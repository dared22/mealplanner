import React, { useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { CheckCircle, Sparkles, Calendar, Clock } from 'lucide-react';

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9
};
const GOAL_ADJUSTMENTS = {
  lose_weight: -350,
  maintain_weight: 0,
  gain_weight: 300,
  build_muscle: 200,
  improve_health: 0
};
const MACRO_RATIOS = {
  lose_weight: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  maintain_weight: { protein: 0.25, carbs: 0.5, fat: 0.25 },
  gain_weight: { protein: 0.25, carbs: 0.5, fat: 0.25 },
  build_muscle: { protein: 0.35, carbs: 0.4, fat: 0.25 },
  improve_health: { protein: 0.3, carbs: 0.45, fat: 0.25 },
  default: { protein: 0.3, carbs: 0.45, fat: 0.25 }
};
const MEAL_SHARES = {
  Breakfast: 0.25,
  Lunch: 0.3,
  Dinner: 0.3,
  Snacks: 0.15
};
const RECIPE_LIBRARY = {
  Breakfast: [
    'Protein Pancakes',
    'Berry Smoothie Bowl',
    'Avocado Toast & Eggs',
    'Greek Yogurt Parfait',
    'Chia Overnight Oats',
    'Veggie Omelette Wrap'
  ],
  Lunch: [
    'Grilled Chicken Quinoa Bowl',
    'Mediterranean Chickpea Salad',
    'Salmon Poke Bowl',
    'Turkey Avocado Wrap',
    'Tofu Power Stir Fry',
    'Lentil Harvest Bowl'
  ],
  Dinner: [
    'Garlic Herb Salmon & Veggies',
    'Lean Steak Fajita Plate',
    'Miso Glazed Cod',
    'Roasted Veggie Farro Bowl',
    'Lemon Chicken Orzo',
    'Thai Basil Tofu Noodles'
  ],
  Snacks: [
    'Almond Butter Energy Bites',
    'Greek Yogurt with Berries',
    'Hummus & Veggie Dippers',
    'Protein Smoothie',
    'Spiced Roasted Chickpeas',
    'Apple & Nut Butter Plate'
  ]
};
const MACRO_META = [
  { key: 'protein', label: 'P', color: '#2563eb' },
  { key: 'carbs', label: 'C', color: '#22c55e' },
  { key: 'fat', label: 'F', color: '#f97316' }
];

function toTitleCase(value) {
  if (!value) return '';
  return value
    .toString()
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word ? word[0].toUpperCase() + word.slice(1) : '')
    .join(' ');
}

function estimateCalorieTarget(data) {
  const weight = Number(data?.weight) || 70;
  const height = Number(data?.height) || 170;
  const age = Number(data?.age) || 30;
  const gender = data?.gender === 'female' ? 'female' : 'male';
  const bmr = gender === 'female'
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5;
  const activity = ACTIVITY_MULTIPLIERS[data?.activity_level] || ACTIVITY_MULTIPLIERS.moderately_active;
  const goalAdjustment = GOAL_ADJUSTMENTS[data?.nutrition_goal] ?? 0;
  const raw = bmr * activity + goalAdjustment;
  return Math.max(1500, Math.round(raw));
}

function deriveMacroTargets(calories, goal) {
  const ratios = MACRO_RATIOS[goal] || MACRO_RATIOS.default;
  return {
    protein: Math.round((calories * ratios.protein) / 4),
    carbs: Math.round((calories * ratios.carbs) / 4),
    fat: Math.round((calories * ratios.fat) / 9)
  };
}

function deriveCookTimeLabel(preference) {
  switch (preference) {
    case 'under_15_min':
      return '12 min';
    case '15_30_min':
      return '25 min';
    case '30_60_min':
      return '45 min';
    case 'over_60_min':
      return '75 min';
    default:
      return '20 min';
  }
}

function mapTimeTag(preference) {
  switch (preference) {
    case 'under_15_min':
      return '<15m';
    case '15_30_min':
      return '15-30m';
    case '30_60_min':
      return '30-60m';
    case 'over_60_min':
      return 'Slow cook';
    default:
      return 'Balanced time';
  }
}

function mapBudgetTag(range) {
  switch (range) {
    case 'budget_friendly':
      return 'Budget';
    case 'moderate':
      return 'Moderate';
    case 'premium':
      return 'Premium';
    case 'no_limit':
      return 'Open budget';
    default:
      return 'Budget-aware';
  }
}

function pickRecipe(mealType, index, cuisines) {
  const options = RECIPE_LIBRARY[mealType] || ['Chef\'s Choice'];
  const recipe = options[index % options.length];
  const cuisine = cuisines[index % cuisines.length];
  if (!cuisine || cuisine.toLowerCase() === 'seasonal') {
    return recipe;
  }
  return `${cuisine} ${recipe}`;
}

