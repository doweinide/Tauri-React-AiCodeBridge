import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  parseProjectChanges,
  changesToApplyInputs,
  SAMPLE_CHANGE_JSON,
  type ParseErrorDetail,
  type ProjectChange,
} from '@/lib/protocol'
import { applyAiChanges, undoAiChanges } from '@/services/project'
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
  parse: (
    localContents: Record<string, string>,
    fileHashes: Record<string, string>
  ) => void
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

      parse: (localContents, fileHashes) => {
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
        const changes: ReviewChange[] = result.data.changes.map(
          (c: ProjectChange) => {
            const oldContent =
              c.operation === 'add' ? null : (localContents[c.path] ?? '')
            return {
              id: nextId(),
              type: c.operation,
              path: c.path,
              status: 'pending',
              oldContent,
              newContent: c.content ?? null,
              expectedHash: fileHashes[c.path] ?? null,
              diff: buildDiff(c.operation, oldContent, c.content ?? null),
            }
          }
        )
        set(
          {
            parsed: result.data.changes,
            changes,
            parseError: null,
            activeId: changes[0]?.id ?? null,
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

// keep changesToApplyInputs imported for type re-export convenience
void changesToApplyInputs
