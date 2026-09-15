import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * User-defined ignore rules (relative to project root).
 * Global applies to every project; project maps rootPath → rules.
 * Rules support path prefixes and Glob patterns (`*`, `?`, `**`, `[...]`).
 */
interface IgnoreState {
  global: string[]
  byProject: Record<string, string[]>
  addGlobal: (prefix: string) => void
  removeGlobal: (prefix: string) => void
  addProject: (rootPath: string, prefix: string) => void
  removeProject: (rootPath: string, prefix: string) => void
  /** Combined list for scan/build commands */
  listForProject: (rootPath: string) => string[]
  isIgnoredPath: (rootPath: string, relPath: string) => boolean
}

function hasGlobMeta(s: string): boolean {
  return s.includes('*') || s.includes('?') || s.includes('[')
}

/** Match one path segment: `*`, `?`, `[...]`. No `/`. */
function matchSegment(pattern: string, text: string): boolean {
  // Compile a simple segment regex once per call (rules are few)
  let re = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern.charAt(i)
    if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else if (c === '[') {
      let j = i + 1
      let cls = '['
      const neg = pattern.charAt(j)
      if (neg === '!' || neg === '^') {
        cls += '^'
        j++
      }
      while (j < pattern.length && pattern.charAt(j) !== ']') {
        const ch = pattern.charAt(j)
        cls += ch === '\\' ? '\\\\' : ch
        j++
      }
      if (j < pattern.length) {
        cls += ']'
        re += cls
        i = j
      } else {
        re += '\\['
      }
    } else if (c === '\\') {
      re += '\\\\'
    } else if (/[.+^${}()|\\]/.test(c)) {
      re += `\\${c}`
    } else {
      re += c
    }
  }
  return new RegExp(`^${re}$`).test(text)
}

function matchGlobPath(pattern: string, path: string): boolean {
  const pat = pattern.split('/')
  const parts = path.split('/')

  const walk = (pi: number, ti: number): boolean => {
    if (pi === pat.length) return ti === parts.length
    const seg = pat[pi]
    if (seg === '**') {
      for (let skip = ti; skip <= parts.length; skip++) {
        if (walk(pi + 1, skip)) return true
      }
      return false
    }
    if (ti === parts.length || seg === undefined) return false
    const part = parts[ti]
    if (part === undefined) return false
    return matchSegment(seg, part) && walk(pi + 1, ti + 1)
  }

  return walk(0, 0)
}

/** Match a path prefix or Glob rule against a relative path. */
export function ruleMatchesPath(rule: string, relPath: string): boolean {
  const raw = rule.trim()
  if (!raw) return false
  let pattern = raw.replace(/\/+$/, '')
  if (!pattern) return false
  pattern = pattern.replace(/^\.\//, '')
  const path = relPath.replace(/^\/+|\/+$/g, '')

  // Basename-only: `*.env`, `credentials.*`
  if (!pattern.includes('/')) {
    const basename = path.split('/').pop() ?? path
    if (hasGlobMeta(pattern)) return matchSegment(pattern, basename)
    return (
      basename === pattern ||
      path === pattern ||
      path.startsWith(`${pattern}/`)
    )
  }

  if (hasGlobMeta(pattern)) {
    let current = path
    for (;;) {
      if (matchGlobPath(pattern, current)) return true
      const idx = current.lastIndexOf('/')
      if (idx < 0) break
      current = current.slice(0, idx)
    }
    return false
  }

  return path === pattern || path.startsWith(`${pattern}/`)
}

function uniquePush(list: string[], prefix: string): string[] {
  const p = prefix.trim().replace(/\/+$/, '')
  if (!p || list.includes(p)) return list
  return [...list, p]
}

export const useIgnoreStore = create<IgnoreState>()(
  persist(
    (set, get) => ({
      global: [],
      byProject: {},

      addGlobal: prefix =>
        set(s => ({ global: uniquePush(s.global, prefix) })),
      removeGlobal: prefix =>
        set(s => ({
          global: s.global.filter(x => x !== prefix.replace(/\/+$/, '')),
        })),

      addProject: (rootPath, prefix) =>
        set(s => ({
          byProject: {
            ...s.byProject,
            [rootPath]: uniquePush(s.byProject[rootPath] ?? [], prefix),
          },
        })),
      removeProject: (rootPath, prefix) =>
        set(s => {
          const p = prefix.replace(/\/+$/, '')
          const list = (s.byProject[rootPath] ?? []).filter(x => x !== p)
          const next = { ...s.byProject }
          if (list.length === 0) {
            const { [rootPath]: _removed, ...rest } = next
            return { byProject: rest }
          }
          next[rootPath] = list
          return { byProject: next }
        }),

      listForProject: rootPath => {
        const s = get()
        return [...s.global, ...(s.byProject[rootPath] ?? [])]
      },

      isIgnoredPath: (rootPath, relPath) => {
        const s = get()
        const rules = [...s.global, ...(s.byProject[rootPath] ?? [])]
        return rules.some(r => ruleMatchesPath(r, relPath))
      },
    }),
    { name: 'ai-context-tool-ignore' }
  )
)
