# src-tauri/src/ Rust 后端目录说明

Tauri 2 后端：文件系统扫描、Context 组装、AI 变更 Apply/Undo、偏好与窗口能力。

依赖方向：

```text
commands/  →  services/  →  platform / types / utils
                ↓
              std::fs
```

`commands` 只做参数与 IPC 边界；业务逻辑放在 `services`。

---

## 入口

| 文件          | 作用                                                              |
| ------------- | ----------------------------------------------------------------- |
| `main.rs`     | 调用 `lib::run()`                                                 |
| `lib.rs`      | 注册插件、状态、命令；窗口生命周期（macOS 隐藏/Reopen、退出清理） |
| `bindings.rs` | tauri-specta 命令收集；导出 TS 到 `src/lib/tauri/bindings.ts`     |

---

## commands/ — Tauri 命令（IPC）

每个命令：校验输入 → 调 service → 返回 `Result`。

| 文件               | 主要命令                                                                         | 说明                                |
| ------------------ | -------------------------------------------------------------------------------- | ----------------------------------- |
| `mod.rs`           | —                                                                                | 命令模块汇总                        |
| `project.rs`       | `open_project`、`rescan_project`、`get_recent_projects`、`validate_project_path` | 打开/重扫目录，写入最近项目         |
| `context.rs`       | `read_project_files`、`build_project_context`、`list_all_file_paths`             | 按结构路径裁剪树 + 按内容路径读文件 |
| `changes.rs`       | `apply_ai_changes`、`undo_ai_changes`、`list_undo_change_sets`                   | 应用/撤销变更                       |
| `preferences.rs`   | `load_preferences`、`save_preferences`、`greet`                                  | 偏好持久化（app data JSON）         |
| `notifications.rs` | `send_native_notification`                                                       | 系统通知                            |
| `quick_pane.rs`    | 显示/隐藏/切换、快捷键注册                                                       | 全局快捷键浮动面板                  |
| `recovery.rs`      | 紧急数据存取、清理                                                               | 崩溃恢复文件                        |

---

## services/ — 业务服务

### scanner.rs

- 递归扫描项目目录（std `read_dir`）
- 默认忽略：`.git`、`node_modules`、`dist`、`build`、`coverage`、`target`、`.history` 等
- 敏感文件过滤：`.env*`、`*.key`/`*.pem`、`credentials.*`/`secrets.*`
- 支持根目录 `.aiignore`（前缀/后缀简单匹配）
- 输出 `ScannedProject` + `ProjectNode` 树

### context_builder.rs

- `resolve_in_project` / `resolve_new_path_in_project`：路径安全（禁止穿越；ADD 可指向尚不存在路径）
- `prune_tree_to_files`：按勾选的文件路径裁剪结构树
- `read_files`：读内容 + FNV-1a 指纹
- `structure` / `files` / 统计字段，供前端序列化为协议 JSON
- Token 估算字段仅供参考；**前端以实际复制载荷为准**

### apply_engine.rs

- 预校验：ADD 目标不存在、MODIFY/DELETE 目标存在、hash 冲突
- ADD 时 `create_dir_all` 创建缺失父目录
- 快照：`<project>/.history/<timestamp>_<id>/` + `manifest.json`
- Undo：从快照还原；ADD 用 `*.__ai_ctx_added__` 标记以便删除

### recent_projects.rs

- 最近项目列表（app data 目录 JSON），上限 20 条

---

## platform/ — 平台工具

| 文件     | 作用                                                               |
| -------- | ------------------------------------------------------------------ |
| `mod.rs` | 路径规范化、`is_macos`/`is_windows`/`is_linux`、`current_platform` |

---

## types/ — 共享类型

| 文件     | 作用                                                     |
| -------- | -------------------------------------------------------- |
| `mod.rs` | `AppPreferences`、恢复相关类型、默认快捷键常量、校验函数 |

只放跨模块公共类型；复杂后再按域拆分。

---

## utils/ — 通用工具

保持极小；平台相关逻辑在 `platform/`，业务逻辑在 `services/`。

---

## 数据落盘位置

| 位置                              | 内容                     |
| --------------------------------- | ------------------------ |
| App data（`preferences.json` 等） | 偏好、恢复数据           |
| App data `recent-projects.json`   | 最近项目                 |
| `<project>/.history/`             | Apply 快照（扫描时忽略） |

---

## 测试

- 单元测试跟模块：`#[cfg(test)]`
- 覆盖：扫描忽略规则、路径裁剪、路径安全、hash 稳定性
- 导出 TS：`cargo test export_bindings -- --ignored`
