//! Context building commands.

use std::path::PathBuf;

use crate::services::context_builder::{
    build_context_text, estimate_tokens, read_files, ContextBuildResult, FileContent,
};
use crate::services::scanner;

/// Read file contents (with hash) for selected relative paths.
#[tauri::command]
#[specta::specta]
pub async fn read_project_files(
    root_path: String,
    paths: Vec<String>,
) -> Result<Vec<FileContent>, String> {
    if paths.len() > 500 {
        return Err("Too many files selected (max 500)".into());
    }
    let root = PathBuf::from(&root_path);
    read_files(&root, &paths)
}

/// Build full context text + stats for a mode: structure | selected | all
#[tauri::command]
#[specta::specta]
pub async fn build_project_context(
    root_path: String,
    mode: String,
    selected_paths: Vec<String>,
) -> Result<ContextBuildResult, String> {
    let root = PathBuf::from(&root_path);
    let scanned = scanner::scan_project(&root)?;

    let mut all_paths = Vec::new();
    crate::services::context_builder::collect_file_paths(&scanned.tree, &mut all_paths);

    let paths: Vec<String> = match mode.as_str() {
        "structure" => Vec::new(),
        "selected" => selected_paths,
        "all" => all_paths,
        other => return Err(format!("Unknown context mode: {other}")),
    };

    let files = if paths.is_empty() {
        Vec::new()
    } else {
        read_files(&root, &paths)?
    };

    let include_contents = mode != "structure";
    let text = build_context_text(&scanned.name, &scanned.tree, &files, include_contents);

    let selected_chars: usize = files.iter().map(|f| f.content.chars().count()).sum();
    let total_chars: usize = text.chars().count();
    // Project total estimated from file sizes (bytes ≈ chars for ASCII code)
    let project_total_bytes = scanned.total_bytes;
    let project_total_tokens = estimate_tokens(project_total_bytes as usize);
    let estimated_tokens = estimate_tokens(total_chars);
    let reduction_percent = if project_total_tokens == 0 {
        0.0
    } else {
        (1.0 - (estimated_tokens as f64 / project_total_tokens as f64)) * 100.0
    };

    let _ = selected_chars;

    Ok(ContextBuildResult {
        text,
        files,
        file_count: paths.len() as u32,
        total_chars: total_chars as u32,
        estimated_tokens,
        project_total_bytes,
        project_total_tokens,
        reduction_percent: (reduction_percent * 10.0).round() / 10.0,
    })
}
