import { describe, expect, it } from 'vitest'
import {
  createProjectContext,
  serializeContextForCopy,
  parseProjectChanges,
  validateProjectContext,
  SAMPLE_CHANGE_JSON,
  AI_INSTRUCTION,
} from './index'

describe('protocol ProjectContext', () => {
  it('serializes instruction + JSON payload', () => {
    const ctx = createProjectContext({
      projectName: 'my-app',
      structure: { name: 'my-app', path: '', nodeType: 'dir', children: [] },
      files: [
        { path: 'src/a.ts', content: 'export const a = 1\n', hash: 'fnv1a-x' },
      ],
      mode: 'custom',
      structureFileCount: 1,
      contentFileCount: 1,
      totalChars: 20,
      estimatedTokens: 5,
    })
    expect(ctx.version).toBe('1.0')
    expect(ctx.type).toBe('project_context')
    const payload = serializeContextForCopy(ctx)
    expect(payload.startsWith(AI_INSTRUCTION)).toBe(true)
    const jsonPart = payload.split('\n\n---\n\n')[1] ?? ''
    const parsed = JSON.parse(jsonPart)
    expect(parsed.type).toBe('project_context')
    expect(parsed.files[0].path).toBe('src/a.ts')
    expect(validateProjectContext(parsed).ok).toBe(true)
  })
})

describe('parseProjectChanges', () => {
  it('parses sample change JSON', () => {
    const result = parseProjectChanges(SAMPLE_CHANGE_JSON)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.changes.length).toBeGreaterThan(0)
      expect(result.data.type).toBe('project_changes')
    }
  })

  it('rejects empty', () => {
    expect(parseProjectChanges('').ok).toBe(false)
  })

  it('rejects non-JSON text', () => {
    const r = parseProjectChanges('Please rewrite login.ts for me')
    expect(r.ok).toBe(false)
  })

  it('rejects wrong type', () => {
    const raw = JSON.stringify({
      version: '1.0',
      type: 'project_context',
      changes: [],
    })
    expect(parseProjectChanges(raw).ok).toBe(false)
  })

  it('rejects path traversal', () => {
    const raw = JSON.stringify({
      version: '1.0',
      type: 'project_changes',
      changes: [{ operation: 'add', path: '../../etc/passwd', content: 'x' }],
    })
    const r = parseProjectChanges(raw)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.reason).toMatch(/safe relative path|path/i)
  })

  it('tolerates markdown fence wrapper', () => {
    const fenced = '```json\n' + SAMPLE_CHANGE_JSON + '\n```'
    expect(parseProjectChanges(fenced).ok).toBe(true)
  })

  it('accepts Chinese and spaced path segments', () => {
    const raw = JSON.stringify({
      version: '1.0',
      type: 'project_changes',
      changes: [
        {
          operation: 'modify',
          path: '05-Flutter规范/Bloc/Bloc状态管理规范.md',
          content: '# 标题\n',
        },
        {
          operation: 'modify',
          path: '05-Flutter 规范/Bloc/状态管理.md',
          content: '# 标题\n',
        },
      ],
    })
    const r = parseProjectChanges(raw)
    expect(r.ok).toBe(true)
  })
})
