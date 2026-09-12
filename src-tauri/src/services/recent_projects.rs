//! Recent projects persistence (JSON file in app data dir).

use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    pub name: String,
    pub path: String,
    pub opened_at: String,
}

fn store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("create app data: {e}"))?;
    Ok(dir.join("recent-projects.json"))
}

fn load_all(app: &tauri::AppHandle) -> Vec<RecentProject> {
    let Ok(path) = store_path(app) else {
        return Vec::new();
    };
    let Ok(content) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    serde_json::from_str(&content).unwrap_or_default()
}

fn save_all(app: &tauri::AppHandle, list: &[RecentProject]) -> Result<(), String> {
    let path = store_path(app)?;
    let json = serde_json::to_string_pretty(list).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| format!("write recent projects: {e}"))
}

pub fn list_recent(app: &tauri::AppHandle, limit: usize) -> Vec<RecentProject> {
    load_all(app).into_iter().take(limit).collect()
}

pub fn touch_recent(app: &tauri::AppHandle, name: &str, path: &str) -> Result<(), String> {
    let mut list = load_all(app);
    list.retain(|p| p.path != path);
    list.insert(
        0,
        RecentProject {
            name: name.to_string(),
            path: path.to_string(),
            opened_at: now_epoch().to_string(),
        },
    );
    list.truncate(20);
    save_all(app, &list)
}

fn now_epoch() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
