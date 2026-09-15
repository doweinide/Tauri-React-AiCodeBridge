import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  fetchProjectContext,
  toProjectContext,
  contextCopyText,
  contextJsonText,
  listAllFilePaths,
} from '@/services/project'
import type {
  ContextBuildResult,
  ProjectNode,
} from '@/lib/tauri/tauri-bindings'
import type { ProjectContext } from '@/lib/protocol'
import {
  estimateContextTokens,
  estimateProjectTokens,
  reductionPercent,
  projectContextToMarkdown,
  createSelection,
  type ProjectSelection,
  type TokenEstimate,
} from '@/lib/protocol'
import { useAppSettingsStore } from '@/store/app-settings-store'
import { useIgnoreStore } from './ignore-store'
import { collectFilePaths } from '@/features/project/project-store'

export type PreviewTab = 'tree' | 'json' | 'raw' | 'md'

interface ContextState {
  /** Files included in the pruned structure tree */
  structureSelected: Set<string>
  /** Files whose full content is sent in files[] */
  contentSelected: Set<string>
  expanded: Set<string>
  search: string
  previewTab: PreviewTab
  buildResult: ContextBuildResult | null
  protocolContext: ProjectContext | null
  previewText: string
  /** Human-readable Markdown preview (structure + files) */
  markdownText: string
  building: boolean
  lastError: string | null
  fileHashes: Record<string, string>
  selectedFileForCode: string | null
  /** Payload-based token stats (copy payload includes instruction + structure JSON) */
  tokenStats: TokenEstimate | null
  projectTokens: number
  reductionPercent: number

  toggleExpand: (path: string) => void
  setSearch: (q: string) => void
  /** Toggle structure inclusion for a file path */
  toggleStructureFile: (path: string) => void
  /** Recursively select/deselect structure for a directory */
  toggleStructureDir: (node: ProjectNode, on?: boolean) => void
  /** Toggle content inclusion for a file path */
  toggleContentFile: (path: string) => void
  /** Recursively select/deselect content for a directory */
  toggleContentDir: (node: ProjectNode, on?: boolean) => void
  selectAllStructure: (root: ProjectNode, on: boolean) => Promise<void>
  selectAllContent: (root: ProjectNode, on: boolean) => void
  clearStructure: () => void
  clearContent: () => void
  /** Copy structure selection to content (files currently in structure) */
  copyStructureToContent: () => void
  exportSelection: () => ProjectSelection
  applySelection: (structure: string[], content: string[]) => void
  setPreviewTab: (tab: PreviewTab) => void
  setSelectedFileForCode: (path: string | null) => void
  refreshPreview: (rootPath: string) => Promise<void>
  copyContext: () => Promise<string>
  copyMarkdown: () => Promise<string>
  reset: () => void
}

