import React, { useState } from 'react'
import { Auth } from '@/Entities/Auth'
import { Button } from '@/components/ui/button'

const modes = {
  login: 'Log in',
  register: 'Create account',
}

export default function Login({ onAuthSuccess }) {
  const [mode, setMode] = useState('login')
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChangeMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setInfo('')
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const validate = () => {
    if (!formData.email.trim() || !formData.password.trim()) {
      setError('Email and password are required.')
      return false
    }

    if (formData.password.trim().length < 8) {
      setError('Password must be at least 8 characters long.')
      return false
    }

    return true
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    setError('')
    setInfo('')

    try {
      if (mode === 'login') {
        const authData = await Auth.login(formData)
        let effectiveUser = authData
        try {
          const sessionData = await Auth.session()
          if (sessionData?.user_id && sessionData?.email) {
            effectiveUser = sessionData
          }
        } catch (sessionError) {
          console.warn('Unable to refresh session after login, using login payload', sessionError)
        }

        if (!effectiveUser?.user_id || !effectiveUser?.email) {
          try {
            const profileData = await Auth.profileInfo(formData)
            if (profileData?.user_id && profileData?.email) {
              effectiveUser = profileData
            }
          } catch (profileError) {
            console.warn('Profile lookup failed after login', profileError)
          }
        }

        const normalizedUser = {
          id: effectiveUser?.user_id ?? effectiveUser?.id ?? effectiveUser?.userId,
          email: effectiveUser?.email,
        }

        if (!normalizedUser.id || !normalizedUser.email) {
          throw new Error('Login succeeded but no user profile was returned. Please try again.')
        }

        if (typeof window !== 'undefined') {
          window.localStorage.setItem('auth_status', 'authenticated')
          window.localStorage.setItem('auth_user', JSON.stringify(normalizedUser))
        }
        onAuthSuccess?.(normalizedUser)
      } else {
        const data = await Auth.register(formData)
        setInfo('Account created successfully. You can log in now.')
        if (data?.user_id && data?.email && typeof window !== 'undefined') {
          window.localStorage.setItem(
            'auth_user',
            JSON.stringify({ id: data.user_id, email: data.email })
          )
        }
        setFormData((prev) => ({ ...prev, password: '' }))
        setMode('login')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F5] via-white to-[#F5F5F5] flex items-center justify-center p-4 dark:from-[#0F172A] dark:via-[#111827] dark:to-[#0F172A]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 dark:bg-slate-900 dark:shadow-[0_24px_60px_rgba(7,11,23,0.45)]">
          <h1 className="text-3xl font-bold text-[#2E3A59] mb-6 text-center dark:text-gray-100">
            {modes[mode]}
          </h1>
          <div className="flex gap-2 mb-6">
            <Button
              variant={mode === 'login' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => handleChangeMode('login')}
            >
              Log in
            </Button>
            <Button
              variant={mode === 'register' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => handleChangeMode('register')}
            >
              Sign up
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-600 mb-1 dark:text-gray-300"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-800 shadow-sm focus:border-[#A5D6A7] focus:outline-none focus:ring-2 focus:ring-[#A5D6A7]/60 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-600 mb-1 dark:text-gray-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={formData.password}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-800 shadow-sm focus:border-[#A5D6A7] focus:outline-none focus:ring-2 focus:ring-[#A5D6A7]/60 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                placeholder="********"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-100/60 rounded-xl px-4 py-2">
                {error}
              </p>
            )}

            {info && (
              <p className="text-sm text-emerald-600 bg-emerald-100/70 rounded-xl px-4 py-2">
                {info}
              </p>
            )}

            <Button type="submit" className="w-full py-3" disabled={isSubmitting}>
              {isSubmitting ? 'Please wait...' : modes[mode]}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
