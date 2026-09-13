/**
 * Public protocol API. UI and services must only go through this module
 * for copy/parse of ProjectContext / ProjectChanges payloads.
 */

export * from './types'
export {
  parseProjectChanges,
  validateProjectChanges,
  validateProjectContext,
  isSafeRelativePath,
  changesToApplyInputs,
} from './schema'
export {
  DEFAULT_CHARS_PER_TOKEN,
  normalizeCharsPerToken,
  estimateTokensFromChars,
  estimateContextTokens,
  estimateProjectTokens,
  reductionPercent,
  type TokenEstimate,
} from './token-estimate'

import type { ProjectContext } from './types'
import {
  buildCopyPayload,
  PROTOCOL_VERSION,
  serializeProjectContext,
} from './types'

export interface BuildContextInput {
  projectName: string
  structure: unknown
  files: { path: string; content: string; hash?: string; size?: number }[]
  mode: 'structure' | 'selected' | 'all' | 'custom' | 'empty'
  structureFileCount: number
  contentFileCount: number
  totalChars: number
  estimatedTokens: number
}

/** Build a protocol-compliant ProjectContext (no UI string assembly). */
export function createProjectContext(input: BuildContextInput): ProjectContext {
  return {
    version: PROTOCOL_VERSION,
    type: 'project_context',
    project: { name: input.projectName },
    structure: input.structure,
    files: input.files.map(f => ({
      path: f.path,
      content: f.content,
      ...(f.hash ? { hash: f.hash } : {}),
      ...(typeof f.size === 'number' ? { size: f.size } : {}),
    })),
    meta: {
      mode: input.mode,
      structureFileCount: input.structureFileCount,
      contentFileCount: input.contentFileCount,
      totalChars: input.totalChars,
      estimatedTokens: input.estimatedTokens,
      createdAt: new Date().toISOString(),
    },
  }
}

/** Serialize context for clipboard (instruction + JSON). */
export function serializeContextForCopy(context: ProjectContext): string {
  return buildCopyPayload(context)
}

/** Serialize context JSON only (for Raw preview). */
export function serializeContextJson(context: ProjectContext): string {
  return serializeProjectContext(context)
}
