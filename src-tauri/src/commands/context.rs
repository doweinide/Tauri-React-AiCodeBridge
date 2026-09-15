//! Context building commands. Structure and content are independent selections.

use std::collections::HashSet;
use std::path::PathBuf;

use crate::services::context_builder::{
    collect_file_paths, count_files, estimate_tokens, prune_tree_to_files, read_files,
    ContextBuildResult, FileContent,
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

/// Build structured project context.
///
/// - `structure_paths`: file paths to include in the pruned structure tree
/// - `content_paths`: file paths whose contents are read into `files[]`
///
/// Structure and content are independent: e.g. full structure of `src/auth/`
/// plus content of a single Login file, without any `src/payment/` structure.
#[tauri::command]
#[specta::specta]
pub async fn build_project_context(
    root_path: String,
    structure_paths: Vec<String>,
    content_paths: Vec<String>,
    extra_ignore: Vec<String>,
) -> Result<ContextBuildResult, String> {
    let root = PathBuf::from(&root_path);
    let scanned = scanner::scan_project_with_ignores(&root, &extra_ignore)?;

    if structure_paths.len() > 5000 {
        return Err("Too many structure paths (max 5000)".into());
    }
    if content_paths.len() > 500 {
        return Err("Too many content files (max 500)".into());
    }

    // Expand structure selection: paths may be file paths.
    // (Dir recursive selection is handled on the frontend into file path lists.)
    let structure_set: HashSet<String> = structure_paths.into_iter().collect();
    let structure = prune_tree_to_files(&scanned.tree, &structure_set).unwrap_or_else(|| {
        scanner::ProjectNode {
            name: scanned.name.clone(),
            path: String::new(),
            node_type: "dir".into(),
            size: None,
            ignored: false,
            children: Some(Vec::new()),
        }
    });

    let files = if content_paths.is_empty() {
        Vec::new()
    } else {
        read_files(&root, &content_paths)?
    };

    let structure_file_count = count_files(&structure);
    let content_file_count = files.len() as u32;
    let total_chars: usize = files.iter().map(|f| f.content.chars().count()).sum();
    let project_total_bytes = scanned.total_bytes;
    let project_total_tokens = estimate_tokens(project_total_bytes as usize);
    let estimated_tokens = estimate_tokens(total_chars);
    let reduction_percent = if project_total_tokens == 0 {
        0.0
    } else {
        (1.0 - (estimated_tokens as f64 / project_total_tokens as f64)) * 100.0
    };

    let mode = if content_file_count == 0 && structure_file_count > 0 {
        "structure"
    } else if structure_file_count == 0 && content_file_count == 0 {
        "empty"
    } else {
        "custom"
    };

    Ok(ContextBuildResult {
        project_name: scanned.name,
        structure,
        files,
        mode: mode.to_string(),
        structure_file_count,
        content_file_count,
        total_chars: total_chars as u32,
        estimated_tokens,
        project_total_bytes,
        project_total_tokens,
        reduction_percent: (reduction_percent * 10.0).round() / 10.0,
    })
}

/// Collect every file path in a scanned project (for "select all structure").
#[tauri::command]
#[specta::specta]
pub async fn list_all_file_paths(root_path: String) -> Result<Vec<String>, String> {
    let root = PathBuf::from(&root_path);
    let scanned = scanner::scan_project(&root)?;
    let mut paths = Vec::new();
    collect_file_paths(&scanned.tree, &mut paths);
    Ok(paths)
}
