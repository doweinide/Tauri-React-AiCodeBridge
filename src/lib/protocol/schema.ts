/**
 * Lightweight JSON Schema-style validation for the project protocol.
 * Validates version, type, required fields, and path safety.
 */

import type {
  ParseOutcome,
  ProjectChange,
  ProjectChanges,
  ProjectContext,
} from './types'
import { PROTOCOL_VERSION } from './types'

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Safe relative path: no traversal, no absolute, no control chars.
 * Allows Unicode (中文等), spaces, and common filename characters.
 */
export function isSafeRelativePath(path: unknown): path is string {
  if (typeof path !== 'string' || !path.trim()) return false
  // Reject any parent-segment traversal, including "foo/../bar"
  if (path.includes('..')) return false
  if (path.includes('\0')) return false
  if (path.startsWith('/') || path.startsWith('\\')) return false
  // Windows drive / UNC
  if (/^[A-Za-z]:[\\/]/.test(path)) return false
  if (path.startsWith('\\\\')) return false
  // Control characters
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i)
    if (code < 32 || code === 127) return false
  }

  const parts = path.split(/[/\\]/)
  for (const p of parts) {
    if (!p || p === '.' || p === '..') return false
    // Characters illegal on common desktop filesystems
    if (/[<>:"|?*]/.test(p)) return false
  }
  return true
}

function fail(
  reason: string,
  path?: string,
  line?: number
): ParseOutcome<never> {
  return { ok: false, error: { reason, path, line } }
}

/** Validate a ProjectContext object (already parsed). */
export function validateProjectContext(
  value: unknown
): ParseOutcome<ProjectContext> {
  if (!isPlainObject(value)) {
    return fail('Root must be a JSON object')
  }
  if (value.version !== PROTOCOL_VERSION) {
    return fail(
      `Expected version "${PROTOCOL_VERSION}", got ${JSON.stringify(value.version)}`,
      'version'
    )
  }
  if (value.type !== 'project_context') {
    return fail(
      `Expected type "project_context", got ${JSON.stringify(value.type)}`,
      'type'
    )
  }
  if (!isPlainObject(value.project) || typeof value.project.name !== 'string') {
    return fail('Expected "project.name" to be a string', 'project.name')
  }
  if (value.structure === undefined) {
    return fail('Expected "structure" field', 'structure')
  }
  if (!Array.isArray(value.files)) {
    return fail('Expected "files" to be an array', 'files')
  }
  for (let i = 0; i < value.files.length; i++) {
    const f = value.files[i]
    if (!isPlainObject(f)) {
      return fail(`files[${i}] must be an object`, `files[${i}]`)
    }
    if (!isSafeRelativePath(f.path)) {
      return fail(
        `files[${i}].path is not a safe relative path`,
        `files[${i}].path`
      )
    }
    if (typeof f.content !== 'string') {
      return fail(`files[${i}].content must be a string`, `files[${i}].content`)
    }
  }
  return { ok: true, data: value as unknown as ProjectContext }
}

/** Validate a ProjectChanges object (already parsed). */
export function validateProjectChanges(
  value: unknown
): ParseOutcome<ProjectChanges> {
  if (!isPlainObject(value)) {
    return fail('Root must be a JSON object')
  }
  if (value.version !== PROTOCOL_VERSION) {
    return fail(
      `Expected version "${PROTOCOL_VERSION}", got ${JSON.stringify(value.version)}`,
      'version'
    )
  }
  if (value.type !== 'project_changes') {
    return fail(
      `Expected type "project_changes", got ${JSON.stringify(value.type)}`,
      'type'
    )
  }
  if (!Array.isArray(value.changes)) {
    return fail('Expected "changes" to be an array', 'changes')
  }
  if (value.changes.length === 0) {
    return fail('Expected "changes" to be a non-empty array', 'changes')
  }

  const seen = new Set<string>()
  for (let i = 0; i < value.changes.length; i++) {
    const c = value.changes[i]
    const p = `changes[${i}]`
    if (!isPlainObject(c)) {
      return fail(`${p} must be an object`, p)
    }
    const op = c.operation
    if (op !== 'add' && op !== 'modify' && op !== 'delete') {
      return fail(
        `${p}.operation must be "add" | "modify" | "delete"`,
        `${p}.operation`
      )
    }
    if (!isSafeRelativePath(c.path)) {
      return fail(`${p}.path is not a safe relative path`, `${p}.path`)
    }
    if (seen.has(String(c.path))) {
      return fail(`Duplicate path in changes: ${String(c.path)}`, `${p}.path`)
    }
    seen.add(String(c.path))
    if (op === 'delete') {
      // content optional / ignored
    } else if (typeof c.content !== 'string') {
      return fail(`${p}.content must be a string for ${op}`, `${p}.content`)
    }
  }

  return { ok: true, data: value as unknown as ProjectChanges }
}

/** Parse raw AI response text into validated ProjectChanges. */
export function parseProjectChanges(raw: string): ParseOutcome<ProjectChanges> {
  const text = raw.trim()
  if (!text) {
    return fail('Empty response')
  }

  // Tolerate accidental markdown fences around the JSON body
  let body = text
  const fence = /^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i.exec(text)
  if (fence?.[1]) {
    body = fence[1]
  } else {
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return fail(
        'Response is not valid JSON. Expected a project_changes object.'
      )
    }
    body = text.slice(firstBrace, lastBrace + 1)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return fail(`JSON.parse failed: ${msg}`)
  }

  return validateProjectChanges(parsed)
}

/** Convert validated changes into apply-engine inputs. */
export function changesToApplyInputs(changes: ProjectChange[]): {
  changeType: string
  path: string
  newContent: string | null
  expectedHash: string | null
}[] {
  return changes.map(c => ({
    changeType: c.operation,
    path: c.path,
    newContent: c.operation === 'delete' ? null : (c.content ?? ''),
    expectedHash: null,
  }))
}
