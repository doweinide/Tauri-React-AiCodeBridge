//! Project open / recent / scan commands.

use std::path::PathBuf;

use crate::services::recent_projects::{self, RecentProject};
use crate::services::scanner::{self, ScannedProject};

/// Open a local project directory and scan its file tree.
/// `extra_ignore` marks matching paths as ignored (shown disabled, excluded from Context).
#[tauri::command]
#[specta::specta]
pub async fn open_project(
    app: tauri::AppHandle,
    path: String,
    #[allow(clippy::ptr_arg)] extra_ignore: Vec<String>,
) -> Result<ScannedProject, String> {
    if path.trim().is_empty() {
        return Err("Project path is empty".into());
    }
    let root = PathBuf::from(&path);
    let scanned = scanner::scan_project_with_ignores(&root, &extra_ignore)?;
    recent_projects::touch_recent(&app, &scanned.name, &scanned.root_path)?;
    log::info!(
        "Opened project {} ({} files)",
        scanned.name,
        scanned.file_count
    );
    Ok(scanned)
}

/// Re-scan an already known project path.
#[tauri::command]
#[specta::specta]
pub async fn rescan_project(
    path: String,
    extra_ignore: Vec<String>,
) -> Result<ScannedProject, String> {
    let root = PathBuf::from(&path);
    scanner::scan_project_with_ignores(&root, &extra_ignore)
}

/// List recently opened projects.
#[tauri::command]
#[specta::specta]
pub async fn get_recent_projects(app: tauri::AppHandle) -> Result<Vec<RecentProject>, String> {
    Ok(recent_projects::list_recent(&app, 20))
}

/// Validate that a path is an existing directory.
#[tauri::command]
#[specta::specta]
pub async fn validate_project_path(path: String) -> Result<bool, String> {
    Ok(PathBuf::from(&path).is_dir())
}
