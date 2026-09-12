import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { EditorView } from '@codemirror/view'
import { cn } from '@/lib/utils'

const baseTheme = EditorView.theme({
  '&': {
    fontSize: '12px',
    height: '100%',
  },
  '.cm-scroller': {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    lineHeight: '1.65',
  },
  '.cm-content': {
    caretColor: 'currentColor',
  },
  '&.cm-focused': {
    outline: 'none',
  },
})

export interface CodeViewerProps {
  value: string
  language?: 'javascript' | 'json' | 'text'
  readOnly?: boolean
  className?: string
  minHeight?: string
}

export function CodeViewer({
  value,
  language = 'javascript',
  readOnly = true,
  className,
  minHeight = '160px',
}: CodeViewerProps) {
  const extensions =
    language === 'javascript'
      ? [javascript({ typescript: true, jsx: true }), baseTheme]
      : [baseTheme]

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border bg-background',
        className
      )}
      style={{ minHeight }}
    >
      <CodeMirror
        value={value}
        readOnly={readOnly}
        theme="dark"
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        }}
        style={{ height: '100%', minHeight }}
      />
    </div>
  )
}
