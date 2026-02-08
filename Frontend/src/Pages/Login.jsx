import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SignIn, SignUp } from '@clerk/clerk-react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/i18n/useLanguage'

/* Clerk appearance — strips the default chrome and applies the Preppr design tokens */
const clerkAppearance = {
  layout: {
    socialButtonsPlacement: 'top',
    socialButtonsVariant: 'iconButton',
    showOptionalFields: false,
  },
  elements: {
    /* Root / Card — make invisible so it blends into our layout */
    rootBox: 'w-full',
    cardBox: 'w-full shadow-none',
    card: 'bg-transparent shadow-none border-none p-0 gap-6 w-full',

    /* Hide Clerk's own header (we have our own headline) */
    headerTitle: 'hidden',
    headerSubtitle: 'hidden',

    /* Social buttons — minimal icon-only circles */
    socialButtonsBlockButton:
      'border border-[var(--border)] bg-[var(--card)] rounded-full transition-all duration-200 hover:border-[var(--primary)] hover:bg-[var(--accent)]',
    socialButtonsBlockButtonText: 'text-[var(--foreground)] text-sm font-medium',
    socialButtonsProviderIcon: 'w-5 h-5',

    /* Divider ("or") */
    dividerLine: 'bg-[var(--border)]',
    dividerText: 'text-[var(--muted-foreground)] text-xs uppercase tracking-widest',

    /* Form fields */
    formFieldLabel: 'text-xs font-semibold uppercase tracking-wider text-[var(--primary)] mb-1',
    formFieldInput:
      'bg-transparent border-0 border-b-2 border-[var(--border)] rounded-none px-0 py-3 text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-0 focus:shadow-none transition-colors',
    formFieldHintText: 'text-xs text-[var(--muted-foreground)]',
    formFieldWarningText: 'text-xs text-amber-600',
    formFieldErrorText: 'text-xs text-red-500 mt-1',
    formFieldSuccessText: 'text-xs text-emerald-600',

    /* "Last used" badge */
    identityPreviewEditButton: 'text-[var(--primary)] text-xs font-medium',
    badge: 'text-[10px] font-medium text-[var(--muted-foreground)] bg-[var(--secondary)] border-0 rounded-full px-2 py-0.5',

    /* Primary action button */
    formButtonPrimary:
      'bg-[var(--primary)] text-white rounded-full font-semibold text-sm tracking-wide py-3 transition-all duration-200 hover:opacity-90 hover:shadow-[0_4px_12px_rgba(61,90,61,0.25)] focus:shadow-[0_0_0_3px_rgba(61,90,61,0.15)]',

    /* Footer / alternate action */
    footerAction: 'flex justify-center',
    footerActionText: 'text-sm text-[var(--muted-foreground)]',
    footerActionLink: 'text-sm font-semibold text-[var(--primary)] hover:text-[var(--primary)]/80',

    /* "Secured by Clerk" branding */
    footer: 'hidden',

    /* Error/alert boxes */
    alert: 'bg-red-50 border border-red-200 rounded-xl text-sm',
    alertText: 'text-red-700',

    /* OTP / verification inputs */
    otpCodeFieldInput: 'border-b-2 border-[var(--border)] rounded-none bg-transparent text-[var(--foreground)] focus:border-[var(--primary)]',
  },
  variables: {
    colorPrimary: '#3D5A3D',
    colorText: '#1A1A1A',
    colorTextSecondary: '#888888',
    colorBackground: 'transparent',
    colorInputBackground: 'transparent',
    colorInputText: '#1A1A1A',
    borderRadius: '0.75rem',
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontSize: '14px',
  },
}

export default function Login() {
  const { lang, setLang, t } = useLanguage()
  const [mode, setMode] = useState('login')

  /* Memoize so Clerk doesn't re-mount on every render */
  const appearance = useMemo(() => clerkAppearance, [])

  return (
    <div className="login-page">
      {/* Top bar: logo + language toggle */}
      <header className="login-header">
        <a href="/" className="login-logo" aria-label="Preppr Home">
          <img src="/logo.png" alt="" className="w-9 h-9" />
          <span className="login-logo-text">Preppr</span>
        </a>

        <button
          onClick={() => setLang(lang === 'en' ? 'no' : 'en')}
          className="nav-lang-toggle"
          type="button"
          aria-label={`Switch to ${lang === 'en' ? 'Norwegian' : 'English'}`}
        >
          {lang === 'en' ? 'NO' : 'EN'}
        </button>
      </header>

      {/* Centered content */}
      <main className="login-main">
        <Motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className="login-content"
        >
          {/* Headline */}
          <div className="login-headline-group">
            <h1 className="login-headline">
              {mode === 'login' ? t('Access your planner') : t('Create your account')}
            </h1>
            <p className="login-subtitle">
              {t('Secure access to your personalized weekly meal planning experience.')}
            </p>
          </div>

          {/* Thin decorative rule */}
          <div className="login-rule" />

          {/* Mode toggle */}
          <div className="login-toggle">
            <button
              onClick={() => setMode('login')}
              className={`login-toggle-btn ${mode === 'login' ? 'active' : ''}`}
              type="button"
            >
              {t('Sign in')}
            </button>
            <button
              onClick={() => setMode('register')}
              className={`login-toggle-btn ${mode === 'register' ? 'active' : ''}`}
              type="button"
            >
              {t('Create account')}
            </button>
          </div>

          {/* Clerk auth component */}
          <AnimatePresence mode="wait">
            <Motion.div
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="login-clerk-wrapper"
            >
              {mode === 'login' ? (
                <SignIn routing="hash" appearance={appearance} />
              ) : (
                <SignUp routing="hash" appearance={appearance} />
              )}
            </Motion.div>
          </AnimatePresence>
        </Motion.div>
      </main>

      {/* Minimal footer */}
      <footer className="login-footer">
        <div className="flex flex-col items-center gap-2">
          <span className="login-footer-text">
            {t('Your data is encrypted and used solely for nutritional analysis.')}
          </span>
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="footer-link">
              {t('View Privacy Policy')}
            </Link>
            <Link to="/data-deletion" className="footer-link">
              {t('Data Deletion')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
