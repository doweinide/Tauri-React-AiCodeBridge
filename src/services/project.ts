/**
 * Application-level services: Tauri IPC for project / context / changes.
 */

import { commands, unwrapResult } from '@/lib/tauri/tauri-bindings'
import type {
  ApplyResult,
  ChangeInput,
  ContextBuildResult,
  FileContent,
  ProjectNode,
  RecentProject,
  ScannedProject,
} from '@/lib/tauri/tauri-bindings'

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

export async function buildProjectContext(
  rootPath: string,
  mode: 'structure' | 'selected' | 'all',
  selectedPaths: string[]
): Promise<ContextBuildResult> {
  return unwrapResult(
    await commands.buildProjectContext(rootPath, mode, selectedPaths)
  )
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

export async function undoAiChanges(changeSetId: string): Promise<string[]> {
  return unwrapResult(await commands.undoAiChanges(changeSetId))
}

export async function listUndoChangeSets(rootPath: string): Promise<string[]> {
  return unwrapResult(await commands.listUndoChangeSets(rootPath))
}
