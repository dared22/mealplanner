import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Leaf } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

export default function DietaryStep({ data, onChange }) {
  const { t } = useLanguage();
  const dietaryOptions = [
    { value: 'none', title: t('No specific needs'), badge: t('None') },
    { value: 'vegetarian', title: t('Vegetarian'), badge: 'Veg' },
    { value: 'vegan', title: t('Vegan'), badge: 'VGN' },
    { value: 'gluten_free', title: t('Gluten-free'), badge: 'GF' },
    { value: 'dairy_free', title: t('Dairy-free'), badge: 'DF' },
    { value: 'nut_free', title: t('Nut-free'), badge: 'NF' },
    { value: 'keto', title: t('Keto'), badge: 'Keto' },
    { value: 'paleo', title: t('Paleo'), badge: 'Paleo' }
  ];

  const currentRestrictions = data.dietary_restrictions || [];

  const toggleRestriction = (value) => {
    if (value === 'none') {
      onChange({ dietary_restrictions: ['none'] });
    } else {
      let newRestrictions;
      if (currentRestrictions.includes('none')) {
        newRestrictions = [value];
      } else if (currentRestrictions.includes(value)) {
        newRestrictions = currentRestrictions.filter(r => r !== value);
        if (newRestrictions.length === 0) {
          newRestrictions = ['none'];
        }
      } else {
        newRestrictions = [...currentRestrictions, value];
      }
      onChange({ dietary_restrictions: newRestrictions });
    }
  };

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
          <Leaf className="w-8 h-8" />
        </Motion.div>
        <h2 className="text-2xl font-semibold mb-2 text-slate-900 dark:text-slate-100">
          {t('Any dietary needs?')}
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          {t('Select all that apply.')}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {dietaryOptions.map((option, index) => (
          <Motion.div
            key={option.value}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
              currentRestrictions.includes(option.value)
                ? 'border-primary bg-primary/10 shadow-sm'
                : 'border-gray-200 hover:border-primary/70 hover:bg-gray-50 dark:border-slate-700 dark:hover:border-primary/60 dark:hover:bg-slate-800'
            }`}
            onClick={() => toggleRestriction(option.value)}
          >
            <div className="flex items-center space-x-4">
              <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-secondary text-xs font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100">
                {option.badge}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-50">
                  {option.title}
                </h3>
              </div>
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                  currentRestrictions.includes(option.value)
                    ? 'border-primary bg-primary/80'
                    : 'border-gray-300'
                }`}
              >
                {currentRestrictions.includes(option.value) && (
                  <div className="w-2 h-2 bg-white rounded-sm" />
                )}
              </div>
            </div>
          </Motion.div>
        ))}
      </div>
    </Motion.div>
  );
}
