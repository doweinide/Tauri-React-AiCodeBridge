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

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ContextBuildResult {
    pub text: String,
    pub files: Vec<FileContent>,
    pub file_count: u32,
    pub total_chars: u32,
    pub estimated_tokens: u32,
    pub project_total_bytes: f64,
    pub project_total_tokens: u32,
    pub reduction_percent: f64,
}

/// Ensure a relative path stays inside the project root after join.
pub fn resolve_in_project(root: &Path, rel: &str) -> Result<PathBuf, String> {
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

/// Stable FNV-1a 64 content fingerprint for external-change detection.
/// Not cryptographic — only used to detect local edits between context create and apply.
pub fn hash_content(content: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in content.as_bytes() {
        hash ^= u64::from(*b);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("fnv1a-{hash:016x}-{}", content.len())
}

/// Render directory tree as structure text (like `tree` output).
pub fn structure_text(root_name: &str, tree: &ProjectNode) -> String {
    let mut out = format!("{root_name}/\n");
    if let Some(children) = &tree.children {
        render_children(children, "", &mut out);
    }
    out
}

fn render_children(children: &[ProjectNode], prefix: &str, out: &mut String) {
    let n = children.len();
    for (i, child) in children.iter().enumerate() {
        let last = i == n - 1;
        let branch = if last { "└── " } else { "├── " };
        let name = if child.node_type == "dir" {
            format!("{}/", child.name)
        } else {
            child.name.clone()
        };
        out.push_str(&format!("{prefix}{branch}{name}\n"));
        if child.node_type == "dir" {
            if let Some(kids) = &child.children {
                let next_prefix = format!("{prefix}{}", if last { "    " } else { "│   " });
                render_children(kids, &next_prefix, out);
            }
        }
    }
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

/// Build context text from structure + optional file contents.
pub fn build_context_text(
    project_name: &str,
    tree: &ProjectNode,
    files: &[FileContent],
    include_contents: bool,
) -> String {
    let structure = structure_text(project_name, tree);
    if !include_contents {
        return format!("## 项目结构\n\n{structure}");
    }
    let mut out = format!("## 项目结构\n\n{structure}\n## 文件内容\n");
    for f in files {
        out.push_str(&format!(
            "\n### FILE: {}\n```\n{}\n```\n",
            f.path, f.content
        ));
    }
    out
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
    fn structure_renders_tree() {
        let tree = ProjectNode {
            name: "app".into(),
            path: "".into(),
            node_type: "dir".into(),
            size: None,
            children: Some(vec![ProjectNode {
                name: "src".into(),
                path: "src".into(),
                node_type: "dir".into(),
                size: None,
                children: Some(vec![ProjectNode {
                    name: "a.ts".into(),
                    path: "src/a.ts".into(),
                    node_type: "file".into(),
                    size: Some(10.0),
                    children: None,
                }]),
            }]),
        };
        let text = structure_text("app", &tree);
        assert!(text.contains("app/"));
        assert!(text.contains("src/"));
        assert!(text.contains("a.ts"));
    }

    #[test]
    fn hash_is_stable() {
        assert_eq!(hash_content("hello"), hash_content("hello"));
        assert_ne!(hash_content("hello"), hash_content("world"));
    }
}
