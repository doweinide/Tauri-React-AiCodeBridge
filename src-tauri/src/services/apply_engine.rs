//! Apply engine: write/add/delete files with path safety, hash conflict check,
//! and project-local `.history/` snapshots for undo.

use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::{Path, PathBuf};

use super::context_builder::{
    hash_content, new_id, resolve_in_project, resolve_new_path_in_project,
};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ChangeInput {
    /// "add" | "modify" | "delete"
    pub change_type: String,
    /// Relative path inside project
    pub path: String,
    /// New file content (required for add/modify)
    pub new_content: Option<String>,
    /// Content fingerprint when context was created (modify only)
    pub expected_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub change_set_id: String,
    pub applied: Vec<String>,
    pub skipped: Vec<String>,
}

/// Snapshot lives in `<project>/.history/<timestamp>_<id>/`
fn history_root(project_root: &Path) -> PathBuf {
    project_root.join(".history")
}

fn snapshot_dir_name(change_set_id: &str) -> String {
    // Compact UTC-ish timestamp for sortability
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{secs}_{change_set_id}")
}

/// Apply a batch of changes. Creates a `.history/` snapshot first.
pub fn apply_changes(
    _app: &tauri::AppHandle,
    root: &Path,
    changes: &[ChangeInput],
    allow_overwrite_conflict: bool,
) -> Result<ApplyResult, String> {
    if changes.is_empty() {
        return Err("No changes to apply".into());
    }

    let root = root
        .canonicalize()
        .map_err(|e| format!("Cannot resolve project root: {e}"))?;

    // Pre-validate all paths and detect conflicts
    for change in changes {
        // Never allow applying into .history itself
        if change.path.starts_with(".history/") || change.path == ".history" {
            return Err("Cannot modify .history/ snapshot directory".into());
        }
        let abs = if change.change_type == "add" {
            // ADD targets may not exist yet — create parent dirs on write
            resolve_new_path_in_project(&root, &change.path)?
        } else {
            resolve_in_project(&root, &change.path)?
        };
        match change.change_type.as_str() {
            "add" => {
                if change.new_content.is_none() {
                    return Err(format!("ADD missing content: {}", change.path));
                }
                if abs.exists() {
                    return Err(format!("ADD target already exists: {}", change.path));
                }
            }
            "modify" => {
                if change.new_content.is_none() {
                    return Err(format!("MODIFY missing content: {}", change.path));
                }
                if !abs.is_file() {
                    return Err(format!("MODIFY target not found: {}", change.path));
                }
                if let Some(expected) = &change.expected_hash {
                    let current = std::fs::read_to_string(&abs)
                        .map_err(|e| format!("read {}: {e}", change.path))?;
                    let current_hash = hash_content(&current);
                    if &current_hash != expected && !allow_overwrite_conflict {
                        return Err(format!(
                            "CONFLICT:{}:Local file has changed since Context was created.",
                            change.path
                        ));
                    }
                }
            }
            "delete" => {
                if !abs.exists() {
                    return Err(format!("DELETE target not found: {}", change.path));
                }
            }
            other => return Err(format!("Unknown change type: {other}")),
        }
    }

    let change_set_id = new_id();
    let snap_name = snapshot_dir_name(&change_set_id);
    let snapshot_root = history_root(&root).join(&snap_name);
    std::fs::create_dir_all(&snapshot_root).map_err(|e| format!("create snapshot: {e}"))?;

    let mut applied = Vec::new();
    let mut skipped = Vec::new();
    let mut manifest_files: Vec<serde_json::Value> = Vec::new();

    for change in changes {
        let abs = if change.change_type == "add" {
            resolve_new_path_in_project(&root, &change.path)?
        } else {
            resolve_in_project(&root, &change.path)?
        };
        let snapshot_path = snapshot_root.join(&change.path);
        if let Some(parent) = snapshot_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("snapshot parent: {e}"))?;
        }

        match change.change_type.as_str() {
            "add" => {
                let content = change.new_content.as_ref().unwrap();
                if let Some(parent) = abs.parent() {
                    std::fs::create_dir_all(parent)
                        .map_err(|e| format!("create parent for {}: {e}", change.path))?;
                }
                std::fs::write(&abs, content).map_err(|e| format!("write {}: {e}", change.path))?;
                let file_name = abs
                    .file_name()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                let marker_name = format!("{file_name}.__ai_ctx_added__");
                let marker_path = snapshot_path.with_file_name(marker_name);
                std::fs::write(&marker_path, b"").ok();
                manifest_files.push(serde_json::json!({
                    "path": change.path,
                    "operation": "add"
                }));
                applied.push(change.path.clone());
            }
            "modify" => {
                let content = change.new_content.as_ref().unwrap();
                std::fs::copy(&abs, &snapshot_path)
                    .map_err(|e| format!("snapshot {}: {e}", change.path))?;
                std::fs::write(&abs, content).map_err(|e| format!("write {}: {e}", change.path))?;
                manifest_files.push(serde_json::json!({
                    "path": change.path,
                    "operation": "modify"
                }));
                applied.push(change.path.clone());
            }
            "delete" => {
                std::fs::copy(&abs, &snapshot_path)
                    .map_err(|e| format!("snapshot {}: {e}", change.path))?;
                std::fs::remove_file(&abs).map_err(|e| format!("delete {}: {e}", change.path))?;
                manifest_files.push(serde_json::json!({
                    "path": change.path,
                    "operation": "delete"
                }));
                applied.push(change.path.clone());
            }
            _ => skipped.push(change.path.clone()),
        }
    }

    let manifest = serde_json::json!({
        "changeSetId": change_set_id,
        "projectId": root.to_string_lossy(),
        "createdAt": new_id(),
        "applied": applied,
        "files": manifest_files,
    });
    std::fs::write(
        snapshot_root.join("manifest.json"),
        serde_json::to_string_pretty(&manifest).unwrap_or_default(),
    )
    .map_err(|e| format!("write manifest: {e}"))?;

    Ok(ApplyResult {
        change_set_id: snap_name,
        applied,
        skipped,
    })
}

