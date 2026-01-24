import React, { useState } from 'react'
import { SignIn, SignUp } from '@clerk/clerk-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/i18n/LanguageContext'

export default function Login() {
  const { lang, setLang, t } = useLanguage()
  const [mode, setMode] = useState('login')

  const handleChangeMode = (nextMode) => {
    setMode(nextMode)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F5] via-white to-[#F5F5F5] flex items-center justify-center p-4 dark:from-[#0F172A] dark:via-[#111827] dark:to-[#0F172A] relative">
      <div className="absolute right-4 top-4">
        <Button
          variant="outline"
          onClick={() => setLang(lang === 'en' ? 'no' : 'en')}
          className="rounded-full bg-white/70 text-gray-600 shadow-sm hover:bg-white dark:bg-slate-800/70 dark:text-gray-200 dark:hover:bg-slate-700"
        >
          {lang === 'en' ? 'NO' : 'EN'}
          <span className="sr-only">{t('Language')}</span>
        </Button>
      </div>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 dark:bg-slate-900 dark:shadow-[0_24px_60px_rgba(7,11,23,0.45)]">
          <h1 className="text-3xl font-semibold text-[#0f172a] mb-2 text-center dark:text-gray-100">
            {mode === 'login' ? t('Access your planner') : t('Create your account')}
          </h1>
          <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
            {t('Secure access to your personalized weekly meal planning experience.')}
          </p>
          <div className="flex gap-2 mb-6">
            <Button
              variant={mode === 'login' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => handleChangeMode('login')}
            >
              {t('Sign in')}
            </Button>
            <Button
              variant={mode === 'register' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => handleChangeMode('register')}
            >
              {t('Create account')}
            </Button>
          </div>

          <div className="space-y-4">
            {mode === 'login' ? (
              <SignIn routing="hash" />
            ) : (
              <SignUp routing="hash" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
