import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Sparkles, Calendar, Clock } from 'lucide-react';

export default function ResultsStep({ data }) {
  const getActivityText = (level) => {
    const levels = {
      sedentary: 'Sedentary',
      lightly_active: 'Lightly Active',
      moderately_active: 'Moderately Active',
      very_active: 'Very Active',
      extremely_active: 'Extremely Active'
    };
    return levels[level] || level;
  };

  const getGoalText = (goal) => {
    const goals = {
      lose_weight: 'Lose Weight',
      maintain_weight: 'Maintain Weight',
      gain_weight: 'Gain Weight',
      build_muscle: 'Build Muscle',
      improve_health: 'Improve Health'
    };
    return goals[goal] || goal;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
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
          <CheckCircle className="w-8 h-8 text-white" />
        </motion.div>
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold mb-2" 
          style={{ color: '#2E3A59' }}
        >
          Your personalized meal plan is ready! 🎉
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-gray-600"
        >
          Based on your preferences, we've crafted the perfect weekly meal plan
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-br from-[#A5D6A7] to-[#81C784] p-6 rounded-2xl text-white transition-colors dark:from-[#12413b] dark:to-[#0f2f2d]"
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-white/80" />
          <h3 className="font-semibold text-white">Your Profile Summary</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl bg-white/15 p-4 text-white shadow-inner">
            <div className="font-medium">Physical Stats</div>
            <div className="text-sm opacity-90">{data.age} years • {data.height}cm • {data.weight}kg</div>
          </div>
          <div className="rounded-xl bg-white/15 p-4 text-white shadow-inner">
            <div className="font-medium">Activity & Goal</div>
            <div className="text-sm opacity-90">{getActivityText(data.activity_level)} • {getGoalText(data.nutrition_goal)}</div>
          </div>
        </div>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white border border-gray-200 p-6 rounded-xl transition-colors dark:bg-slate-900/60 dark:border-slate-700"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-[#A5D6A7] dark:text-[#7dd3a7]" />
            <h3 className="font-semibold text-[#2E3A59] dark:text-gray-100">
              Weekly Plan Preview
            </h3>
          </div>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex justify-between">
              <span>Meals per day:</span>
              <span className="font-medium">{data.meals_per_day || 3}</span>
            </div>
            <div className="flex justify-between">
              <span>Cuisines:</span>
              <span className="font-medium">{(data.preferred_cuisines || []).length} selected</span>
            </div>
            <div className="flex justify-between">
              <span>Dietary needs:</span>
              <span className="font-medium">{(data.dietary_restrictions || ['none']).join(', ')}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white border border-gray-200 p-6 rounded-xl transition-colors dark:bg-slate-900/60 dark:border-slate-700"
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[#FF6F61] dark:text-[#fb7185]" />
            <h3 className="font-semibold text-[#2E3A59] dark:text-gray-100">
              Cooking Preferences
            </h3>
          </div>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex justify-between">
              <span>Cooking time:</span>
              <span className="font-medium">{data.cooking_time_preference?.replace('_', ' ') || 'Not specified'}</span>
            </div>
            <div className="flex justify-between">
              <span>Budget range:</span>
              <span className="font-medium">{data.budget_range?.replace('_', ' ') || 'Not specified'}</span>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-[#F5F5F5] p-6 rounded-xl text-center transition-colors dark:bg-slate-900/60"
      >
        <div className="text-4xl mb-2">🍽️</div>
        <h3 className="font-semibold mb-2 text-[#2E3A59] dark:text-gray-100">
          Your meal plan is being prepared!
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          In the full version, you'll receive detailed recipes, shopping lists, and nutritional information
          tailored specifically to your preferences and goals.
        </p>
      </motion.div>
    </motion.div>
  );
}
