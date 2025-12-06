import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Target } from 'lucide-react';

export default function GoalsStep({ data, onChange }) {
  const goals = [
    {
      value: 'lose_weight',
      title: 'Lose weight',
      description: 'Gradual, sustainable weight reduction',
      icon: 'LW'
    },
    {
      value: 'maintain_weight',
      title: 'Maintain weight',
      description: 'Keep your current weight stable',
      icon: 'MW'
    },
    {
      value: 'gain_weight',
      title: 'Gain weight',
      description: 'Increase weight in a healthy way',
      icon: 'GW'
    },
    {
      value: 'build_muscle',
      title: 'Build muscle',
      description: 'Increase muscle mass and strength',
      icon: 'BM'
    },
    {
      value: 'improve_health',
      title: 'Improve health',
      description: 'Support overall metabolic health',
      icon: 'IH'
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
          <Target className="w-8 h-8" />
        </Motion.div>
        <h2 className="text-2xl font-semibold mb-2 text-slate-900 dark:text-slate-100">
          What's your primary goal?
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          We'll tune calories and macros to match.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {goals.map((goal, index) => (
          <Motion.div
            key={goal.value}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * index }}
            className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
              data.nutrition_goal === goal.value
                ? 'border-primary bg-primary/10 shadow-sm'
                : 'border-gray-200 hover:border-primary/70 hover:bg-gray-50 dark:border-slate-700 dark:hover:border-primary/60 dark:hover:bg-slate-800'
            }`}
            onClick={() => onChange({ nutrition_goal: goal.value })}
          >
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-xs font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100">
                {goal.icon}
              </div>
              <h3 className="font-semibold mb-1 text-slate-900 dark:text-slate-50">
                {goal.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{goal.description}</p>
            </div>
          </Motion.div>
        ))}
      </div>
    </Motion.div>
  );
}
