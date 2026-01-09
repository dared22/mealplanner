import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

export default function ActivityStep({ data, onChange }) {
  const { t } = useLanguage();
  const activityLevels = [
    {
      value: 'sedentary',
      title: t('Sedentary'),
      description: t('Minimal movement, desk-based work'),
      icon: 'S'
    },
    {
      value: 'lightly_active',
      title: t('Lightly Active'),
      description: t('Light exercise 1–3 days per week'),
      icon: 'L'
    },
    {
      value: 'moderately_active',
      title: t('Moderately Active'),
      description: t('Moderate exercise 3–5 days per week'),
      icon: 'M'
    },
    {
      value: 'very_active',
      title: t('Very Active'),
      description: t('Intense exercise 6–7 days per week'),
      icon: 'V'
    },
    {
      value: 'extremely_active',
      title: t('Extremely Active'),
      description: t('Heavy training or physically demanding work'),
      icon: 'E'
    }
  ];

  return (
    <Motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <Motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-primary/20 text-primary"
        >
          <Activity className="w-8 h-8" />
        </Motion.div>
        <h2 className="text-2xl font-semibold mb-2 text-slate-900 dark:text-slate-100">
          {t("What's your activity level?")}
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          {t('Helps us set your daily energy needs.')}
        </p>
      </div>

      <div className="space-y-4">
        {activityLevels.map((level, index) => (
          <Motion.div
            key={level.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
              data.activity_level === level.value
                ? 'border-primary bg-primary/10 shadow-sm'
                : 'border-gray-200 hover:border-primary/70 hover:bg-gray-50 dark:border-slate-700 dark:hover:border-primary/60 dark:hover:bg-slate-800'
            }`}
            onClick={() => onChange({ activity_level: level.value })}
          >
            <div className="flex items-center space-x-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-slate-900 dark:text-slate-100">
                {level.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-50">
                  {level.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">{level.description}</p>
              </div>
              <div
                className={`relative flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                  data.activity_level === level.value
                    ? 'border-primary bg-primary/10 shadow-[0_0_0_4px_rgba(58,175,169,0.25)]'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {data.activity_level === level.value && (
                  <span className="block h-2.5 w-2.5 rounded-full bg-primary" />
                )}
              </div>
            </div>
          </Motion.div>
        ))}
      </div>
    </Motion.div>
  );
}
