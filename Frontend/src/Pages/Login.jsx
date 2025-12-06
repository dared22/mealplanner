import React, { useState } from 'react'
import { Auth } from '@/Entities/Auth'
import { Button } from '@/components/ui/button'

const modes = {
  login: 'Sign in',
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
        const loginPayload = await Auth.login(formData)

        const [sessionResult, profileResult] = await Promise.allSettled([
          Auth.session(),
          Auth.profileInfo(formData),
        ])

        const sessionData =
          sessionResult.status === 'fulfilled' ? sessionResult.value : null
        const profileData =
          profileResult.status === 'fulfilled' ? profileResult.value : null

        console.debug('Auth debug payloads', {
          loginPayload,
          sessionData,
          profileData,
        })

        const effectiveUser = sessionData || profileData || loginPayload

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
          <h1 className="text-3xl font-semibold text-[#0f172a] mb-2 text-center dark:text-gray-100">
            {mode === 'login' ? 'Access your planner' : 'Create your account'}
          </h1>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
            Secure access to your personalized weekly meal planning experience.
          </p>
          <div className="flex gap-2 mb-6">
            <Button
              variant={mode === 'login' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => handleChangeMode('login')}
            >
              Sign in
            </Button>
            <Button
              variant={mode === 'register' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => handleChangeMode('register')}
            >
              Create account
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
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
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-800 shadow-sm focus:border-[#A5D6A7] focus:outline-none focus:ring-2 focus:ring-[#A5D6A7]/50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300"
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
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-800 shadow-sm focus:border-[#A5D6A7] focus:outline-none focus:ring-2 focus:ring-[#A5D6A7]/50 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-100"
                placeholder="********"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">
                {error}
              </p>
            )}

            {info && (
              <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2">
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
