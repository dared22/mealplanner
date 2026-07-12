import React, { memo, useCallback, useMemo, useState } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import { Dumbbell, HeartPulse, Scale, TrendingDown } from 'lucide-react';
import { useLanguage } from '@/i18n/useLanguage';

const GoalsStep = memo(function GoalsStep({ data, onChange }) {
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const [showMoreGoals, setShowMoreGoals] = useState(false);

  const goals = useMemo(
    () => [
      {
        value: 'lose_weight',
        title: t('Lose Weight'),
        hint: t('We will favor higher-protein meals and a small calorie deficit.'),
        icon: TrendingDown,
      },
      {
        value: 'maintain_weight',
        title: t('Maintain Weight'),
        hint: t('We will balance macros to match your current energy needs.'),
        icon: Scale,
      },
      {
        value: 'build_muscle',
        title: t('Build Muscle'),
        hint: t('We will lean toward higher protein and a slight calorie surplus.'),
        icon: Dumbbell,
      },
      {
        value: 'improve_health',
        title: t('Improve Health'),
        hint: t('We will prioritize nutrient-dense meals and steady variety.'),
        icon: HeartPulse,
      },
    ],
    [t]
  );

  const primaryGoals = useMemo(
    () => goals.filter((goal) => ['lose_weight', 'maintain_weight', 'build_muscle'].includes(goal.value)),
    [goals]
  );
  const extraGoals = useMemo(
    () => goals.filter((goal) => !['lose_weight', 'maintain_weight', 'build_muscle'].includes(goal.value)),
    [goals]
  );
  const activeGoal = useMemo(
    () => goals.find((goal) => goal.value === data.nutrition_goal),
    [data.nutrition_goal, goals]
  );

  const handleSelect = useCallback(
    (value) => {
      onChange({ nutrition_goal: value });
    },
    [onChange]
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
          {t('What is your')} <span className="accent">{t('primary goal')}</span>?
        </h1>
        <p className="text-muted-foreground text-lg">
          {t("Select your health objective and we'll tailor your meal plans.")}
        </p>
      </div>

      {/* Goal choice slabs */}
      <div className="space-y-4">
        <div className="goal-slab-list">
          {primaryGoals.map((goal) => {
            const isSelected = data.nutrition_goal === goal.value;
            const Icon = goal.icon;

            return (
              <Motion.button
                key={goal.value}
                type="button"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0 }}
                onClick={() => handleSelect(goal.value)}
                aria-pressed={isSelected}
                className={`goal-slab ${isSelected ? 'active' : ''}`}
              >
                <span className="goal-slab-title">{goal.title}</span>
                <Icon className="goal-slab-icon" aria-hidden="true" />
              </Motion.button>
            );
          })}
        </div>

        {extraGoals.length > 0 && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowMoreGoals((value) => !value)}
              className="goal-more-toggle"
            >
              {showMoreGoals ? t('Hide more goals') : t('More goals')}
            </button>

            {showMoreGoals && (
              <Motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="goal-chip-row"
              >
                {extraGoals.map((goal) => {
                  const isSelected = data.nutrition_goal === goal.value;

                  return (
                    <button
                      key={goal.value}
                      type="button"
                      onClick={() => handleSelect(goal.value)}
                      aria-pressed={isSelected}
                      className={`goal-chip ${isSelected ? 'active' : ''}`}
                    >
                      {goal.title}
                    </button>
                  );
                })}
              </Motion.div>
            )}
          </div>
        )}
      </div>

      {/* Active goal hint */}
      <Motion.p
        key={activeGoal?.value || 'empty-goal'}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="goal-hint"
      >
        {activeGoal?.hint || t('Choose a goal to see how your plan will adjust.')}
      </Motion.p>
    </Motion.div>
  );
});

export default GoalsStep;
