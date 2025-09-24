import React from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';

export default function GoalsStep({ data, onChange }) {
  const goals = [
    {
      value: 'lose_weight',
      title: 'Lose Weight',
      description: 'Reduce body weight in a healthy way',
      icon: '📉',
      color: '#FF6F61'
    },
    {
      value: 'maintain_weight',
      title: 'Maintain Weight',
      description: 'Keep current weight stable',
      icon: '⚖️',
      color: '#A5D6A7'
    },
    {
      value: 'gain_weight',
      title: 'Gain Weight',
      description: 'Increase body weight healthily',
      icon: '📈',
      color: '#4CAF50'
    },
    {
      value: 'build_muscle',
      title: 'Build Muscle',
      description: 'Increase muscle mass and strength',
      icon: '💪',
      color: '#2196F3'
    },
    {
      value: 'improve_health',
      title: 'Improve Health',
      description: 'Focus on overall wellness',
      icon: '❤️',
      color: '#9C27B0'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#A5D6A7' }}
        >
          <Target className="w-8 h-8 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#2E3A59' }}>
          What's your main goal?
        </h2>
        <p className="text-gray-600">
          Choose your primary nutrition objective
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {goals.map((goal, index) => (
          <motion.div
            key={goal.value}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * index }}
            className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
              data.nutrition_goal === goal.value
                ? 'border-[#A5D6A7] bg-[#A5D6A7] bg-opacity-10 transform scale-105'
                : 'border-gray-200 hover:border-[#A5D6A7] hover:bg-gray-50'
            }`}
            onClick={() => onChange({ nutrition_goal: goal.value })}
          >
            <div className="text-center">
              <div className="text-3xl mb-3">{goal.icon}</div>
              <h3 className="font-semibold mb-1" style={{ color: '#2E3A59' }}>
                {goal.title}
              </h3>
              <p className="text-sm text-gray-600">{goal.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}