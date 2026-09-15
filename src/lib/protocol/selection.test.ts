import { describe, expect, it } from 'vitest'
import { createSelection, parseSelection, serializeSelection } from './selection'

describe('project selection JSON', () => {
  it('round-trips structure/content lists', () => {
    const sel = createSelection(['src/auth', 'src/a.ts'], ['src/a.ts'])
    const raw = serializeSelection(sel)
    const parsed = parseSelection(raw)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.structure).toContain('src/auth')
      expect(parsed.data.content).toContain('src/a.ts')
      expect(parsed.data.type).toBe('project_selection')
    }
  })

  it('rejects path traversal', () => {
    const raw = JSON.stringify({
      version: '1.0',
      type: 'project_selection',
      structure: ['../etc'],
      content: [],
    })
    expect(parseSelection(raw).ok).toBe(false)
  })

  it('rejects wrong type', () => {
    const raw = JSON.stringify({
      version: '1.0',
      type: 'project_context',
      structure: [],
      content: [],
    })
    expect(parseSelection(raw).ok).toBe(false)
  })
})
