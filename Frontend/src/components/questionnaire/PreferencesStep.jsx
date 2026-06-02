import React, { memo, useMemo } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '@/i18n/useLanguage';

const PreferencesStep = memo(function PreferencesStep({ data, onChange }) {
  const { t } = useLanguage();
  const shouldReduceMotion = useReducedMotion();
  const carryForwardEnabled = Boolean(data.carry_forward_enabled);

  const containerMotion = shouldReduceMotion
    ? {
        initial: false,
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.01 },
      }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
        transition: { duration: 0.4 },
      };

  const itemMotion = (delay = 0) => (
    shouldReduceMotion
      ? {
          initial: false,
          animate: { opacity: 1 },
          transition: { duration: 0.01 },
        }
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { delay },
        }
  );

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
    <Motion.div {...containerMotion} className="space-y-8">
      <Motion.label
        {...itemMotion(0.05)}
        className={`leftover-hero-card ${carryForwardEnabled ? 'active' : ''}`}
      >
        <span className="leftover-hero-icon" aria-hidden="true">
          <RefreshCw className="w-5 h-5" />
        </span>
        <span className="leftover-hero-copy">
          <span id="carry-forward-title" className="leftover-hero-title">
            {t('Carry-forward leftovers')}
          </span>
          <span id="carry-forward-description" className="leftover-hero-description">
            {t('Reuse dinner leftovers the next day. Cuts cooking time roughly in half on busy nights.')}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={carryForwardEnabled}
          aria-checked={carryForwardEnabled}
          aria-labelledby="carry-forward-title"
          aria-describedby="carry-forward-description"
          onChange={(e) => onChange({ carry_forward_enabled: e.target.checked })}
          className="leftover-switch-input sr-only"
        />
        <span className="leftover-switch" aria-hidden="true">
          <span className="leftover-switch-thumb" />
        </span>
      </Motion.label>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <Motion.div {...itemMotion(0.1)}>
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

        <Motion.div {...itemMotion(0.15)}>
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

        <Motion.div {...itemMotion(0.2)}>
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
    </Motion.div>
  );
});

export default PreferencesStep;
