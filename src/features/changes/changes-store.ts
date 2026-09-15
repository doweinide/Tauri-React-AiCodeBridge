import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  parseProjectChanges,
  SAMPLE_CHANGE_JSON,
  type ParseErrorDetail,
  type ProjectChange,
} from '@/lib/protocol'
import {
  applyAiChanges,
  undoAiChanges,
  readProjectFiles,
  clearProjectHistory,
} from '@/services/project'
import type { ChangeInput } from '@/lib/tauri/tauri-bindings'
import { diffForAdd, diffForDelete, diffLines, type DiffLine } from '@/lib/diff'

export type ChangeStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'applied'
  | 'failed'

export interface ReviewChange {
  id: string
  type: 'add' | 'modify' | 'delete'
  path: string
  status: ChangeStatus
  oldContent: string | null
  newContent: string | null
  expectedHash: string | null
  diff: DiffLine[]
}

interface ChangesState {
  responseText: string
  parseError: ParseErrorDetail | null
  parsed: ProjectChange[] | null
  changes: ReviewChange[]
  activeId: string | null
  applying: boolean
  lastChangeSetId: string | null
  conflictPath: string | null
  applySummary: {
    applied: number
    added: number
    modified: number
    deleted: number
  } | null

  setResponseText: (text: string) => void
  loadSample: () => void
  /**
   * Parse AI JSON and load current on-disk baselines for MODIFY/DELETE.
   * Diff left side always reflects the live project file, not only
   * structure/content selection from Context Builder.
   */
  parseFromProject: (
    rootPath: string,
    fileHashes?: Record<string, string>
  ) => Promise<void>
  selectChange: (id: string) => void
  setChangeStatus: (id: string, status: ChangeStatus) => void
  applyOne: (
    id: string,
    rootPath: string,
    allowOverwrite?: boolean
  ) => Promise<void>
  applyPending: (rootPath: string, allowOverwrite?: boolean) => Promise<void>
  rejectOne: (id: string) => void
  rejectAll: () => void
  undoLast: (rootPath: string) => Promise<void>
  clear: () => void
  dismissConflict: () => void
  dismissSummary: () => void
}

let seq = 0
function nextId() {
  seq += 1
  return `chg_${seq}`
}

function buildDiff(
  type: ReviewChange['type'],
  oldContent: string | null,
  newContent: string | null
): DiffLine[] {
  if (type === 'add') return diffForAdd(newContent ?? '')
  if (type === 'delete') return diffForDelete(oldContent ?? '')
  return diffLines(oldContent ?? '', newContent ?? '')
}

