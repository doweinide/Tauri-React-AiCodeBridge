import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FolderOpen,
  GitBranch,
  ListTree,
  Settings,
  ArrowLeftRight,
  FileDiff,
  Search,
  Check,
} from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUIStore, type WorkspacePage } from '@/store/ui-store'
import { useIsNarrow } from '@/hooks/use-narrow'
import {
  projectAbbr,
  projectColor,
  useProjectStore,
} from '@/features/project/project-store'
import { useContextStore } from '@/features/context/context-store'
import { ContextBuilderPage } from '@/features/context/ContextBuilderPage'
import { AiExchangePage } from '@/features/changes/AiExchangePage'
import {
  ChangeReviewPage,
  useChangesStore,
  pendingCount,
} from '@/features/changes'
import { SettingsPage } from './SettingsPage'

const NAV: {
  id: WorkspacePage
  labelKey: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: 'context', labelKey: 'workspace.nav.context', icon: ListTree },
  { id: 'exchange', labelKey: 'workspace.nav.exchange', icon: ArrowLeftRight },
  { id: 'review', labelKey: 'workspace.nav.review', icon: FileDiff },
  { id: 'settings', labelKey: 'workspace.nav.settings', icon: Settings },
]

const PAGE_TITLE_KEY: Record<WorkspacePage, string> = {
  context: 'workspace.nav.context',
  exchange: 'workspace.nav.exchange',
  review: 'workspace.nav.review',
  settings: 'workspace.nav.settings',
}

export function WorkspaceShell() {
  const { t } = useTranslation()
  const activePage = useUIStore(s => s.activePage)
  const setActivePage = useUIStore(s => s.setActivePage)
  const leftSidebarVisible = useUIStore(s => s.leftSidebarVisible)
  const project = useProjectStore(s => s.project)
  const changes = useChangesStore(s => s.changes)
  const selectedCount = useContextStore(
    s => s.structureSelected.size + s.contentSelected.size
  )
  const pending = pendingCount(changes)
  const isNarrow = useIsNarrow()
  // Icon-only when user collapsed via titlebar, or window is narrow
  const navCollapsed = !leftSidebarVisible || isNarrow

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r bg-muted/20 px-2 py-3.5 transition-[width] duration-200',
          navCollapsed ? 'w-[64px] px-1.5' : 'w-[180px] xl:w-[212px] px-2.5'
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2.5 px-1.5 pt-1 pb-[14px]',
            navCollapsed && 'justify-center px-0'
          )}
        >
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-gradient-to-br from-indigo-500 to-purple-500 text-[13px] font-bold text-white shadow-[0_3px_12px_rgba(99,102,241,.4)]">
            AC
          </div>
          <span className="sr-only">{t('workspace.brand')}</span>
          {!navCollapsed && (
            <div className="min-w-0">
              <div className="truncate text-[13px] leading-tight font-semibold tracking-[.2px]">
                AIContextTool
              </div>
              <div className="mt-px text-[10px] leading-tight text-muted-foreground">
                v1.0 · MVP
              </div>
            </div>
          )}
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {!navCollapsed && (
            <div className="px-2.5 pt-2 pb-[5px] text-[10px] font-semibold tracking-[.8px] text-muted-foreground uppercase">
              Workspace
            </div>
          )}
          {NAV.slice(0, 3).map(item => (
            <NavItem
              key={item.id}
              item={item}
              active={activePage === item.id}
              badge={item.id === 'review' ? pending : undefined}
              collapsed={navCollapsed}
              onClick={() => setActivePage(item.id)}
            />
          ))}
          {!navCollapsed && (
            <div className="px-2.5 pt-3 pb-[5px] text-[10px] font-semibold tracking-[.8px] text-muted-foreground uppercase">
              System
            </div>
          )}
          {NAV[3] ? (
            <NavItem
              item={NAV[3]}
              active={activePage === 'settings'}
              collapsed={navCollapsed}
              onClick={() => setActivePage('settings')}
            />
          ) : null}
        </nav>

        <div
          className={cn(
            'mt-auto shrink-0 border-t pt-2.5',
            navCollapsed ? 'px-0' : 'px-2'
          )}
        >
          <div
            className={cn(
              'text-[10.5px] leading-[1.7] text-muted-foreground',
              navCollapsed && 'flex justify-center'
            )}
            title={project ? `${project.name}\n${project.rootPath}` : undefined}
          >
            <span
              className={cn(
                'inline-block h-1.5 w-1.5 rounded-full',
                navCollapsed ? '' : 'mr-1.5',
                project ? 'bg-emerald-500' : 'bg-muted-foreground/40'
              )}
            />
            {!navCollapsed && (
              <>
                <span className="truncate">
                  {project?.name ?? t('workspace.project.none')}
                </span>
                {project ? t('workspace.project.connected') : ''}
              </>
            )}
          </div>
          {!navCollapsed && (
            <div className="truncate pl-[11px] text-[10.5px] leading-[1.7] text-muted-foreground">
              {project?.rootPath ?? '—'}
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceTopbar
          title={t(PAGE_TITLE_KEY[activePage])}
          selectedCount={selectedCount}
          compact={navCollapsed}
        />
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {activePage === 'context' && <ContextBuilderPage />}
          {activePage === 'exchange' && <AiExchangePage />}
          {activePage === 'review' && <ChangeReviewPage />}
          {activePage === 'settings' && <SettingsPage />}
        </div>
      </div>
    </div>
  )
}

