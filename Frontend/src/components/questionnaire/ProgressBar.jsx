import React from "react"
import { motion } from "framer-motion"

export default function ProgressBar({ currentStep = 1, totalSteps = 6 }) {
  const raw = (Number(currentStep) / Number(totalSteps)) * 100
  const pct = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0
  const label = `Step ${currentStep} of ${totalSteps}`

  return (
    <div className="mb-6" role="region" aria-label="Progress">
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
        <span>{label}</span>
        <span>{Math.round(pct)}% Complete</span>
      </div>

      <div
        className="w-full h-2 rounded-full bg-gray-200/80 dark:bg-white/10 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={label}
      >
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}
