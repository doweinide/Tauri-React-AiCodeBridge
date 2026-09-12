/**
 * Parse AI_CHANGE structured responses into typed file changes.
 */

export type ParsedChangeType = 'add' | 'modify' | 'delete'

export interface ParsedChange {
  type: ParsedChangeType
  path: string
  newContent: string | null
}

export interface ParseResult {
  ok: boolean
  changes: ParsedChange[]
  error?: string
}

export function parseAiResponse(raw: string): ParseResult {
  const text = raw.trim()
  if (!text) {
    return { ok: false, changes: [], error: 'Empty response' }
  }

  const hasHeader = /#?\s*AI_CHANGE/i.test(text)
  const hasSection = /(^|\n)##\s*(ADD|MODIFY|DELETE)/i.test(text)
  if (!hasHeader && !hasSection) {
    return {
      ok: false,
      changes: [],
      error:
        'Unable to parse response. Please ask AI to return changes using the required format.',
    }
  }

  const changes: ParsedChange[] = []
  const lines = text.split('\n')

  let i = 0
  while (i < lines.length) {
    const line = (lines[i] ?? '').trim()
    const sectionMatch = /^##\s+(ADD|MODIFY|DELETE)\s*$/i.exec(line)
    if (!sectionMatch) {
      i++
      continue
    }

    const rawType = sectionMatch[1] ?? 'MODIFY'
    const type = rawType.toLowerCase() as ParsedChangeType
    i++

    let filePath: string | null = null
    while (i < lines.length) {
      const fileLine = (lines[i] ?? '').trim()
      if (/^##\s+(ADD|MODIFY|DELETE)\s*$/i.test(fileLine)) break
      if (/^#\s/i.test(fileLine)) break
      const m = /^FILE:\s*(.+?)\s*$/i.exec(fileLine)
      if (m && m[1]) {
        filePath = m[1]
        i++
        break
      }
      i++
    }

    if (!filePath) {
      return {
        ok: false,
        changes: [],
        error: `Missing FILE: line under ${rawType}`,
      }
    }

    let content: string | null = null
    while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
      if (/^##\s+(ADD|MODIFY|DELETE)\s*$/i.test((lines[i] ?? '').trim())) break
      i++
    }

    if (i < lines.length && (lines[i] ?? '').trim().startsWith('```')) {
      i++
      const buf: string[] = []
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith('```')) {
        buf.push(lines[i] ?? '')
        i++
      }
      if (i < lines.length && (lines[i] ?? '').trim().startsWith('```')) {
        i++
      }
      content = buf.join('\n')
    }

    if (type === 'delete') {
      changes.push({ type, path: filePath, newContent: null })
    } else {
      changes.push({ type, path: filePath, newContent: content ?? '' })
    }
  }

  if (changes.length === 0) {
    return {
      ok: false,
      changes: [],
      error:
        'Unable to parse response. Please ask AI to return changes using the required format.',
    }
  }

  for (const c of changes) {
    if (
      c.path.includes('..') ||
      c.path.startsWith('/') ||
      c.path.startsWith('\\')
    ) {
      return {
        ok: false,
        changes: [],
        error: `Unsafe path rejected: ${c.path}`,
      }
    }
  }

  return { ok: true, changes }
}

export const AI_PROMPT = `# 角色

你是一个代码修改助手。你会收到一个项目的部分上下文，以及一个修改需求。

# 规则

1. 只修改与需求相关的文件。
2. 严格按下面的格式返回结果，不要输出任何额外解释。
3. 不要使用 Markdown 表格、编号列表或额外章节。

# 返回格式

\`\`\`
# AI_CHANGE

## ADD
FILE: src/auth/oauth.ts
\`\`\`ts
<完整文件内容>
\`\`\`

## MODIFY
FILE: src/auth/login.ts
\`\`\`ts
<完整文件内容>
\`\`\`

## DELETE
FILE: src/auth/old.ts
\`\`\`
`

export const SAMPLE_AI_RESPONSE = `# AI_CHANGE

## ADD
FILE: src/auth/oauth.ts
\`\`\`ts
import { api } from '../services/api';
import { setSession } from './session';

export async function loginWithOAuth(provider: string, code: string) {
  const res = await api.post('/auth/oauth/' + provider, { code });
  if (!res.ok) {
    throw new Error('OAuth login failed');
  }
  setSession(res.data.token);
  return res.data;
}
\`\`\`

## MODIFY
FILE: src/auth/login.ts
\`\`\`ts
import { api } from '../services/api';
import { setSession } from './session';

export interface LoginPayload {
  username: string;
  password: string;
}

export async function login(payload: LoginPayload) {
  try {
    const res = await api.post('/auth/login', payload);
    if (!res.ok) {
      throw new Error('Username or password is incorrect');
    }
    setSession(res.data.token);
    return res.data;
  } catch (err) {
    return { error: 'Username or password is incorrect' };
  }
}
\`\`\`

## DELETE
FILE: src/auth/old.ts
\`\`\`
`
