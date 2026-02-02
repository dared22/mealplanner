import React, { memo, useCallback, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useLanguage } from '@/i18n/useLanguage';

const DietaryStep = memo(function DietaryStep({ data, onChange }) {
  const { t } = useLanguage();

  const dietaryOptions = useMemo(
    () => [
      { value: 'none', title: t('No Restrictions'), badge: 'ALL' },
      { value: 'vegetarian', title: t('Vegetarian'), badge: 'VEG' },
      { value: 'vegan', title: t('Vegan'), badge: 'VGN' },
      { value: 'gluten_free', title: t('Gluten-Free'), badge: 'GF' },
      { value: 'dairy_free', title: t('Dairy-Free'), badge: 'DF' },
      { value: 'nut_free', title: t('Nut-Free'), badge: 'NF' },
      { value: 'keto', title: t('Keto'), badge: 'KETO' },
      { value: 'paleo', title: t('Paleo'), badge: 'PALEO' },
    ],
    [t]
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
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

      {/* Dietary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {dietaryOptions.map((option, index) => {
          const isSelected = currentRestrictions.includes(option.value);

          return (
            <Motion.button
              key={option.value}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * index }}
              onClick={() => toggleRestriction(option.value)}
              className={`selectable-card flex flex-col items-center text-center py-6 px-4 ${
                isSelected ? 'selected' : ''
              }`}
            >
              {/* Check indicator */}
              {isSelected && (
                <div className="check-icon">
                  <Check className="w-4 h-4" />
                </div>
              )}

              {/* Badge */}
              <div
                className={`w-16 h-12 rounded-xl flex items-center justify-center mb-4 text-xs font-bold uppercase tracking-wide transition-colors ${
                  isSelected
                    ? 'bg-primary text-white'
                    : 'bg-secondary text-foreground'
                }`}
              >
                {option.badge}
              </div>

              {/* Title */}
              <h3 className="font-semibold text-sm text-foreground">{option.title}</h3>
            </Motion.button>
          );
        })}
      </div>

      {/* Selected summary */}
      {currentRestrictions.length > 0 && !currentRestrictions.includes('none') && (
        <Motion.p
          initial={{ opacity: 0, y: 10 }}
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
