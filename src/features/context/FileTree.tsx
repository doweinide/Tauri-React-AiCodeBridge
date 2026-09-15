import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Folder, FileText, ChevronRight, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ProjectNode } from '@/lib/tauri/tauri-bindings'
import { useProjectStore } from '@/features/project/project-store'
import { useContextStore, formatNumber } from './context-store'
import { useIgnoreStore } from './ignore-store'

function iconColor(name: string) {
  if (name.endsWith('.ts') || name.endsWith('.js')) return 'text-sky-400'
  if (name.endsWith('.tsx') || name.endsWith('.jsx')) return 'text-cyan-400'
  if (name.endsWith('.json')) return 'text-amber-400'
  if (name.endsWith('.md')) return 'text-muted-foreground'
  if (name.endsWith('.rs')) return 'text-orange-400'
  return 'text-sky-400'
}

function matchesSearch(node: ProjectNode, q: string): boolean {
  if (!q) return true
  if (node.name.toLowerCase().includes(q)) return true
  return (node.children ?? []).some(c => matchesSearch(c, q))
}

/** Collect selectable (non-ignored) file paths under a node. */
function collectSelectableFiles(node: ProjectNode): string[] {
  if (node.ignored) return []
  if (node.nodeType === 'file') return [node.path]
  const acc: string[] = []
  for (const c of node.children ?? []) acc.push(...collectSelectableFiles(c))
  return acc
}

function collectFiles(node: ProjectNode): string[] {
  if (node.nodeType === 'file') return [node.path]
  const acc: string[] = []
  for (const c of node.children ?? []) acc.push(...collectFiles(c))
  return acc
}

type CheckState = 'none' | 'all' | 'indet'

function dirCheckState(files: string[], selected: Set<string>): CheckState {
  if (files.length === 0) return 'none'
  const n = files.filter(p => selected.has(p)).length
  if (n === 0) return 'none'
  if (n === files.length) return 'all'
  return 'indet'
}

