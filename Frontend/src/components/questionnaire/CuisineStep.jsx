import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { useLanguage } from '@/i18n/useLanguage';

const CuisineStep = memo(function CuisineStep({ data, onChange }) {
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const searchRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');

  const cuisines = useMemo(
    () => [
      { value: 'mediterranean', title: t('Mediterranean'), group: t('European') },
      { value: 'italian', title: t('Italian'), group: t('European') },
      { value: 'french', title: t('French'), group: t('European') },
      { value: 'norwegian', title: t('Norwegian'), group: t('European') },
      { value: 'asian', title: t('Asian'), group: t('Asian') },
      { value: 'thai', title: t('Thai'), group: t('Asian') },
      { value: 'japanese', title: t('Japanese'), group: t('Asian') },
      { value: 'indian', title: t('Indian'), group: t('Asian') },
      { value: 'american', title: t('American'), group: t('Americas') },
      { value: 'mexican', title: t('Mexican'), group: t('Americas') },
      { value: 'middle_eastern', title: t('Middle Eastern'), group: t('Middle Eastern') },
    ],
    [t]
  );

  const currentCuisines = useMemo(() => data.preferred_cuisines || [], [data.preferred_cuisines]);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const groupedCuisines = useMemo(() => {
    const visibleCuisines = normalizedQuery
      ? cuisines.filter((cuisine) => cuisine.title.toLowerCase().includes(normalizedQuery))
      : cuisines;

    return visibleCuisines.reduce((groups, cuisine) => {
      const group = groups.find((item) => item.label === cuisine.group);
      if (group) {
        group.items.push(cuisine);
      } else {
        groups.push({ label: cuisine.group, items: [cuisine] });
      }
      return groups;
    }, []);
  }, [cuisines, normalizedQuery]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const canAutofocus = window.matchMedia('(min-width: 768px)').matches;
    if (canAutofocus) {
      searchRef.current?.focus();
    }
  }, []);

  const toggleCuisine = useCallback(
    (value) => {
      const newCuisines = currentCuisines.includes(value)
        ? currentCuisines.filter((c) => c !== value)
        : [...currentCuisines, value];
      onChange({ preferred_cuisines: newCuisines });
    },
    [currentCuisines, onChange]
  );

  return (
    <Motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="space-y-10"
    >
      {/* Headline */}
      <div>
        <h1 className="headline-serif mb-3">
          {t('Which')} <span className="accent">{t('cuisines')}</span> {t('do you enjoy')}?
        </h1>
        <p className="text-muted-foreground text-lg">
          {t('Select your favorites. You can choose multiple.')}
        </p>
      </div>

      {/* Searchable grouped chip cloud */}
      <div className="space-y-6">
        <input
          ref={searchRef}
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t('Search by cuisine')}
          aria-label={t('Search cuisines')}
          className="cuisine-search"
        />

        <div className="space-y-6">
          {groupedCuisines.map((group) => (
            <div key={group.label} className="space-y-3">
              <div className="choice-group-heading">
                <span>{group.label}</span>
              </div>
              <div className="cuisine-chip-cloud">
                {group.items.map((cuisine, index) => {
                  const isSelected = currentCuisines.includes(cuisine.value);

                  return (
                    <Motion.button
                      key={cuisine.value}
                      type="button"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.02 * index }}
                      onClick={() => toggleCuisine(cuisine.value)}
                      aria-pressed={isSelected}
                      className={`cuisine-chip ${isSelected ? 'active' : ''}`}
                    >
                      {cuisine.title}
                    </Motion.button>
                  );
                })}
              </div>
            </div>
          ))}

          {groupedCuisines.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('No cuisines match your search')}</p>
          )}
        </div>
      </div>

      {/* Selected count */}
      {currentCuisines.length > 0 && (
        <Motion.p
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-sm text-primary font-medium"
        >
          {currentCuisines.length} {t('cuisine(s) selected')}
        </Motion.p>
      )}
    </Motion.div>
  );
});

export default CuisineStep;
