import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { loginUser, registerUser, getMe, AUTH_TOKEN_KEY } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await getMe()
      setUser(me)
    } catch {
      // Token missing/expired/invalid — drop it and treat as logged out
      localStorage.removeItem(AUTH_TOKEN_KEY)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUser() }, [loadUser])

  const login = async (email, password) => {
    const data = await loginUser({ email, password })
    localStorage.setItem(AUTH_TOKEN_KEY, data.access_token)
    setUser(data.user)
    return data.user
  }

  const register = async (name, email, password) => {
    const data = await registerUser({ name, email, password })
    localStorage.setItem(AUTH_TOKEN_KEY, data.access_token)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    // JWTs are stateless — logging out is just discarding the local token,
    // there's no server-side session to invalidate.
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}