import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CheckCheck,
  Copy,
  Download,
  Eraser,
  FileJson,
  MoveRight,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { CodeViewer, JsonTreeView } from '@/components/code'
import { useProjectStore } from '@/features/project/project-store'
import { useAppSettingsStore } from '@/store/app-settings-store'
import { FileTree, useFileCount } from './FileTree'
import { ImportSelectionDialog } from './ImportSelectionDialog'
import { serializeSelection, getSelectionPrompt } from '@/lib/protocol'
import {
  formatNumber,
  useContextStore,
  type PreviewTab,
} from './context-store'

function IconAction({
  label,
  onClick,
  children,
  tone = 'default',
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  tone?: 'default' | 'primary'
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-6 w-6 text-muted-foreground hover:text-foreground',
            tone === 'primary' && 'hover:text-primary'
          )}
          onClick={onClick}
        >
          {children}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px]">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

const TABS: { id: PreviewTab; labelKey: string }[] = [
  { id: 'tree', labelKey: 'context.tab.tree' },
  { id: 'json', labelKey: 'context.tab.json' },
  { id: 'raw', labelKey: 'context.tab.raw' },
  { id: 'md', labelKey: 'context.tab.md' },
]

export function ContextBuilderPage() {
  const { t } = useTranslation()
  const project = useProjectStore(s => s.project)
  const rescan = useProjectStore(s => s.rescan)
  const structureSelected = useContextStore(s => s.structureSelected)
  const contentSelected = useContextStore(s => s.contentSelected)
  const search = useContextStore(s => s.search)
  const setSearch = useContextStore(s => s.setSearch)
  const selectAllStructure = useContextStore(s => s.selectAllStructure)
  const selectAllContent = useContextStore(s => s.selectAllContent)
  const clearStructure = useContextStore(s => s.clearStructure)
  const clearContent = useContextStore(s => s.clearContent)
  const copyStructureToContent = useContextStore(s => s.copyStructureToContent)
  const exportSelection = useContextStore(s => s.exportSelection)
  const buildResult = useContextStore(s => s.buildResult)
  const protocolContext = useContextStore(s => s.protocolContext)
  const previewText = useContextStore(s => s.previewText)
  const previewTab = useContextStore(s => s.previewTab)
  const setPreviewTab = useContextStore(s => s.setPreviewTab)
  const refreshPreview = useContextStore(s => s.refreshPreview)
  const copyContext = useContextStore(s => s.copyContext)
  const copyMarkdown = useContextStore(s => s.copyMarkdown)
  const markdownText = useContextStore(s => s.markdownText)
  const reset = useContextStore(s => s.reset)
  const selectedFileForCode = useContextStore(s => s.selectedFileForCode)
  const setSelectedFileForCode = useContextStore(s => s.setSelectedFileForCode)
  const fileCount = useFileCount(project?.tree ?? null)
  const tokenStats = useContextStore(s => s.tokenStats)
  const projectTokens = useContextStore(s => s.projectTokens)
  const reduction = useContextStore(s => s.reductionPercent)
  const charsPerToken = useAppSettingsStore(s => s.charsPerToken)
  const [copied, setCopied] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const lastRootRef = useRef<string | null>(null)

  useEffect(() => {
    // Only reset when switching to a different project, not on every remount
    // (remount happens when navigating Settings → Context, which would wipe selection)
    const root = project?.rootPath
    if (!root) return
    if (lastRootRef.current === root) return
    lastRootRef.current = root
    reset()
  }, [project?.rootPath, reset])

  useEffect(() => {
    if (!project) return
    void refreshPreview(project.rootPath)
  }, [
    project,
    structureSelected,
    contentSelected,
    refreshPreview,
    charsPerToken,
  ])

  const codeFile = useMemo(() => {
    if (!selectedFileForCode || !buildResult) return null
    return buildResult.files.find(f => f.path === selectedFileForCode) ?? null
  }, [selectedFileForCode, buildResult])

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <p className="text-sm">{t('context.emptyTitle')}</p>
        <p className="text-xs">{t('context.emptyHint')}</p>
      </div>
    )
  }

  const doCopy = async () => {
    try {
      await refreshPreview(project.rootPath)
      await copyContext()
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast.success(t('context.copySuccess'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/30 px-2.5 py-2 sm:flex-nowrap sm:px-3">
        <div className="flex w-full min-w-[140px] max-w-[200px] flex-1 items-center gap-1.5 rounded-[7px] border border-transparent bg-muted px-2.5 py-1.5 transition-colors focus-within:border-primary sm:w-[180px] sm:flex-none">
          <Search className="h-[13px] w-[13px] shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('context.search')}
            className="h-auto w-full min-w-0 border-none bg-transparent p-0 text-[12px] shadow-none outline-none focus-visible:ring-0"
          />
        </div>

        <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />

        {/* 结构 legend + icon actions */}
        <div className="flex items-center gap-0.5 rounded-md border border-border/60 bg-background/40 px-1.5 py-0.5">
          <span
            className="mr-0.5 inline-block h-2.5 w-2.5 rounded-[3px] border border-primary bg-primary"
            aria-hidden
          />
          <span className="mr-0.5 text-[10.5px] font-medium tracking-wide text-muted-foreground">
            {t('context.structure')}
          </span>
          <IconAction
            label={t('context.selectAllStructure')}
            onClick={() => void selectAllStructure(project.tree, true)}
          >
            <CheckCheck className="h-3.5 w-3.5" />
          </IconAction>
          <IconAction label={t('context.clearStructure')} onClick={clearStructure}>
            <Eraser className="h-3.5 w-3.5" />
          </IconAction>
        </div>

        {/* 同步：结构 → 内容（居中） */}
        <IconAction
          label={t('context.syncStructureToContent')}
          tone="primary"
          onClick={() => {
            copyStructureToContent()
            toast.success(t('context.syncDone'))
          }}
        >
          <MoveRight className="h-3.5 w-3.5" />
        </IconAction>

        {/* 内容 legend + icon actions */}
        <div className="flex items-center gap-0.5 rounded-md border border-border/60 bg-background/40 px-1.5 py-0.5">
          <span
            className="mr-0.5 inline-block h-2.5 w-2.5 rounded-[3px] border border-sky-500 bg-sky-500"
            aria-hidden
          />
          <span className="mr-0.5 text-[10.5px] font-medium tracking-wide text-muted-foreground">
            {t('context.content')}
          </span>
          <IconAction
            label={t('context.selectAllContent')}
            onClick={() => selectAllContent(project.tree, true)}
          >
            <CheckCheck className="h-3.5 w-3.5" />
          </IconAction>
          <IconAction label={t('context.clearContent')} onClick={clearContent}>
            <Eraser className="h-3.5 w-3.5" />
          </IconAction>
        </div>

        <IconAction
          label={t('context.importSelection')}
          onClick={() => setImportOpen(true)}
        >
          <FileJson className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction
          label={t('context.exportSelection')}
          onClick={async () => {
            try {
              const sel = exportSelection()
              await navigator.clipboard.writeText(serializeSelection(sel))
              toast.success(t('context.exportSelectionOk'))
            } catch (e) {
              toast.error(e instanceof Error ? e.message : String(e))
            }
          }}
        >
          <Download className="h-3.5 w-3.5" />
        </IconAction>
        <IconAction
          label={t('context.copySelectionPrompt')}
          onClick={async () => {
            await navigator.clipboard.writeText(getSelectionPrompt('zh'))
            toast.success(t('context.copySelectionPromptOk'))
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </IconAction>

        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-[11.5px]"
          onClick={() => void rescan()}
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Rescan
        </Button>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {previewTab === 'md' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[11.5px]"
              disabled={!protocolContext}
              onClick={async () => {
                try {
                  await copyMarkdown()
                  toast.success(t('context.copyMdSuccess'))
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : String(e))
                }
              }}
            >
              <Copy className="mr-1 h-3 w-3" />
              {t('context.copyMd')}
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 px-2.5 text-[11.5px]"
            onClick={() => void doCopy()}
          >
            <Copy className="mr-1 h-3 w-3" />
            {copied ? t('context.copied') : t('context.copyContext')}
          </Button>
        </div>
      </div>

      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-0 min-w-0 flex-1"
      >
        <ResizablePanel
          defaultSize={32}
          minSize={20}
          maxSize={52}
          className="min-w-0"
        >
          <div className="flex h-full min-h-0 min-w-0 flex-col border-r bg-background/40">
            <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[.5px] text-muted-foreground">
                {t('context.fileTree')}
              </span>
              <span className="rounded-full bg-muted px-2 py-px text-[10.5px] font-medium text-muted-foreground">
                {t('context.filesCount', { count: fileCount })}
              </span>
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-px text-[10.5px] font-medium text-primary">
                {t('context.scCount', { structure: structureSelected.size, content: contentSelected.size })}
              </span>
            </div>
            {project.tree ? <FileTree root={project.tree} /> : null}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={68} minSize={40} className="min-w-0">
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPreviewTab(tab.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11.5px] transition-colors',
                    previewTab === tab.id
                      ? 'bg-primary/12 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {t(tab.labelKey)}
                </button>
              ))}
              <span className="ml-auto truncate text-[11px] text-muted-foreground">
                {t('context.previewHint')}
              </span>
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-2">
              {previewTab === 'tree' && protocolContext ? (
                <div className="flex h-full min-h-0 flex-col gap-2">
                  <JsonTreeView
                    value={protocolContext}
                    collapsed={1}
                    className="min-h-0 flex-1"
                  />
                  {(buildResult?.files.length ?? 0) > 0 && (
                    <div className="flex max-h-[40%] min-h-0 shrink-0 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-1 px-1">
                        <span className="text-[11px] text-muted-foreground">
                          {t('context.contentFilesLabel')}
                        </span>
                        {(buildResult?.files ?? []).map(f => (
                          <button
                            key={f.path}
                            type="button"
                            onClick={() => setSelectedFileForCode(f.path)}
                            className={cn(
                              'rounded px-1.5 py-0.5 font-mono text-[10.5px] transition-colors',
                              selectedFileForCode === f.path
                                ? 'bg-primary/15 text-primary'
                                : 'bg-muted text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {f.path.split('/').pop()}
                          </button>
                        ))}
                      </div>
                      {codeFile ? (
                        <CodeViewer
                          value={codeFile.content}
                          className="min-h-0 flex-1"
                          minHeight="140px"
                        />
                      ) : (
                        <p className="px-1 text-[11px] text-muted-foreground">
                          {t('context.selectFileHint')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : previewTab === 'json' && protocolContext ? (
                <JsonTreeView
                  value={protocolContext}
                  collapsed={false}
                  className="h-full"
                />
              ) : previewTab === 'md' ? (
                <pre className="m-0 h-full min-h-0 overflow-auto bg-background px-3 py-3 font-mono text-[11.5px] leading-[1.72] whitespace-pre text-muted-foreground select-text">
                  {markdownText}
                </pre>
              ) : (
                <pre className="m-0 h-full min-h-0 overflow-auto bg-background px-3 py-3 font-mono text-[11.5px] leading-[1.72] whitespace-pre text-muted-foreground select-text">
                  {previewText}
                </pre>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {project.tree ? (
        <ImportSelectionDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          root={project.tree}
        />
      ) : null}

      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-t bg-muted/30 px-3 py-2.5 sm:gap-[22px] sm:px-4">
        <Stat
          label={t('context.structureFiles')}
          value={String(buildResult?.structureFileCount ?? 0)}
        />
        <Stat
          label={t('context.contentFiles')}
          value={String(buildResult?.contentFileCount ?? 0)}
          accent
        />
        <Stat
          label={t('context.characters')}
          value={formatNumber(tokenStats?.payloadChars ?? 0)}
          hint={t('context.payloadHint')}
        />
        <Stat
          label={t('context.estimatedTokens')}
          value={`~${formatNumber(tokenStats?.estimatedTokens ?? 0)}`}
          accent
          hint={t('context.tokenHint')}
        />
        <Stat
          label={t('context.projectTotal')}
          value={`~${formatNumber(projectTokens)}`}
          muted
        />
        <div className="ml-auto flex items-center gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5">
          <div className="font-mono text-[15px] font-bold text-emerald-500">
            {reduction.toFixed(1)}%
          </div>
          <div className="text-[10.5px] leading-[1.3] text-emerald-400">
            {t('context.tokenReduction')}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
  muted,
  hint,
}: {
  label: string
  value: string
  accent?: boolean
  muted?: boolean
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-px">
      <div className="text-[10px] font-semibold uppercase tracking-[.7px] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'font-mono text-[14px] font-semibold tracking-[-.3px]',
          accent && 'text-primary',
          muted && 'text-muted-foreground'
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className="text-[10.5px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  )
}
