import { describe, expect, it } from 'vitest'
import {
  createProjectContext,
  estimateContextTokens,
  estimateProjectTokens,
  estimateTokensFromChars,
  normalizeCharsPerToken,
  reductionPercent,
  AI_INSTRUCTION,
} from './index'

const emptyCtx = createProjectContext({
  projectName: 'demo',
  structure: {
    name: 'demo',
    path: '',
    nodeType: 'dir',
    children: [
      {
        name: 'src',
        path: 'src',
        nodeType: 'dir',
        size: null,
        children: [
          {
            name: 'a.ts',
            path: 'src/a.ts',
            nodeType: 'file',
            size: 10,
            children: null,
          },
        ],
      },
    ],
  },
  files: [],
  mode: 'custom',
  structureFileCount: 1,
  contentFileCount: 0,
  totalChars: 0,
  estimatedTokens: 0,
})

describe('token estimate', () => {
  it('counts structure-only payload (instruction + structure JSON)', () => {
    const est = estimateContextTokens(emptyCtx, 4)
    expect(est.payloadChars).toBeGreaterThan(AI_INSTRUCTION.length)
    expect(est.jsonChars).toBeGreaterThan(20)
    expect(est.estimatedTokens).toBeGreaterThan(0)
  })

  it('honors configurable chars-per-token', () => {
    expect(estimateTokensFromChars(100, 4)).toBe(25)
    expect(estimateTokensFromChars(100, 2)).toBe(50)
    expect(normalizeCharsPerToken(0)).toBe(4)
    expect(normalizeCharsPerToken(999)).toBe(64)
  })

  it('project tokens and reduction', () => {
    const projectTokens = estimateProjectTokens(8000, 4)
    expect(projectTokens).toBe(2000)
    expect(reductionPercent(200, 2000)).toBeCloseTo(90)
    expect(reductionPercent(0, 0)).toBe(0)
  })
})
