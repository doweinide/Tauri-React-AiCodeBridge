import { Copy, Check, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AI_PROMPT, SAMPLE_AI_RESPONSE } from '@/lib/ai-response'
import { useProjectStore } from '@/features/project/project-store'
import { useContextStore } from '@/features/context/context-store'
import { useChangesStore } from '@/features/changes/changes-store'
import { readProjectFiles } from '@/services/project'
import { useUIStore } from '@/store/ui-store'

export function AiExchangePage() {
  const project = useProjectStore(s => s.project)
  const selected = useContextStore(s => s.selected)
  const fileHashes = useContextStore(s => s.fileHashes)
  const responseText = useChangesStore(s => s.responseText)
  const setResponseText = useChangesStore(s => s.setResponseText)
  const parse = useChangesStore(s => s.parse)
  const parseError = useChangesStore(s => s.parseError)
  const changes = useChangesStore(s => s.changes)
  const setActivePage = useUIStore(s => s.setActivePage)

  const copyContext = async () => {
    if (!project) return
    const { buildProjectContext } = await import('@/services/project')
    try {
      const result = await buildProjectContext(project.rootPath, 'selected', [
        ...selected,
      ])
      await navigator.clipboard.writeText(result.text)
      useContextStore.setState({
        preview: result,
        fileHashes: Object.fromEntries(result.files.map(f => [f.path, f.hash])),
      })
      toast.success('已复制 Structure + Selected Contents')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(AI_PROMPT)
    toast.success('已复制 AI 指令')
  }

  const handleParse = async () => {
    if (!project) {
      toast.error('请先打开项目')
      return
    }
    // Load current local contents for MODIFY paths
    const localContents: Record<string, string> = {}
    const allSelected = [...selected]
    if (allSelected.length > 0) {
      try {
        const files = await readProjectFiles(project.rootPath, allSelected)
        for (const f of files) localContents[f.path] = f.content
      } catch {
        // continue with empty contents
      }
    }
    // Also try reading any path mentioned if we can guess from selected tree
    // Paths in response that aren't selected will have empty oldContent
    parse(localContents, fileHashes)
    if (useChangesStore.getState().changes.length > 0) {
      toast.success(
        `解析成功 · 识别到 ${useChangesStore.getState().changes.length} 个变更`
      )
      setTimeout(() => setActivePage('review'), 200)
    }
  }

  const pending = changes.filter(c => c.status === 'pending').length

  return (
    <div className="h-full overflow-y-auto px-4 pt-5 pb-10 sm:px-[30px] sm:pt-[26px]">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
        <StepCard
          step={1}
          title="复制 Context"
          desc="把选中的项目上下文复制到剪贴板"
          action={
            <Button
              size="sm"
              className="h-8"
              onClick={() => void copyContext()}
              disabled={!project}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy Context
            </Button>
          }
        />

        <StepCard
          step={2}
          title="复制 AI 指令"
          desc="告诉 AI 按固定格式返回结构化修改结果"
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => void copyPrompt()}
            >
              Copy Prompt
            </Button>
          }
        >
          <pre className="max-h-[220px] overflow-auto whitespace-pre rounded-lg border bg-background px-3.5 py-3 font-mono text-[11.5px] leading-[1.65] text-muted-foreground select-text">
            {AI_PROMPT}
          </pre>
        </StepCard>

        <StepCard
          step={3}
          title="粘贴 AI Response"
          desc="将网页 AI 返回的内容粘贴到这里"
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                useChangesStore.getState().loadSample(SAMPLE_AI_RESPONSE)
                toast.success('已载入示例响应')
              }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              载入示例
            </Button>
          }
        >
          <Textarea
            value={responseText}
            onChange={e => setResponseText(e.target.value)}
            placeholder={
              '# AI_CHANGE\n\n## MODIFY\nFILE: src/auth/login.ts\n```ts\n...\n```'
            }
            className="min-h-[190px] resize-y font-mono text-[11.5px] leading-[1.65] select-text"
          />
          <div className="mt-3 flex items-center gap-2.5">
            <Button
              size="sm"
              className="h-8"
              onClick={() => void handleParse()}
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Parse Changes
            </Button>
            <span
              className={`text-[11.5px] ${
                parseError
                  ? 'text-destructive'
                  : changes.length
                    ? 'text-emerald-500'
                    : 'text-muted-foreground'
              }`}
            >
              {parseError ??
                (changes.length
                  ? `解析成功 · ${pending} 个待应用变更`
                  : '支持 ADD / MODIFY / DELETE 三种指令')}
            </span>
          </div>
        </StepCard>

        {!project && (
          <p className="text-xs text-muted-foreground">
            请先打开一个本地项目，再生成 Context。
          </p>
        )}
        {project && selected.size === 0 && (
          <p className="text-xs text-muted-foreground">
            当前未选中文件。可在 Context Builder 中选择，或直接复制 Structure。
          </p>
        )}
      </div>
    </div>
  )
}

function StepCard({
  step,
  title,
  desc,
  action,
  children,
}: {
  step: number
  title: string
  desc: string
  action?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-[11px] border bg-card">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
          {step}
        </div>
        <div>
          <div className="text-[13px] font-semibold">{title}</div>
          <div className="mt-px text-[11.5px] text-muted-foreground">
            {desc}
          </div>
        </div>
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      {children ? <div className="border-t px-4 py-4">{children}</div> : null}
    </div>
  )
}
