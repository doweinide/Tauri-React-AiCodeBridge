/**
 * Line-based LCS diff for review UI.
 */

export type DiffLineType = 'add' | 'del' | 'ctx' | 'meta'

export interface DiffLine {
  type: DiffLineType
  text: string
  oldNo?: number
  newNo?: number
}

export interface DiffStats {
  added: number
  removed: number
}

function lcsMatrix(a: string[], b: string[]): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0)
  )
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      const down = dp[i + 1]?.[j] ?? 0
      const right = dp[i]?.[j + 1] ?? 0
      const diag = dp[i + 1]?.[j + 1] ?? 0
      const row = dp[i]
      if (!row) continue
      row[j] = a[i] === b[j] ? diag + 1 : Math.max(down, right)
    }
  }
  return dp
}

/** Simple line diff between old and new text. */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split('\n')
  const b = newText.split('\n')
  const dp = lcsMatrix(a, b)
  const lines: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const ai = a[i] ?? ''
    const bj = b[j] ?? ''
    if (ai === bj) {
      lines.push({ type: 'ctx', text: ai, oldNo: i + 1, newNo: j + 1 })
      i++
      j++
      continue
    }
    const down = dp[i + 1]?.[j] ?? 0
    const right = dp[i]?.[j + 1] ?? 0
    if (down >= right) {
      lines.push({ type: 'del', text: ai, oldNo: i + 1 })
      i++
    } else {
      lines.push({ type: 'add', text: bj, newNo: j + 1 })
      j++
    }
  }
  while (i < a.length) {
    lines.push({ type: 'del', text: a[i] ?? '', oldNo: i + 1 })
    i++
  }
  while (j < b.length) {
    lines.push({ type: 'add', text: b[j] ?? '', newNo: j + 1 })
    j++
  }
  return lines
}

export function diffStats(lines: DiffLine[]): DiffStats {
  let added = 0
  let removed = 0
  for (const l of lines) {
    if (l.type === 'add') added++
    if (l.type === 'del') removed++
  }
  return { added, removed }
}

/** Full-file add diff */
export function diffForAdd(newText: string): DiffLine[] {
  return newText.split('\n').map((text, i) => ({
    type: 'add' as const,
    text,
    newNo: i + 1,
  }))
}

/** Full-file delete diff */
export function diffForDelete(oldText: string): DiffLine[] {
  return oldText.split('\n').map((text, i) => ({
    type: 'del' as const,
    text,
    oldNo: i + 1,
  }))
}
