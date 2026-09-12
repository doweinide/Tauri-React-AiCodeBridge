import * as React from 'react'

const NARROW_BREAKPOINT = 1100

/** True when the window is too narrow for the full three-column workspace. */
export function useIsNarrow() {
  const [isNarrow, setIsNarrow] = React.useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < NARROW_BREAKPOINT
  })

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${NARROW_BREAKPOINT - 1}px)`)
    const onChange = () => setIsNarrow(window.innerWidth < NARROW_BREAKPOINT)
    mql.addEventListener('change', onChange)
    setIsNarrow(window.innerWidth < NARROW_BREAKPOINT)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isNarrow
}
