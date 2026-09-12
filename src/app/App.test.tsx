import { render, screen } from '@/test/test-utils'
import { describe, it, expect } from 'vitest'
import App from './App'

// Tauri bindings are mocked globally in src/test/setup.ts

describe('App', () => {
  it('renders AI Context Tool workspace shell', () => {
    render(<App />)
    expect(screen.getByText(/AI Context Tool/i)).toBeInTheDocument()
  })

  it('renders workspace navigation', () => {
    render(<App />)
    expect(screen.getAllByText(/Context Builder/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/AI Exchange/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Change Review/i).length).toBeGreaterThan(0)
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
