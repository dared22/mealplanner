import React, { memo, useCallback, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

const GoalsStep = memo(function GoalsStep({ data, onChange }) {
  const { t } = useLanguage();

  const goals = useMemo(
    () => [
      {
        value: 'lose_weight',
        title: t('Lose Weight'),
        description: t('Calorie deficit with high-volume, nutrient-dense meals'),
        icon: (
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
          </svg>
        ),
      },
      {
        value: 'build_muscle',
        title: t('Build Muscle'),
        description: t('Protein-optimized meals for recovery and growth'),
        icon: (
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        ),
      },
      {
        value: 'maintain_weight',
        title: t('Maintain Weight'),
        description: t('Balanced macros for sustained energy'),
        icon: (
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
          </svg>
        ),
      },
      {
        value: 'improve_health',
        title: t('Improve Health'),
        description: t('Micronutrient-dense foods for vitality'),
        icon: (
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        ),
      },
    ],
    [t]
  );

  const handleSelect = useCallback(
    (value) => {
      onChange({ nutrition_goal: value });
    },
    [onChange]
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
          {t('What is your')} <span className="accent">{t('primary goal')}</span>?
        </h1>
        <p className="text-muted-foreground text-lg">
          {t("Select your health objective and we'll tailor your meal plans.")}
        </p>
      </div>

      {/* Goal Cards - 4 in a row */}
      <div className="goal-grid">
        {goals.map((goal, index) => {
          const isSelected = data.nutrition_goal === goal.value;

          return (
            <Motion.button
              key={goal.value}
              type="button"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * index }}
              onClick={() => handleSelect(goal.value)}
              className={`goal-card ${isSelected ? 'selected' : ''}`}
            >
              {/* Check indicator */}
              {isSelected && (
                <div className="check-icon">
                  <Check className="w-4 h-4" />
                </div>
              )}

              {/* Icon */}
              <div className="card-icon">
                {goal.icon}
              </div>

              {/* Content */}
              <h3 className="card-title">{goal.title}</h3>
              <p className="card-description">{goal.description}</p>
            </Motion.button>
          );
        })}
      </div>

      {/* Helper text */}
      <p className="text-center text-sm text-muted-foreground">
        {t('You can change this later in your settings')}
      </p>
    </Motion.div>
  );
});

export default GoalsStep;
