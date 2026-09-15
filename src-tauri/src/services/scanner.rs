//! Project directory scanner with default + .aiignore + user ignore rules.
//! Uses std::fs only (no walkdir/ignore) for a zero-extra-dep MVP.

use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

/// Default directory names always excluded from scans (too large / never useful).
const DEFAULT_DIR_IGNORES: &[&str] = &[
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "target",
    ".next",
    ".turbo",
    ".venv",
    "venv",
    "__pycache__",
    ".DS_Store",
    ".history",
];

const DEFAULT_SENSITIVE_BASENAMES: &[&str] = &[".env", "credentials.json"];
const DEFAULT_SENSITIVE_PREFIXES: &[&str] = &[".env."];
const DEFAULT_SENSITIVE_SUFFIXES: &[&str] = &[".key", ".pem"];
const DEFAULT_SENSITIVE_CONTAINS: &[&str] = &["credentials.", "secrets."];

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectNode {
    pub name: String,
    /// Path relative to project root, using forward slashes.
    pub path: String,
    pub node_type: String, // "file" | "dir"
    pub size: Option<f64>,
    /// Excluded from Context; still listed in the tree (disabled in UI).
    #[serde(default)]
    pub ignored: bool,
    pub children: Option<Vec<ProjectNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScannedProject {
    pub name: String,
    pub root_path: String,
    pub tree: ProjectNode,
    pub file_count: u32,
    pub total_bytes: f64,
}

pub fn is_sensitive_basename(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    if DEFAULT_SENSITIVE_BASENAMES.iter().any(|b| lower == *b) {
        return true;
    }
    if DEFAULT_SENSITIVE_PREFIXES
        .iter()
        .any(|p| lower.starts_with(p))
    {
        return true;
    }
    if DEFAULT_SENSITIVE_SUFFIXES
        .iter()
        .any(|s| lower.ends_with(s))
    {
        return true;
    }
    if DEFAULT_SENSITIVE_CONTAINS.iter().any(|c| lower.contains(c)) {
        return true;
    }
    false
}

fn is_default_ignored_dir(name: &str) -> bool {
    DEFAULT_DIR_IGNORES.contains(&name)
}

fn load_aiignore(root: &Path) -> Vec<String> {
    let path = root.join(".aiignore");
    let Ok(content) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    content
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .map(str::to_string)
        .collect()
}

fn has_glob_meta(s: &str) -> bool {
    s.contains('*') || s.contains('?') || s.contains('[')
}

/// Match one glob segment: `*` (no `/`), `?` (one char, no `/`), `[...]`.
fn match_segment(pattern: &str, text: &str) -> bool {
    let p: Vec<char> = pattern.chars().collect();
    let t: Vec<char> = text.chars().collect();
    let (mut pi, mut ti) = (0usize, 0usize);
    let (mut star, mut backtrack) = (None::<usize>, 0usize);

    while ti < t.len() {
        if pi < p.len() {
            match p[pi] {
                '?' => {
                    pi += 1;
                    ti += 1;
                    continue;
                }
                '*' => {
                    star = Some(pi);
                    backtrack = ti;
                    pi += 1;
                    continue;
                }
                '[' => {
                    if let Some((ok, next_pi)) = match_char_class(&p, pi, t[ti]) {
                        if ok {
                            pi = next_pi;
                            ti += 1;
                            continue;
                        }
                    } else {
                        // Unclosed class: treat as literal '['
                        if t[ti] == '[' {
                            pi += 1;
                            ti += 1;
                            continue;
                        }
                    }
                }
                c => {
                    if c == t[ti] {
                        pi += 1;
                        ti += 1;
                        continue;
                    }
                }
            }
        }
        if let Some(sp) = star {
            pi = sp + 1;
            backtrack += 1;
            ti = backtrack;
            continue;
        }
        return false;
    }
    while pi < p.len() && p[pi] == '*' {
        pi += 1;
    }
    pi == p.len()
}

/// Returns (matched, next_pattern_index) when class is well-formed.
fn match_char_class(p: &[char], start: usize, ch: char) -> Option<(bool, usize)> {
    let mut i = start + 1;
    let negated = i < p.len() && (p[i] == '!' || p[i] == '^');
    if negated {
        i += 1;
    }
    let mut matched = false;
    let mut first = true;
    while i < p.len() {
        if p[i] == ']' && !first {
            return Some((matched != negated, i + 1));
        }
        first = false;
        if p[i] == '\\' && i + 1 < p.len() {
            if p[i + 1] == ch {
                matched = true;
            }
            i += 2;
            continue;
        }
        // range a-z
        if i + 2 < p.len() && p[i + 1] == '-' && p[i + 2] != ']' {
            let (lo, hi) = (p[i], p[i + 2]);
            if ch >= lo && ch <= hi {
                matched = true;
            }
            i += 3;
            continue;
        }
        if p[i] == ch {
            matched = true;
        }
        i += 1;
    }
    None
}

/// Match full relative path against a glob. `**` crosses `/`.
fn match_glob_path(pattern: &str, path: &str) -> bool {
    let pat: Vec<&str> = pattern.split('/').collect();
    let parts: Vec<&str> = path.split('/').collect();
    glob_match_parts(&pat, &parts)
}

fn glob_match_parts(pat: &[&str], parts: &[&str]) -> bool {
    if pat.is_empty() {
        return parts.is_empty();
    }
    if pat[0] == "**" {
        // `**` matches zero or more path segments
        let rest = &pat[1..];
        for skip in 0..=parts.len() {
            if glob_match_parts(rest, &parts[skip..]) {
                return true;
            }
        }
        return false;
    }
    if parts.is_empty() {
        return false;
    }
    match_segment(pat[0], parts[0]) && glob_match_parts(&pat[1..], &parts[1..])
}

/// Match a single ignore rule (path prefix or glob) against a relative path.
///
/// Supported:
/// - Plain path: `src/secrets` also ignores everything under it
/// - Glob: `*`, `?`, `[...]`, `**` (cross directories)
/// - Pattern without `/` matches the basename anywhere (gitignore-like)
/// - Trailing `/` is treated as a directory prefix
fn rule_matches_path(rule: &str, rel_path: &str) -> bool {
    let rule = rule.trim();
    if rule.is_empty() {
        return false;
    }
    let dir_only = rule.ends_with('/');
    let rule = rule.trim_end_matches('/');
    if rule.is_empty() {
        return false;
    }
    let rule = rule.trim_start_matches("./");
    let path = rel_path.trim_matches('/');

    // Basename-only patterns: `*.env`, `credentials.*`
    if !rule.contains('/') {
        let basename = path.rsplit('/').next().unwrap_or(path);
        if has_glob_meta(rule) {
            return match_segment(rule, basename);
        }
        if basename == rule {
            return true;
        }
        // Also allow legacy exact path / ancestor prefix for plain names
        // (e.g. rule `docs` still covers `docs` and `docs/a.md`)
        return path == rule || path.starts_with(&format!("{rule}/"));
    }

    // Glob with `/`
    if has_glob_meta(rule) {
        // Match the path itself, or any ancestor (ignore whole matched subtree)
        let mut current = path;
        loop {
            if match_glob_path(rule, current) {
                return true;
            }
            match current.rfind('/') {
                Some(idx) => current = &current[..idx],
                None => break,
            }
        }
        let _ = dir_only;
        return false;
    }

    // Plain path with `/`: exact or ancestor prefix
    path == rule || path.starts_with(&format!("{rule}/"))
}

fn matches_rule_list(rel_path: &str, name: &str, rules: &[String]) -> bool {
    for rule in rules {
        let rule = rule.trim().trim_end_matches('/');
        if rule.is_empty() {
            continue;
        }
        if let Some(prefix) = rule.strip_suffix('*') {
            if !prefix.is_empty() && (rel_path.starts_with(prefix) || name.starts_with(prefix)) {
                return true;
            }
            continue;
        }
        if let Some(suffix) = rule.strip_prefix('*') {
            if !suffix.is_empty() && (rel_path.ends_with(suffix) || name.ends_with(suffix)) {
                return true;
            }
            continue;
        }
        if rel_path == rule
            || rel_path.starts_with(&format!("{rule}/"))
            || name == rule
            || rel_path.ends_with(&format!("/{rule}"))
        {
            return true;
        }
    }
    false
}

/// Match user ignore rules: path prefixes and Glob patterns.
fn matches_custom_ignore(rel_path: &str, extra: &[String]) -> bool {
    extra.iter().any(|rule| rule_matches_path(rule, rel_path))
}

#[derive(Default)]
struct DirBuilder {
    /// (name, size, ignored)
    files: Vec<(String, f64, bool)>,
    /// name → (builder, ignored_dir_flag)
    dirs: BTreeMap<String, (DirBuilder, bool)>,
}

struct WalkCtx<'a> {
    aiignore: &'a [String],
    extra_ignore: &'a [String],
}