/// Undo a previous apply by snapshot directory name (change set id).
pub fn undo_apply(project_root: &str, snapshot_name: &str) -> Result<Vec<String>, String> {
    let root = PathBuf::from(project_root)
        .canonicalize()
        .map_err(|e| format!("Cannot resolve project root: {e}"))?;
    let snapshot_root = history_root(&root).join(snapshot_name);
    if !snapshot_root.is_dir() {
        return Err(format!("Undo snapshot not found: {snapshot_name}"));
    }

    let mut restored = Vec::new();

    fn walk(dir: &Path, acc: &mut Vec<PathBuf>) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    walk(&path, acc);
                } else {
                    acc.push(path);
                }
            }
        }
    }

    let mut files = Vec::new();
    walk(&snapshot_root, &mut files);

    for snap_file in files {
        let rel = snap_file
            .strip_prefix(&snapshot_root)
            .map_err(|e| format!("strip: {e}"))?
            .to_string_lossy()
            .replace('\\', "/");

        if rel == "manifest.json" {
            continue;
        }

        let file_name = Path::new(&rel)
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        // Newly-added files: delete them on undo
        if let Some(stripped) = file_name.strip_suffix(".__ai_ctx_added__") {
            let dir = Path::new(&rel)
                .parent()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .unwrap_or_default();
            let target_rel = if dir.is_empty() {
                stripped.to_string()
            } else {
                format!("{dir}/{stripped}")
            };
            let target = resolve_in_project(&root, &target_rel)?;
            if target.exists() {
                std::fs::remove_file(&target)
                    .map_err(|e| format!("undo delete {target_rel}: {e}"))?;
                restored.push(target_rel);
            }
            continue;
        }

        // Restore snapshot content (modify/delete undo)
        let target = resolve_in_project(&root, &rel)?;
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        std::fs::copy(&snap_file, &target).map_err(|e| format!("undo restore {rel}: {e}"))?;
        restored.push(rel);
    }

    Ok(restored)
}

/// List snapshot directory names under `<project>/.history/`, newest first.
pub fn list_undo_snapshots(project_root: &str) -> Result<Vec<String>, String> {
    let root = PathBuf::from(project_root);
    let dir = history_root(&root);
    if !dir.is_dir() {
        return Ok(Vec::new());
    }
    let mut ids: Vec<String> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name() {
                    ids.push(name.to_string_lossy().to_string());
                }
            }
        }
    }
    // Newest first by name (timestamp prefix)
    ids.sort();
    ids.reverse();
    Ok(ids)
}

/// Remove all undo snapshots under `<project>/.history/`.
/// Used when starting a new AI exchange cycle so old undo state cannot be applied
/// against a fresh parse.
pub fn clear_project_history(project_root: &str) -> Result<u32, String> {
    let root = PathBuf::from(project_root)
        .canonicalize()
        .map_err(|e| format!("Cannot resolve project root: {e}"))?;
    let dir = history_root(&root);
    if !dir.is_dir() {
        return Ok(0);
    }

    let mut removed = 0u32;
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name == "." || name == ".." {
                continue;
            }
            if path.is_dir() {
                match std::fs::remove_dir_all(&path) {
                    Ok(()) => removed += 1,
                    Err(e) => {
                        log::warn!("Failed to remove history snapshot {name}: {e}");
                    }
                }
            } else {
                // stray file in .history/
                let _ = std::fs::remove_file(&path);
            }
        }
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn path_safety() {
        let dir = std::env::temp_dir().join("ai-apply-test");
        std::fs::create_dir_all(&dir).unwrap();
        assert!(resolve_in_project(&dir, "../../etc/passwd").is_err());
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn clears_history_snapshots() {
        let dir = std::env::temp_dir().join(format!(
            "ai-hist-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(dir.join(".history/111_a")).unwrap();
        std::fs::create_dir_all(dir.join(".history/222_b")).unwrap();
        std::fs::write(dir.join(".history/111_a/x.ts"), b"a").unwrap();
        let n = clear_project_history(&dir.to_string_lossy()).unwrap();
        assert_eq!(n, 2);
        assert!(!dir.join(".history/111_a").exists());
        std::fs::remove_dir_all(&dir).ok();
    }
}
