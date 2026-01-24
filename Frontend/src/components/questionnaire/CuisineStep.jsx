import React, { memo, useCallback, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

const CuisineStep = memo(function CuisineStep({ data, onChange }) {
  const { t } = useLanguage();

  const cuisines = useMemo(
    () => [
      { value: 'mediterranean', title: t('Mediterranean'), flag: '🇬🇷' },
      { value: 'asian', title: t('Asian'), flag: '🥢' },
      { value: 'mexican', title: t('Mexican'), flag: '🇲🇽' },
      { value: 'italian', title: t('Italian'), flag: '🇮🇹' },
      { value: 'indian', title: t('Indian'), flag: '🇮🇳' },
      { value: 'american', title: t('American'), flag: '🇺🇸' },
      { value: 'french', title: t('French'), flag: '🇫🇷' },
      { value: 'thai', title: t('Thai'), flag: '🇹🇭' },
      { value: 'japanese', title: t('Japanese'), flag: '🇯🇵' },
      { value: 'middle_eastern', title: t('Middle Eastern'), flag: '🧆' },
    ],
    [t]
  );

  const currentCuisines = data.preferred_cuisines || [];

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
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

      {/* Cuisine Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {cuisines.map((cuisine, index) => {
          const isSelected = currentCuisines.includes(cuisine.value);

          return (
            <Motion.button
              key={cuisine.value}
              type="button"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.03 * index }}
              onClick={() => toggleCuisine(cuisine.value)}
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

              {/* Flag/Emoji */}
              <div className="text-4xl mb-4">{cuisine.flag}</div>

              {/* Title */}
              <h3 className="font-semibold text-sm text-foreground">{cuisine.title}</h3>
            </Motion.button>
          );
        })}
      </div>

      {/* Selected count */}
      {currentCuisines.length > 0 && (
        <Motion.p
          initial={{ opacity: 0, y: 10 }}
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
