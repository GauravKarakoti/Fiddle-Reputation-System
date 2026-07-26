import { createContext, useContext, useState, useEffect } from 'react'

const THEME_KEY = 'ff_theme'
const AUTOREFRESH_KEY = 'ff_autorefresh'

const PreferencesContext = createContext(null)

export function PreferencesProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')
  const [autoRefresh, setAutoRefreshState] = useState(
    () => localStorage.getItem(AUTOREFRESH_KEY) !== 'false' // defaults to true if unset
  )

  // Applying data-theme on <html> is what the light-mode CSS overrides in
  // index.css key off of — see the "[data-theme='light']" block there.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(AUTOREFRESH_KEY, String(autoRefresh))
  }, [autoRefresh])

  const toggleTheme = () => setThemeState(t => (t === 'dark' ? 'light' : 'dark'))
  const toggleAutoRefresh = () => setAutoRefreshState(v => !v)

  return (
    <PreferencesContext.Provider value={{ theme, toggleTheme, autoRefresh, toggleAutoRefresh }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) {
    throw new Error('usePreferences must be used within a PreferencesProvider')
  }
  return ctx
}