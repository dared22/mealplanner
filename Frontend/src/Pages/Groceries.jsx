import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Clipboard,
  Loader2,
  ShoppingBasket,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import DashboardLayout from '@/components/DashboardLayout';
import { buildShoppingList, formatAmounts } from '@/components/groceries/shoppingListUtils';
import { Button } from '@/components/ui/button';
import { Plans } from '@/Entities/Plans';
import { UserPreferences } from '@/Entities/UserPreferences';
import { useLanguage } from '@/i18n/useLanguage';

const TRANSLATION_POLL_INTERVAL = 4000;
const MAX_TRANSLATION_ATTEMPTS = 5;

const getItemKey = (item) => item.name.toLowerCase();

const loadCheckedItems = (storageKey) => {
  if (!storageKey || typeof window === 'undefined') return [];

  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey));
    if (!Array.isArray(stored)) return [];
    return [...new Set(
      stored
        .filter((name) => typeof name === 'string')
        .map((name) => name.toLowerCase())
    )];
  } catch {
    return [];
  }
};

const readGroceriesCache = (userId) => {
  if (!userId || typeof window === 'undefined') return null;

  try {
    const cached = JSON.parse(window.localStorage.getItem(`groceries_cache_${userId}`));
    if (!cached || !Array.isArray(cached.items) || !cached.preferenceId) return null;
    return cached;
  } catch {
    return null;
  }
};

const writeGroceriesCache = (userId, value) => {
  if (!userId || typeof window === 'undefined') return;

  try {
    const cacheKey = `groceries_cache_${userId}`;
    if (value === null) {
      window.localStorage.removeItem(cacheKey);
    } else {
      window.localStorage.setItem(cacheKey, JSON.stringify(value));
    }
  } catch {
    // Ignore storage errors; the freshly fetched list still works for the current session.
  }
};

function StatusCard({ icon: Icon, title, message, action }) {
  return (
    <div className="mx-auto flex min-h-[52vh] max-w-xl items-center justify-center">
      <div className="w-full rounded-3xl border border-border/60 bg-card px-6 py-12 text-center shadow-sm md:px-12">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          {React.createElement(Icon, {
            className: 'h-7 w-7 text-primary',
            'aria-hidden': 'true',
          })}
        </div>
        <h1 className="headline-serif text-3xl text-foreground">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground md:text-base">
          {message}
        </p>
        {action ? <div className="mt-7">{action}</div> : null}
      </div>
    </div>
  );
}

