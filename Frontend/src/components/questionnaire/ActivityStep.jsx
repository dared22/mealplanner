import React, { memo, useCallback, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useLanguage } from '@/i18n/useLanguage';

const ActivityStep = memo(function ActivityStep({ data, onChange }) {
  const { t } = useLanguage();

  const activityLevels = useMemo(
    () => [
      {
        value: 'sedentary',
        title: t('Sedentary'),
        description: t('Minimal movement, desk-based work'),
        level: 1,
        icon: (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
          </svg>
        ),
      },
      {
        value: 'lightly_active',
        title: t('Lightly Active'),
        description: t('Light exercise 1-3 days/week'),
        level: 2,
        icon: (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        ),
      },
      {
        value: 'moderately_active',
        title: t('Moderately Active'),
        description: t('Moderate exercise 3-5 days/week'),
        level: 3,
        icon: (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        ),
      },
      {
        value: 'very_active',
        title: t('Very Active'),
        description: t('Intense exercise 6-7 days/week'),
        level: 4,
        icon: (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
          </svg>
        ),
      },
      {
        value: 'extremely_active',
        title: t('Extremely Active'),
        description: t('Intense daily training'),
        level: 5,
        icon: (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        ),
      },
    ],
    [t]
  );

  const handleSelect = useCallback(
    (value) => {
      onChange({ activity_level: value });
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
          {t("What's your")} <span className="accent">{t('activity level')}</span>?
        </h1>
        <p className="text-muted-foreground text-lg">
          {t('Helps us set your daily energy needs.')}
        </p>
      </div>

      {/* Activity Cards - Horizontal Row */}
      <div className="activity-grid">
        {activityLevels.map((level, index) => {
          const isSelected = data.activity_level === level.value;
          return (
            <Motion.button
              key={level.value}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * index }}
              onClick={() => handleSelect(level.value)}
              className={`activity-card ${isSelected ? 'selected' : ''}`}
            >
              {/* Check indicator */}
              {isSelected && (
                <div className="check-icon">
                  <Check className="w-4 h-4" />
                </div>
              )}

              {/* Icon */}
              <div className="card-icon">
                {level.icon}
              </div>

              {/* Content */}
              <h3 className="card-title">{level.title}</h3>
              {/* Activity level dots */}
              <div className="activity-dots">
                {[1, 2, 3, 4, 5].map((dot) => (
                  <div
                    key={dot}
                    className={`activity-dot ${
                      dot <= level.level
                        ? isSelected
                          ? 'bg-primary'
                          : 'bg-primary/60'
                        : 'bg-border'
                    }`}
                  />
                ))}
              </div>
              <p className="card-description">{level.description}</p>
            </Motion.button>
          );
        })}
      </div>
    </Motion.div>
  );
});

export default ActivityStep;
