import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ClipboardPaste,
  Copy,
  Download,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { readText } from '@tauri-apps/plugin-clipboard-manager'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { JsonTreeView } from '@/components/code'
import {
  getAiInstruction,
  serializeProjectChanges,
  parseProjectChanges,
} from '@/lib/protocol'
import { useProjectStore } from '@/features/project/project-store'
import { useContextStore } from '@/features/context/context-store'
import { useChangesStore } from '@/features/changes/changes-store'
import { contextCopyText } from '@/services/project'
import { useUIStore } from '@/store/ui-store'

type PromptLang = 'zh' | 'en'
type ResponsePreviewTab = 'json' | 'md'

export function AiExchangePage() {
  const { t } = useTranslation()
  const project = useProjectStore(s => s.project)
  const fileHashes = useContextStore(s => s.fileHashes)
  const refreshPreview = useContextStore(s => s.refreshPreview)
  const responseText = useChangesStore(s => s.responseText)
  const setResponseText = useChangesStore(s => s.setResponseText)
  const parseFromProject = useChangesStore(s => s.parseFromProject)
  const parseError = useChangesStore(s => s.parseError)
  const changes = useChangesStore(s => s.changes)
  const setActivePage = useUIStore(s => s.setActivePage)

  const [promptLang, setPromptLang] = useState<PromptLang>('zh')
  const [previewTab, setPreviewTab] = useState<ResponsePreviewTab>('json')
  const instruction = useMemo(
    () => getAiInstruction(promptLang),
    [promptLang]
  )

  const copyContext = async () => {
    if (!project) return
    try {
      await refreshPreview(project.rootPath)
      const ctx = useContextStore.getState().protocolContext
      if (!ctx) throw new Error(t('exchange.contextNotReady'))
      await navigator.clipboard.writeText(contextCopyText(ctx))
      toast.success(t('exchange.copyContextOk'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(instruction)
    toast.success(t('exchange.copyPromptOk'))
  }

  const handleParse = async () => {
    if (!project) {
      toast.error(t('exchange.needProject'))
      return
    }
    await parseFromProject(project.rootPath, fileHashes)
    const st = useChangesStore.getState()
    if (st.changes.length > 0) {
      toast.success(t('exchange.parseOk', { count: st.changes.length }))
      setTimeout(() => setActivePage('review'), 200)
    }
  }

  const pending = changes.filter(
    c => c.status === 'pending' || c.status === 'accepted'
  ).length

  /** Parsed preview for the response textarea (JSON tree + MD dump) */
  const preview = useMemo(() => {
    const parsed = parseProjectChanges(responseText)
    if (!parsed.ok) return null
    const mdParts: string[] = []
    for (const c of parsed.data.changes) {
      mdParts.push(`### ${c.operation.toUpperCase()} ${c.path}`)
      if (c.content != null && c.operation !== 'delete') {
        mdParts.push('```')
        mdParts.push(c.content)
        mdParts.push('```')
      }
      mdParts.push('')
    }
    return {
      json: JSON.parse(serializeProjectChanges(parsed.data)) as unknown,
      md: `## 变更预览\n\n${mdParts.join('\n')}`,
      count: parsed.data.changes.length,
    }
  }, [responseText])

  return (
    <div className="flex h-full min-h-0 min-w-0 gap-3 overflow-hidden p-3">
      {/* Left: copy actions + prompt */}
      <div className="flex min-h-0 w-[42%] min-w-0 shrink-0 flex-col gap-3 overflow-y-auto">
        <div className="rounded-[11px] border bg-card p-3.5">
          <div className="text-[12px] font-semibold">
            {t('exchange.exportTitle')}
          </div>
          <p className="mt-0.5 mb-3 text-[11px] text-muted-foreground">
            {t('exchange.exportDesc')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5">
              <Button
                size="sm"
                className="h-8"
                onClick={() => void copyContext()}
                disabled={!project}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                {t('exchange.copyContext')}
              </Button>
              <InfoButton
                title={t('exchange.infoContextTitle')}
                body={t('exchange.infoContextBody')}
              />
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => void copyPrompt()}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                {t('exchange.copyPrompt')}
              </Button>
              <InfoButton
                title={t('exchange.infoPromptTitle')}
                body={t('exchange.infoPromptBody')}
              />
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-[11px] border bg-card">
          <div className="flex shrink-0 items-center gap-2 border-b px-3.5 py-2.5">
            <div className="text-[12px] font-semibold">
              {t('exchange.promptTitle')}
            </div>
            <div className="ml-auto flex items-center gap-0.5 rounded-md border bg-background/60 p-0.5">
              <button
                type="button"
                onClick={() => setPromptLang('zh')}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] transition-colors',
                  promptLang === 'zh'
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                中文
              </button>
              <button
                type="button"
                onClick={() => setPromptLang('en')}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] transition-colors',
                  promptLang === 'en'
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                EN
              </button>
            </div>
          </div>
          <pre className="m-0 min-h-0 flex-1 overflow-auto bg-background px-3.5 py-3 font-mono text-[11.5px] leading-[1.65] whitespace-pre text-muted-foreground select-text">
            {instruction}
          </pre>
          <div className="shrink-0 border-t px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11.5px]"
              onClick={() => void copyPrompt()}
            >
              <Copy className="mr-1 h-3 w-3" />
              {t('exchange.copyPrompt')}
            </Button>
          </div>
        </div>
      </div>

      {/* Right: paste AI response + preview */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex min-h-0 flex-[1.1] flex-col rounded-[11px] border bg-card">
          <div className="flex shrink-0 items-center gap-2 border-b px-3.5 py-2.5">
            <div className="text-[12px] font-semibold">
              {t('exchange.pasteTitle')}
            </div>
            <InfoButton
              title={t('exchange.infoPasteTitle')}
              body={t('exchange.infoPasteBody')}
            />
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={async () => {
                  try {
                    const text = await readText()
                    if (!text) {
                      toast.error(t('exchange.clipboardEmpty'))
                      return
                    }
                    setResponseText(text)
                    toast.success(t('exchange.pastedFromClipboard'))
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : String(e))
                  }
                }}
              >
                <ClipboardPaste className="mr-1 h-3 w-3" />
                {t('exchange.pasteFromClipboard')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => {
                  useChangesStore.getState().loadSample()
                  toast.success(t('exchange.sampleLoaded'))
                }}
              >
                <Download className="mr-1 h-3 w-3" />
                {t('exchange.loadSample')}
              </Button>
              <Button
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => void handleParse()}
              >
                <Check className="mr-1 h-3 w-3" />
                {t('exchange.parseChanges')}
              </Button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-2.5">
            <Textarea
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              onPaste={e => e.stopPropagation()}
              placeholder={t('exchange.pastePlaceholder')}
              className="min-h-[120px] flex-1 resize-none font-mono text-[11.5px] leading-[1.65] select-text"
            />
            <div
              className={cn(
                'mt-2 shrink-0 text-[11.5px]',
                parseError
                  ? 'text-destructive'
                  : changes.length
                    ? 'text-emerald-500'
                    : 'text-muted-foreground'
              )}
            >
              {parseError
                ? `${t('exchange.parseInvalid')}${
                    parseError.path ? ` · ${parseError.path}` : ''
                  }${parseError.line ? ` · Line ${parseError.line}` : ''}: ${
                    parseError.reason
                  }`
                : changes.length
                  ? t('exchange.detected', { count: changes.length, pending })
                  : t('exchange.parseHint')}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-[11px] border bg-card">
          <div className="flex shrink-0 items-center gap-2 border-b px-3.5 py-2">
            <div className="text-[12px] font-semibold">
              {t('exchange.responsePreview')}
            </div>
            <div className="ml-auto flex items-center gap-0.5 rounded-md border bg-background/60 p-0.5">
              {(
                [
                  ['json', 'JSON'],
                  ['md', 'MD'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPreviewTab(id)}
                  className={cn(
                    'rounded px-2 py-0.5 text-[11px] transition-colors',
                    previewTab === id
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden p-2">
            {!preview ? (
              <p className="px-2 py-3 text-[11.5px] text-muted-foreground">
                {t('exchange.previewEmpty')}
              </p>
            ) : previewTab === 'json' ? (
              <JsonTreeView
                value={preview.json}
                collapsed={1}
                className="h-full"
              />
            ) : (
              <pre className="m-0 h-full min-h-0 overflow-auto bg-background px-3 py-2.5 font-mono text-[11.5px] leading-[1.72] whitespace-pre text-muted-foreground select-text">
                {preview.md}
              </pre>
            )}
          </div>
        </div>

        {!project && (
          <p className="shrink-0 text-xs text-muted-foreground">
            {t('exchange.needProjectHint')}
          </p>
        )}
      </div>
    </div>
  )
}

function InfoButton({ title, body }: { title: string; body: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          title={title}
        >
          <Info className="h-3.5 w-3.5" />
          <span className="sr-only">{title}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-[min(320px,90vw)] text-[12px] leading-relaxed"
      >
        <div className="mb-1 font-semibold">{title}</div>
        <p className="text-muted-foreground">{body}</p>
      </PopoverContent>
    </Popover>
  )
}
