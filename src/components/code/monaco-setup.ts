import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
// monaco-editor@0.56 package exports map: monaco-editor/* → esm/vs/*.js
import editorWorker from 'monaco-editor/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker'

// Bundle Monaco workers locally (no CDN) for offline Tauri.
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new jsonWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  },
}

loader.config({ monaco })
