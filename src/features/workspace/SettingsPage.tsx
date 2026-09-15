import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAppSettingsStore } from '@/store/app-settings-store'
import { useProjectStore } from '@/features/project/project-store'
import { useIgnoreStore } from '@/features/context/ignore-store'
import { useContextStore } from '@/features/context/context-store'

const BUILTIN_IGNORED = [
  '.git/',
  'node_modules/',
  'dist/ · build/ · coverage/',
  '.env · .env.* · *.key · *.pem',
  'credentials.* · secrets.*',
]

type IgnoreScope = 'global' | 'project'

function normalizeRule(raw: string): string {
  return raw.trim().replace(/\\/g, '/').replace(/^\.\//, '')
}

export function SettingsPage() {
  const { t } = useTranslation()
  const charsPerToken = useAppSettingsStore(s => s.charsPerToken)
  const setCharsPerToken = useAppSettingsStore(s => s.setCharsPerToken)
  const project = useProjectStore(s => s.project)
  const rescan = useProjectStore(s => s.rescan)
  const globalIgnores = useIgnoreStore(s => s.global)
  const byProject = useIgnoreStore(s => s.byProject)
  const addGlobal = useIgnoreStore(s => s.addGlobal)
  const removeGlobal = useIgnoreStore(s => s.removeGlobal)
  const addProject = useIgnoreStore(s => s.addProject)
  const removeProject = useIgnoreStore(s => s.removeProject)
  const removePathsUnder = useContextStore(s => s.removePathsUnder)

  const [ruleText, setRuleText] = useState('')
  const [scope, setScope] = useState<IgnoreScope>('global')

  const rootPath = project?.rootPath ?? null
  const projectIgnores = rootPath ? (byProject[rootPath] ?? []) : []

  const applyIgnoreChange = async () => {
    if (!rootPath) return
    await rescan()
  }

  const addRule = async () => {
    const rule = normalizeRule(ruleText)
    if (!rule || rule === '/') return
    if (scope === 'project' && !rootPath) return

    const list = scope === 'project' ? projectIgnores : globalIgnores
    if (list.includes(rule)) {
      toast.info(t('settings.ignore.exists', { path: rule }))
      return
    }

    if (scope === 'project' && rootPath) addProject(rootPath, rule)
    else addGlobal(rule)

    // Drop now-disabled paths from context selection (supports Glob)
    removePathsUnder(rule)
    setRuleText('')
    toast.success(
      scope === 'project'
        ? t('context.ignoreAddedProject', { path: rule })
        : t('context.ignoreAddedGlobal', { path: rule })
    )
    await applyIgnoreChange()
  }

  const deleteRule = async (scopeOfRule: IgnoreScope, prefix: string) => {
    if (scopeOfRule === 'project' && rootPath) removeProject(rootPath, prefix)
    else removeGlobal(prefix)
    toast.success(t('settings.ignore.removed', { path: prefix }))
    await applyIgnoreChange()
  }

  return (
    <div className="h-full overflow-y-auto px-4 pt-5 pb-10 sm:px-[30px] sm:pt-[26px]">
      <div className="mx-auto flex w-full max-w-[780px] flex-col gap-3.5">
        <Card
          title={t('settings.ignore.title')}
          desc={t('settings.ignore.desc')}
        >
          <div className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground">
            {t('settings.ignore.builtin')}
          </div>
          <div className="flex flex-col gap-1.5">
            {BUILTIN_IGNORED.map(label => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-[7px] border bg-background px-3 py-2 font-mono text-[11.5px] text-muted-foreground"
              >
                <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span className="truncate">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 mb-2 flex items-center gap-2">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
              {t('settings.ignore.custom')}
            </span>
            {!rootPath && (
              <span className="rounded-full bg-muted px-2 py-px text-[10.5px] text-muted-foreground">
                {t('settings.ignore.noProject')}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            {globalIgnores.length === 0 && projectIgnores.length === 0 ? (
              <div className="rounded-[7px] border border-dashed px-3 py-2.5 text-[11.5px] text-muted-foreground">
                {t('settings.ignore.empty')}
              </div>
            ) : (
              <>
                {globalIgnores.map(prefix => (
                  <RuleRow
                    key={`g:${prefix}`}
                    prefix={prefix}
                    badge={t('settings.ignore.scopeGlobal')}
                    onDelete={() => void deleteRule('global', prefix)}
                  />
                ))}
                {rootPath &&
                  projectIgnores.map(prefix => (
                    <RuleRow
                      key={`p:${prefix}`}
                      prefix={prefix}
                      badge={t('settings.ignore.scopeProject')}
                      onDelete={() => void deleteRule('project', prefix)}
                    />
                  ))}
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5">
              {(
                [
                  ['global', t('settings.ignore.scopeGlobal')],
                  ['project', t('settings.ignore.scopeProject')],
                ] as const
              ).map(([id, label]) => {
                const disabled = id === 'project' && !rootPath
                const active = scope === id && !disabled
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setScope(id)}
                    className={cn(
                      'rounded-[5px] px-2.5 py-1 text-[11px] transition-colors',
                      active
                        ? 'bg-background font-medium text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                      disabled && 'cursor-not-allowed opacity-40 hover:text-muted-foreground'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <Input
              value={ruleText}
              onChange={e => setRuleText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addRule()
                }
              }}
              placeholder={t('settings.ignore.placeholder')}
              className="h-8 min-w-0 flex-1 font-mono text-[12px]"
              spellCheck={false}
            />
            <Button
              size="sm"
              className="h-8 px-2.5 text-[11.5px]"
              disabled={
                !normalizeRule(ruleText) || (scope === 'project' && !rootPath)
              }
              onClick={() => void addRule()}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('settings.ignore.add')}
            </Button>
          </div>

          <div className="mt-3 text-[11.5px] text-muted-foreground">
            <div>{t('settings.ignore.globHint')}</div>
            <div className="mt-0.5">{t('settings.ignore.aiignore')}</div>
          </div>
        </Card>

        <Card
          title={t('settings.format.title')}
          desc={t('settings.format.desc')}
        >
          <SettingRow
            title={t('settings.format.strict')}
            desc={t('settings.format.strictDesc')}
            defaultOn
          />
          <SettingRow
            title={t('settings.format.diff')}
            desc={t('settings.format.diffDesc')}
            defaultOn
          />
          <SettingRow
            title={t('settings.format.external')}
            desc={t('settings.format.externalDesc')}
            defaultOn
          />
        </Card>

        <Card
          title={t('settings.token.title')}
          desc={t('settings.token.payloadBasedDesc')}
        >
          <div className="flex items-center gap-3 border-b py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px]">
                {t('settings.token.payloadBased')}
              </div>
              <div className="mt-px text-[11px] text-muted-foreground">
                {t('settings.token.payloadBasedDesc')}
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10.5px] font-medium text-emerald-500">
              ON
            </span>
          </div>
          <div className="flex items-center gap-3 border-b py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px]">
                {t('settings.token.charsPerToken')}
              </div>
              <div className="mt-px text-[11px] text-muted-foreground">
                {t('settings.token.charsPerTokenDesc')}
              </div>
            </div>
            <Input
              type="number"
              min={1}
              max={64}
              value={String(charsPerToken)}
              onChange={e => {
                const raw = e.target.value.trim()
                if (raw === '') return
                const n = Number.parseInt(raw, 10)
                if (Number.isFinite(n)) setCharsPerToken(n)
              }}
              onBlur={e => {
                const n = Number.parseInt(e.target.value, 10)
                setCharsPerToken(Number.isFinite(n) ? n : 4)
              }}
              className="h-8 w-20 text-right font-mono"
              placeholder={t('settings.token.charsPerTokenPlaceholder')}
            />
          </div>
          <SettingRow
            title={t('settings.token.reduction')}
            desc={t('settings.token.reductionDesc')}
            defaultOn
          />
        </Card>

        <Card
          title={t('settings.general.title')}
          desc={t('settings.general.desc')}
        >
          <SettingRow
            title={t('settings.general.undo')}
            desc={t('settings.general.undoDesc')}
            defaultOn
          />
        </Card>
      </div>
    </div>
  )
}

function RuleRow({
  prefix,
  badge,
  onDelete,
}: {
  prefix: string
  badge: string
  onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="group flex items-center gap-2.5 rounded-[7px] border bg-background px-3 py-2">
      <span className="shrink-0 rounded-full bg-sky-500/12 px-1.5 py-px font-sans text-[10px] font-medium text-sky-500">
        {badge}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground">
        {prefix}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
        title={t('settings.ignore.remove')}
        aria-label={t('settings.ignore.remove')}
        onClick={onDelete}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function Card({
  title,
  desc,
  children,
}: {
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[11px] border bg-card px-[18px] py-4">
      <h3 className="mb-0.5 text-[13px] font-semibold">{title}</h3>
      <p className="mb-3 text-[11.5px] text-muted-foreground">{desc}</p>
      {children}
    </div>
  )
}

function SettingRow({
  title,
  desc,
  defaultOn,
}: {
  title: string
  desc?: string
  defaultOn?: boolean
}) {
  return (
    <div className="flex items-center gap-3 border-b py-2.5 last:border-b-0 last:pb-0">
      <div>
        <div className="text-[12.5px]">{title}</div>
        {desc ? (
          <div className="mt-px text-[11px] text-muted-foreground">{desc}</div>
        ) : null}
      </div>
      <Switch className="ml-auto" defaultChecked={defaultOn} />
    </div>
  )
}
