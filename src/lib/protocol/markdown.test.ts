import { describe, expect, it } from 'vitest'
import { createProjectContext, projectContextToMarkdown } from './index'

describe('projectContextToMarkdown', () => {
  it('renders structure tree and file sections', () => {
    const ctx = createProjectContext({
      projectName: 'files',
      structure: {
        name: 'files',
        path: '',
        nodeType: 'dir',
        size: null,
        children: [
          {
            name: 'domain',
            path: 'domain',
            nodeType: 'dir',
            size: null,
            children: [
              {
                name: 'contracts',
                path: 'domain/contracts',
                nodeType: 'dir',
                size: null,
                children: [
                  {
                    name: 'file_system_service.dart',
                    path: 'domain/contracts/file_system_service.dart',
                    nodeType: 'file',
                    size: 10,
                    children: null,
                  },
                ],
              },
            ],
          },
        ],
      },
      files: [
        {
          path: 'domain/contracts/file_system_service.dart',
          content: 'class FileSystemService {}',
        },
      ],
      mode: 'custom',
      structureFileCount: 1,
      contentFileCount: 1,
      totalChars: 26,
      estimatedTokens: 7,
    })

    const md = projectContextToMarkdown(ctx)
    expect(md).toContain('## 结构')
    expect(md).toContain('└── contracts/')
    expect(md).toContain('## 文件')
    expect(md).toContain('### domain/contracts/file_system_service.dart')
    expect(md).toContain('```dart')
    expect(md).toContain('class FileSystemService {}')
  })

  it('omits files section when empty', () => {
    const ctx = createProjectContext({
      projectName: 'p',
      structure: { name: 'p', path: '', nodeType: 'dir', children: [] },
      files: [],
      mode: 'structure',
      structureFileCount: 0,
      contentFileCount: 0,
      totalChars: 0,
      estimatedTokens: 0,
    })
    const md = projectContextToMarkdown(ctx)
    expect(md).toContain('## 结构')
    expect(md).not.toContain('## 文件')
  })
})
