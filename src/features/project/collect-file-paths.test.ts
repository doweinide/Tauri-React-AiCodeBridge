import { describe, expect, it } from 'vitest'
import type { ProjectNode } from '@/lib/tauri/tauri-bindings'
import { collectFilePaths, findNode } from './project-store'

function node(
  partial: Partial<ProjectNode> & Pick<ProjectNode, 'name' | 'path' | 'nodeType'>
): ProjectNode {
  return {
    size: null,
    ignored: false,
    children: null,
    ...partial,
  } as ProjectNode
}

describe('collectFilePaths', () => {
  it('skips ignored files and ignored subtrees', () => {
    const root = node({
      name: 'root',
      path: '',
      nodeType: 'dir',
      children: [
        node({ name: 'a.ts', path: 'src/a.ts', nodeType: 'file' }),
        node({ name: 'secret.env', path: 'secret.env', nodeType: 'file', ignored: true }),
        node({
          name: 'node_modules',
          path: 'node_modules',
          nodeType: 'dir',
          ignored: true,
          children: [
            node({ name: 'x.js', path: 'node_modules/x.js', nodeType: 'file' }),
          ],
        }),
        node({
          name: 'src',
          path: 'src',
          nodeType: 'dir',
          children: [
            node({ name: 'b.ts', path: 'src/b.ts', nodeType: 'file' }),
            node({ name: 'c.ts', path: 'src/c.ts', nodeType: 'file', ignored: true }),
          ],
        }),
      ],
    })

    expect(collectFilePaths(root).sort()).toEqual(['src/a.ts', 'src/b.ts'])
  })

  it('returns empty for an ignored root', () => {
    const root = node({
      name: 'dist',
      path: 'dist',
      nodeType: 'dir',
      ignored: true,
      children: [node({ name: 'a.js', path: 'dist/a.js', nodeType: 'file' })],
    })
    expect(collectFilePaths(root)).toEqual([])
  })
})

describe('findNode', () => {
  it('locates nested nodes by path', () => {
    const root = node({
      name: 'root',
      path: '',
      nodeType: 'dir',
      children: [
        node({
          name: 'src',
          path: 'src',
          nodeType: 'dir',
          children: [node({ name: 'a.ts', path: 'src/a.ts', nodeType: 'file' })],
        }),
      ],
    })
    expect(findNode(root, 'src/a.ts')?.name).toBe('a.ts')
    expect(findNode(root, 'missing.ts')).toBeNull()
  })
})
