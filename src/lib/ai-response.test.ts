import { describe, expect, it } from 'vitest'
import { parseAiResponse, SAMPLE_AI_RESPONSE } from './ai-response'

describe('parseAiResponse', () => {
  it('parses sample ADD/MODIFY/DELETE response', () => {
    const result = parseAiResponse(SAMPLE_AI_RESPONSE)
    expect(result.ok).toBe(true)
    expect(result.changes).toHaveLength(3)
    expect(result.changes[0]).toMatchObject({
      type: 'add',
      path: 'src/auth/oauth.ts',
    })
    expect(result.changes[0]?.newContent).toContain('loginWithOAuth')
    expect(result.changes[1]).toMatchObject({
      type: 'modify',
      path: 'src/auth/login.ts',
    })
    expect(result.changes[1]?.newContent).toContain(
      'Username or password is incorrect'
    )
    expect(result.changes[2]).toMatchObject({
      type: 'delete',
      path: 'src/auth/old.ts',
    })
  })

  it('rejects empty input', () => {
    const result = parseAiResponse('   ')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('rejects unstructured text', () => {
    const result = parseAiResponse('I rewrote the login function for you!')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Unable to parse')
  })

  it('rejects path traversal', () => {
    const raw = `# AI_CHANGE

## ADD
FILE: ../../etc/passwd
\`\`\`
x
\`\`\`
`
    const result = parseAiResponse(raw)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Unsafe path')
  })

  it('parses single MODIFY', () => {
    const raw = `## MODIFY
FILE: src/a.ts
\`\`\`ts
export const a = 2
\`\`\`
`
    const result = parseAiResponse(raw)
    expect(result.ok).toBe(true)
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]?.newContent).toBe('export const a = 2')
  })
})
