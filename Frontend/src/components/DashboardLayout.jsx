import React, { useState, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { BookOpen, Calendar, Moon, ShoppingCart, Sun, User, Search } from 'lucide-react';
import { useLanguage } from '@/i18n/useLanguage';
import { LogoInline } from './Logo';

const DashboardHeader = memo(function DashboardHeader({ lang, setLang, isDarkMode, setIsDarkMode, t }) {
  return (
    <header className="header dashboard-header">
      <div className="dashboard-nav-container">
        {/* Left section: Logo and Search */}
        <div className="nav-section-left">
          <Link to="/planner" className="dashboard-logo" aria-label="Preppr Home">
            <LogoInline />
          </Link>

          {/* Search bar */}
          <div className="nav-search-wrapper">
            <div className="nav-search">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                className="nav-search-input"
                type="text"
                placeholder={t('Search for meals or nutrients...')}
                aria-label={t('Search for meals or nutrients')}
              />
            </div>
          </div>
        </div>

        {/* Center section: Main navigation */}
        <nav className="nav-section-center" aria-label="Main navigation">
          <Link to="/planner" className="nav-link-item">
            <Calendar className="nav-link-icon" />
            <span className="nav-link-text">{t('Planner')}</span>
          </Link>
          <Link to="/recipes" className="nav-link-item">
            <BookOpen className="nav-link-icon" />
            <span className="nav-link-text">{t('Recipes')}</span>
          </Link>
          <Link to="/groceries" className="nav-link-item">
            <ShoppingCart className="nav-link-icon" />
            <span className="nav-link-text">{t('Groceries')}</span>
          </Link>
        </nav>

        {/* Right section: User controls */}
        <div className="nav-section-right">
          {/* User Profile */}
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

          {/* Divider */}
          <div className="nav-separator" role="separator" />

          {/* Language Toggle */}
          <button
            onClick={() => setLang(lang === 'en' ? 'no' : 'en')}
            className="nav-lang-toggle"
            type="button"
            aria-label={`Switch to ${lang === 'en' ? 'Norwegian' : 'English'}`}
          >
            {lang === 'en' ? 'NO' : 'EN'}
          </button>

          {/* Theme Toggle */}
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