export const useContextStore = create<ContextState>()(
  devtools(
    (set, get) => ({
      structureSelected: new Set(),
      contentSelected: new Set(),
      expanded: new Set(),
      search: '',
      previewTab: 'tree',
      buildResult: null,
      protocolContext: null,
      previewText: '',
      markdownText: '',
      building: false,
      lastError: null,
      fileHashes: {},
      selectedFileForCode: null,
      tokenStats: null,
      projectTokens: 0,
      reductionPercent: 0,

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

      toggleStructureFile: path =>
        set(
          state => {
            const next = new Set(state.structureSelected)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            return { structureSelected: next }
          },
          undefined,
          'toggleStructureFile'
        ),

      toggleStructureDir: (node, on) => {
        const files = collectFilePaths(node)
        set(
          state => {
            const next = new Set(state.structureSelected)
            // Empty dir (or only ignored children): toggle the directory path itself
            if (files.length === 0) {
              const shouldSelect = on ?? !next.has(node.path)
              if (shouldSelect) next.add(node.path)
              else next.delete(node.path)
              return { structureSelected: next }
            }
            const allSelected =
              files.length > 0 && files.every(p => next.has(p))
            const shouldSelect = on ?? !allSelected
            for (const f of files) {
              if (shouldSelect) next.add(f)
              else next.delete(f)
            }
            return { structureSelected: next }
          },
          undefined,
          'toggleStructureDir'
        )
      },

      toggleContentFile: path =>
        set(
          state => {
            const next = new Set(state.contentSelected)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            return { contentSelected: next }
          },
          undefined,
          'toggleContentFile'
        ),

      toggleContentDir: (node, on) => {
        const files = collectFilePaths(node)
        set(
          state => {
            const next = new Set(state.contentSelected)
            const allSelected =
              files.length > 0 && files.every(p => next.has(p))
            const shouldSelect = on ?? !allSelected
            for (const f of files) {
              if (shouldSelect) next.add(f)
              else next.delete(f)
            }
            return { contentSelected: next }
          },
          undefined,
          'toggleContentDir'
        )
      },

      selectAllStructure: async (root, on) => {
        if (!on) {
          set({ structureSelected: new Set() }, undefined, 'selectAllStructure')
          return
        }
        // Prefer all files from last known project scan via collect on root
        const files = collectFilePaths(root)
        set(
          { structureSelected: new Set(files) },
          undefined,
          'selectAllStructure'
        )
      },

      selectAllContent: (root, on) => {
        const files = collectFilePaths(root)
        set(
          { contentSelected: on ? new Set(files) : new Set() },
          undefined,
          'selectAllContent'
        )
      },

      clearStructure: () =>
        set({ structureSelected: new Set() }, undefined, 'clearStructure'),
      clearContent: () =>
        set({ contentSelected: new Set() }, undefined, 'clearContent'),

      copyStructureToContent: () =>
        set(
          state => ({
            contentSelected: new Set(state.structureSelected),
          }),
          undefined,
          'copyStructureToContent'
        ),

      /** Export current structure/content path lists */
      exportSelection: () => {
        const { structureSelected, contentSelected } = get()
        return createSelection([...structureSelected], [...contentSelected])
      },

      /** Apply imported selection JSON */
      applySelection: (structure: string[], content: string[]) => {
        set(
          {
            structureSelected: new Set(structure),
            contentSelected: new Set(content),
          },
          undefined,
          'applySelection'
        )
      },

      setPreviewTab: tab =>
        set({ previewTab: tab }, undefined, 'setPreviewTab'),
      setSelectedFileForCode: path =>
        set({ selectedFileForCode: path }, undefined, 'setSelectedFileForCode'),

      refreshPreview: async rootPath => {
        const { structureSelected, contentSelected } = get()
        set({ building: true, lastError: null }, undefined, 'refresh/start')
        try {
          const extraIgnore = useIgnoreStore.getState().listForProject(rootPath)
          const buildResult = await fetchProjectContext(
            rootPath,
            [...structureSelected],
            [...contentSelected],
            extraIgnore
          )
          const protocolContext = toProjectContext(buildResult)
          const previewText = contextJsonText(protocolContext)
          const markdownText = projectContextToMarkdown(protocolContext)
          const fileHashes: Record<string, string> = {}
          for (const f of buildResult.files) fileHashes[f.path] = f.hash

          const charsPerToken = useAppSettingsStore.getState().charsPerToken
          const tokenStats = estimateContextTokens(protocolContext, charsPerToken)
          const projectTokens = estimateProjectTokens(
            buildResult.projectTotalBytes,
            charsPerToken
          )

          set(
            {
              buildResult,
              protocolContext,
              previewText,
              markdownText,
              building: false,
              fileHashes,
              tokenStats,
              projectTokens,
              reductionPercent: reductionPercent(
                tokenStats.estimatedTokens,
                projectTokens
              ),
            },
            undefined,
            'refresh/ok'
          )
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

      copyContext: async () => {
        const ctx = get().protocolContext
        if (!ctx) throw new Error('No context to copy')
        const text = contextCopyText(ctx)
        await navigator.clipboard.writeText(text)
        return text
      },

      copyMarkdown: async () => {
        const ctx = get().protocolContext
        if (!ctx) throw new Error('No context to copy')
        const text = projectContextToMarkdown(ctx)
        await navigator.clipboard.writeText(text)
        return text
      },

      reset: () =>
        set(
          {
            structureSelected: new Set(),
            contentSelected: new Set(),
            expanded: new Set(),
            search: '',
            previewTab: 'tree',
            buildResult: null,
            protocolContext: null,
            previewText: '',
            markdownText: '',
            fileHashes: {},
            selectedFileForCode: null,
            tokenStats: null,
            projectTokens: 0,
            reductionPercent: 0,
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

/** Expand structure selection when user picks a directory path prefix. */
export async function expandStructureFromRoot(
  rootPath: string,
  dirPath: string
): Promise<string[]> {
  const all = await listAllFilePaths(rootPath)
  if (!dirPath || dirPath === '.') return all
  const prefix = dirPath.endsWith('/') ? dirPath : `${dirPath}/`
  return all.filter(p => p === dirPath || p.startsWith(prefix))
}
