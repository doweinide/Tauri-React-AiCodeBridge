//! Context text builder and file content reader.

use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::{Path, PathBuf};

use super::scanner::ProjectNode;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub hash: String,
    pub size: f64,
}

/// Structured context payload. Frontend serializer turns this into
/// protocol ProjectContext JSON — Rust does not emit Markdown.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContextBuildResult {
    pub project_name: String,
    /// Pruned tree containing only structure-selected files.
    pub structure: ProjectNode,
    /// File contents for content-selected paths (independent of structure).
    pub files: Vec<FileContent>,
    pub mode: String,
    pub structure_file_count: u32,
    pub content_file_count: u32,
    pub total_chars: u32,
    pub estimated_tokens: u32,
    pub project_total_bytes: f64,
    pub project_total_tokens: u32,
    pub reduction_percent: f64,
}

/// Prune the project tree to only include files whose paths are in `keep`.
/// Directories are kept only if they still have children after pruning.
pub fn prune_tree_to_files(
    node: &ProjectNode,
    keep: &std::collections::HashSet<String>,
) -> Option<ProjectNode> {
    if node.node_type == "file" {
        return if keep.contains(&node.path) {
            Some(node.clone())
        } else {
            None
        };
    }

    let mut children = Vec::new();
    for child in node.children.as_deref().unwrap_or(&[]) {
        if let Some(pruned) = prune_tree_to_files(child, keep) {
            children.push(pruned);
        }
    }

    if children.is_empty() {
        // Keep root always; keep empty dir if explicitly selected (dir path in keep)
        if node.path.is_empty() || keep.contains(&node.path) {
            return Some(ProjectNode {
                name: node.name.clone(),
                path: node.path.clone(),
                node_type: node.node_type.clone(),
                size: node.size,
                ignored: node.ignored,
                children: Some(Vec::new()),
            });
        }
        return None;
    }

    Some(ProjectNode {
        name: node.name.clone(),
        path: node.path.clone(),
        node_type: node.node_type.clone(),
        size: node.size,
        ignored: node.ignored,
        children: Some(children),
    })
}

/// Count files under a tree node.
pub fn count_files(node: &ProjectNode) -> u32 {
    if node.node_type == "file" {
        return 1;
    }
    node.children
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .map(count_files)
        .sum()
}

/// Ensure a relative path stays inside the project root after join.
/// The target path (or a parent) must already exist so it can be canonicalized.
pub fn resolve_in_project(root: &Path, rel: &str) -> Result<PathBuf, String> {
    validate_rel_path(rel)?;
    let joined = root.join(rel);
    let canonical = joined
        .canonicalize()
        .map_err(|e| format!("Cannot resolve {rel}: {e}"))?;
    let root_canonical = root
        .canonicalize()
        .map_err(|e| format!("Cannot resolve project root: {e}"))?;

    if !canonical.starts_with(&root_canonical) {
        return Err(format!("Path escapes project root: {rel}"));
    }
    Ok(canonical)
}

/// Resolve a path that may not exist yet (ADD): validate the deepest existing
/// ancestor stays under project root, then return the joined absolute path.
pub fn resolve_new_path_in_project(root: &Path, rel: &str) -> Result<PathBuf, String> {
    validate_rel_path(rel)?;

    let root_canonical = root
        .canonicalize()
        .map_err(|e| format!("Cannot resolve project root: {e}"))?;

    let joined = root_canonical.join(rel);

    // Walk up until we find an existing ancestor to canonicalize for escape checks
    let mut ancestor = joined.as_path();
    let mut missing_suffix: Vec<std::ffi::OsString> = Vec::new();
    loop {
        if ancestor.exists() {
            let canonical_ancestor = ancestor
                .canonicalize()
                .map_err(|e| format!("Cannot resolve parent of {rel}: {e}"))?;
            if !canonical_ancestor.starts_with(&root_canonical) {
                return Err(format!("Path escapes project root: {rel}"));
            }
            let mut full = canonical_ancestor;
            for part in missing_suffix.iter().rev() {
                full.push(part);
            }
            // Extra safety: final path still under root
            if !full.starts_with(&root_canonical) {
                return Err(format!("Path escapes project root: {rel}"));
            }
            return Ok(full);
        }
        match ancestor.parent() {
            Some(parent) => {
                if let Some(name) = ancestor.file_name() {
                    missing_suffix.push(name.to_os_string());
                }
                ancestor = parent;
            }
            None => return Err(format!("Cannot resolve {rel}: no existing parent")),
        }
    }
}

