import { useMemo, useState } from 'react'
import { ChevronRight, Folder } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReviewChange } from './changes-store'

const SYM: Record<ReviewChange['type'], string> = {
  add: '+',
  modify: '~',
  delete: '−',
}

const SYM_CLS: Record<ReviewChange['type'], string> = {
  add: 'bg-emerald-500/12 text-emerald-500',
  modify: 'bg-amber-500/12 text-amber-500',
  delete: 'bg-red-500/12 text-red-500',
}

interface DirNode {
  name: string
  path: string
  dirs: Map<string, DirNode>
  files: ReviewChange[]
}

function buildTree(changes: ReviewChange[]): DirNode {
  const root: DirNode = { name: '', path: '', dirs: new Map(), files: [] }
  for (const c of changes) {
    const parts = c.path.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i] ?? ''
      if (!seg) continue
      let next = node.dirs.get(seg)
      if (!next) {
        const path = node.path ? `${node.path}/${seg}` : seg
        next = { name: seg, path, dirs: new Map(), files: [] }
        node.dirs.set(seg, next)
      }
      node = next
    }
    node.files.push(c)
  }
  return root
}

function sortNode(node: DirNode) {
  for (const child of node.dirs.values()) sortNode(child)
  // keep Map insertion order after sort by re-creating
  const sortedDirs = [...node.dirs.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )
  node.dirs = new Map(sortedDirs)
  node.files.sort((a, b) => a.path.localeCompare(b.path))
}

export interface ChangesTreeViewProps {
  changes: ReviewChange[]
  activeId: string | null
  onSelect: (id: string) => void
}

/**
 * Hierarchical view of changed files by directory.
 */
export function ChangesTreeView({
  changes,
  activeId,
  onSelect,
}: ChangesTreeViewProps) {
  const root = useMemo(() => {
    const tree = buildTree(changes)
    sortNode(tree)
    return tree
  }, [changes])

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  const toggleDir = (path: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const renderDir = (node: DirNode, depth: number): React.ReactNode => {
    if (node.dirs.size === 0 && node.files.length === 0) return null
    const isCollapsed = collapsed.has(node.path)
    const pad = Math.min(depth, 8) * 12 + 4

    return (
      <div key={node.path || 'root'}>
        {node.path && (
          <button
            type="button"
            onClick={() => toggleDir(node.path)}
            className="flex w-full items-center gap-1.5 rounded-md py-1 pr-1.5 text-[11.5px] text-muted-foreground transition-colors select-none hover:bg-muted/60 hover:text-foreground"
            style={{ paddingLeft: pad }}
          >
            <ChevronRight
              className={cn(
                'h-3 w-3 shrink-0 transition-transform',
                !isCollapsed && 'rotate-90'
              )}
            />
            <Folder className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
            <span className="truncate">{node.name}</span>
          </button>
        )}

        {!isCollapsed && (
          <>
            {node.files.map(c => {
              const isActive = c.id === activeId
              const filePad = node.path ? pad + 14 : pad
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md py-1.5 pr-1.5 text-left transition-colors',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50'
                  )}
                  style={{ paddingLeft: filePad }}
                >
                  <span
                    className={cn(
                      'flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] font-mono text-[11px] font-bold',
                      SYM_CLS[c.type]
                    )}
                  >
                    {SYM[c.type]}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate font-mono text-[11.5px]',
                      isActive && 'font-medium'
                    )}
                  >
                    {c.path.split('/').pop()}
                  </span>
                </button>
              )
            })}
            {[...node.dirs.values()].map(child =>
              renderDir(child, node.path ? depth + 1 : depth)
            )}
          </>
        )}
      </div>
    )
  }

  return <div className="px-1">{renderDir(root, 0)}</div>
}
