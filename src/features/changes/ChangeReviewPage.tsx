import { toast } from 'sonner'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { cn } from '@/lib/utils'
import { MonacoDiff } from '@/components/code'
import { useProjectStore } from '@/features/project/project-store'
import {
  useChangesStore,
  pendingCount,
  type ReviewChange,
} from './changes-store'

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

const STATUS_CLS: Record<ReviewChange['status'], string> = {
  pending: 'text-muted-foreground',
  accepted: 'text-primary',
  rejected: 'text-red-500',
  applied: 'text-emerald-500',
  failed: 'text-red-500',
}

export function ChangeReviewPage() {
  const project = useProjectStore(s => s.project)
  const changes = useChangesStore(s => s.changes)
  const activeId = useChangesStore(s => s.activeId)
  const selectChange = useChangesStore(s => s.selectChange)
  const setChangeStatus = useChangesStore(s => s.setChangeStatus)
  const applyOne = useChangesStore(s => s.applyOne)
  const applyPending = useChangesStore(s => s.applyPending)
  const rejectOne = useChangesStore(s => s.rejectOne)
  const rejectAll = useChangesStore(s => s.rejectAll)
  const undoLast = useChangesStore(s => s.undoLast)
  const lastChangeSetId = useChangesStore(s => s.lastChangeSetId)
  const conflictPath = useChangesStore(s => s.conflictPath)
  const dismissConflict = useChangesStore(s => s.dismissConflict)
  const applySummary = useChangesStore(s => s.applySummary)
  const dismissSummary = useChangesStore(s => s.dismissSummary)

  const active = changes.find(c => c.id === activeId) ?? changes[0]
  const added = changes.filter(c => c.type === 'add').length
  const modified = changes.filter(c => c.type === 'modify').length
  const deleted = changes.filter(c => c.type === 'delete').length
  const pending = pendingCount(changes)

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        请先打开项目
      </div>
    )
  }

  if (changes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
        <p className="text-sm">暂无变更</p>
        <p className="text-xs">
          请先在 AI Exchange 中粘贴并解析 AI Response JSON
        </p>
      </div>
    )
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
      <ResizablePanel
        defaultSize={30}
        minSize={18}
        maxSize={48}
        className="min-w-0"
      >
        <div className="flex h-full min-h-0 min-w-0 flex-col border-r bg-background/40">
          <div className="shrink-0 border-b px-3.5 py-3">
            <div className="text-[12px] font-semibold">
              {changes.length} files changed
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              + {added} added · ~ {modified} modified · − {deleted} deleted
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {changes.map(c => {
              const isActive = c.id === active?.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectChange(c.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2.5 text-left transition-colors',
                    isActive
                      ? 'border-border bg-muted'
                      : 'border-transparent hover:bg-muted/50'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] font-mono text-[12px] font-bold',
                      SYM_CLS[c.type]
                    )}
                  >
                    {SYM[c.type]}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate font-mono text-[11.5px]',
                      isActive ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {c.path}
                  </span>
                  <span
                    className={cn('shrink-0 text-[10px]', STATUS_CLS[c.status])}
                  >
                    {c.status === 'pending' ? '' : c.status}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex shrink-0 flex-col gap-[7px] border-t p-2.5">
            <Button
              size="sm"
              className="h-8 bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
              disabled={pending === 0}
              onClick={async () => {
                try {
                  await applyPending(project.rootPath)
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : String(e))
                }
              }}
            >
              Apply ({pending})
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-red-500/35 text-red-500 hover:bg-red-500/10"
              onClick={() => rejectAll()}
            >
              Reject All
            </Button>
            {lastChangeSetId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={async () => {
                  try {
                    await undoLast(project.rootPath)
                    toast.success('已从 .history 快照撤销')
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : String(e))
                  }
                }}
              >
                <Undo2 className="mr-1 h-3.5 w-3.5" />
                Undo
              </Button>
            )}
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={70} minSize={40} className="min-w-0">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="flex h-[42px] shrink-0 items-center gap-2.5 overflow-hidden border-b px-3.5">
            <span className="min-w-0 flex-1 truncate font-mono text-[12px]">
              {active?.path ?? '—'}
            </span>
            <div className="ml-auto flex shrink-0 gap-[7px]">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-[11.5px]"
                disabled={!active || active.status === 'applied'}
                onClick={() => active && setChangeStatus(active.id, 'accepted')}
              >
                Accept
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 border-red-500/35 px-2.5 text-[11.5px] text-red-500 hover:bg-red-500/10"
                disabled={!active || active.status !== 'pending'}
                onClick={() => active && rejectOne(active.id)}
              >
                Reject
              </Button>
              <Button
                size="sm"
                className="h-7 bg-emerald-600 px-2.5 text-[11.5px] font-semibold text-white hover:bg-emerald-500"
                disabled={
                  !active ||
                  active.status === 'applied' ||
                  active.status === 'rejected'
                }
                onClick={async () => {
                  if (!active) return
                  try {
                    await applyOne(active.id, project.rootPath)
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : String(e))
                  }
                }}
              >
                Apply
              </Button>
            </div>
          </div>

          {applySummary && (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-[12px]">
              <span className="flex-1 text-emerald-600 dark:text-emerald-400">
                ✓ Changes applied — {applySummary.applied} files ( +
                {applySummary.added} · ~{applySummary.modified} · −
                {applySummary.deleted})
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={async () => {
                  try {
                    await undoLast(project.rootPath)
                    toast.success('已撤销')
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : String(e))
                  }
                }}
              >
                Undo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={dismissSummary}
              >
                Done
              </Button>
            </div>
          )}

          {conflictPath && (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[12px]">
              <span className="min-w-0 flex-1 text-amber-600 dark:text-amber-400">
                ⚠ File changed externally:{' '}
                <code className="break-all">{conflictPath}</code>
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => {
                  dismissConflict()
                  void (async () => {
                    if (!active) return
                    try {
                      await applyOne(active.id, project.rootPath, true)
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : String(e))
                    }
                  })()
                }}
              >
                Overwrite
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={dismissConflict}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Monaco DiffEditor: left Current | right AI Changes */}
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-0">
            {active ? (
              <MonacoDiff
                path={active.path}
                original={
                  active.type === 'add' ? '' : (active.oldContent ?? '')
                }
                modified={
                  active.type === 'delete' ? '' : (active.newContent ?? '')
                }
              />
            ) : null}
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
