/**
 * Project selection JSON: which paths are included as structure / content.
 * Export/import so users can reuse selection rules across sessions.
 */

import type { ParseOutcome } from './types'
import { PROTOCOL_VERSION } from './types'

export interface ProjectSelection {
  version: typeof PROTOCOL_VERSION
  type: 'project_selection'
  /** File and/or dir paths for structure tree */
  structure: string[]
  /** File paths whose content is sent */
  content: string[]
}

export const SELECTION_PROMPT_ZH = `# 项目选中规则 JSON

用于导入/导出「上下文构建」里的结构勾选与内容勾选。

## Schema

{
  "version": "1.0",
  "type": "project_selection",
  "structure": ["src/auth", "src/auth/login.ts"],
  "content": ["src/auth/login.ts"]
}

## 说明

- structure：进入项目结构树的路径。可填目录（递归包含其下文件）或具体文件。
- content：要附带完整内容的文件路径（必须是文件）。
- 路径相对项目根目录，使用正斜杠，禁止 .. 与绝对路径。
- 空数组表示该维度不选中任何项。

## 示例

{
  "version": "1.0",
  "type": "project_selection",
  "structure": ["src/auth", "src/components/Login.tsx"],
  "content": ["src/auth/login.ts", "src/components/Login.tsx"]
}`

export const SELECTION_PROMPT_EN = `# Project Selection JSON

Used to import/export structure & content checkboxes in Context Builder.

## Schema

{
  "version": "1.0",
  "type": "project_selection",
  "structure": ["src/auth", "src/auth/login.ts"],
  "content": ["src/auth/login.ts"]
}

## Notes

- structure: paths included in the project tree. Directory (recursive) or file.
- content: file paths whose full content is attached (must be files).
- Paths are relative to project root, forward slashes, no ".." or absolute paths.
- Empty array means nothing selected in that dimension.

## Example

{
  "version": "1.0",
  "type": "project_selection",
  "structure": ["src/auth", "src/components/Login.tsx"],
  "content": ["src/auth/login.ts", "src/components/Login.tsx"]
}`

export function getSelectionPrompt(lang: 'zh' | 'en' = 'zh'): string {
  return lang === 'zh' ? SELECTION_PROMPT_ZH : SELECTION_PROMPT_EN
}

const REL_OK = /^[A-Za-z0-9._@+\u4e00-\u9fff ]+(?:\/[A-Za-z0-9._@+\u4e00-\u9fff ]+)*$/

function okPath(p: unknown): p is string {
  if (typeof p !== 'string' || !p.trim()) return false
  if (p.includes('..') || p.startsWith('/') || p.startsWith('\\')) return false
  if (/^[A-Za-z]:[\\/]/.test(p)) return false
  return REL_OK.test(p.trim())
}

export function createSelection(
  structure: string[],
  content: string[]
): ProjectSelection {
  return {
    version: PROTOCOL_VERSION,
    type: 'project_selection',
    structure: [...new Set(structure)],
    content: [...new Set(content)],
  }
}

export function serializeSelection(sel: ProjectSelection): string {
  return JSON.stringify(sel, null, 2)
}

export function parseSelection(raw: string): ParseOutcome<ProjectSelection> {
  const text = raw.trim()
  if (!text) {
    return { ok: false, error: { reason: 'Empty selection JSON' } }
  }
  let body = text
  const fence = /^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i.exec(text)
  if (fence?.[1]) body = fence[1]
  else {
    const a = text.indexOf('{')
    const b = text.lastIndexOf('}')
    if (a === -1 || b <= a) {
      return { ok: false, error: { reason: 'Not a JSON object' } }
    }
    body = text.slice(a, b + 1)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch (e) {
    return {
      ok: false,
      error: {
        reason: `JSON.parse failed: ${e instanceof Error ? e.message : String(e)}`,
      },
    }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: { reason: 'Root must be an object' } }
  }
  const obj = parsed as Record<string, unknown>
  if (obj.version !== PROTOCOL_VERSION) {
    return {
      ok: false,
      error: {
        reason: `Expected version "${PROTOCOL_VERSION}", got ${JSON.stringify(obj.version)}`,
        path: 'version',
      },
    }
  }
  if (obj.type !== 'project_selection') {
    return {
      ok: false,
      error: {
        reason: `Expected type "project_selection", got ${JSON.stringify(obj.type)}`,
        path: 'type',
      },
    }
  }
  if (!Array.isArray(obj.structure) || !Array.isArray(obj.content)) {
    return {
      ok: false,
      error: { reason: 'structure and content must be string arrays' },
    }
  }
  const structure: string[] = []
  for (let i = 0; i < obj.structure.length; i++) {
    const p = obj.structure[i]
    if (!okPath(p)) {
      return {
        ok: false,
        error: { reason: 'Invalid structure path', path: `structure[${i}]` },
      }
    }
    structure.push((p as string).trim())
  }
  const content: string[] = []
  for (let i = 0; i < obj.content.length; i++) {
    const p = obj.content[i]
    if (!okPath(p)) {
      return {
        ok: false,
        error: { reason: 'Invalid content path', path: `content[${i}]` },
      }
    }
    content.push((p as string).trim())
  }

  return {
    ok: true,
    data: createSelection(structure, content),
  }
}
