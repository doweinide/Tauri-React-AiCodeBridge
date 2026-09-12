import { useMemo } from 'react'
import { Folder, FileText, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectNode } from '@/lib/tauri/tauri-bindings'
import { useContextStore, formatNumber } from './context-store'

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
}: {
  state: CheckState
  onClick: (e: React.MouseEvent) => void
  title: string
  tone?: 'primary' | 'accent'
}) {
  const filled =
    state === 'all' || state === 'indet'
      ? tone === 'primary'
        ? 'border-primary bg-primary'
        : 'border-sky-500 bg-sky-500'
      : 'border-border bg-background'
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-all',
        filled
      )}
    >
      {state === 'all' && (
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
      {state === 'indet' && (
        <span className="h-[1.5px] w-[7px] rounded-[1px] bg-primary-foreground" />
      )}
    </button>
  )
}

interface FileTreeProps {
  root: ProjectNode
}

export function FileTree({ root }: FileTreeProps) {
  const structureSelected = useContextStore(s => s.structureSelected)
  const contentSelected = useContextStore(s => s.contentSelected)
  const expanded = useContextStore(s => s.expanded)
  const search = useContextStore(s => s.search)
  const toggleExpand = useContextStore(s => s.toggleExpand)
  const toggleStructureFile = useContextStore(s => s.toggleStructureFile)
  const toggleStructureDir = useContextStore(s => s.toggleStructureDir)
  const toggleContentFile = useContextStore(s => s.toggleContentFile)
  const toggleContentDir = useContextStore(s => s.toggleContentDir)

  const q = search.trim().toLowerCase()

  const renderNode = (node: ProjectNode, depth: number): React.ReactNode => {
    if (!matchesSearch(node, q)) return null
    const isDir = node.nodeType === 'dir'
    const isExpanded = expanded.has(node.path)
    const pad = Math.min(depth, 6) * 13 + 6
    const files = isDir ? collectFiles(node) : [node.path]
    const sState = dirCheckState(files, structureSelected)
    const cState = isDir
      ? dirCheckState(files, contentSelected)
      : contentSelected.has(node.path)
        ? 'all'
        : 'none'
    const anySel = sState !== 'none' || cState !== 'none'

    return (
      <div key={node.path || node.name}>
        <div
          className={cn(
            'group flex cursor-pointer select-none items-center gap-1.5 rounded-[5px] py-[3px] pr-1.5 text-[12.5px] transition-colors hover:bg-muted/60',
            anySel ? 'text-foreground' : 'text-muted-foreground'
          )}
          style={{ paddingLeft: pad }}
          onClick={() => {
            if (isDir) toggleStructureDir(node)
            else toggleStructureFile(node.path)
          }}
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

          <span title="结构包含">
            <CheckBox
              state={sState}
              title="结构包含"
              onClick={e => {
                e.stopPropagation()
                if (isDir) toggleStructureDir(node)
                else toggleStructureFile(node.path)
              }}
            />
          </span>

          {isDir ? (
            <span title="内容包含（该目录下文件）">
              <CheckBox
                state={cState}
                tone="accent"
                title="内容包含"
                onClick={e => {
                  e.stopPropagation()
                  toggleContentDir(node)
                }}
              />
            </span>
          ) : (
            <span title="内容包含">
              <CheckBox
                state={cState}
                tone="accent"
                title="内容包含"
                onClick={e => {
                  e.stopPropagation()
                  toggleContentFile(node.path)
                }}
              />
            </span>
          )}

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
    <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5 pb-4">
      <div className="mb-1 flex items-center gap-3 px-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px] border border-primary bg-primary" />
          结构（点行）
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px] border border-sky-500 bg-sky-500" />
          内容（点框）
        </span>
      </div>
      {(root.children ?? []).map(c => renderNode(c, 0))}
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