fn validate_rel_path(rel: &str) -> Result<(), String> {
    if rel.is_empty() {
        return Err("Empty path".into());
    }
    if rel.contains("..") || Path::new(rel).is_absolute() {
        return Err(format!("Path escapes project root: {rel}"));
    }
    if rel.starts_with('/') || rel.starts_with('\\') {
        return Err(format!("Absolute paths not allowed: {rel}"));
    }
    if rel.chars().nth(1) == Some(':') {
        return Err(format!("Absolute paths not allowed: {rel}"));
    }
    Ok(())
}

/// Stable FNV-1a 64 content fingerprint for external-change detection.
pub fn hash_content(content: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in content.as_bytes() {
        hash ^= u64::from(*b);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("fnv1a-{hash:016x}-{}", content.len())
}

/// Collect all file paths under a tree node.
pub fn collect_file_paths(node: &ProjectNode, acc: &mut Vec<String>) {
    if node.node_type == "file" {
        acc.push(node.path.clone());
        return;
    }
    if let Some(children) = &node.children {
        for c in children {
            collect_file_paths(c, acc);
        }
    }
}

/// Read selected files from disk with content + hash.
pub fn read_files(root: &Path, paths: &[String]) -> Result<Vec<FileContent>, String> {
    let mut out = Vec::with_capacity(paths.len());
    for rel in paths {
        let abs = resolve_in_project(root, rel)?;
        if !abs.is_file() {
            return Err(format!("Not a file: {rel}"));
        }
        let content =
            std::fs::read_to_string(&abs).map_err(|e| format!("Failed to read {rel}: {e}"))?;
        let size = content.len() as f64;
        let hash = hash_content(&content);
        out.push(FileContent {
            path: rel.clone(),
            content,
            hash,
            size,
        });
    }
    Ok(out)
}

pub fn estimate_tokens(chars: usize) -> u32 {
    chars.div_ceil(4) as u32
}

pub fn new_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("cs_{nanos:x}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_path_escape() {
        let dir = std::env::temp_dir().join("ai-ctx-test-escape");
        std::fs::create_dir_all(&dir).unwrap();
        assert!(resolve_in_project(&dir, "../etc/passwd").is_err());
        assert!(resolve_in_project(&dir, "/etc/passwd").is_err());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn resolves_new_path_under_project() {
        let dir = std::env::temp_dir().join(format!(
            "ai-ctx-new-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(dir.join("packages")).unwrap();
        let resolved =
            resolve_new_path_in_project(&dir, "packages/three-runtime/package.json").unwrap();
        assert!(resolved.ends_with("packages/three-runtime/package.json"));
        assert!(resolved.starts_with(dir.canonicalize().unwrap()));
        assert!(resolve_new_path_in_project(&dir, "../evil.ts").is_err());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn hash_is_stable() {
        assert_eq!(hash_content("hello"), hash_content("hello"));
        assert_ne!(hash_content("hello"), hash_content("world"));
    }

    #[test]
    fn prunes_structure_to_selected_files_only() {
        use std::collections::HashSet;

        let file = |name: &str, path: &str| ProjectNode {
            name: name.into(),
            path: path.into(),
            node_type: "file".into(),
            size: Some(1.0),
            ignored: false,
            children: None,
        };
        let dir = |name: &str, path: &str, children: Vec<ProjectNode>| ProjectNode {
            name: name.into(),
            path: path.into(),
            node_type: "dir".into(),
            size: None,
            ignored: false,
            children: Some(children),
        };

        let tree = dir(
            "app",
            "",
            vec![
                dir(
                    "auth",
                    "src/auth",
                    vec![
                        file("login.ts", "src/auth/login.ts"),
                        file("token.ts", "src/auth/token.ts"),
                    ],
                ),
                dir(
                    "payment",
                    "src/payment",
                    vec![file("pay.ts", "src/payment/pay.ts")],
                ),
            ],
        );

        let mut keep = HashSet::new();
        keep.insert("src/auth/login.ts".to_string());
        let pruned = prune_tree_to_files(&tree, &keep).unwrap();

        fn flatten(node: &ProjectNode) -> Vec<String> {
            let mut out = Vec::new();
            if node.node_type == "file" {
                out.push(node.path.clone());
            }
            for c in node.children.as_deref().unwrap_or(&[]) {
                out.extend(flatten(c));
            }
            out
        }

        let flat = flatten(&pruned);
        assert!(flat.contains(&"src/auth/login.ts".to_string()));
        assert!(!flat.iter().any(|p| p.contains("payment")));
        assert!(!flat.contains(&"src/auth/token.ts".to_string()));
    }
}
