import { Copy, Check, Download, ClipboardPaste } from 'lucide-react'
import { toast } from 'sonner'
import { readText } from '@tauri-apps/plugin-clipboard-manager'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AI_INSTRUCTION } from '@/lib/protocol'
import { useProjectStore } from '@/features/project/project-store'
import { useContextStore } from '@/features/context/context-store'
import { useChangesStore } from '@/features/changes/changes-store'
import { contextCopyText } from '@/services/project'
import { useUIStore } from '@/store/ui-store'

export function AiExchangePage() {
  const project = useProjectStore(s => s.project)
  const fileHashes = useContextStore(s => s.fileHashes)
  const refreshPreview = useContextStore(s => s.refreshPreview)
  const responseText = useChangesStore(s => s.responseText)
  const setResponseText = useChangesStore(s => s.setResponseText)
  const parseFromProject = useChangesStore(s => s.parseFromProject)
  const parseError = useChangesStore(s => s.parseError)
  const changes = useChangesStore(s => s.changes)
  const setActivePage = useUIStore(s => s.setActivePage)

  const copyContext = async () => {
    if (!project) return
    try {
      await refreshPreview(project.rootPath)
      const ctx = useContextStore.getState().protocolContext
      if (!ctx) throw new Error('Context not ready')
      await navigator.clipboard.writeText(contextCopyText(ctx))
      toast.success('已复制 AI Instruction + Project Context JSON')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(AI_INSTRUCTION)
    toast.success('已复制 AI Instruction')
  }

  const handleParse = async () => {
    if (!project) {
      toast.error('请先打开项目')
      return
    }
    // Baselines come from live project files (not just Context selection).
    await parseFromProject(project.rootPath, fileHashes)
    const st = useChangesStore.getState()
    if (st.changes.length > 0) {
      toast.success(`Schema 校验通过 · 识别到 ${st.changes.length} 个变更`)
      setTimeout(() => setActivePage('review'), 200)
    }
  }

  const pending = changes.filter(
    c => c.status === 'pending' || c.status === 'accepted'
  ).length

  return (
    <div className="h-full overflow-y-auto px-4 pt-5 pb-10 sm:px-[30px] sm:pt-[26px]">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
        <StepCard
          step={1}
          title="复制 Context JSON"
          desc="AI Instruction + 标准 ProjectContext JSON"
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
          title="复制 AI Instruction"
          desc="要求 AI 只返回 project_changes JSON"
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
          <pre className="max-h-[220px] overflow-auto rounded-lg border bg-background px-3.5 py-3 font-mono text-[11.5px] leading-[1.65] whitespace-pre text-muted-foreground select-text">
            {AI_INSTRUCTION}
          </pre>
        </StepCard>

        <StepCard
          step={3}
          title="粘贴 AI Response JSON"
          desc="粘贴后做 JSON.parse + Schema 校验"
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                useChangesStore.getState().loadSample()
                toast.success('已载入示例 Change JSON')
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
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            onPaste={e => {
              // Allow native paste; also stop parent handlers from swallowing it
              e.stopPropagation()
            }}
            placeholder={
              '{\n  "version": "1.0",\n  "type": "project_changes",\n  "changes": [\n    { "operation": "modify", "path": "src/auth/login.ts", "content": "..." }\n  ]\n}'
            }
            className="min-h-[190px] resize-y font-mono text-[11.5px] leading-[1.65] select-text"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={async () => {
                try {
                  const text = await readText()
                  if (!text) {
                    toast.error('剪贴板为空')
                    return
                  }
                  setResponseText(text)
                  toast.success('已从系统剪贴板粘贴')
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : String(e))
                }
              }}
            >
              <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
              从剪贴板粘贴
            </Button>
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
              {parseError
                ? `Invalid AI response${
                    parseError.path ? ` · ${parseError.path}` : ''
                  }${parseError.line ? ` · Line ${parseError.line}` : ''}: ${
                    parseError.reason
                  }`
                : changes.length
                  ? `${changes.length} changes detected · ${pending} 待处理`
                  : '仅接受 version=1.0 / type=project_changes 的 JSON'}
            </span>
          </div>
        </StepCard>

        {!project && (
          <p className="text-xs text-muted-foreground">
            请先打开一个本地项目，再生成 Context。
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
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{title}</div>
          <div className="mt-px truncate text-[11.5px] text-muted-foreground">
            {desc}
          </div>
        </div>
        {action ? <div className="ml-auto shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="border-t px-4 py-4">{children}</div> : null}
    </div>
  )
}
