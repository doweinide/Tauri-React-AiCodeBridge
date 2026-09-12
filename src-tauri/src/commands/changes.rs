//! Change apply / undo commands.

use std::path::PathBuf;

use crate::services::apply_engine::{
    apply_changes, list_undo_snapshots, undo_apply, ApplyResult, ChangeInput,
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

/// Undo a previous apply by change set id.
#[tauri::command]
#[specta::specta]
pub async fn undo_ai_changes(
    app: tauri::AppHandle,
    change_set_id: String,
) -> Result<Vec<String>, String> {
    undo_apply(&app, &change_set_id)
}

/// List undo snapshots available for a project.
#[tauri::command]
#[specta::specta]
pub async fn list_undo_change_sets(
    app: tauri::AppHandle,
    root_path: String,
) -> Result<Vec<String>, String> {
    list_undo_snapshots(&app, &root_path)
}
