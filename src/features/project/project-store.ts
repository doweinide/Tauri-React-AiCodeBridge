import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  openProject,
  rescanProject,
  getRecentProjects,
} from '@/services/project'
import { useIgnoreStore } from '@/features/context/ignore-store'
import type {
  ProjectNode,
  RecentProject,
  ScannedProject,
} from '@/lib/tauri/tauri-bindings'

interface ProjectState {
  project: ScannedProject | null
  recent: RecentProject[]
  loading: boolean
  error: string | null

  open: (path: string) => Promise<void>
  rescan: () => Promise<void>
  loadRecent: () => Promise<void>
  clear: () => void
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    (set, get) => ({
      project: null,
      recent: [],
      loading: false,
      error: null,

      open: async path => {
        set({ loading: true, error: null }, undefined, 'open/start')
        try {
          const project = await openProject(path, useIgnoreStore.getState().listForProject(path))
          set({ project, loading: false }, undefined, 'open/ok')
          void get().loadRecent()
        } catch (e) {
          set(
            {
              loading: false,
              error: e instanceof Error ? e.message : String(e),
            },
            undefined,
            'open/err'
          )
        }
      },

      rescan: async () => {
        const current = get().project
        if (!current) return
        set({ loading: true, error: null }, undefined, 'rescan/start')
        try {
          const project = await rescanProject(
          current.rootPath,
          useIgnoreStore.getState().listForProject(current.rootPath)
        )
          set({ project, loading: false }, undefined, 'rescan/ok')
        } catch (e) {
          set(
            {
              loading: false,
              error: e instanceof Error ? e.message : String(e),
            },
            undefined,
            'rescan/err'
          )
        }
      },

      loadRecent: async () => {
        try {
          const recent = await getRecentProjects()
          set({ recent }, undefined, 'loadRecent')
        } catch {
          // ignore
        }
      },

      clear: () => set({ project: null, error: null }, undefined, 'clear'),
    }),
    { name: 'project-store' }
  )
)

export function collectFilePaths(
  node: ProjectNode,
  acc: string[] = []
): string[] {
  if (node.nodeType === 'file') {
    acc.push(node.path)
    return acc
  }
  for (const c of node.children ?? []) {
    collectFilePaths(c, acc)
  }
  return acc
}

export function findNode(root: ProjectNode, path: string): ProjectNode | null {
  if (root.path === path) return root
  for (const c of root.children ?? []) {
    const found = findNode(c, path)
    if (found) return found
  }
  return null
}

export function projectAbbr(name: string): string {
  const parts = name.split(/[-_\s]+/).filter(Boolean)
  const p0 = parts[0] ?? name
  const p1 = parts[1] ?? ''
  if (p1) {
    const a = p0.charAt(0) || '?'
    const b = p1.charAt(0) || ''
    return (a + b).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function projectColor(name: string): string {
  const palette = [
    '#3E9C4A',
    '#2563EB',
    '#7C3AED',
    '#D97706',
    '#0D9488',
    '#DB2777',
    '#4B5563',
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return palette[Math.abs(h) % palette.length] ?? '#4B5563'
}
