# src/ 前端目录说明

AIContextTool 前端源码。依赖方向：`app` → `features` → `components / hooks / services` → `lib`。

`lib` 不得反向依赖 `features`；跨 Feature 共享逻辑放到 `components` / `hooks` / `services` / `lib`。

---

## 总览

```text
src/
├── main.tsx / quick-pane-main.tsx   入口
├── app/                             应用组装
├── features/                        产品功能（按域拆分）
├── components/                      跨功能 UI 与设计系统
├── lib/                             无业务语义的基础设施
├── hooks/                           跨功能 Hook
├── services/                        Tauri IPC / 外部系统封装
├── store/                           全局 UI / 设置状态
├── i18n/                            国际化
├── test/                            测试 setup 与工具
└── theme-variables.css / *.css      样式
```

---

## app/ — 应用组装

| 路径                          | 作用                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `App.tsx`                     | 根组件：ErrorBoundary → QueryClient → ThemeProvider → MainWindow；启动时初始化命令系统、语言、菜单、恢复清理、自动更新 |
| `App.css`                     | 全局样式、输入框可选择/粘贴、拖拽区域                                                                                  |
| `App.test.tsx`                | 应用壳层渲染测试                                                                                                       |
| `providers/ThemeProvider.tsx` | 主题状态与 `.dark` class 同步                                                                                          |
| `index.ts`                    | barrel 导出                                                                                                            |

`main.tsx` 只负责 `createRoot` + 渲染 `<App />`，不放业务初始化。

---

## features/ — 产品功能

每个 Feature 自己放 UI、store、类型；避免拆到多个顶层目录。

### project/

| 文件               | 作用                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `project-store.ts` | 当前项目、最近项目、打开/重扫；工具函数 `collectFilePaths`、`projectAbbr`/`projectColor` |
| `index.ts`         | barrel                                                                                   |

### context/

| 文件                     | 作用                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `context-store.ts`       | **结构选择**与**内容选择**双集合；预览 tab；Token 统计；`refreshPreview` / `copyContext` / `copyMarkdown` |
| `FileTree.tsx`           | 文件树：结构勾选（行/紫框）、内容勾选（蓝框）、目录递归、搜索过滤                                         |
| `ContextBuilderPage.tsx` | 工具栏、Tree/JSON/Raw/MD 预览、统计条、复制按钮                                                           |
| `index.ts`               | barrel                                                                                                    |

### changes/

| 文件                   | 作用                                             |
| ---------------------- | ------------------------------------------------ |
| `changes-store.ts`     | 解析 AI JSON、变更状态机、Apply/Undo、冲突与汇总 |
| `AiExchangePage.tsx`   | 复制 Context/Instruction、粘贴 Response、Parse   |
| `ChangeReviewPage.tsx` | 列表/树视图、Accept/Reject/Apply、Monaco Diff    |
| `ChangesTreeView.tsx`  | 变更文件按目录树展示与折叠                       |
| `index.ts`             | barrel                                           |

### workspace/

| 文件                 | 作用                                                         |
| -------------------- | ------------------------------------------------------------ |
| `WorkspaceShell.tsx` | 左导航（可收成图标）、顶栏项目切换、页路由                   |
| `SettingsPage.tsx`   | Ignore 规则说明、Token 规则（每 Token 字符数）、格式开关展示 |

### 基础模板功能（保留）

| 目录               | 作用                           |
| ------------------ | ------------------------------ |
| `command-palette/` | `Cmd+K` 命令面板               |
| `preferences/`     | 偏好设置对话框（panes/shared） |
| `quick-pane/`      | 全局快捷键浮动输入面板         |

---

## components/ — 跨功能 UI

| 目录                    | 作用                                        |
| ----------------------- | ------------------------------------------- |
| `code/MonacoDiff.tsx`   | Monaco DiffEditor（左右对照 Current vs AI） |
| `code/monaco-setup.ts`  | Monaco worker 本地打包（离线可用）          |
| `code/JsonTreeView.tsx` | `@uiw/react-json-view` 可展开 JSON          |
| `code/CodeViewer.tsx`   | CodeMirror 只读代码查看                     |
| `code/language.ts`      | 路径 → Monaco 语言 id                       |
| `layout/`               | MainWindow 等窗口壳                         |
| `titlebar/`             | 跨平台标题栏、窗口控制、侧栏收起联动        |
| `error-boundary/`       | 崩溃边界                                    |
| `ui/`                   | shadcn/ui 设计系统（不含业务）              |