fn walk_dir(
    abs: &Path,
    rel: &str,
    ctx: &WalkCtx,
    builder: &mut DirBuilder,
    file_count: &mut u32,
    total_bytes: &mut f64,
) -> Result<(), String> {
    let entries = std::fs::read_dir(abs).map_err(|e| format!("read_dir {}: {e}", abs.display()))?;
    let mut names: Vec<_> = entries.flatten().collect();
    names.sort_by_key(|e| e.file_name());

    for entry in names {
        let name = entry.file_name().to_string_lossy().to_string();
        let child_rel = if rel.is_empty() {
            name.clone()
        } else {
            format!("{rel}/{name}")
        };

        let file_type = entry.file_type().map_err(|e| format!("file_type: {e}"))?;

        if file_type.is_dir() {
            if is_default_ignored_dir(&name) {
                continue;
            }
            let ignored = matches_custom_ignore(&child_rel, ctx.extra_ignore)
                || matches_rule_list(&child_rel, &name, ctx.aiignore);
            let child = builder
                .dirs
                .entry(name.clone())
                .or_insert_with(|| (DirBuilder::default(), ignored));
            if ignored {
                child.1 = true;
            }
            walk_dir(
                &entry.path(),
                &child_rel,
                ctx,
                &mut child.0,
                file_count,
                total_bytes,
            )?;
        } else if file_type.is_file() {
            let ignored = is_sensitive_basename(&name)
                || matches_custom_ignore(&child_rel, ctx.extra_ignore)
                || matches_rule_list(&child_rel, &name, ctx.aiignore);
            let size = entry.metadata().map(|m| m.len() as f64).unwrap_or(0.0);
            *file_count += 1;
            *total_bytes += size;
            builder.files.push((name, size, ignored));
        }
    }
    Ok(())
}

