import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * User-defined ignore path prefixes (relative to project root).
 * Global applies to every project; project maps rootPath → prefixes.
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

function matchesPrefix(relPath: string, prefix: string): boolean {
  const p = prefix.replace(/\/+$/, '')
  if (!p) return false
  return relPath === p || relPath.startsWith(`${p}/`)
}

function uniquePush(list: string[], prefix: string): string[] {
  const p = prefix.replace(/\/+$/, '')
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
        const prefixes = [...s.global, ...(s.byProject[rootPath] ?? [])]
        return prefixes.some(p => matchesPrefix(relPath, p))
      },
    }),
    { name: 'ai-context-tool-ignore' }
  )
)
