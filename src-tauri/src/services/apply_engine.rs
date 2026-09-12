//! Apply engine: write/add/delete files with path safety, hash conflict check, undo snapshots.

use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::{Path, PathBuf};

use super::context_builder::{hash_content, new_id, resolve_in_project};

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

fn undo_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir: {e}"))?
        .join("undo");
    std::fs::create_dir_all(&dir).map_err(|e| format!("create undo dir: {e}"))?;
    Ok(dir)
}

/// Apply a batch of changes. Creates an undo snapshot first.
pub fn apply_changes(
    app: &tauri::AppHandle,
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
        let abs = resolve_in_project(&root, &change.path)?;
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
    let snapshot_root = undo_dir(app)?.join(&change_set_id);
    std::fs::create_dir_all(&snapshot_root).map_err(|e| format!("create snapshot: {e}"))?;

    let mut applied = Vec::new();
    let mut skipped = Vec::new();

    for change in changes {
        let abs = resolve_in_project(&root, &change.path)?;
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
                // Marker filename: "<file>.__ai_ctx_added__"
                let file_name = abs
                    .file_name()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                let marker_name = format!("{file_name}.__ai_ctx_added__");
                let marker_path = snapshot_path.with_file_name(marker_name);
                std::fs::write(&marker_path, b"").ok();
                applied.push(change.path.clone());
            }
            "modify" => {
                let content = change.new_content.as_ref().unwrap();
                std::fs::copy(&abs, &snapshot_path)
                    .map_err(|e| format!("snapshot {}: {e}", change.path))?;
                std::fs::write(&abs, content).map_err(|e| format!("write {}: {e}", change.path))?;
                applied.push(change.path.clone());
            }
            "delete" => {
                std::fs::copy(&abs, &snapshot_path)
                    .map_err(|e| format!("snapshot {}: {e}", change.path))?;
                std::fs::remove_file(&abs).map_err(|e| format!("delete {}: {e}", change.path))?;
                applied.push(change.path.clone());
            }
            _ => skipped.push(change.path.clone()),
        }
    }

    let meta = serde_json::json!({
        "projectId": root.to_string_lossy(),
        "createdAt": new_id(),
        "applied": applied,
    });
    std::fs::write(
        snapshot_root.join("meta.json"),
        serde_json::to_string_pretty(&meta).unwrap_or_default(),
    )
    .ok();

    Ok(ApplyResult {
        change_set_id,
        applied,
        skipped,
    })
}

/// Undo a previous apply by change set id.
pub fn undo_apply(app: &tauri::AppHandle, change_set_id: &str) -> Result<Vec<String>, String> {
    let snapshot_root = undo_dir(app)?.join(change_set_id);
    if !snapshot_root.is_dir() {
        return Err(format!("Undo snapshot not found: {change_set_id}"));
    }

    let meta_path = snapshot_root.join("meta.json");
    let meta: serde_json::Value = std::fs::read_to_string(&meta_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(serde_json::json!({}));

    let project_root = meta
        .get("projectId")
        .and_then(|v| v.as_str())
        .map(PathBuf::from)
        .ok_or_else(|| "Undo snapshot missing project id".to_string())?;

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

        if rel == "meta.json" {
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
            let target = resolve_in_project(&project_root, &target_rel)?;
            if target.exists() {
                std::fs::remove_file(&target)
                    .map_err(|e| format!("undo delete {target_rel}: {e}"))?;
                restored.push(target_rel);
            }
            continue;
        }

        // Restore snapshot content (modify/delete undo)
        let target = resolve_in_project(&project_root, &rel)?;
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        std::fs::copy(&snap_file, &target).map_err(|e| format!("undo restore {rel}: {e}"))?;
        restored.push(rel);
    }

    Ok(restored)
}

/// List undo snapshot ids for a project.
pub fn list_undo_snapshots(
    app: &tauri::AppHandle,
    project_root: &str,
) -> Result<Vec<String>, String> {
    let dir = undo_dir(app)?;
    let mut ids = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let meta_path = path.join("meta.json");
            if let Ok(meta) = std::fs::read_to_string(&meta_path) {
                if meta.contains(project_root) {
                    if let Some(id) = path.file_name() {
                        ids.push(id.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    Ok(ids)
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
}
