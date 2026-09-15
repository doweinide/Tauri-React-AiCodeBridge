//! Change apply / undo commands. Snapshots live in `<project>/.history/`.

use std::path::PathBuf;

use crate::services::apply_engine::{
    apply_changes, clear_project_history as clear_history_dir, list_undo_snapshots, undo_apply,
    ApplyResult, ChangeInput,
};

/// Apply parsed AI changes to the local project.
#[tauri::command]
#[specta::specta]
pub async fn apply_ai_changes(
    app: tauri::AppHandle,
    root_path: String,
    changes: Vec<ChangeInput>,
    allow_overwrite_conflict: bool,
) -> Result<ApplyResult, String> {
    let root = PathBuf::from(&root_path);
    apply_changes(&app, &root, &changes, allow_overwrite_conflict)
}

/// Undo a previous apply by snapshot name (under project `.history/`).
#[tauri::command]
#[specta::specta]
pub async fn undo_ai_changes(
    root_path: String,
    change_set_id: String,
) -> Result<Vec<String>, String> {
    undo_apply(&root_path, &change_set_id)
}

/// List undo snapshots available for a project (`.history/` folders).
#[tauri::command]
#[specta::specta]
pub async fn list_undo_change_sets(root_path: String) -> Result<Vec<String>, String> {
    list_undo_snapshots(&root_path)
}

/// Clear all `.history/` undo snapshots for a project (new AI parse cycle).
#[tauri::command]
#[specta::specta]
pub async fn clear_project_history(root_path: String) -> Result<u32, String> {
    clear_history_dir(&root_path)
}