export const useChangesStore = create<ChangesState>()(
  devtools(
    (set, get) => ({
      responseText: '',
      parseError: null,
      parsed: null,
      changes: [],
      activeId: null,
      applying: false,
      lastChangeSetId: null,
      conflictPath: null,
      applySummary: null,

      setResponseText: text =>
        set({ responseText: text }, undefined, 'setResponseText'),
      loadSample: () =>
        set(
          { responseText: SAMPLE_CHANGE_JSON, parseError: null },
          undefined,
          'loadSample'
        ),

      parseFromProject: async (rootPath, fileHashes = {}) => {
        const result = parseProjectChanges(get().responseText)
        if (!result.ok) {
          set(
            {
              parseError: result.error,
              parsed: null,
              changes: [],
              activeId: null,
            },
            undefined,
            'parse/err'
          )
          return
        }

        const parsedChanges = result.data.changes
        // Always read current disk content for non-ADD ops so Diff left pane is real.
        const baselinePaths = parsedChanges
          .filter(c => c.operation === 'modify' || c.operation === 'delete')
          .map(c => c.path)

        const diskMap: Record<string, string> = {}
        const diskHashes: Record<string, string> = {}
        if (baselinePaths.length > 0) {
          try {
            const files = await readProjectFiles(rootPath, baselinePaths)
            for (const f of files) {
              diskMap[f.path] = f.content
              diskHashes[f.path] = f.hash
            }
          } catch {
            // Missing files stay empty on the left pane
          }
        }

        const changes: ReviewChange[] = parsedChanges.map(
          (c: ProjectChange) => {
            const isAdd = c.operation === 'add'
            const oldContent = isAdd ? null : (diskMap[c.path] ?? '')
            const newContent = c.operation === 'delete' ? null : (c.content ?? '')
            // Prefer context-created hash for external-change detection; fall back to disk hash.
            const expectedHash =
              fileHashes[c.path] ?? diskHashes[c.path] ?? null
            return {
              id: nextId(),
              type: c.operation,
              path: c.path,
              status: 'pending',
              oldContent,
              newContent,
              expectedHash,
              diff: buildDiff(c.operation, oldContent, newContent),
            }
          }
        )

        // New parse cycle: drop previous undo snapshots and last-apply UI state
        try {
          await clearProjectHistory(rootPath)
        } catch {
          // Non-fatal: continue with the new ChangeSet
        }

        set(
          {
            parsed: parsedChanges,
            changes,
            parseError: null,
            activeId: changes[0]?.id ?? null,
            lastChangeSetId: null,
            applySummary: null,
            conflictPath: null,
          },
          undefined,
          'parse/ok'
        )
      },

      selectChange: id => set({ activeId: id }, undefined, 'selectChange'),

      setChangeStatus: (id, status) =>
        set(
          state => ({
            changes: state.changes.map(c =>
              c.id === id ? { ...c, status } : c
            ),
          }),
          undefined,
          'setChangeStatus'
        ),

      applyOne: async (id, rootPath, allowOverwrite = false) => {
        const change = get().changes.find(c => c.id === id)
        if (
          !change ||
          change.status === 'rejected' ||
          change.status === 'applied'
        )
          return
        set({ applying: true, conflictPath: null }, undefined, 'applyOne/start')
        try {
          const input: ChangeInput = {
            changeType: change.type,
            path: change.path,
            newContent: change.newContent,
            expectedHash: change.type === 'modify' ? change.expectedHash : null,
          }
          const result = await applyAiChanges(rootPath, [input], allowOverwrite)
          set(
            state => ({
              applying: false,
              lastChangeSetId: result.changeSetId,
              changes: state.changes.map(c =>
                c.id === id ? { ...c, status: 'applied' } : c
              ),
            }),
            undefined,
            'applyOne/ok'
          )
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          if (msg.startsWith('CONFLICT:')) {
            const path = msg.split(':')[1] ?? change.path
            set(
              { applying: false, conflictPath: path },
              undefined,
              'applyOne/conflict'
            )
          } else {
            set(
              state => ({
                applying: false,
                changes: state.changes.map(c =>
                  c.id === id ? { ...c, status: 'failed' } : c
                ),
              }),
              undefined,
              'applyOne/err'
            )
            throw e
          }
        }
      },

      applyPending: async (rootPath, allowOverwrite = false) => {
        const pending = get().changes.filter(
          c => c.status === 'pending' || c.status === 'accepted'
        )
        if (pending.length === 0) return
        set({ applying: true, conflictPath: null }, undefined, 'apply/start')
        try {
          const inputs: ChangeInput[] = pending.map(c => ({
            changeType: c.type,
            path: c.path,
            newContent: c.newContent,
            expectedHash: c.type === 'modify' ? c.expectedHash : null,
          }))
          const result = await applyAiChanges(rootPath, inputs, allowOverwrite)
          const appliedPaths = new Set(result.applied)
          const added = pending.filter(
            c => c.type === 'add' && appliedPaths.has(c.path)
          ).length
          const modified = pending.filter(
            c => c.type === 'modify' && appliedPaths.has(c.path)
          ).length
          const deleted = pending.filter(
            c => c.type === 'delete' && appliedPaths.has(c.path)
          ).length
          set(
            state => ({
              applying: false,
              lastChangeSetId: result.changeSetId,
              applySummary: {
                applied: result.applied.length,
                added,
                modified,
                deleted,
              },
              changes: state.changes.map(c =>
                appliedPaths.has(c.path) ? { ...c, status: 'applied' } : c
              ),
            }),
            undefined,
            'apply/ok'
          )
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          if (msg.startsWith('CONFLICT:')) {
            const path = msg.split(':')[1] ?? ''
            set(
              { applying: false, conflictPath: path },
              undefined,
              'apply/conflict'
            )
          } else {
            set({ applying: false }, undefined, 'apply/err')
            throw e
          }
        }
      },

      rejectOne: id => get().setChangeStatus(id, 'rejected'),

      rejectAll: () =>
        set(
          state => ({
            changes: state.changes.map(c =>
              c.status === 'pending' || c.status === 'accepted'
                ? { ...c, status: 'rejected' }
                : c
            ),
          }),
          undefined,
          'rejectAll'
        ),

      undoLast: async rootPath => {
        const id = get().lastChangeSetId
        if (!id) return
        await undoAiChanges(rootPath, id)
        set(
          state => ({
            lastChangeSetId: null,
            applySummary: null,
            changes: state.changes.map(c =>
              c.status === 'applied' ? { ...c, status: 'pending' } : c
            ),
          }),
          undefined,
          'undo'
        )
      },

      clear: () =>
        set(
          {
            changes: [],
            activeId: null,
            parseError: null,
            parsed: null,
            lastChangeSetId: null,
            conflictPath: null,
            applySummary: null,
          },
          undefined,
          'clear'
        ),

      dismissConflict: () =>
        set({ conflictPath: null }, undefined, 'dismissConflict'),
      dismissSummary: () =>
        set({ applySummary: null }, undefined, 'dismissSummary'),
    }),
    { name: 'changes-store' }
  )
)

export function pendingCount(changes: ReviewChange[]): number {
  return changes.filter(c => c.status === 'pending' || c.status === 'accepted')
    .length
}
