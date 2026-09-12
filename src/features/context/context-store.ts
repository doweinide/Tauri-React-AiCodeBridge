import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { buildProjectContext } from '@/services/project'
import type { ContextBuildResult } from '@/lib/tauri/tauri-bindings'
import type { ProjectNode } from '@/lib/tauri/tauri-bindings'
import { collectFilePaths } from '@/features/project/project-store'

export type ContextMode = 'structure' | 'selected' | 'all'

interface ContextState {
  selected: Set<string>
  expanded: Set<string>
  search: string
  previewMode: ContextMode
  preview: ContextBuildResult | null
  building: boolean
  lastError: string | null
  /** content hashes from last selected-files build, for conflict detection */
  fileHashes: Record<string, string>

  toggleExpand: (path: string) => void
  setSearch: (q: string) => void
  toggleFile: (path: string) => void
  toggleDir: (node: ProjectNode, on?: boolean) => void
  selectAll: (root: ProjectNode, on: boolean) => void
  setPreviewMode: (mode: ContextMode) => void
  refreshPreview: (rootPath: string, root: ProjectNode) => Promise<void>
  reset: () => void
}

export const useContextStore = create<ContextState>()(
  devtools(
    (set, get) => ({
      selected: new Set(),
      expanded: new Set(),
      search: '',
      previewMode: 'selected',
      preview: null,
      building: false,
      lastError: null,
      fileHashes: {},

      toggleExpand: path =>
        set(
          state => {
            const next = new Set(state.expanded)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            return { expanded: next }
          },
          undefined,
          'toggleExpand'
        ),

      setSearch: q => set({ search: q }, undefined, 'setSearch'),

      toggleFile: path =>
        set(
          state => {
            const next = new Set(state.selected)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            return { selected: next }
          },
          undefined,
          'toggleFile'
        ),

      toggleDir: (node, on) => {
        const files = collectFilePaths(node)
        set(
          state => {
            const next = new Set(state.selected)
            const allSelected =
              files.length > 0 && files.every(p => next.has(p))
            const shouldSelect = on ?? !allSelected
            for (const f of files) {
              if (shouldSelect) next.add(f)
              else next.delete(f)
            }
            return { selected: next }
          },
          undefined,
          'toggleDir'
        )
      },

      selectAll: (root, on) => {
        const files = collectFilePaths(root)
        set(
          { selected: on ? new Set(files) : new Set() },
          undefined,
          'selectAll'
        )
      },

      setPreviewMode: mode =>
        set({ previewMode: mode }, undefined, 'setPreviewMode'),

      refreshPreview: async (rootPath, root) => {
        const { previewMode, selected } = get()
        set({ building: true, lastError: null }, undefined, 'refresh/start')
        try {
          const paths =
            previewMode === 'all'
              ? collectFilePaths(root)
              : previewMode === 'selected'
                ? [...selected]
                : []
          const preview = await buildProjectContext(
            rootPath,
            previewMode,
            paths
          )
          const fileHashes: Record<string, string> = {}
          for (const f of preview.files) fileHashes[f.path] = f.hash
          set({ preview, building: false, fileHashes }, undefined, 'refresh/ok')
        } catch (e) {
          set(
            {
              building: false,
              lastError: e instanceof Error ? e.message : String(e),
            },
            undefined,
            'refresh/err'
          )
        }
      },

      reset: () =>
        set(
          {
            selected: new Set(),
            expanded: new Set(),
            search: '',
            previewMode: 'selected',
            preview: null,
            fileHashes: {},
          },
          undefined,
          'reset'
        ),
    }),
    { name: 'context-store' }
  )
)

export function formatNumber(n: number): string {
  return n.toLocaleString()
}
