import React, { useMemo, useState } from 'react'
import MealPlanner from '@/Pages/MealPlanner.jsx'
import Login from '@/Pages/Login.jsx'

export default function App() {
  const [authUser, setAuthUser] = useState(() => {
    if (typeof window === 'undefined') return null
    const storedUser = window.localStorage.getItem('auth_user')
    try {
      return storedUser ? JSON.parse(storedUser) : null
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
    setAuthUser(user)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('auth_status', 'authenticated')
      window.localStorage.setItem('auth_user', JSON.stringify(user))
    }
  }

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('auth_status')
      window.localStorage.removeItem('auth_user')
    }
    setAuthUser(null)
  }

  if (!isAuthenticated) {
    return <Login onAuthSuccess={handleAuthSuccess} />
  }

  return <MealPlanner onLogout={handleLogout} user={authUser} />
}
