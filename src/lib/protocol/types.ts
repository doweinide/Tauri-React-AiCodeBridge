/**
 * Unified JSON protocol types for ProjectContext / ChangeSet exchange.
 * UI must never invent its own wire format.
 */

export const PROTOCOL_VERSION = '1.0' as const

export type ProtocolType = 'project_context' | 'project_changes'

export type ChangeOperation = 'add' | 'modify' | 'delete'

export interface ProtocolFile {
  path: string
  content: string
  /** Content fingerprint (optional, for external-modification detection) */
  hash?: string
  size?: number
}

export interface ProjectContext {
  version: typeof PROTOCOL_VERSION
  type: 'project_context'
  project: {
    name: string
    /** Absolute root is omitted from copy payload by default for privacy */
    rootPath?: string
  }
  structure: unknown
  files: ProtocolFile[]
  meta?: {
    mode: 'structure' | 'selected' | 'all' | 'custom' | 'empty'
    structureFileCount: number
    contentFileCount: number
    totalChars: number
    estimatedTokens: number
    createdAt: string
  }
}

export interface ProjectChange {
  operation: ChangeOperation
  path: string
  /** Full file content for add/modify; omitted for delete */
  content?: string
}

export interface ProjectChanges {
  version: typeof PROTOCOL_VERSION
  type: 'project_changes'
  changes: ProjectChange[]
}

export interface ParseErrorDetail {
  line?: number
  path?: string
  reason: string
}

export type ParseOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; error: ParseErrorDetail }

/** Copy payload = instruction + separator + ProjectContext JSON */
export const PAYLOAD_SEPARATOR = '\n\n---\n\n'

export function buildCopyPayload(context: ProjectContext): string {
  return `${AI_INSTRUCTION}${PAYLOAD_SEPARATOR}${serializeProjectContext(context)}`
}

export function serializeProjectContext(context: ProjectContext): string {
  return JSON.stringify(context, null, 2)
}

export function serializeProjectChanges(changes: ProjectChanges): string {
  return JSON.stringify(changes, null, 2)
}

export const AI_INSTRUCTION = `You are modifying an existing software project.

Analyze the provided project context (JSON).

Return ONLY a valid JSON object using the following schema. Do not wrap it in markdown fences. Do not add commentary.

Schema:
{
  "version": "1.0",
  "type": "project_changes",
  "changes": [
    {
      "operation": "add" | "modify" | "delete",
      "path": "relative/path/to/file.ts",
      "content": "full file content (required for add/modify, omit for delete)"
    }
  ]
}

Rules:
1. Only include files related to the user's request.
2. For modify, return the COMPLETE new file content (not a diff).
3. Paths must be relative to the project root. Never use absolute paths or "..".
4. Response must be a single JSON object.`

export const SAMPLE_CHANGE_JSON = `{
  "version": "1.0",
  "type": "project_changes",
  "changes": [
    {
      "operation": "add",
      "path": "src/auth/google-oauth.ts",
      "content": "import { api } from '../services/api';\\nimport { setSession } from './session';\\n\\nexport async function loginWithGoogle(code: string) {\\n  const res = await api.post('/auth/google', { code });\\n  if (!res.ok) throw new Error('Google OAuth login failed');\\n  setSession(res.data.token);\\n  return res.data;\\n}\\n"
    },
    {
      "operation": "modify",
      "path": "src/auth/login.ts",
      "content": "import { api } from '../services/api';\\nimport { setSession } from './session';\\n\\nexport interface LoginPayload {\\n  username: string;\\n  password: string;\\n}\\n\\nexport async function login(payload: LoginPayload) {\\n  try {\\n    const res = await api.post('/auth/login', payload);\\n    if (!res.ok) {\\n      throw new Error('Username or password is incorrect');\\n    }\\n    setSession(res.data.token);\\n    return res.data;\\n  } catch (err) {\\n    return { error: 'Username or password is incorrect' };\\n  }\\n}\\n"
    }
  ]
}`
