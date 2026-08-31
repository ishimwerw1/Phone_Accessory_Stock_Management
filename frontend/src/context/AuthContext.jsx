import { createContext, useContext, useState, useCallback } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pas_user')) || null
    } catch {
      return null
    }
  })

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('pas_token', data.data.token)
    localStorage.setItem('pas_user', JSON.stringify(data.data.user))
    setUser(data.data.user)
    return data.data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* ignore */
    }
    localStorage.removeItem('pas_token')
    localStorage.removeItem('pas_user')
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me')
    localStorage.setItem('pas_user', JSON.stringify(data.data.user))
    setUser(data.data.user)
  }, [])

  const hasPermission = useCallback(
    (permission) => {
      if (!user) return false
      if (user.roleName === 'Super Admin') return true
      if (user.role && typeof user.role === 'object') {
        if (user.role.name === 'Super Admin') return true
        return (user.role.permissions || []).includes(permission)
      }
      return (user.permissions || []).includes(permission)
    },
    [user]
  )

  const isSuperAdmin =
    user?.roleName === 'Super Admin' ||
    user?.role?.name === 'Super Admin' ||
    user?.role === 'SUPER_ADMIN'

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, hasPermission, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
