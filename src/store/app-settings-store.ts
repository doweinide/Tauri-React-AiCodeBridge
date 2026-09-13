import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  normalizeCharsPerToken,
  DEFAULT_CHARS_PER_TOKEN,
} from '@/lib/protocol/token-estimate'

interface AppSettingsState {
  /** Characters per token for estimation (default 4). */
  charsPerToken: number
  setCharsPerToken: (n: number) => void
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    set => ({
      charsPerToken: DEFAULT_CHARS_PER_TOKEN,
      setCharsPerToken: n =>
        set({ charsPerToken: normalizeCharsPerToken(n) }),
    }),
    { name: 'ai-context-tool-settings' }
  )
)
