import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Activity } from 'lucide-react';

export default function ActivityStep({ data, onChange }) {
  const activityLevels = [
    {
      value: 'sedentary',
      title: 'Sedentary',
      description: 'Little to no exercise, desk job',
      icon: '🪑'
    },
    {
      value: 'lightly_active',
      title: 'Lightly Active',
      description: 'Light exercise 1-3 days/week',
      icon: '🚶'
    },
    {
      value: 'moderately_active',
      title: 'Moderately Active',
      description: 'Moderate exercise 3-5 days/week',
      icon: '🏃'
    },
    {
      value: 'very_active',
      title: 'Very Active',
      description: 'Heavy exercise 6-7 days/week',
      icon: '💪'
    },
    {
      value: 'extremely_active',
      title: 'Extremely Active',
      description: 'Very heavy exercise, physical job',
      icon: '🏋️'
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
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#A5D6A7' }}
        >
          <Activity className="w-8 h-8 text-white" />
        </Motion.div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#2E3A59' }}>
          What's your activity level?
        </h2>
        <p className="text-gray-600">
          This helps us calculate your daily calorie needs
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
                ? 'border-[#A5D6A7] bg-[#A5D6A7] bg-opacity-10'
                : 'border-gray-200 hover:border-[#A5D6A7] hover:bg-gray-50'
            }`}
            onClick={() => onChange({ activity_level: level.value })}
          >
            <div className="flex items-center space-x-4">
              <div className="text-2xl">{level.icon}</div>
              <div className="flex-1">
                <h3 className="font-semibold" style={{ color: '#2E3A59' }}>
                  {level.title}
                </h3>
                <p className="text-sm text-gray-600">{level.description}</p>
              </div>
              <div
                className={`w-4 h-4 rounded-full border-2 ${
                  data.activity_level === level.value
                    ? 'border-[#A5D6A7] bg-[#A5D6A7]'
                    : 'border-gray-300'
                }`}
              />
            </div>
          </Motion.div>
        ))}
      </div>
    </Motion.div>
  );
}
