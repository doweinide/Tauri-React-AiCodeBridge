import { Switch } from '@/components/ui/switch'

const IGNORED = [
  { label: '.git/', locked: true },
  { label: 'node_modules/', locked: true },
  { label: 'dist/ · build/ · coverage/', locked: true },
  { label: '.env · .env.* · *.key · *.pem', locked: true },
  { label: 'credentials.* · secrets.*', locked: true },
]

export function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto px-4 pt-5 pb-10 sm:px-[30px] sm:pt-[26px]">
      <div className="mx-auto flex w-full max-w-[780px] flex-col gap-3.5">
        <Card
          title="Ignore Rules"
          desc="被忽略的文件不会进入 Context，也不允许 AI 修改"
        >
          <div className="flex flex-col gap-1.5">
            {IGNORED.map(item => (
              <div
                key={item.label}
                className="flex items-center gap-2.5 rounded-[7px] border bg-background px-3 py-2 font-mono text-[11.5px] text-muted-foreground"
              >
                <span className="text-amber-500">🔒</span>
                {item.label}
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11.5px] text-muted-foreground">
            项目根目录 <code className="font-mono text-primary">.aiignore</code>{' '}
            中的规则会追加到此列表
          </div>
        </Card>

        <Card title="AI Response Format" desc="软件据此解析 AI 返回的修改结果">
          <SettingRow
            title="启用严格格式校验"
            desc="格式不符时拒绝应用，避免误改本地文件"
            defaultOn
          />
          <SettingRow
            title="Apply 前强制 Diff"
            desc="AI 返回内容不能直接覆盖本地文件"
            defaultOn
          />
          <SettingRow
            title="检测外部文件修改"
            desc="Context 创建后本地文件被改动时提示冲突"
            defaultOn
          />
        </Card>

        <Card
          title="Token Estimation"
          desc="估算值仅用于参考，标记为 Estimated"
        >
          <SettingRow
            title="显示项目总量与 Reduction"
            desc="对比整个项目规模，显示节省比例"
            defaultOn
          />
          <SettingRow
            title="按 4 字符 ≈ 1 token 估算"
            desc="适用于英文与代码，中文会略有偏差"
            defaultOn
          />
        </Card>

        <Card title="General" desc="界面与行为">
          <SettingRow title="深色主题" desc="跟随系统偏好设置" defaultOn />
          <SettingRow
            title="Apply 后自动创建 Undo 快照"
            desc="支持撤销最近一次 Change Set"
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
