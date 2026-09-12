import { useEffect } from 'react'
import { Copy, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useProjectStore } from '@/features/project/project-store'
import { FileTree, useFileCount } from './FileTree'
import { formatNumber, useContextStore } from './context-store'

export function ContextBuilderPage() {
  const project = useProjectStore(s => s.project)
  const rescan = useProjectStore(s => s.rescan)
  const selected = useContextStore(s => s.selected)
  const search = useContextStore(s => s.search)
  const setSearch = useContextStore(s => s.setSearch)
  const selectAll = useContextStore(s => s.selectAll)
  const preview = useContextStore(s => s.preview)
  const previewMode = useContextStore(s => s.previewMode)
  const setPreviewMode = useContextStore(s => s.setPreviewMode)
  const refreshPreview = useContextStore(s => s.refreshPreview)
  const reset = useContextStore(s => s.reset)
  const fileCount = useFileCount(project?.tree ?? null)

  useEffect(() => {
    reset()
  }, [project?.rootPath, reset])

  useEffect(() => {
    if (!project) return
    void refreshPreview(project.rootPath, project.tree)
  }, [project, selected, previewMode, refreshPreview])

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <p className="text-sm">尚未打开项目</p>
        <p className="text-xs">使用左上角项目切换器打开本地目录</p>
      </div>
    )
  }

  const copyContext = async (mode: 'structure' | 'selected' | 'all') => {
    setPreviewMode(mode)
    // force rebuild with new mode
    const { buildProjectContext } = await import('@/services/project')
    const { collectFilePaths } =
      await import('@/features/project/project-store')
    const paths =
      mode === 'all'
        ? collectFilePaths(project.tree)
        : mode === 'selected'
          ? [...selected]
          : []
    try {
      const result = await buildProjectContext(project.rootPath, mode, paths)
      await navigator.clipboard.writeText(result.text)
      useContextStore.setState({
        preview: result,
        previewMode: mode,
        fileHashes: Object.fromEntries(result.files.map(f => [f.path, f.hash])),
      })
      toast.success(
        mode === 'structure'
          ? '已复制项目结构'
          : mode === 'all'
            ? '已复制 Structure + All Contents'
            : '已复制 Structure + Selected Contents'
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const selectedChars = (preview?.files ?? [])
    .filter(f => selected.has(f.path) || previewMode !== 'selected')
    .reduce((s, f) => s + f.content.length, 0)

  const shownChars = preview?.totalChars ?? 0
  const shownTokens = preview?.estimatedTokens ?? 0
  const projectTokens = preview?.projectTotalTokens ?? 0
  const reduction = preview?.reductionPercent ?? 0
  const shownFiles =
    previewMode === 'structure'
      ? 0
      : previewMode === 'all'
        ? (preview?.fileCount ?? 0)
        : selected.size

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      {/* toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/30 px-2.5 py-2 sm:h-[46px] sm:flex-nowrap sm:py-0 sm:px-3">
        <div className="flex w-full min-w-[140px] max-w-[220px] flex-1 items-center gap-1.5 rounded-[7px] border border-transparent bg-muted px-2.5 py-1.5 transition-colors focus-within:border-primary sm:w-[210px] sm:flex-none">
          <Search className="h-[13px] w-[13px] shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索文件…"
            className="h-auto w-full min-w-0 border-none bg-transparent p-0 text-[12px] shadow-none outline-none focus-visible:ring-0"
          />
        </div>
        <div className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-[11.5px]"
          onClick={() => selectAll(project.tree, true)}
        >
          全选
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-[11.5px]"
          onClick={() => selectAll(project.tree, false)}
        >
          清空
        </Button>
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
          <Button
            variant="secondary"
            size="sm"
            className="h-7 px-2.5 text-[11.5px]"
            onClick={() => void copyContext('structure')}
          >
            <Copy className="mr-1 h-3 w-3" />
            Structure
          </Button>
          <Button
            size="sm"
            className="h-7 px-2.5 text-[11.5px]"
            onClick={() => void copyContext('selected')}
          >
            <Copy className="mr-1 h-3 w-3" />
            Structure + Selected
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 px-2.5 text-[11.5px]"
            onClick={() => void copyContext('all')}
          >
            Structure + All
          </Button>
        </div>
      </div>

      {/* body — resizable file tree | preview */}
      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-0 min-w-0 flex-1"
      >
        <ResizablePanel
          defaultSize={28}
          minSize={16}
          maxSize={48}
          className="min-w-0"
        >
          <div className="flex h-full min-h-0 min-w-0 flex-col border-r bg-background/40">
            <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[.5px] text-muted-foreground">
                File Tree
              </span>
              <span className="rounded-full bg-muted px-2 py-px text-[10.5px] font-medium text-muted-foreground">
                {fileCount} files
              </span>
            </div>
            {project.tree ? <FileTree root={project.tree} /> : null}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={72} minSize={40} className="min-w-0">
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <div className="flex h-9 shrink-0 items-center gap-2 overflow-hidden border-b px-3.5">
              <span className="shrink-0 rounded-[5px] bg-primary/15 px-1.5 py-px text-[10px] font-semibold tracking-[.3px] text-primary">
                PREVIEW
              </span>
              <span className="hidden truncate text-[11.5px] text-muted-foreground sm:inline">
                预览内容 = 复制后发送给 AI 的内容
              </span>
              <span className="ml-auto shrink-0 truncate text-[11px] text-muted-foreground">
                {previewMode === 'structure'
                  ? 'Structure Only'
                  : previewMode === 'all'
                    ? 'Structure + All'
                    : 'Structure + Selected'}
              </span>
            </div>
            <pre className="m-0 min-h-0 min-w-0 flex-1 overflow-auto bg-background px-3 py-3.5 font-mono text-[11.5px] leading-[1.72] whitespace-pre text-muted-foreground select-text sm:px-4">
              {preview?.text ?? ''}
            </pre>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* stats */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-t bg-muted/30 px-3 py-2.5 sm:gap-[22px] sm:px-4">
        <Stat label="Files" value={String(shownFiles)} />
        <Stat
          label="Characters"
          value={formatNumber(shownChars || selectedChars)}
        />
        <Stat
          label="Estimated Tokens"
          value={`~${formatNumber(shownTokens)}`}
          accent
          hint="估算值 · chars / 4"
        />
        <Stat
          label="Project Total"
          value={`~${formatNumber(projectTokens)}`}
          muted
        />
        <div className="ml-auto flex items-center gap-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5">
          <div className="font-mono text-[15px] font-bold text-emerald-500">
            {reduction.toFixed(1)}%
          </div>
          <div className="text-[10.5px] leading-[1.3] text-emerald-400">
            Token
            <br />
            Reduction
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
        className={`font-mono text-[14px] font-semibold tracking-[-.3px] ${
          accent ? 'text-primary' : muted ? 'text-muted-foreground' : ''
        }`}
      >
        {value}
      </div>
      {hint ? (
        <div className="text-[10.5px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  )
}