function NavItem({
  item,
  active,
  badge,
  collapsed,
  onClick,
}: {
  item: {
    id: WorkspacePage
    labelKey: string
    icon: React.ComponentType<{ className?: string }>
  }
  active: boolean
  badge?: number
  collapsed?: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? t(item.labelKey) : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-[7px] py-2 text-[12.5px] transition-colors select-none',
        collapsed ? 'justify-center px-0' : 'px-2.5',
        active
          ? 'bg-primary/12 font-medium text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-[15px] w-[15px] shrink-0" />
      <span className={cn(collapsed ? 'sr-only' : 'truncate')}>
        {t(item.labelKey)}
      </span>
      {badge != null && badge > 0 ? (
        <span
          className={cn(
            'rounded-[9px] bg-amber-500/12 px-1.5 py-px text-[10px] font-semibold text-amber-500',
            collapsed ? 'absolute translate-x-3 -translate-y-3' : 'ml-auto'
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  )
}

function WorkspaceTopbar({
  title,
  selectedCount,
  compact,
}: {
  title: string
  selectedCount: number
  compact?: boolean
}) {
  const { t } = useTranslation()
  const project = useProjectStore(s => s.project)
  const recent = useProjectStore(s => s.recent)
  const loadRecent = useProjectStore(s => s.loadRecent)
  const openProject = useProjectStore(s => s.open)
  const rescan = useProjectStore(s => s.rescan)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadRecent()
  }, [loadRecent])

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const handleOpenFolder = async () => {
    setMenuOpen(false)
    const path = await open({ directory: true, title: t('workspace.project.openFolderTitle') })
    if (!path || Array.isArray(path)) return
    try {
      await openProject(path)
      toast.success(t('workspace.project.opened'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const filtered = recent.filter(
    p =>
      !query.trim() ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.path.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <header className="relative z-40 flex h-12 shrink-0 items-center gap-2 border-b bg-muted/20 px-2.5 sm:gap-3 sm:px-3.5">
      <div className="relative min-w-0 shrink" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex max-w-[min(270px,42vw)] cursor-pointer items-center gap-2 rounded-lg border bg-muted py-1.5 pr-2 pl-1.5 text-[12.5px] font-medium transition-colors hover:bg-muted/80"
        >
          <span
            className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[5px] text-[9px] font-bold tracking-[.2px] text-white"
            style={{
              background: project ? projectColor(project.name) : '#4B5563',
            }}
          >
            {project ? projectAbbr(project.name) : '··'}
          </span>
          <span className="truncate">{project?.name ?? t('workspace.project.open')}</span>
          <svg
            className={cn(
              'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
              menuOpen ? 'rotate-180' : ''
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute top-[calc(100%+8px)] left-0 z-50 flex w-[min(358px,calc(100vw-24px))] origin-top flex-col overflow-hidden rounded-[11px] border bg-card shadow-[0_16px_44px_rgba(0,0,0,.45)]">
            <div className="relative border-b p-2.5 pb-2">
              <Search className="pointer-events-none absolute top-1/2 left-[19px] h-[13px] w-[13px] -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('workspace.project.search')}
                className="h-8 pl-[30px] text-[12px]"
              />
            </div>
            <div className="border-b p-[5px]">
              <button
                type="button"
                onClick={() => void handleOpenFolder()}
                className="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-left text-[12.5px] text-muted-foreground transition-colors select-none hover:bg-muted hover:text-foreground"
              >
                <FolderOpen className="h-[15px] w-[15px] shrink-0" />
                打开文件夹
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  toast(t('workspace.project.cloneGitTodo'))
                }}
                className="flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-left text-[12.5px] text-muted-foreground transition-colors select-none hover:bg-muted hover:text-foreground"
              >
                <GitBranch className="h-[15px] w-[15px] shrink-0" />
                克隆 Git 仓库
              </button>
            </div>
            <div className="px-3.5 pt-2.5 pb-1 text-[10px] font-semibold tracking-[.9px] text-muted-foreground uppercase">
              最近
            </div>
            <div className="max-h-[300px] overflow-y-auto px-[5px] pb-1.5">
              {filtered.length === 0 ? (
                <div className="px-3 py-5 text-center text-[12px] text-muted-foreground">
                  无匹配项目
                </div>
              ) : (
                filtered.map(p => {
                  const isActive = p.path === project?.rootPath
                  return (
                    <button
                      key={p.path}
                      type="button"
                      onClick={async () => {
                        setMenuOpen(false)
                        try {
                          await openProject(p.path)
                          toast.success(t('workspace.project.switchTo', { name: p.name }))
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : String(e)
                          )
                        }
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-left transition-colors select-none hover:bg-muted',
                        isActive && 'bg-primary/10'
                      )}
                    >
                      <div
                        className="flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-md text-[10px] font-bold tracking-[.2px] text-white"
                        style={{ background: projectColor(p.name) }}
                      >
                        {projectAbbr(p.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            'truncate text-[12.5px]',
                            isActive ? 'font-medium text-primary' : ''
                          )}
                        >
                          {p.name}
                        </div>
                        <div className="mt-px truncate font-mono text-[10.5px] text-muted-foreground">
                          {p.path}
                        </div>
                      </div>
                      {isActive ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      <div className="hidden h-5 w-px shrink-0 bg-border sm:block" />
      <h1 className="min-w-0 flex-1 truncate text-[13px] font-semibold">
        {title}
      </h1>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="hidden rounded-full bg-muted px-2 py-px text-[10.5px] font-medium text-muted-foreground md:inline-block">
          {t('workspace.selectedCount', { count: selectedCount })}
        </span>
        {!compact && (
          <span className="rounded-full bg-muted px-2 py-px text-[10.5px] font-medium text-muted-foreground md:hidden">
            {t('workspace.selectedCountShort', { count: selectedCount })}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-[11.5px]"
          onClick={() => {
            void rescan()
            toast.success(t('workspace.project.rescanned'))
          }}
        >
          Rescan
        </Button>
      </div>
    </header>
  )
}
