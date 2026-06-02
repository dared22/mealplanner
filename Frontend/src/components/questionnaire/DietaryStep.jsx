import React, { memo, useCallback, useMemo } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { useLanguage } from '@/i18n/useLanguage';

const DietaryStep = memo(function DietaryStep({ data, onChange }) {
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();

  const dietaryOptions = useMemo(
    () => [
      { value: 'none', title: t('No Restrictions') },
      { value: 'gluten_free', title: t('Gluten-free'), hint: t('must avoid') },
      { value: 'dairy_free', title: t('Dairy-free'), hint: t('must avoid') },
      { value: 'nut_free', title: t('Nut-free'), hint: t('must avoid') },
      { value: 'vegetarian', title: t('Vegetarian') },
      { value: 'vegan', title: t('Vegan') },
      { value: 'keto', title: t('Keto') },
      { value: 'paleo', title: t('Paleo') },
    ],
    [t]
  );

  const restrictionGroups = useMemo(
    () => [
      {
        label: t('Allergens'),
        values: ['gluten_free', 'dairy_free', 'nut_free'],
      },
      {
        label: t('Diet style'),
        values: ['vegetarian', 'vegan', 'keto', 'paleo'],
      },
    ],
    [t]
  );

  const optionByValue = useMemo(
    () => new Map(dietaryOptions.map((option) => [option.value, option])),
    [dietaryOptions]
  );

  const currentRestrictions = useMemo(
    () => data.dietary_restrictions || [],
    [data.dietary_restrictions]
  );

  const toggleRestriction = useCallback(
    (value) => {
      if (value === 'none') {
        onChange({ dietary_restrictions: ['none'] });
      } else {
        let newRestrictions;
        if (currentRestrictions.includes('none')) {
          newRestrictions = [value];
        } else if (currentRestrictions.includes(value)) {
          newRestrictions = currentRestrictions.filter((r) => r !== value);
          if (newRestrictions.length === 0) {
            newRestrictions = ['none'];
          }
        } else {
          newRestrictions = [...currentRestrictions, value];
        }
        onChange({ dietary_restrictions: newRestrictions });
      }
    },
    [currentRestrictions, onChange]
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
          {t('Any')} <span className="accent">{t('dietary needs')}</span>?
        </h1>
        <p className="text-muted-foreground text-lg">
          {t("Select all that apply. We'll make sure your meals fit.")}
        </p>
      </div>

      {/* Segmented restrictions list */}
      <div className="dietary-list">
        <button
          type="button"
          onClick={() => toggleRestriction('none')}
          aria-pressed={currentRestrictions.includes('none')}
          className={`dietary-row dietary-row-pinned ${
            currentRestrictions.includes('none') ? 'active' : ''
          }`}
        >
          <span className="dietary-dot" aria-hidden="true" />
          <span className="dietary-label">{optionByValue.get('none')?.title}</span>
        </button>

        {restrictionGroups.map((group) => (
          <div key={group.label} className="dietary-group">
            <div className="choice-group-heading">
              <span>{group.label}</span>
            </div>
            <div className="divide-y divide-border">
              {group.values.map((value) => {
                const option = optionByValue.get(value);
                const isSelected = currentRestrictions.includes(value);
                const isDisabled = currentRestrictions.includes('none');

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleRestriction(value)}
                    aria-pressed={isSelected}
                    className={`dietary-row ${isSelected ? 'active' : ''} ${
                      isDisabled ? 'muted' : ''
                    }`}
                  >
                    <span className="dietary-dot" aria-hidden="true" />
                    <span className="dietary-label">{option?.title}</span>
                    {option?.hint && <span className="dietary-hint">{option.hint}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selected summary */}
      {currentRestrictions.length > 0 && !currentRestrictions.includes('none') && (
        <Motion.p
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-sm text-primary font-medium"
        >
          {currentRestrictions.length} {t('restriction(s) selected')}
        </Motion.p>
      )}
    </Motion.div>
  );
});

export default DietaryStep;
