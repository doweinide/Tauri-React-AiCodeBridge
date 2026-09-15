import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ProjectNode } from '@/lib/tauri/tauri-bindings'
import { collectFilePaths } from '@/features/project/project-store'
import { useContextStore } from './context-store'

export type ImportMode = 'replace' | 'merge'

interface ParsedSelection {
  structure: string[]
  content: string[]
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
}

/**
 * Accepts:
 * 1. ProjectContext protocol JSON (`files[]` → content, plus optional structure list)
 * 2. `{ structure?: string[]; content?: string[] }`
 * 3. Plain string[] of paths → structure only
 */
// eslint-disable-next-line react-refresh/only-export-components -- shared parser, used by dialog
export function parseSelectionJson(raw: string): ParsedSelection {
  const data = JSON.parse(raw) as unknown

  if (Array.isArray(data)) {
    const paths = data
      .filter((x): x is string => typeof x === 'string')
      .map(normalizePath)
      .filter(Boolean)
    return { structure: paths, content: [] }
  }

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>

    // ProjectContext protocol
    if (obj.type === 'project_context' && Array.isArray(obj.files)) {
      const content = (obj.files as { path?: unknown }[])
        .map(f => (typeof f?.path === 'string' ? normalizePath(f.path) : ''))
        .filter(Boolean)
      const structure = Array.isArray(obj.structurePaths)
        ? (obj.structurePaths as unknown[])
            .filter((x): x is string => typeof x === 'string')
            .map(normalizePath)
            .filter(Boolean)
        : content
      return { structure, content }
    }

    // Explicit structure/content object
    const structure = Array.isArray(obj.structure)
      ? (obj.structure as unknown[])
          .filter((x): x is string => typeof x === 'string')
          .map(normalizePath)
          .filter(Boolean)
      : []
    const content = Array.isArray(obj.content)
      ? (obj.content as unknown[])
          .filter((x): x is string => typeof x === 'string')
          .map(normalizePath)
          .filter(Boolean)
      : []
    if (structure.length || content.length) return { structure, content }
  }

  throw new Error('Unrecognized JSON shape')
}

function expandDirs(paths: string[], allFiles: string[]): string[] {
  const fileSet = new Set(allFiles)
  const result = new Set<string>()
  for (const raw of paths) {
    const p = normalizePath(raw)
    if (fileSet.has(p)) {
      result.add(p)
      continue
    }
    const prefix = p.endsWith('/') ? p : `${p}/`
    for (const f of allFiles) {
      if (f.startsWith(prefix)) result.add(f)
    }
  }
  return [...result]
}

function expandAncestors(paths: string[]): string[] {
  const dirs = new Set<string>()
  for (const p of paths) {
    const parts = p.split('/')
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join('/'))
    }
  }
  return [...dirs]
}

function findNodeByPath(root: ProjectNode, path: string): ProjectNode | null {
  if (root.path === path) return root
  for (const c of root.children ?? []) {
    const found = findNodeByPath(c, path)
    if (found) return found
  }
  return null
}

export function ImportSelectionDialog({
  open,
  onOpenChange,
  root,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  root: ProjectNode
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<ImportMode>('replace')
  const structureSelected = useContextStore(s => s.structureSelected)
  const contentSelected = useContextStore(s => s.contentSelected)

  const allFiles = useMemo(() => collectFilePaths(root), [root])

  const preview = useMemo(() => {
    if (!text.trim()) return null
    try {
      const parsed = parseSelectionJson(text)
      const structure = expandDirs(parsed.structure, allFiles)
      const content = expandDirs(parsed.content, allFiles)
      return { structure, content, error: null as string | null }
    } catch (e) {
      return {
        structure: [] as string[],
        content: [] as string[],
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }, [text, allFiles])

  const apply = () => {
    if (!preview || preview.error) return

    const selectable = new Set(allFiles)
    const filter = (paths: string[]) => paths.filter(p => selectable.has(p))

    const nextStructure =
      mode === 'replace'
        ? new Set(filter(preview.structure))
        : new Set([...structureSelected, ...filter(preview.structure)])
    const nextContent =
      mode === 'replace'
        ? new Set(filter(preview.content))
        : new Set([...contentSelected, ...filter(preview.content)])

    useContextStore.setState({
      structureSelected: nextStructure,
      contentSelected: nextContent,
    })

    // Expand ancestor dirs so selected nodes are visible
    const ancestors = expandAncestors([...nextStructure, ...nextContent])
    const nextExpanded = new Set(useContextStore.getState().expanded)
    for (const dir of ancestors) {
      if (findNodeByPath(root, dir)) nextExpanded.add(dir)
    }
    useContextStore.setState({ expanded: nextExpanded })

    toast.success(
      t('context.importApplied', {
        structure: nextStructure.size,
        content: nextContent.size,
      })
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('context.importTitle')}</DialogTitle>
          <DialogDescription className="text-[12px] leading-relaxed">
            {t('context.importDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t('context.importPlaceholder')}
            className="min-h-[180px] font-mono text-[11.5px] leading-[1.6]"
            spellCheck={false}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {t('context.importMode')}
            </span>
            {(
              [
                ['replace', t('context.importModeReplace')],
                ['merge', t('context.importModeMerge')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cnLike(mode === id)}
              >
                {label}
              </button>
            ))}
          </div>

          {preview?.error ? (
            <p className="text-[11px] text-destructive">
              {t('context.importInvalid')}: {preview.error}
            </p>
          ) : preview ? (
            <p className="text-[11px] text-muted-foreground">
              {t('context.importPreview', {
                structure: preview.structure.length,
                content: preview.content.length,
              })}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            disabled={!preview || !!preview.error}
            onClick={apply}
          >
            {t('context.importApply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function cnLike(active: boolean): string {
  return [
    'rounded-md px-2 py-0.5 text-[11px] transition-colors border',
    active
      ? 'border-primary bg-primary/12 text-primary font-medium'
      : 'border-border text-muted-foreground hover:bg-muted',
  ].join(' ')
}
