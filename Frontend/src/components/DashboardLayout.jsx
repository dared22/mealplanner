import React, { useState, useEffect, memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { BookOpen, Calendar, Globe, Moon, MoreHorizontal, ShoppingCart, Sun, User } from 'lucide-react';
import { useLanguage } from '@/i18n/useLanguage';
import { LogoInline } from './Logo';

const navItems = [
  { to: '/planner', label: 'Planner', icon: Calendar },
  { to: '/recipes', label: 'Recipes', icon: BookOpen },
  { to: '/groceries', label: 'Groceries', icon: ShoppingCart },
];

const mobileNavItems = [
  { to: '/planner', label: 'Planner', icon: Calendar },
  { to: '/recipes', label: 'Recipes', icon: BookOpen },
  { to: '/more', label: 'More', icon: MoreHorizontal },
];

function MobileBottomNav({ t }) {
  const location = useLocation();

  return (
    <nav
      className="bottom-nav bg-card border-t border-border shadow-[0_-4px_12px_oklch(0_0_0/0.06)]"
      aria-label="Mobile navigation"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {mobileNavItems.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);

          return (
            <Link
              key={to}
              to={to}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-2 text-[10px] font-semibold ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {React.createElement(Icon, {
                className: 'h-5 w-5',
                fill: isActive ? 'currentColor' : 'none',
                strokeWidth: isActive ? 2.4 : 2,
                'aria-hidden': 'true',
              })}
              <span>{t(label)}</span>
              <span
                className={`h-1 w-1 rounded-full bg-primary ${
                  isActive ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export const AppShell = memo(function AppShell({ children, lang, setLang, isDarkMode, setIsDarkMode, t, activeRoute }) {
  const location = useLocation();
  const currentRoute = activeRoute || location.pathname;

  const isActiveRoute = (route) => currentRoute === route || currentRoute.startsWith(`${route}/`);

  return (
    <div className="min-h-screen bg-background">
      <header className="header dashboard-header">
        <div className="dashboard-nav-container">
          <div className="nav-section-left">
            <Link to="/planner" className="dashboard-logo" aria-label="Preppr Home">
              <LogoInline />
            </Link>
          </div>

          <nav className="nav-section-center" aria-label="Main navigation">
            {navItems.map(({ to, label, icon: Icon }) => {
              const isActive = isActiveRoute(to);

              return (
                <Link
                  key={to}
                  to={to}
                  className={`nav-link-item ${isActive ? 'active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {React.createElement(Icon, { className: 'nav-link-icon' })}
                  <span className="nav-link-text">{t(label)}</span>
                </Link>
              );
            })}
          </nav>

          <div className="nav-section-right">
            <SignedIn>
              <div className="nav-user-wrapper">
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: 'w-9 h-9',
                      userButtonBox: 'hover:opacity-80 transition-opacity'
                    }
                  }}
                />
              </div>
            </SignedIn>
            <SignedOut>
              <Link to="/login" className="nav-control-btn" aria-label={t('Log In')}>
                <User className="w-5 h-5" />
              </Link>
            </SignedOut>

            <div className="nav-separator" role="separator" />

            <button
              onClick={() => setLang(lang === 'en' ? 'no' : 'en')}
              className="nav-lang-toggle"
              type="button"
              aria-label={lang === 'en' ? t('Switch to Norwegian') : t('Switch to English')}
            >
              <Globe className="w-4 h-4" />
              {lang === 'en' ? 'NO' : 'EN'}
            </button>

            <button
              onClick={() => setIsDarkMode(p => !p)}
              className="nav-control-btn"
              type="button"
              aria-label={t('Toggle theme')}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>
      <main className="pt-32 pb-12 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
      <MobileBottomNav t={t} />
    </div>
  );
});

export default function DashboardLayout({ children }) {
  const { lang, setLang, t } = useLanguage();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDarkMode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }
  }, [isDarkMode]);

  return (
    <AppShell lang={lang} setLang={setLang} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} t={t}>
      {children}
    </AppShell>
  );
}
