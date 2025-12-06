import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Globe } from 'lucide-react';

export default function CuisineStep({ data, onChange }) {
  const cuisines = [
    { value: 'mediterranean', title: 'Mediterranean', badge: 'MED' },
    { value: 'asian', title: 'Asian', badge: 'ASIA' },
    { value: 'mexican', title: 'Mexican', badge: 'MEX' },
    { value: 'italian', title: 'Italian', badge: 'ITA' },
    { value: 'indian', title: 'Indian', badge: 'IND' },
    { value: 'american', title: 'American', badge: 'USA' },
    { value: 'french', title: 'French', badge: 'FRA' },
    { value: 'thai', title: 'Thai', badge: 'THA' },
    { value: 'japanese', title: 'Japanese', badge: 'JPN' },
    { value: 'middle_eastern', title: 'Middle Eastern', badge: 'ME' }
  ];

  const currentCuisines = data.preferred_cuisines || [];

  const toggleCuisine = (value) => {
    const newCuisines = currentCuisines.includes(value)
      ? currentCuisines.filter(c => c !== value)
      : [...currentCuisines, value];
    onChange({ preferred_cuisines: newCuisines });
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
          <Globe className="w-8 h-8" />
        </Motion.div>
        <h2 className="text-2xl font-semibold mb-2 text-slate-900 dark:text-slate-100">
          Which cuisines do you prefer?
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Choose your go-to flavors. Select multiple.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cuisines.map((cuisine, index) => (
          <Motion.div
            key={cuisine.value}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * index }}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
              currentCuisines.includes(cuisine.value)
                ? 'border-primary bg-primary/10 shadow-sm'
                : 'border-gray-200 hover:border-primary/70 hover:bg-gray-50 dark:border-slate-700 dark:hover:border-primary/60 dark:hover:bg-slate-800'
            }`}
            onClick={() => toggleCuisine(cuisine.value)}
          >
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-14 items-center justify-center rounded-lg bg-secondary text-xs font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100">
                {cuisine.badge}
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-50">
                {cuisine.title}
              </h3>
            </div>
          </Motion.div>
        ))}
      </div>
    </Motion.div>
  );
}
