import React, { memo } from 'react';
import { motion as Motion } from 'framer-motion';
import { useLanguage } from '@/i18n/LanguageContext';

const ProgressBar = memo(function ProgressBar({ currentStep = 1, totalSteps = 6 }) {
  const { t } = useLanguage();
  const pct = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100));

  return (
    <div className="mb-8" role="region" aria-label={t('Progress')}>
      {/* Step indicator and progress */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <span className="step-badge">
          {t('Step {current} of {total}', { current: currentStep, total: totalSteps })}
        </span>
        <div className="h-2 w-36 rounded-full bg-[var(--secondary)] overflow-hidden">
          <Motion.div
            className="h-full rounded-full bg-[var(--primary)]"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <span className="text-sm font-medium text-[var(--muted-foreground)]">
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
});

export default ProgressBar;