---

## lib/ — 基础设施

| 路径                                                                                                               | 作用                                                        |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `protocol/types.ts`                                                                                                | `ProjectContext` / `ProjectChanges`、AI Instruction、序列化 |
| `protocol/schema.ts`                                                                                               | Schema 与路径安全校验、解析 AI JSON                         |
| `protocol/token-estimate.ts`                                                                                       | 按复制载荷估算 Token、可配置 chars/token                    |
| `protocol/markdown.ts`                                                                                             | `## 结构` / `## 文件` Markdown 预览                         |
| `protocol/index.ts`                                                                                                | 协议统一入口（UI 禁止自拼格式）                             |
| `tauri/bindings.ts`                                                                                                | tauri-specta 自动生成（勿手改）                             |
| `tauri/tauri-bindings.ts`                                                                                          | 前端桥接 + `unwrapResult`                                   |
| `commands/`                                                                                                        | 应用命令系统（快捷键、面板，非 Rust IPC）                   |
| `platform/platform-strings.ts`                                                                                     | 平台相关文案                                                |
| `diff.ts`                                                                                                          | 行级 LCS Diff（统计/列表用）                                |
| `logger.ts` / `menu.ts` / `notifications.ts` / `query-client.ts` / `recovery.ts` / `utils.ts` / `theme-context.ts` | 日志、原生菜单、通知、Query、恢复、工具                     |

---

## hooks/ — 跨功能 Hook

| 文件                                 | 作用                    |
| ------------------------------------ | ----------------------- |
| `use-platform.ts`                    | 平台检测                |
| `use-narrow.ts`                      | 窄窗口（侧栏图标模式）  |
| `use-mobile.ts`                      | 移动断点                |
| `use-keyboard-shortcuts.ts`          | 全局快捷键              |
| `use-main-window-event-listeners.ts` | 主窗口事件 + 快捷键组合 |
| `use-command-context.ts`             | 命令上下文              |
| `use-theme.ts`                       | 主题读写                |

Feature 专属 Hook 应放在对应 `features/*/` 下。

---

## services/ — IPC 封装

| 文件             | 作用                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `project.ts`     | `openProject` / `rescan` / `buildProjectContext` / `applyAiChanges` / `undoAiChanges` 等，并把 Rust 结果转成协议 `ProjectContext` |
| `preferences.ts` | 偏好读写（TanStack Query）                                                                                                        |

---

## store/ — 全局状态

| 文件                    | 作用                                           |
| ----------------------- | ---------------------------------------------- |
| `ui-store.ts`           | `activePage`、侧栏可见性、命令面板、偏好对话框 |
| `app-settings-store.ts` | `charsPerToken`（persist 到 localStorage）     |

Feature 状态（如 structure/content 选择）放在各自 feature store。

---

## i18n/ 与 locales/

- 默认语言 **中文（zh）**，可选 **English（en）**
- `i18n/config.ts`：资源与 `lng: 'zh'`
- `i18n/language-init.ts`：用户偏好 → 系统 zh → 默认 zh
- `locales/zh.json` / `en.json`：界面文案（扁平 key）

---

## test/

| 文件             | 作用                               |
| ---------------- | ---------------------------------- |
| `setup.ts`       | jest-dom、Tauri/dialog/Monaco mock |
| `test-utils.tsx` | RTL 包装（i18n、主题等）           |

测试与源码同目录（`*.test.ts(x)`），协议与 Token 规则有单测。

---

## 命名约定

- React 组件：`PascalCase.tsx`
- Hook：`use-kebab-case.ts`
- 普通模块 / UI primitive：`kebab-case.ts(x)`
- Feature 目录：`kebab-case/`
- 路径别名：`@/` → `src/`