function GroceryRow({ item, checked, expanded, onCheck, onExpand, t }) {
  const itemKey = getItemKey(item);
  const amount = formatAmounts(item);

  return (
    <li className="border-b border-border/60 last:border-b-0">
      <div className="flex min-h-20 items-center gap-3 px-4 py-3 sm:px-6">
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-4">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onCheck(itemKey)}
            className="peer sr-only"
          />
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-primary/35 bg-background transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-checked:border-primary peer-checked:bg-primary">
            <Check className="h-4 w-4 text-primary-foreground opacity-0 peer-checked:opacity-100" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-foreground">{item.name}</span>
            {amount ? (
              <span className="mt-0.5 block text-sm text-muted-foreground">{amount}</span>
            ) : null}
          </span>
        </label>

        <button
          type="button"
          onClick={() => onExpand(itemKey)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-expanded={expanded}
          aria-label={expanded ? t('Hide item sources') : t('Show item sources')}
        >
          <ChevronDown
            className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-border/40 bg-secondary/45 px-6 py-4 sm:pl-16">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t('Used in')}
          </p>
          <ul className="space-y-1.5">
            {item.sources.map((source) => (
              <li
                key={`${source.day}-${source.mealType}`}
                className="text-sm leading-5 text-muted-foreground"
              >
                {t(source.day)} {t(source.mealType)} — {source.mealName}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

export default function Groceries({ user }) {
  const userId = user?.id ?? null;
  const { getToken } = useAuth();
  const { lang, t } = useLanguage();
  const [viewState, setViewState] = useState('loading');
  const [items, setItems] = useState([]);
  const [preferenceId, setPreferenceId] = useState(null);
  const [submittedAt, setSubmittedAt] = useState(null);
  const [checkedNames, setCheckedNames] = useState([]);
  const [expandedNames, setExpandedNames] = useState([]);
  const [copied, setCopied] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const copyTimerRef = useRef(null);

  const storageKey = userId && preferenceId
    ? `groceries_checked_${userId}_${preferenceId}`
    : null;

  useEffect(() => {
    let cancelled = false;
    let pollTimer = null;
    const cached = readGroceriesCache(userId);
    const hasHydratedCache = cached?.lang === lang;

    if (hasHydratedCache) {
      const cachedStorageKey = `groceries_checked_${userId}_${cached.preferenceId}`;
      setItems(cached.items);
      setPreferenceId(cached.preferenceId);
      setSubmittedAt(cached.submittedAt ?? null);
      setCheckedNames(loadCheckedItems(cachedStorageKey));
      setViewState('ready');
    }

    const waitForPoll = () => new Promise((resolve) => {
      pollTimer = window.setTimeout(resolve, TRANSLATION_POLL_INTERVAL);
    });

    const loadShoppingList = async () => {
      if (!hasHydratedCache) setViewState('loading');
      setExpandedNames([]);

      try {
        let token = null;
        try {
          token = await getToken();
        } catch {
          token = null;
        }

        const history = await Plans.history(token);
        if (cancelled) return;

        const historyItems = Array.isArray(history?.items) ? history.items : [];
        const successfulPlan = historyItems.find((entry) => entry?.plan_status === 'success');

        if (!successfulPlan) {
          writeGroceriesCache(userId, null);
          setItems([]);
          setPreferenceId(null);
          setSubmittedAt(null);
          setCheckedNames([]);
          setViewState(historyItems[0]?.plan_status === 'pending' ? 'generating' : 'empty');
          return;
        }

        if (!successfulPlan.preference_id) {
          writeGroceriesCache(userId, null);
          setItems([]);
          setPreferenceId(null);
          setSubmittedAt(null);
          setCheckedNames([]);
          setViewState('empty');
          return;
        }

        let response = await UserPreferences.fetch(successfulPlan.preference_id, lang, token);
        let pollAttempts = 0;

        while (
          !cancelled
          && lang !== 'en'
          && response?.translation_status === 'pending'
          && pollAttempts < MAX_TRANSLATION_ATTEMPTS
        ) {
          await waitForPoll();
          if (cancelled) return;
          response = await UserPreferences.fetch(successfulPlan.preference_id, lang, token);
          pollAttempts += 1;
        }

        if (cancelled) return;

        const nextItems = buildShoppingList(response?.plan);
        const nextStorageKey = userId && successfulPlan.preference_id
          ? `groceries_checked_${userId}_${successfulPlan.preference_id}`
          : null;

        setItems(nextItems);
        setPreferenceId(successfulPlan.preference_id);
        setSubmittedAt(successfulPlan.submitted_at ?? null);
        setCheckedNames(loadCheckedItems(nextStorageKey));
        setViewState(nextItems.length ? 'ready' : 'empty');
        if (nextItems.length) {
          writeGroceriesCache(userId, {
            preferenceId: successfulPlan.preference_id,
            submittedAt: successfulPlan.submitted_at ?? null,
            lang,
            items: nextItems,
          });
        } else {
          writeGroceriesCache(userId, null);
        }
      } catch {
        if (!cancelled && !hasHydratedCache) setViewState('error');
      }
    };

    loadShoppingList();

    return () => {
      cancelled = true;
      if (pollTimer !== null) window.clearTimeout(pollTimer);
    };
  }, [getToken, lang, retryCount, userId]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(checkedNames));
    } catch {
      // Ignore storage errors; the list still works for the current session.
    }
  }, [checkedNames, storageKey]);

  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
  }, []);

  const checkedSet = useMemo(() => new Set(checkedNames), [checkedNames]);
  const expandedSet = useMemo(() => new Set(expandedNames), [expandedNames]);
  const uncheckedItems = useMemo(
    () => items.filter((item) => !checkedSet.has(getItemKey(item))),
    [checkedSet, items]
  );
  const checkedItems = useMemo(
    () => items.filter((item) => checkedSet.has(getItemKey(item))),
    [checkedSet, items]
  );

  const toggleChecked = (itemKey) => {
    setCheckedNames((current) => (
      current.includes(itemKey)
        ? current.filter((name) => name !== itemKey)
        : [...current, itemKey]
    ));
    setExpandedNames((current) => current.filter((name) => name !== itemKey));
  };

  const toggleExpanded = (itemKey) => {
    setExpandedNames((current) => (
      current.includes(itemKey)
        ? current.filter((name) => name !== itemKey)
        : [...current, itemKey]
    ));
  };

  const copyUncheckedItems = async () => {
    const listText = uncheckedItems
      .map((item) => `${formatAmounts(item)} ${item.name}`.trim())
      .join('\n');

    try {
      await navigator.clipboard.writeText(listText);
      setCopied(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by browser permissions.
    }
  };

  const planDate = submittedAt
    ? new Date(submittedAt).toLocaleDateString(lang === 'no' ? 'nb-NO' : 'en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  if (viewState === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm font-medium">{t('Loading shopping list...')}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (viewState === 'error') {
    return (
      <DashboardLayout>
        <StatusCard
          icon={AlertCircle}
          title={t('Unable to load shopping list')}
          message={t('We could not load your latest meal plan. Please try again.')}
          action={<Button onClick={() => setRetryCount((count) => count + 1)}>{t('Try again')}</Button>}
        />
      </DashboardLayout>
    );
  }

  if (viewState === 'generating') {
    return (
      <DashboardLayout>
        <StatusCard
          icon={Loader2}
          title={t('Your plan is still being prepared')}
          message={t('Your shopping list will be ready as soon as your meal plan is complete.')}
          action={<Button asChild><Link to="/planner">{t('View meal planner')}</Link></Button>}
        />
      </DashboardLayout>
    );
  }

  if (viewState === 'empty') {
    return (
      <DashboardLayout>
        <StatusCard
          icon={ShoppingBasket}
          title={t('Your shopping list is waiting')}
          message={t('Create a meal plan and we will gather every ingredient here for you.')}
          action={<Button asChild><Link to="/planner">{t('Create a meal plan')}</Link></Button>}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <section className="mx-auto max-w-4xl pb-16">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {t('Weekly essentials')}
            </p>
            <h1 className="headline-serif text-4xl text-foreground md:text-5xl">
              {t('Shopping list')}
            </h1>
            {planDate ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t('Plan from {date}', { date: planDate })}
              </p>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={copyUncheckedItems}
            disabled={!uncheckedItems.length}
            className="h-11 self-start rounded-full px-5 sm:self-auto"
          >
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Clipboard className="mr-2 h-4 w-4" />}
            {copied ? t('Copied!') : t('Copy list')}
          </Button>
        </header>

        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 bg-secondary/35 px-4 py-3 sm:px-6">
            <p className="text-sm font-semibold text-foreground">
              {t('{count} items left', { count: uncheckedItems.length })}
            </p>
            <p className="text-xs text-muted-foreground">{t('Tap an item when it is in your cart')}</p>
          </div>

          {uncheckedItems.length ? (
            <ul>
              {uncheckedItems.map((item) => {
                const itemKey = getItemKey(item);
                return (
                  <GroceryRow
                    key={itemKey}
                    item={item}
                    checked={false}
                    expanded={expandedSet.has(itemKey)}
                    onCheck={toggleChecked}
                    onExpand={toggleExpanded}
                    t={t}
                  />
                );
              })}
            </ul>
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <p className="font-semibold text-foreground">{t('Everything is in the cart')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('You are ready to shop.')}</p>
            </div>
          )}

          {checkedItems.length ? (
            <div className="border-t border-border">
              <div className="px-4 pb-2 pt-5 sm:px-6">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {t('In cart ({count})', { count: checkedItems.length })}
                </h2>
              </div>
              <ul className="px-2 pb-3 sm:px-4">
                {checkedItems.map((item) => {
                  const itemKey = getItemKey(item);
                  const amount = formatAmounts(item);
                  return (
                    <li key={itemKey}>
                      <button
                        type="button"
                        onClick={() => toggleChecked(itemKey)}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-muted-foreground transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-3"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/70">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1 line-through decoration-1">
                          {item.name}
                          {amount ? ` · ${amount}` : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </DashboardLayout>
  );
}