function CheckBox({
  state,
  onClick,
  title,
  tone = 'primary',
  disabled,
}: {
  state: CheckState
  onClick: (e: React.MouseEvent) => void
  title: string
  tone?: 'primary' | 'accent'
  disabled?: boolean
}) {
  const filled =
    !disabled && (state === 'all' || state === 'indet')
      ? tone === 'primary'
        ? 'border-primary bg-primary'
        : 'border-sky-500 bg-sky-500'
      : 'border-border/60 bg-muted/40'
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-all',
        filled,
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      {state === 'all' && !disabled && (
        <svg
          className="h-2.5 w-2.5 text-primary-foreground"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M2 6.5L5 9.5L10 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {state === 'indet' && !disabled && (
        <span className="h-[1.5px] w-[7px] rounded-[1px] bg-primary-foreground" />
      )}
    </button>
  )
}

interface FileTreeProps {
  root: ProjectNode
}

export function FileTree({ root }: FileTreeProps) {
  const { t } = useTranslation()
  const structureSelected = useContextStore(s => s.structureSelected)
  const contentSelected = useContextStore(s => s.contentSelected)
  const expanded = useContextStore(s => s.expanded)
  const search = useContextStore(s => s.search)
  const toggleExpand = useContextStore(s => s.toggleExpand)
  const toggleStructureFile = useContextStore(s => s.toggleStructureFile)
  const toggleStructureDir = useContextStore(s => s.toggleStructureDir)
  const toggleContentFile = useContextStore(s => s.toggleContentFile)
  const toggleContentDir = useContextStore(s => s.toggleContentDir)
  const project = useProjectStore(s => s.project)
  const rescan = useProjectStore(s => s.rescan)
  const addGlobal = useIgnoreStore(s => s.addGlobal)
  const addProject = useIgnoreStore(s => s.addProject)
  const removeGlobal = useIgnoreStore(s => s.removeGlobal)
  const removeProject = useIgnoreStore(s => s.removeProject)
  const listForProject = useIgnoreStore(s => s.listForProject)
  const [menu, setMenu] = useState<{
    x: number
    y: number
    path: string
    name: string
    isDir: boolean
    ignored: boolean
  } | null>(null)

  const q = search.trim().toLowerCase()

  const openIgnoreMenu = (e: React.MouseEvent, node: ProjectNode) => {
    e.preventDefault()
    e.stopPropagation()
    if (!node.path) return
    setMenu({
      x: e.clientX,
      y: e.clientY,
      path: node.path,
      name: node.name,
      isDir: node.nodeType === 'dir',
      ignored: Boolean(node.ignored),
    })
  }

  const closeMenu = () => setMenu(null)

  const runIgnore = async (scope: 'project' | 'global') => {
    if (!menu || !project) return
    const prefix = menu.path
    if (scope === 'project') addProject(project.rootPath, prefix)
    else addGlobal(prefix)
    closeMenu()
    toast.success(
      scope === 'project'
        ? t('context.ignoreAddedProject', { path: prefix })
        : t('context.ignoreAddedGlobal', { path: prefix })
    )
    await rescan()
  }

  /** Remove the longest matching ignore prefix so this path becomes selectable again. */
  const runUnignore = async () => {
    if (!menu || !project) return
    const path = menu.path
    const prefixes = listForProject(project.rootPath)
      .filter(p => path === p || path.startsWith(`${p}/`))
      .sort((a, b) => b.length - a.length)
    if (prefixes.length === 0) {
      closeMenu()
      return
    }
    // Remove all matching prefixes (global + project) for a clean unignore
    for (const prefix of prefixes) {
      removeGlobal(prefix)
      removeProject(project.rootPath, prefix)
    }
    closeMenu()
    toast.success(t('context.unignoreDone', { path: prefixes[0] }))
    await rescan()
  }

  const renderNode = (node: ProjectNode, depth: number): React.ReactNode => {
    if (!matchesSearch(node, q)) return null
    const isDir = node.nodeType === 'dir'
    const isExpanded = expanded.has(node.path)
    const pad = Math.min(depth, 6) * 13 + 6
    const ignored = node.ignored
    const files = isDir
      ? collectSelectableFiles(node)
      : ignored
        ? []
        : [node.path]
    // Empty dir: treat the directory path itself as the selection key
    const dirKeys =
      isDir && files.length === 0 && !ignored && node.path ? [node.path] : files
    const sState = ignored
      ? 'none'
      : dirCheckState(isDir ? dirKeys : [node.path], structureSelected)
    const cState = ignored
      ? 'none'
      : isDir
        ? dirCheckState(files, contentSelected)
        : contentSelected.has(node.path)
          ? 'all'
          : 'none'
    const anySel = !ignored && (sState !== 'none' || cState !== 'none')

    return (
      <div key={node.path || node.name}>
        <div
          className={cn(
            'group flex select-none items-center gap-1.5 rounded-[5px] py-[3px] pr-1.5 text-[12.5px] transition-colors',
            ignored
              ? 'cursor-default opacity-45'
              : 'cursor-pointer hover:bg-muted/60',
            anySel && !ignored ? 'text-foreground' : 'text-muted-foreground'
          )}
          style={{ paddingLeft: pad }}
          title={
            ignored ? t('context.ignoredTooltip', { path: node.path }) : undefined
          }
          onClick={() => {
            if (ignored) return
            if (isDir) toggleStructureDir(node)
            else toggleStructureFile(node.path)
          }}
          onContextMenu={e => openIgnoreMenu(e, node)}
        >
          <button
            type="button"
            className={cn(
              'flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[9px] text-muted-foreground transition-transform',
              isDir ? '' : 'invisible',
              isDir && isExpanded ? 'rotate-90' : ''
            )}
            onClick={e => {
              e.stopPropagation()
              if (isDir) toggleExpand(node.path)
            }}
          >
            <ChevronRight className="h-3 w-3" />
          </button>

          <span>
            <CheckBox
              state={sState}
              title={t('context.structureInclude')}
              disabled={ignored}
              onClick={e => {
                e.stopPropagation()
                if (ignored) return
                if (isDir) toggleStructureDir(node)
                else toggleStructureFile(node.path)
              }}
            />
          </span>

          <span>
            <CheckBox
              state={cState}
              tone="accent"
              title={
                isDir
                  ? t('context.contentIncludeDir')
                  : t('context.contentInclude')
              }
              disabled={ignored}
              onClick={e => {
                e.stopPropagation()
                if (ignored) return
                if (isDir) toggleContentDir(node)
                else toggleContentFile(node.path)
              }}
            />
          </span>

          <span
            className={cn(
              'flex w-3.5 shrink-0 items-center justify-center',
              isDir ? 'text-indigo-400' : iconColor(node.name)
            )}
          >
            {isDir ? (
              <Folder className="h-[13px] w-[13px]" />
            ) : (
              <FileText className="h-[13px] w-[13px]" />
            )}
          </span>
          <span className="truncate">{node.name}</span>
          {ignored && (
            <span className="mr-1 shrink-0 text-[10px] text-amber-500/80">
              <Ban className="h-3 w-3" />
            </span>
          )}
          {node.nodeType === 'file' && node.size != null && (
            <span className="ml-auto shrink-0 pr-1 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
              {formatNumber(Math.round(node.size))}
            </span>
          )}
        </div>
        {isDir && isExpanded && (
          <div>{(node.children ?? []).map(c => renderNode(c, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5 pb-4">
      <div className="mb-1 flex items-center gap-3 px-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px] border border-primary bg-primary" />
          {t('context.structureClickRow')}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px] border border-sky-500 bg-sky-500" />
          {t('context.contentClickBox')}
        </span>
        <span className="ml-auto">{t('context.rightClickIgnoreHint')}</span>
      </div>
      {(root.children ?? []).map(c => renderNode(c, 0))}

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} />
          <div
            className="fixed z-50 min-w-[200px] overflow-hidden rounded-lg border bg-card py-1 shadow-lg"
            style={{ left: menu.x, top: menu.y }}
          >
            <div className="truncate px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
              {menu.path}
            </div>
            <div className="border-t pt-1">
              {menu.ignored ? (
                <button
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-[12px] text-emerald-500 hover:bg-muted"
                  onClick={() => void runUnignore()}
                >
                  {t('context.unignore')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-muted"
                    onClick={() => void runIgnore('project')}
                  >
                    {t('context.ignoreProject')}
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-muted"
                    onClick={() => void runIgnore('global')}
                  >
                    {t('context.ignoreGlobal')}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* eslint-disable react-refresh/only-export-components */
export function useFileCount(root: ProjectNode | null): number {
  return useMemo(() => {
    if (!root) return 0
    return collectFiles(root).length
  }, [root])
}
