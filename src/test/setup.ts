import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock Tauri APIs for tests
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {
    // Mock unlisten function
  }),
}))

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn().mockResolvedValue(null),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(null),
  message: vi.fn().mockResolvedValue(undefined),
  ask: vi.fn().mockResolvedValue(true),
  confirm: vi.fn().mockResolvedValue(true),
}))

// Monaco is heavy and uses workers; stub for jsdom tests
vi.mock('@monaco-editor/react', () => ({
  DiffEditor: () => null,
  Editor: () => null,
  loader: { config: vi.fn() },
}))
vi.mock('@/components/code/monaco-setup', () => ({}))

const ok = <T>(data: T) => ({ status: 'ok', data })

const emptyTree = {
  name: 'demo',
  path: '',
  nodeType: 'dir',
  size: null,
  children: [],
}

// Mock typed Tauri bindings (tauri-specta generated)
vi.mock('@/lib/tauri/tauri-bindings', () => ({
  commands: {
    greet: vi.fn().mockResolvedValue('Hello, test!'),
    loadPreferences: vi
      .fn()
      .mockResolvedValue({ status: 'ok', data: { theme: 'system' } }),
    savePreferences: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    sendNativeNotification: vi
      .fn()
      .mockResolvedValue({ status: 'ok', data: null }),
    saveEmergencyData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    loadEmergencyData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    cleanupOldRecoveryFiles: vi
      .fn()
      .mockResolvedValue({ status: 'ok', data: 0 }),
    showQuickPane: vi.fn().mockResolvedValue(ok(null)),
    dismissQuickPane: vi.fn().mockResolvedValue(ok(null)),
    toggleQuickPane: vi.fn().mockResolvedValue(ok(null)),
    getDefaultQuickPaneShortcut: vi
      .fn()
      .mockResolvedValue(ok('CommandOrControl+Shift+.')),
    updateQuickPaneShortcut: vi.fn().mockResolvedValue(ok(null)),
    openProject: vi.fn().mockResolvedValue(
      ok({
        name: 'demo',
        rootPath: '/tmp/demo',
        tree: emptyTree,
        fileCount: 0,
        totalBytes: 0,
      })
    ),
    rescanProject: vi.fn().mockResolvedValue(
      ok({
        name: 'demo',
        rootPath: '/tmp/demo',
        tree: emptyTree,
        fileCount: 0,
        totalBytes: 0,
      })
    ),
    getRecentProjects: vi.fn().mockResolvedValue(ok([])),
    validateProjectPath: vi.fn().mockResolvedValue(ok(true)),
    readProjectFiles: vi.fn().mockResolvedValue(ok([])),
    buildProjectContext: vi.fn().mockResolvedValue(
      ok({
        projectName: 'demo',
        structure: emptyTree,
        files: [],
        mode: 'empty',
        structureFileCount: 0,
        contentFileCount: 0,
        totalChars: 0,
        estimatedTokens: 0,
        projectTotalBytes: 0,
        projectTotalTokens: 0,
        reductionPercent: 0,
      })
    ),
    listAllFilePaths: vi.fn().mockResolvedValue(ok([])),
    applyAiChanges: vi
      .fn()
      .mockResolvedValue(
        ok({ changeSetId: 'cs_test', applied: [], skipped: [] })
      ),
    undoAiChanges: vi.fn().mockResolvedValue(ok([])),
    listUndoChangeSets: vi.fn().mockResolvedValue(ok([])),
    clearProjectHistory: vi.fn().mockResolvedValue(ok(0)),
  },
  unwrapResult: vi.fn(
    (result: { status: string; data?: unknown; error?: unknown }) => {
      if (result.status === 'ok') return result.data
      throw result.error
    }
  ),
}))
