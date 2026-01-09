import React from "react"
import { motion as Motion } from "framer-motion"
import { useLanguage } from '@/i18n/LanguageContext'

export default function ProgressBar({ currentStep = 1, totalSteps = 6 }) {
  const { t } = useLanguage()
  const raw = (Number(currentStep) / Number(totalSteps)) * 100
  const pct = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0
  const label = t('Step {current} of {total}', {
    current: currentStep,
    total: totalSteps,
  })

  return (
    <div className="mb-6" role="region" aria-label={t('Progress')}>
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('{percent}% complete', { percent: Math.round(pct) })}
        </span>
      </div>

      <div
        className="w-full h-2 rounded-full bg-gray-200/80 dark:bg-white/10 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={label}
      >
        <Motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}
