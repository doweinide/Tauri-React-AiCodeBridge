import { useMemo } from 'react'
import ReactJson from '@uiw/react-json-view'
import { cn } from '@/lib/utils'

export interface JsonTreeViewProps {
  /** Already-parsed JSON value, or a JSON string */
  value: unknown
  className?: string
  collapsed?: number | boolean
  onFileSelect?: (path: string) => void
}

/**
 * Expandable JSON tree for protocol payloads.
 * File content nodes stay as strings — open them in CodeViewer instead.
 */
export function JsonTreeView({
  value,
  className,
  collapsed = 2,
}: JsonTreeViewProps) {
  const data = useMemo(() => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as unknown
      } catch {
        return { error: 'Invalid JSON' }
      }
    }
    return value
  }, [value])

  return (
    <div
      className={cn(
        'h-full min-h-0 overflow-auto rounded-md border bg-background p-3',
        className
      )}
    >
      <ReactJson
        value={data as object}
        collapsed={collapsed}
        displayDataTypes={false}
        displayObjectSize={false}
        enableClipboard
        style={{
          backgroundColor: 'transparent',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: 12,
        }}
      />
    </div>
  )
}
