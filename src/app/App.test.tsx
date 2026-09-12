import { render, screen } from '@/test/test-utils'
import { describe, it, expect } from 'vitest'
import App from './App'

// Tauri bindings are mocked globally in src/test/setup.ts

describe('App', () => {
  it('renders AIContextTool workspace shell', () => {
    render(<App />)
    expect(screen.getAllByText(/AIContextTool/i).length).toBeGreaterThan(0)
  })

  it('renders workspace navigation', () => {
    render(<App />)
    expect(
      screen.getAllByText(/上下文构建|Context Builder/i).length
    ).toBeGreaterThan(0)
    expect(screen.getAllByText(/AI 交换|AI Exchange/i).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/变更评审|Change Review/i).length
    ).toBeGreaterThan(0)
  })

  it('renders title bar with window control buttons', () => {
    render(<App />)
    const titleBarButtons = screen
      .getAllByRole('button')
      .filter(
        button =>
          button.getAttribute('aria-label')?.includes('window') ||
          button.className.includes('window-control')
      )
    expect(titleBarButtons.length).toBeGreaterThan(0)
  })
})
