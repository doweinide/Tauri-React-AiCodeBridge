/**
 * Human-readable Markdown rendering of ProjectContext for preview/copy.
 * Not the wire protocol — protocol stays JSON. MD is a convenience view.
 */

import type { ProjectContext } from './types'

interface TreeNodeLike {
  name: string
  path: string
  nodeType: string
  children?: TreeNodeLike[] | null
}

function renderTreeLines(node: TreeNodeLike, prefix = '', isRoot = true): string[] {
  const lines: string[] = []
  if (isRoot) {
    lines.push(`${node.name}/`)
  }
  const kids = node.children ?? []
  kids.forEach((child, i) => {
    const last = i === kids.length - 1
    const branch = last ? '└── ' : '├── '
    const label = child.nodeType === 'dir' ? `${child.name}/` : child.name
    lines.push(`${prefix}${branch}${label}`)
    if (child.nodeType === 'dir') {
      const next = `${prefix}${last ? '    ' : '│   '}`
      lines.push(...renderTreeLines(child, next, false))
    }
  })
  return lines
}

function languageFence(path: string): string {
  if (/\.(ts|tsx)$/.test(path)) return 'ts'
  if (/\.(js|jsx|mjs|cjs)$/.test(path)) return 'js'
  if (/\.json$/.test(path)) return 'json'
  if (/\.dart$/.test(path)) return 'dart'
  if (/\.(rs)$/.test(path)) return 'rust'
  if (/\.(py)$/.test(path)) return 'python'
  if (/\.(md)$/.test(path)) return 'md'
  if (/\.(css|scss)$/.test(path)) return 'css'
  if (/\.(html)$/.test(path)) return 'html'
  if (/\.(ya?ml)$/.test(path)) return 'yaml'
  return ''
}

/**
 * Markdown layout:
 * ## 结构
 * files/
 * ├── ...
 *
 * ## 文件
 * ### path
 * ```lang
 * content
 * ```
 */
export function projectContextToMarkdown(context: ProjectContext): string {
  const structure = context.structure as TreeNodeLike | null
  const structureLines = structure
    ? renderTreeLines(structure)
    : ['(empty)']

  let md = `## 结构\n\n\`\`\`\n${structureLines.join('\n')}\n\`\`\`\n`

  if (context.files.length > 0) {
    md += `\n## 文件\n`
    for (const file of context.files) {
      const fence = languageFence(file.path)
      md += `\n### ${file.path}\n\n\`\`\`${fence}\n${file.content}\n\`\`\`\n`
    }
  }

  return md
}
