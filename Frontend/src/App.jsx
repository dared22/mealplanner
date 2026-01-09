import React, { useMemo, useState } from 'react'
import MealPlanner from '@/Pages/MealPlanner.jsx'
import Login from '@/Pages/Login.jsx'
import { LanguageProvider } from '@/i18n/LanguageContext'

export default function App() {
  const [authUser, setAuthUser] = useState(() => {
    if (typeof window === 'undefined') return null
    const storedUser = window.localStorage.getItem('auth_user')
    try {
      if (!storedUser) return null
      const parsed = JSON.parse(storedUser)
      if (!parsed || typeof parsed !== 'object') return null
      const normalizedId = parsed.id ?? parsed.user_id ?? parsed.userId ?? null
      if (!normalizedId || !parsed.email) return null
      return { id: normalizedId, email: parsed.email }
    } catch (error) {
      console.error('Failed to parse stored user', error)
      return null
    }
  })

  const isAuthenticated = useMemo(() => {
    if (typeof window === 'undefined') return false
    const status = window.localStorage.getItem('auth_status')
    return status === 'authenticated' && authUser !== null
  }, [authUser])

  const handleAuthSuccess = (user) => {
    if (!user) return
    const normalized = {
      id: user.id ?? user.user_id ?? user.userId,
      email: user.email,
    }
    if (!normalized.id || !normalized.email) {
      console.error('Auth success payload missing id/email', user)
      return
    }
    setAuthUser(normalized)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('auth_status', 'authenticated')
      window.localStorage.setItem('auth_user', JSON.stringify(normalized))
    }
  }

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('auth_status')
      window.localStorage.removeItem('auth_user')
    }
    setAuthUser(null)
  }

  return (
    <LanguageProvider>
      {isAuthenticated ? (
        <MealPlanner onLogout={handleLogout} user={authUser} />
      ) : (
        <Login onAuthSuccess={handleAuthSuccess} />
      )}
    </LanguageProvider>
  )
}
