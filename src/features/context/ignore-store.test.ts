import { describe, expect, it } from 'vitest'
import { ruleMatchesPath } from './ignore-store'

describe('ruleMatchesPath', () => {
  it('matches plain path prefixes', () => {
    expect(ruleMatchesPath('src/secrets', 'src/secrets')).toBe(true)
    expect(ruleMatchesPath('src/secrets', 'src/secrets/key.pem')).toBe(true)
    expect(ruleMatchesPath('src/secrets', 'src/secrets2')).toBe(false)
    expect(ruleMatchesPath('docs/', 'docs/a.md')).toBe(true)
  })

  it('matches basename patterns anywhere', () => {
    expect(ruleMatchesPath('*.env', 'a.env')).toBe(true)
    expect(ruleMatchesPath('*.env', 'config/prod.env')).toBe(true)
    expect(ruleMatchesPath('credentials.*', 'src/credentials.json')).toBe(true)
    expect(ruleMatchesPath('*.env', 'src/a.ts')).toBe(false)
  })

  it('matches glob with ** across directories', () => {
    expect(ruleMatchesPath('**/*.test.ts', 'src/a/b.test.ts')).toBe(true)
    expect(ruleMatchesPath('**/*.test.ts', 'b.test.ts')).toBe(true)
    expect(ruleMatchesPath('**/*.test.ts', 'src/a.ts')).toBe(false)
    expect(ruleMatchesPath('src/**/internal/**', 'src/x/internal/y.ts')).toBe(
      true
    )
  })

  it('matches ? and character class', () => {
    expect(ruleMatchesPath('file?.ts', 'file1.ts')).toBe(true)
    expect(ruleMatchesPath('file?.ts', 'file10.ts')).toBe(false)
    expect(ruleMatchesPath('*.md', 'README.md')).toBe(true)
    expect(ruleMatchesPath('[ab].txt', 'a.txt')).toBe(true)
    expect(ruleMatchesPath('[ab].txt', 'c.txt')).toBe(false)
  })

  it('ignores children of a matched directory glob', () => {
    expect(ruleMatchesPath('docs/*', 'docs/a.md')).toBe(true)
    expect(ruleMatchesPath('src/secrets', 'src/secrets/deep/x')).toBe(true)
  })
})
