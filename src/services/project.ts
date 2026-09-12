import {
  commands,
  unwrapResult,
  type ContextBuildResult,
} from '@/lib/tauri/tauri-bindings'
import type {
  ApplyResult,
  ChangeInput,
  FileContent,
  ProjectNode,
  RecentProject,
  ScannedProject,
} from '@/lib/tauri/tauri-bindings'
import {
  createProjectContext,
  serializeContextForCopy,
  serializeContextJson,
  type ProjectContext,
} from '@/lib/protocol'

export type { ProjectNode, ScannedProject, RecentProject, FileContent }

export async function openProject(path: string): Promise<ScannedProject> {
  return unwrapResult(await commands.openProject(path))
}

export async function rescanProject(path: string): Promise<ScannedProject> {
  return unwrapResult(await commands.rescanProject(path))
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  return unwrapResult(await commands.getRecentProjects())
}

/**
 * Build structured context with independent structure / content selections.
 * `structurePaths` prune the tree; `contentPaths` are read into files[].
 */
export async function fetchProjectContext(
  rootPath: string,
  structurePaths: string[],
  contentPaths: string[]
): Promise<ContextBuildResult> {
  return unwrapResult(
    await commands.buildProjectContext(rootPath, structurePaths, contentPaths)
  )
}

export async function listAllFilePaths(rootPath: string): Promise<string[]> {
  return unwrapResult(await commands.listAllFilePaths(rootPath))
}

/** Build protocol ProjectContext from structured Rust result. */
export function toProjectContext(result: ContextBuildResult): ProjectContext {
  return createProjectContext({
    projectName: result.projectName,
    structure: result.structure,
    files: result.files.map(f => ({
      path: f.path,
      content: f.content,
      hash: f.hash,
      size: f.size,
    })),
    mode: result.mode as 'structure' | 'selected' | 'all' | 'custom' | 'empty',
    structureFileCount: result.structureFileCount,
    contentFileCount: result.contentFileCount,
    totalChars: result.totalChars,
    estimatedTokens: result.estimatedTokens,
  })
}

export function contextCopyText(context: ProjectContext): string {
  return serializeContextForCopy(context)
}

export function contextJsonText(context: ProjectContext): string {
  return serializeContextJson(context)
}

export async function readProjectFiles(
  rootPath: string,
  paths: string[]
): Promise<FileContent[]> {
  return unwrapResult(await commands.readProjectFiles(rootPath, paths))
}

export async function applyAiChanges(
  rootPath: string,
  changes: ChangeInput[],
  allowOverwriteConflict = false
): Promise<ApplyResult> {
  return unwrapResult(
    await commands.applyAiChanges(rootPath, changes, allowOverwriteConflict)
  )
}

export async function undoAiChanges(
  rootPath: string,
  changeSetId: string
): Promise<string[]> {
  return unwrapResult(await commands.undoAiChanges(rootPath, changeSetId))
}

export async function listUndoChangeSets(rootPath: string): Promise<string[]> {
  return unwrapResult(await commands.listUndoChangeSets(rootPath))
}
