import React, { useState, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { BookOpen, Calendar, Moon, ShoppingCart, Sun, User, Utensils } from 'lucide-react';
import { useLanguage } from '@/i18n/useLanguage';

const DashboardHeader = memo(function DashboardHeader({ lang, setLang, isDarkMode, setIsDarkMode, t }) {
  return (
    <header className="header dashboard-header">
      <div className="dashboard-nav-inner">
        <div className="nav-left">
          <Link to="/planner" className="dashboard-logo">
            <div className="dashboard-logo-icon">
              <Utensils className="w-4 h-4 text-white" />
            </div>
            <span className="dashboard-logo-text">Meal Intelligence</span>
          </Link>
        </div>

        <div className="nav-icons">
          <Link to="/planner" className="nav-icon-btn">
            <Calendar className="w-5 h-5" />
            <span className="nav-icon-label">{t('Planner')}</span>
          </Link>
          <Link to="/recipes" className="nav-icon-btn">
            <BookOpen className="w-5 h-5" />
            <span className="nav-icon-label">{t('Recipes')}</span>
          </Link>
          <Link to="/groceries" className="nav-icon-btn">
            <ShoppingCart className="w-5 h-5" />
            <span className="nav-icon-label">{t('Groceries')}</span>
          </Link>
          <SignedIn>
            <div className="nav-user">
              <UserButton appearance={{ elements: { userButtonAvatarBox: 'nav-avatar-box' } }} />
              <span className="nav-icon-label">{t('Profile')}</span>
            </div>
          </SignedIn>
          <SignedOut>
            <button className="nav-icon-btn" type="button">
              <User className="w-5 h-5" />
              <span className="nav-icon-label">{t('Log In')}</span>
            </button>
          </SignedOut>
          <div className="nav-divider" />
          <div className="nav-controls">
            <button onClick={() => setLang(lang === 'en' ? 'no' : 'en')} className="nav-lang-btn" type="button">
              {lang === 'en' ? 'NO' : 'EN'}
            </button>
            <button onClick={() => setIsDarkMode(p => !p)} className="nav-theme-btn" type="button" aria-label={t('Toggle theme')}>
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
});

export default function DashboardLayout({ children }) {
  const { lang, setLang } = useLanguage();
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

  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader lang={lang} setLang={setLang} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} t={t} />
      <main className="pt-32 pb-12 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