fn build_node(name: &str, path: &str, builder: DirBuilder, ignored: bool) -> ProjectNode {
    let mut children: Vec<ProjectNode> = Vec::new();

    for (dir_name, (dir_builder, dir_ignored)) in builder.dirs {
        let child_path = if path.is_empty() {
            dir_name.clone()
        } else {
            format!("{path}/{dir_name}")
        };
        children.push(build_node(&dir_name, &child_path, dir_builder, dir_ignored));
    }

    for (file_name, size, file_ignored) in builder.files {
        let child_path = if path.is_empty() {
            file_name.clone()
        } else {
            format!("{path}/{file_name}")
        };
        children.push(ProjectNode {
            name: file_name,
            path: child_path,
            node_type: "file".into(),
            size: Some(size),
            ignored: file_ignored,
            children: None,
        });
    }

    children.sort_by(|a, b| {
        let a_dir = a.node_type == "dir";
        let b_dir = b.node_type == "dir";
        b_dir.cmp(&a_dir).then_with(|| a.name.cmp(&b.name))
    });

    ProjectNode {
        name: name.to_string(),
        path: path.to_string(),
        node_type: "dir".into(),
        size: None,
        ignored,
        children: Some(children),
    }
}

/// Scan a project (no extra user ignore prefixes).
pub fn scan_project(root: &Path) -> Result<ScannedProject, String> {
    scan_project_with_ignores(root, &[])
}

