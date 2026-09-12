import { DiffEditor } from '@monaco-editor/react'
import { cn } from '@/lib/utils'
import { detectLanguage } from './language'
import './monaco-setup'

export interface MonacoDiffProps {
  original: string
  modified: string
  path: string
  className?: string
}

/**
 * Side-by-side Monaco DiffEditor: left = current file, right = AI changes.
 * Gutter + line highlighting show adds/deletes/changes clearly.
 */
export function MonacoDiff({
  original,
  modified,
  path,
  className,
}: MonacoDiffProps) {
  const language = detectLanguage(path)

  return (
    <div className={cn('h-full min-h-0 w-full overflow-hidden', className)}>
      <DiffEditor
        key={path}
        height="100%"
        language={language}
        original={original}
        modified={modified}
        theme="vs-dark"
        options={{
          readOnly: true,
          renderSideBySide: true,
          originalEditable: false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          lineNumbers: 'on',
          renderOverviewRuler: true,
          automaticLayout: true,
          wordWrap: 'off',
          folding: true,
          renderIndicators: true,
          ignoreTrimWhitespace: false,
        }}
        loading={
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Loading Diff Editor…
          </div>
        }
      />
    </div>
  )
}
