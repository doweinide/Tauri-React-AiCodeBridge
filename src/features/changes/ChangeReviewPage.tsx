import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { List, Network, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { ChangesTreeView } from './ChangesTreeView'

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
  const { t } = useTranslation()
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
  const [listView, setListView] = useState<'flat' | 'tree'>('flat')

  const active = changes.find(c => c.id === activeId) ?? changes[0]
  const added = changes.filter(c => c.type === 'add').length
  const modified = changes.filter(c => c.type === 'modify').length
  const deleted = changes.filter(c => c.type === 'delete').length
  const pending = pendingCount(changes)

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t('review.noProject')}
      </div>
    )
  }

  if (changes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
        <p className="text-sm">{t('review.emptyTitle')}</p>
        <p className="text-xs">{t('review.emptyHint')}</p>
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
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold">
                  {t('review.filesChanged', { count: changes.length })}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {t('review.summary', { added, modified, deleted })}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 rounded-md border bg-background/60 p-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-6 w-6',
                        listView === 'flat'
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground'
                      )}
                      onClick={() => setListView('flat')}
                    >
                      <List className="h-3.5 w-3.5" />
                      <span className="sr-only">{t('review.viewList')}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[11px]">
                    {t('review.viewList')}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-6 w-6',
                        listView === 'tree'
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground'
                      )}
                      onClick={() => setListView('tree')}
                    >
                      <Network className="h-3.5 w-3.5" />
                      <span className="sr-only">{t('review.viewTree')}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[11px]">
                    {t('review.viewTree')}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {listView === 'tree' ? (
              <ChangesTreeView
                changes={changes}
                activeId={active?.id ?? null}
                onSelect={selectChange}
              />
            ) : (
              changes.map(c => {
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
                      className={cn(
                        'shrink-0 text-[10px]',
                        STATUS_CLS[c.status]
                      )}
                    >
                      {c.status === 'pending'
                        ? ''
                        : t(`review.status.${c.status}`)}
                    </span>
                  </button>
                )
              })
            )}
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
              {t('review.apply', { count: pending })}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-red-500/35 text-red-500 hover:bg-red-500/10"
              onClick={() => rejectAll()}
            >
              {t('review.rejectAll')}
            </Button>
            {lastChangeSetId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={async () => {
                  try {
                    await undoLast(project.rootPath)
                    toast.success(t('review.undoOk'))
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : String(e))
                  }
                }}
              >
                <Undo2 className="mr-1 h-3.5 w-3.5" />
                {t('review.undo')}
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
                {t('review.accept')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 border-red-500/35 px-2.5 text-[11.5px] text-red-500 hover:bg-red-500/10"
                disabled={!active || active.status !== 'pending'}
                onClick={() => active && rejectOne(active.id)}
              >
                {t('review.reject')}
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
                {t('review.appliedSummary', {
                  applied: applySummary.applied,
                  added: applySummary.added,
                  modified: applySummary.modified,
                  deleted: applySummary.deleted,
                })}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={async () => {
                  try {
                    await undoLast(project.rootPath)
                    toast.success(t('review.undoOkShort'))
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : String(e))
                  }
                }}
              >
                {t('review.undo')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={dismissSummary}
              >
                {t('review.done')}
              </Button>
            </div>
          )}

          {conflictPath && (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[12px]">
              <span className="min-w-0 flex-1 text-amber-600 dark:text-amber-400">
                {t('review.conflict')}{' '}
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
                      toast.success(t('review.overwritten'))
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : String(e))
                    }
                  })()
                }}
              >
                {t('review.overwrite')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={dismissConflict}
              >
                {t('review.cancel')}
              </Button>
            </div>
          )}

          <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-0">
            {active ? (
              <MonacoDiff
                path={active.path}
                original={active.type === 'add' ? '' : (active.oldContent ?? '')}
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
