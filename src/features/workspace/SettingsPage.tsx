import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { useAppSettingsStore } from '@/store/app-settings-store'

const IGNORED = [
  '.git/',
  'node_modules/',
  'dist/ · build/ · coverage/',
  '.env · .env.* · *.key · *.pem',
  'credentials.* · secrets.*',
]

export function SettingsPage() {
  const { t } = useTranslation()
  const charsPerToken = useAppSettingsStore(s => s.charsPerToken)
  const setCharsPerToken = useAppSettingsStore(s => s.setCharsPerToken)

  return (
    <div className="h-full overflow-y-auto px-4 pt-5 pb-10 sm:px-[30px] sm:pt-[26px]">
      <div className="mx-auto flex w-full max-w-[780px] flex-col gap-3.5">
        <Card
          title={t('settings.ignore.title')}
          desc={t('settings.ignore.desc')}
        >
          <div className="flex flex-col gap-1.5">
            {IGNORED.map(label => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-[7px] border bg-background px-3 py-2 font-mono text-[11.5px] text-muted-foreground"
              >
                <span className="text-amber-500">🔒</span>
                {label}
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11.5px] text-muted-foreground">
            {t('settings.ignore.aiignore')}
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