/// Scan a project. `extra_ignores` are relative path prefixes or Glob patterns
/// that should appear as `ignored: true` (disabled in UI, excluded from Context).
pub fn scan_project_with_ignores(
    root: &Path,
    extra_ignores: &[String],
) -> Result<ScannedProject, String> {
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", root.display()));
    }

    let root: PathBuf = root
        .canonicalize()
        .map_err(|e| format!("Cannot resolve project path: {e}"))?;

    let name = root
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "project".to_string());

    let aiignore = load_aiignore(&root);
    let ctx = WalkCtx {
        aiignore: &aiignore,
        extra_ignore: extra_ignores,
    };
    let mut root_builder = DirBuilder::default();
    let mut file_count = 0u32;
    let mut total_bytes = 0f64;

    walk_dir(
        &root,
        "",
        &ctx,
        &mut root_builder,
        &mut file_count,
        &mut total_bytes,
    )?;

    let tree = build_node(&name, "", root_builder, false);

    Ok(ScannedProject {
        name,
        root_path: root.to_string_lossy().to_string(),
        tree,
        file_count,
        total_bytes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_project() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "ai-context-scan-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(dir.join("src/auth")).unwrap();
        fs::create_dir_all(dir.join("docs")).unwrap();
        fs::create_dir_all(dir.join("node_modules/pkg")).unwrap();
        fs::write(dir.join("src/auth/login.ts"), "export const a = 1;\n").unwrap();
        fs::write(dir.join("docs/a.md"), "x\n").unwrap();
        fs::write(dir.join("package.json"), "{}\n").unwrap();
        fs::write(dir.join(".env"), "SECRET=1\n").unwrap();
        fs::write(dir.join("node_modules/pkg/index.js"), "x\n").unwrap();
        dir
    }

    fn find_node<'a>(node: &'a ProjectNode, path: &str) -> Option<&'a ProjectNode> {
        if node.path == path {
            return Some(node);
        }
        for c in node.children.as_deref().unwrap_or(&[]) {
            if let Some(n) = find_node(c, path) {
                return Some(n);
            }
        }
        None
    }

    #[test]
    fn scan_marks_ignored_and_skips_hard_dirs() {
        let dir = temp_project();
        let scanned = scan_project_with_ignores(&dir, &["docs".into()]).unwrap();
        let docs = find_node(&scanned.tree, "docs").unwrap();
        assert!(docs.ignored);
        let doc_file = find_node(&scanned.tree, "docs/a.md").unwrap();
        assert!(doc_file.ignored);
        let login = find_node(&scanned.tree, "src/auth/login.ts").unwrap();
        assert!(!login.ignored);
        // hard ignore still hidden
        assert!(find_node(&scanned.tree, "node_modules").is_none());
        // sensitive file shown but ignored
        let env = find_node(&scanned.tree, ".env");
        assert!(env.is_some_and(|n| n.ignored));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn sensitive_names() {
        assert!(is_sensitive_basename(".env"));
        assert!(is_sensitive_basename(".env.local"));
        assert!(is_sensitive_basename("server.key"));
        assert!(is_sensitive_basename("cert.pem"));
        assert!(is_sensitive_basename("credentials.json"));
        assert!(!is_sensitive_basename("login.ts"));
    }

    #[test]
    fn glob_ignore_rules() {
        let dir = temp_project();
        fs::write(dir.join("src/auth/auth.test.ts"), "x\n").unwrap();
        fs::write(dir.join("secret.env"), "x\n").unwrap();
        let rules = vec![
            "**/*.test.ts".to_string(),
            "src/**/internal/**".to_string(),
            "*.env".to_string(),
        ];
        let scanned = scan_project_with_ignores(&dir, &rules).unwrap();
        assert!(
            find_node(&scanned.tree, "src/auth/auth.test.ts")
                .unwrap()
                .ignored
        );
        assert!(find_node(&scanned.tree, "src/auth/login.ts")
            .unwrap()
            .ignored
            == false);
        assert!(find_node(&scanned.tree, "secret.env").unwrap().ignored);
        assert!(find_node(&scanned.tree, "docs/a.md").unwrap().ignored == false);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn rule_matches_path_cases() {
        assert!(rule_matches_path("src/secrets", "src/secrets"));
        assert!(rule_matches_path("src/secrets", "src/secrets/key.pem"));
        assert!(rule_matches_path("*.env", "a.env"));
        assert!(rule_matches_path("*.env", "config/prod.env"));
        assert!(rule_matches_path("**/*.test.ts", "src/a/b.test.ts"));
        assert!(rule_matches_path("src/**/internal/**", "src/x/internal/y.ts"));
        assert!(rule_matches_path("docs/", "docs/a.md"));
        assert!(!rule_matches_path("src/secrets", "src/secrets2"));
        assert!(!rule_matches_path("**/*.test.ts", "src/a.ts"));
    }
}