function generateMockMealPlan(data) {
  const calorieTarget = estimateCalorieTarget(data);
  const macroTargets = deriveMacroTargets(calorieTarget, data?.nutrition_goal);
  const cuisines = (data?.preferred_cuisines?.length
    ? data.preferred_cuisines
    : ['seasonal']).map(toTitleCase);
  const restrictions = (data?.dietary_restrictions || [])
    .filter(item => item && item !== 'none')
    .map(toTitleCase);

  const timeTag = mapTimeTag(data?.cooking_time_preference);
  const budgetTag = mapBudgetTag(data?.budget_range);
  const cookTimeLabel = deriveCookTimeLabel(data?.cooking_time_preference);

  const days = WEEK_DAYS.map((name, dayIndex) => {
    const dayVariance = 0.94 + (dayIndex % 4) * 0.02;
    const calories = Math.round(calorieTarget * dayVariance);
    const macros = {
      protein: Math.max(0, Math.round(macroTargets.protein * dayVariance)),
      carbs: Math.max(0, Math.round(macroTargets.carbs * dayVariance)),
      fat: Math.max(0, Math.round(macroTargets.fat * dayVariance))
    };

    const meals = MEAL_TYPES.reduce((acc, mealType, mealIndex) => {
      const share = MEAL_SHARES[mealType] ?? 0.25;
      const mealVariance = 0.92 + ((dayIndex + mealIndex) % 5) * 0.02;
      const mealCalories = Math.round(calorieTarget * share * mealVariance);
      const scale = mealCalories / calorieTarget;

      const mealProtein = Math.max(4, Math.round(macroTargets.protein * scale));
      const mealCarbs = Math.max(5, Math.round(macroTargets.carbs * scale));
      const mealFat = Math.max(3, Math.round(macroTargets.fat * scale));

      const activeCuisine = cuisines[(dayIndex + mealIndex) % cuisines.length];
      const tags = Array.from(
        new Set(
          [
            timeTag,
            budgetTag,
            activeCuisine,
            ...restrictions
          ].filter(Boolean)
        )
      );

      acc[mealType] = {
        name: pickRecipe(mealType, dayIndex + mealIndex, cuisines),
        calories: mealCalories,
        protein: mealProtein,
        carbs: mealCarbs,
        fat: mealFat,
        cookTime: cookTimeLabel,
        tags
      };

      return acc;
    }, {});

    return {
      name,
      calories,
      macros,
      meals
    };
  });

  return {
    calorieTarget,
    macroTargets,
    days
  };
}

function DailyDonut({ value, target }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const safeTarget = target || value || 1;
  const progress = Math.max(0, Math.min(value / safeTarget, 1));
  const dashOffset = circumference - progress * circumference;

  return (
    <div className="relative w-16 h-16">
      <svg viewBox="0 0 72 72" className="w-16 h-16">
        <circle
          cx="36"
          cy="36"
          r={radius}
          stroke="rgba(148, 163, 184, 0.25)"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          stroke="#34d399"
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] leading-tight">
        <span className="text-xs font-semibold text-[#2E3A59] dark:text-gray-50">{value}</span>
        <span className="text-[9px] text-gray-500 dark:text-gray-400">kcal</span>
      </div>
    </div>
  );
}

