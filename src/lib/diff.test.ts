import { describe, expect, it } from 'vitest'
import { diffForAdd, diffForDelete, diffLines, diffStats } from './diff'

describe('diffLines', () => {
  it('detects simple replacements', () => {
    const lines = diffLines('a\nb\nc\n', 'a\nB\nc\n')
    const stats = diffStats(lines)
    expect(stats.added).toBe(1)
    expect(stats.removed).toBe(1)
    expect(lines.some(l => l.type === 'del' && l.text === 'b')).toBe(true)
    expect(lines.some(l => l.type === 'add' && l.text === 'B')).toBe(true)
  })

  it('handles pure add', () => {
    const lines = diffForAdd('x\ny')
    expect(lines.every(l => l.type === 'add')).toBe(true)
    expect(lines).toHaveLength(2)
  })

  it('handles pure delete', () => {
    const lines = diffForDelete('x\ny')
    expect(lines.every(l => l.type === 'del')).toBe(true)
  })

  it('identical texts produce only context', () => {
    const lines = diffLines('same\n', 'same\n')
    expect(lines.every(l => l.type === 'ctx')).toBe(true)
  })
})
