import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { NavLink, Outlet } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { recipeImportsApi } from '@/Entities/recipeImports';
import { cn } from '@/lib/utils';
import { RecipeImportsContext } from './recipeImportsContext';

export default function RecipeImportsLayout() {
  const { getToken } = useAuth();
  const [readiness, setReadiness] = useState(null);
  const [error, setError] = useState(null);

  const refreshReadiness = async () => {
    setError(null);
    try {
      setReadiness(await recipeImportsApi.readiness(getToken));
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    refreshReadiness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs = [
    ['/admin/recipe-imports/creators', 'Creators'],
    ['/admin/recipe-imports/jobs', 'Jobs'],
    ['/admin/recipe-imports/candidates', 'Review queue'],
  ];

  return (
    <RecipeImportsContext.Provider value={{ getToken, readiness, refreshReadiness }}>
      <div className="mx-auto max-w-[1480px] space-y-6">
        <section className="overflow-hidden rounded-[1.4rem] border border-[#d9d3c6] bg-[#f4efe5] shadow-[0_14px_40px_rgba(53,48,39,0.06)]">
          <div className="grid gap-6 px-6 py-7 md:grid-cols-[1fr_auto] md:px-8">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[#8b5e3c]">
                Culinary intake · Instagram
              </p>
              <h1 className="font-serif text-3xl font-medium tracking-tight text-[#252b24] md:text-4xl">
                Recipe Imports
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68655e]">
                Bring approved creators into a controlled review pipeline. Nothing reaches
                the planner until an admin verifies every quantity, macro, and safety field.
              </p>
            </div>
            <div className="flex items-center">
              {readiness ? (
                <div
                  className={cn(
                    'flex min-w-56 items-center gap-3 rounded-xl border px-4 py-3 text-sm',
                    readiness.ready
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-amber-200 bg-[#fff9e9] text-amber-950',
                  )}
                >
                  {readiness.ready ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                  )}
                  <div>
                    <div className="font-semibold">
                      {readiness.ready ? 'Importer ready' : 'Setup required'}
                    </div>
                    <div className="text-xs opacity-75">
                      {readiness.enabled ? 'Feature enabled' : 'Feature flag is off'}
                    </div>
                  </div>
                </div>
              ) : (
                <RefreshCw className="h-5 w-5 animate-spin text-[#706d64]" />
              )}
            </div>
          </div>
          <nav className="flex gap-1 border-t border-[#d9d3c6] bg-white/60 px-4 pt-2 md:px-7">
            {tabs.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'border-b-2 px-4 py-3 text-sm font-semibold transition-colors',
                    isActive
                      ? 'border-[#3d5a3d] text-[#283b28]'
                      : 'border-transparent text-[#747067] hover:text-[#283b28]',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </section>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error.message}
          </div>
        )}
        {readiness && !readiness.ready && (
          <details className="rounded-xl border border-amber-200 bg-[#fffcf4] p-4 text-sm">
            <summary className="cursor-pointer font-semibold text-amber-950">
              View setup checks
            </summary>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(readiness.checks).map(([name, check]) => (
                <div key={name} className="rounded-lg border border-amber-100 bg-white p-3">
                  <div className="font-semibold capitalize">{name.replaceAll('_', ' ')}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{check.detail}</div>
                </div>
              ))}
            </div>
          </details>
        )}
        <Outlet />
      </div>
    </RecipeImportsContext.Provider>
  );
}