function DailyMacroBars({ macros, targets }) {
  return (
    <div className="flex flex-col gap-1.5">
      {MACRO_META.map(macro => {
        const value = macros[macro.key] ?? 0;
        const target = Math.max(targets[macro.key] ?? 1, 1);
        const pct = Math.min((value / target) * 100, 100);
        return (
          <div key={macro.key} className="flex items-center gap-2">
            <span
              className="w-5 text-[11px] font-semibold"
              style={{ color: macro.color }}
            >
              {macro.label}
            </span>
            <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden dark:bg-slate-700/60">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: macro.color
                }}
              />
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {value}g
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MealCard({ meal, mealType, showMealType = false, className = '' }) {
  if (!meal) {
    return (
      <div className={`rounded-2xl border border-dashed border-gray-200 bg-white/60 p-4 text-sm text-gray-400 dark:border-slate-700 dark:bg-slate-900 ${className}`}>
        Plan coming soon
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col gap-3 rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/80 ${className}`}>
      {showMealType && (
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {mealType}
        </div>
      )}
      <div>
        <div className="text-sm font-semibold text-[#2E3A59] dark:text-gray-100">
          {meal.name}
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {meal.calories} kcal • P {meal.protein}g • C {meal.carbs}g • F {meal.fat}g
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-[#A5D6A7]/15 px-3 py-2 text-xs text-[#2E3A59] dark:bg-emerald-500/10 dark:text-emerald-200">
        <span>Cook time</span>
        <span className="font-semibold">{meal.cookTime}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {meal.tags.map(tag => (
          <span
            key={tag}
            className="rounded-full bg-[#A5D6A7]/25 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[#1B5E20] dark:bg-emerald-500/10 dark:text-emerald-200"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <button className="flex-1 rounded-full border border-[#A5D6A7]/60 px-3 py-1.5 text-xs font-medium text-[#2E3A59] transition hover:bg-[#A5D6A7]/20 dark:border-emerald-400/40 dark:text-emerald-200 dark:hover:bg-emerald-500/10">
          Swap
        </button>
        <button className="flex-1 rounded-full border border-[#A5D6A7]/60 px-3 py-1.5 text-xs font-medium text-[#2E3A59] transition hover:bg-[#A5D6A7]/20 dark:border-emerald-400/40 dark:text-emerald-200 dark:hover:bg-emerald-500/10">
          Details
        </button>
        <button className="flex-1 rounded-full border border-[#FF6F61]/60 px-3 py-1.5 text-xs font-semibold text-[#FF6F61] transition hover:bg-[#FF6F61]/10 dark:border-rose-400/50 dark:text-rose-300 dark:hover:bg-rose-500/10">
          Add to list
        </button>
      </div>
    </div>
  );
}

function DayCard({ day, targetCalories, isActive, onSelect }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-gray-200 bg-white/90 p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/80 ${
        isActive ? 'ring-2 ring-offset-2 ring-[#A5D6A7]/70 dark:ring-emerald-400/60 dark:ring-offset-slate-950' : 'ring-0'
      }`}
    >
      <div className="pointer-events-none absolute inset-x-2 top-2 h-24 rounded-3xl bg-gradient-to-br from-[#A5D6A7]/45 via-transparent to-transparent opacity-80" />
      <div className="relative flex items-center gap-4">
        <DailyDonut value={day.calories} target={targetCalories} />
        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-base font-semibold text-[#2E3A59] dark:text-gray-100">
              {day.name}
            </h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {day.calories} / {targetCalories} kcal
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">
            <span className="rounded-full bg-[#A5D6A7]/25 px-2.5 py-1 text-[#1B5E20] dark:bg-emerald-500/10 dark:text-emerald-200">
              P {day.macros.protein}g
            </span>
            <span className="rounded-full bg-[#A5D6A7]/25 px-2.5 py-1 text-[#1B5E20] dark:bg-emerald-500/10 dark:text-emerald-200">
              C {day.macros.carbs}g
            </span>
            <span className="rounded-full bg-[#A5D6A7]/25 px-2.5 py-1 text-[#1B5E20] dark:bg-emerald-500/10 dark:text-emerald-200">
              F {day.macros.fat}g
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={onSelect}
        className={`relative mt-6 w-full rounded-full px-4 py-2 text-sm font-semibold transition ${
          isActive
            ? 'bg-[#A5D6A7] text-[#1B5E20] shadow hover:bg-[#9bcf9d]'
            : 'border border-[#A5D6A7]/60 text-[#2E3A59] hover:bg-[#A5D6A7]/15 dark:border-emerald-400/40 dark:text-emerald-200 dark:hover:bg-emerald-500/10'
        }`}
      >
        {isActive ? 'Viewing day plan' : 'Show plan for this day'}
      </button>
    </div>
  );
}

function SelectedDayPlan({ day, targetCalories, macroTargets }) {
  if (!day) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-white via-white/70 to-white/40 p-6 shadow-inner dark:from-slate-900 dark:via-slate-900/70 dark:to-slate-900/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <DailyDonut value={day.calories} target={targetCalories} />
            <div>
              <h4 className="text-lg font-semibold text-[#2E3A59] dark:text-gray-100">
                {day.name} overview
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {day.calories} of {targetCalories} kcal planned • P {day.macros.protein}g • C {day.macros.carbs}g • F {day.macros.fat}g
              </p>
            </div>
          </div>
          <div className="min-w-[220px] rounded-2xl border border-[#A5D6A7]/40 bg-white/50 p-4 dark:border-emerald-500/20 dark:bg-slate-900/60">
            <h5 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
              Macro balance
            </h5>
            <div className="mt-3">
              <DailyMacroBars macros={day.macros} targets={macroTargets} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MEAL_TYPES.map(mealType => (
          <MealCard
            key={`${day.name}-${mealType}`}
            meal={day.meals[mealType]}
            mealType={mealType}
            showMealType
            className="md:min-h-[240px]"
          />
        ))}
      </div>
    </div>
  );
}

export default function ResultsStep({ data }) {
  const plan = useMemo(() => generateMockMealPlan(data), [data]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const selectedDay = plan.days[selectedDayIndex] || plan.days[0];

  const getActivityText = (level) => {
    const levels = {
      sedentary: 'Sedentary',
      lightly_active: 'Lightly Active',
      moderately_active: 'Moderately Active',
      very_active: 'Very Active',
      extremely_active: 'Extremely Active'
    };
    return levels[level] || toTitleCase(level);
  };

  const getGoalText = (goal) => {
    const goals = {
      lose_weight: 'Lose Weight',
      maintain_weight: 'Maintain Weight',
      gain_weight: 'Gain Weight',
      build_muscle: 'Build Muscle',
      improve_health: 'Improve Health'
    };
    return goals[goal] || toTitleCase(goal);
  };

  return (
    <Motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <Motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#A5D6A7' }}
        >
          <CheckCircle className="w-8 h-8 text-white" />
        </Motion.div>
        <Motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold mb-2"
          style={{ color: '#2E3A59' }}
        >
          Your personalized meal plan is ready! 🎉
        </Motion.h2>
        <Motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-gray-600 dark:text-gray-300"
        >
          Here’s a full week of meals aligned with your goals, taste, and schedule.
        </Motion.p>
      </div>

      <Motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gradient-to-br from-[#A5D6A7] to-[#81C784] p-6 rounded-2xl text-white transition-colors dark:from-[#12413b] dark:to-[#0f2f2d]"
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-white/80" />
          <h3 className="font-semibold text-white">Your Profile Summary</h3>
        </div>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl bg-white/15 p-4 text-white shadow-inner">
            <div className="font-medium">Physical Stats</div>
            <div className="text-sm opacity-90">
              {data.age || '—'} yrs • {data.height || '—'}cm • {data.weight || '—'}kg
            </div>
          </div>
          <div className="rounded-xl bg-white/15 p-4 text-white shadow-inner">
            <div className="font-medium">Activity & Goal</div>
            <div className="text-sm opacity-90">
              {getActivityText(data.activity_level)} • {getGoalText(data.nutrition_goal)}
            </div>
          </div>
          <div className="rounded-xl bg-white/15 p-4 text-white shadow-inner">
            <div className="font-medium">Daily Targets</div>
            <div className="text-sm opacity-90">
              {plan.calorieTarget} kcal • P {plan.macroTargets.protein}g • C {plan.macroTargets.carbs}g • F {plan.macroTargets.fat}g
            </div>
          </div>
        </div>
      </Motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        <Motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white border border-gray-200 p-6 rounded-xl transition-colors dark:bg-slate-900/60 dark:border-slate-700"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-[#A5D6A7] dark:text-[#7dd3a7]" />
            <h3 className="font-semibold text-[#2E3A59] dark:text-gray-100">
              Weekly Plan Snapshot
            </h3>
          </div>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex justify-between">
              <span>Meals per day</span>
              <span className="font-medium">{data.meals_per_day || 4}</span>
            </div>
            <div className="flex justify-between">
              <span>Preferred cuisines</span>
              <span className="font-medium">
                {(data.preferred_cuisines || ['Seasonal']).map(toTitleCase).join(', ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Dietary needs</span>
              <span className="font-medium">
                {(data.dietary_restrictions || ['None'])
                  .map(toTitleCase)
                  .join(', ')}
              </span>
            </div>
          </div>
        </Motion.div>

        <Motion.div
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
              <span>Cooking time</span>
              <span className="font-medium">
                {toTitleCase(data.cooking_time_preference) || 'Balanced'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Budget focus</span>
              <span className="font-medium">
                {toTitleCase(data.budget_range) || 'Flexible'}
              </span>
            </div>
          </div>
        </Motion.div>
      </div>

      <Motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="space-y-6"
      >
        <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white/95 p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#2E3A59] dark:text-gray-100">
                Explore your week
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Tap a day to reveal its full menu, nutrition breakdown, and quick actions.
              </p>
            </div>
            <div className="rounded-2xl bg-[#A5D6A7]/20 px-4 py-3 text-sm text-[#2E3A59] dark:bg-emerald-500/10 dark:text-emerald-200">
              <div className="font-semibold">Daily target</div>
              <div>
                {plan.calorieTarget} kcal • P {plan.macroTargets.protein}g • C {plan.macroTargets.carbs}g • F {plan.macroTargets.fat}g
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {plan.days.map((day, index) => (
              <DayCard
                key={day.name}
                day={day}
                targetCalories={plan.calorieTarget}
                isActive={index === selectedDayIndex}
                onSelect={() => setSelectedDayIndex(index)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white/95 p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/80">
          <SelectedDayPlan
            day={selectedDay}
            targetCalories={plan.calorieTarget}
            macroTargets={plan.macroTargets}
          />
        </div>
      </Motion.div>
    </Motion.div>
  );
}
