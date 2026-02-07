import React, { memo, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { useLanguage } from '@/i18n/useLanguage';

const PreferencesStep = memo(function PreferencesStep({ data, onChange }) {
  const { t } = useLanguage();

  const cookingTimeOptions = useMemo(
    () => [
      { value: 'under_20_min', label: t('Under 20 minutes') },
      { value: '15_30_min', label: t('15-30 minutes') },
      { value: '30_60_min', label: t('30-60 minutes') },
      { value: 'over_60_min', label: t('Over 60 minutes') },
    ],
    [t]
  );

  const mealsPerDayOptions = useMemo(
    () => [
      { value: '3', label: t('3 meals (breakfast, lunch, dinner)') },
      { value: '4', label: t('4 meals (+ 1 snack)') },
      { value: '5', label: t('5 meals (+ 2 snacks)') },
      { value: '6', label: t('6 smaller meals') },
    ],
    [t]
  );

  const budgetOptions = useMemo(
    () => [
      { value: 'budget friendly', label: t('Budget-friendly') },
      { value: 'moderate', label: t('Moderate') },
      { value: 'premium', label: t('Premium') },
      { value: 'no_limit', label: t('No limit') },
    ],
    [t]
  );

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="space-y-10"
    >
      {/* Headline */}
      <div>
        <h1 className="headline-serif mb-3">
          {t('Set your')} <span className="accent">{t('preferences')}</span>
        </h1>
        <p className="text-muted-foreground text-lg">
          {t('Time, meal frequency, and budget.')}
        </p>
      </div>

      {/* Form with underline inputs */}
      <div className="grid md:grid-cols-3 gap-x-12 gap-y-8">
        {/* Cooking Time */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <label className="input-label">{t('Cooking Time')}</label>
          <select
            value={data.cooking_time_preference || ''}
            onChange={(e) => onChange({ cooking_time_preference: e.target.value })}
            className="select-underline"
          >
            <option value="">{t('Select time')}</option>
            {cookingTimeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Motion.div>

        {/* Meals Per Day */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <label className="input-label">{t('Meals Per Day')}</label>
          <select
            value={data.meals_per_day?.toString() || ''}
            onChange={(e) => onChange({ meals_per_day: parseInt(e.target.value, 10) })}
            className="select-underline"
          >
            <option value="">{t('Select meals')}</option>
            {mealsPerDayOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Motion.div>

        {/* Budget */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <label className="input-label">{t('Budget')}</label>
          <select
            value={data.budget_range || ''}
            onChange={(e) => onChange({ budget_range: e.target.value })}
            className="select-underline"
          >
            <option value="">{t('Select budget')}</option>
            {budgetOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Motion.div>
      </div>

      {/* Summary chips */}
      {(data.cooking_time_preference || data.meals_per_day || data.budget_range) && (
        <Motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap justify-center gap-3"
        >
          {data.cooking_time_preference && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-sm font-medium text-accent-foreground">
              {cookingTimeOptions.find((o) => o.value === data.cooking_time_preference)?.label}
            </span>
          )}
          {data.meals_per_day && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-sm font-medium text-accent-foreground">
              {data.meals_per_day} {t('meals/day')}
            </span>
          )}
          {data.budget_range && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-sm font-medium text-accent-foreground">
              {budgetOptions.find((o) => o.value === data.budget_range)?.label}
            </span>
          )}
        </Motion.div>
      )}
    </Motion.div>
  );
});

export default PreferencesStep;
