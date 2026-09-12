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

interface FileTreeProps {
  root: ProjectNode
}

export function FileTree({ root }: FileTreeProps) {
  const selected = useContextStore(s => s.selected)
  const expanded = useContextStore(s => s.expanded)
  const search = useContextStore(s => s.search)
  const toggleExpand = useContextStore(s => s.toggleExpand)
  const toggleFile = useContextStore(s => s.toggleFile)
  const toggleDir = useContextStore(s => s.toggleDir)

  const q = search.trim().toLowerCase()

  const renderNode = (node: ProjectNode, depth: number): React.ReactNode => {
    if (!matchesSearch(node, q)) return null
    const isDir = node.nodeType === 'dir'
    const isExpanded = expanded.has(node.path)
    const pad = Math.min(depth, 6) * 13 + 6

    const files = isDir ? collect(node) : [node.path]
    const selCount = files.filter(p => selected.has(p)).length
    const allSel = files.length > 0 && selCount === files.length
    const indet = selCount > 0 && !allSel

    return (
      <div key={node.path || node.name}>
        <div
          className={cn(
            'group flex cursor-pointer select-none items-center gap-1.5 rounded-[5px] py-[3px] pr-1.5 text-[12.5px] transition-colors hover:bg-muted/60',
            selCount > 0 ? 'text-foreground' : 'text-muted-foreground'
          )}
          style={{ paddingLeft: pad }}
          onClick={e => {
            e.stopPropagation()
            if (isDir) toggleDir(node)
            else toggleFile(node.path)
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

          <span
            className={cn(
              'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-all',
              allSel || indet
                ? 'border-primary bg-primary'
                : 'border-border bg-background'
            )}
          >
            {allSel && (
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
            {indet && (
              <span className="h-[1.5px] w-[7px] rounded-[1px] bg-primary-foreground" />
            )}
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
    <div className="flex-1 overflow-y-auto px-1.5 py-1.5 pb-4">
      {(root.children ?? []).map(c => renderNode(c, 0))}
    </div>
  )
}

function collect(node: ProjectNode): string[] {
  if (node.nodeType === 'file') return [node.path]
  const acc: string[] = []
  for (const c of node.children ?? []) acc.push(...collect(c))
  return acc
}

/* eslint-disable react-refresh/only-export-components */
export function useFileCount(root: ProjectNode | null): number {
  return useMemo(() => {
    if (!root) return 0
    const walk = (n: ProjectNode): number => {
      if (n.nodeType === 'file') return 1
      return (n.children ?? []).reduce((s, c) => s + walk(c), 0)
    }
    return walk(root)
  }, [root])
}
