import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { CheckCircle, Sparkles, Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
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

function normalizeServerPlan(plan) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.days) || !plan.days.length) {
    return null;
  }

  const normalizedDays = WEEK_DAYS.map((weekday) => {
    const match = plan.days.find(
      (day) => typeof day?.name === 'string' && day.name.toLowerCase() === weekday.toLowerCase()
    );

    const macros = match?.macros || {};
    const meals = MEAL_TYPES.reduce((acc, mealType) => {
      const sourceMeal = match?.meals?.[mealType] || {};
      acc[mealType] = {
        name: sourceMeal.name || `${mealType} option`,
        calories: Number(sourceMeal.calories) || 0,
        protein: Number(sourceMeal.protein) || 0,
        carbs: Number(sourceMeal.carbs) || 0,
        fat: Number(sourceMeal.fat) || 0,
        cookTime: sourceMeal.cookTime || '20 min',
        tags: Array.isArray(sourceMeal.tags) ? sourceMeal.tags.slice(0, 6) : [],
        ingredients: Array.isArray(sourceMeal.ingredients) ? sourceMeal.ingredients : [],
        instructions: typeof sourceMeal.instructions === 'string' ? sourceMeal.instructions : ''
      };
      return acc;
    }, {});

    return {
      name: match?.name || weekday,
      calories: Number(match?.calories) || 0,
      macros: {
        protein: Number(macros.protein) || 0,
        carbs: Number(macros.carbs) || 0,
        fat: Number(macros.fat) || 0
      },
      meals
    };
  });

  const macroTargets = {
    protein: Number(plan?.macroTargets?.protein) || 0,
    carbs: Number(plan?.macroTargets?.carbs) || 0,
    fat: Number(plan?.macroTargets?.fat) || 0
  };

  const calorieTarget =
    Number(plan?.calorieTarget) ||
    Math.round(
      normalizedDays.reduce((sum, day) => sum + (day.calories || 0), 0) /
        Math.max(normalizedDays.length, 1)
    );

  return {
    calorieTarget,
    macroTargets,
    days: normalizedDays
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
      {!!meal.ingredients?.length && (
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-[#2E3A59] dark:text-gray-200">Ingredients:</span>{' '}
          {meal.ingredients.slice(0, 6).join(', ')}
        </div>
      )}
      {meal.instructions && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {meal.instructions}
        </p>
      )}
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

function DayCard({ day, targetCalories, isActive, onSelect, className = '' }) {
  const dayIndex = WEEK_DAYS.indexOf(day.name);
  const dayNumber = dayIndex >= 0 ? dayIndex + 1 : '—';

  return (
    <Motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.99 }}
      className={`group relative flex min-w-[240px] max-w-[320px] flex-col gap-5 rounded-3xl border px-6 py-6 text-left shadow-sm transition-all duration-200 sm:min-w-[260px] sm:max-w-[340px] md:min-w-[280px] ${
        isActive
          ? 'border-[#7ad3a5] bg-gradient-to-br from-[#F1FBF4] via-white to-white shadow-[0_18px_35px_rgba(97,202,140,0.2)] dark:border-emerald-400/50 dark:from-emerald-900/20 dark:via-slate-900 dark:to-slate-900'
          : 'border-gray-200 bg-white hover:-translate-y-1 hover:border-[#A5D6A7]/80 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/90'
      } ${className}`}
    >
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-[#A5D6A7]/20 p-2.5 dark:bg-emerald-500/15">
          <DailyDonut value={day.calories} target={targetCalories} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8ea0c8] dark:text-slate-400">
            Day {dayNumber}
          </p>
          <h4 className="text-lg font-semibold text-[#1f2d4c] dark:text-gray-100">
            {day.name}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {day.calories} / {targetCalories} kcal planned
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#1B5E20] shadow-sm dark:bg-emerald-500/10 dark:text-emerald-200">
          P {day.macros.protein}g
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#1B5E20] shadow-sm dark:bg-emerald-500/10 dark:text-emerald-200">
          C {day.macros.carbs}g
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#1B5E20] shadow-sm dark:bg-emerald-500/10 dark:text-emerald-200">
          F {day.macros.fat}g
        </span>
      </div>
      <div className="mt-auto flex items-center justify-between rounded-2xl bg-[#F1F6F2] px-4 py-3 text-[11px] font-medium text-[#2E3A59] transition group-hover:bg-[#E5F1E6] dark:bg-slate-800/80 dark:text-emerald-100">
        <span>{isActive ? 'View full plan' : 'Tap to preview'}</span>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1B5E20] dark:text-emerald-300">
          {isActive ? 'Active' : 'Preview'}
        </span>
      </div>
    </Motion.button>
  );
}

function SelectedDayPlan({ day, targetCalories, macroTargets }) {
  if (!day) return null;

  const highlightTags = Array.from(
    new Set(
      MEAL_TYPES.flatMap(type => day.meals[type]?.tags || [])
    )
  ).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 rounded-3xl border border-[#A5D6A7]/25 bg-gradient-to-br from-white via-[#F8FBF8] to-white p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900/80 dark:to-slate-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-5">
            <div className="rounded-3xl bg-[#A5D6A7]/25 p-4 dark:bg-emerald-500/10">
              <DailyDonut value={day.calories} target={targetCalories} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#97A0C2] dark:text-slate-400">
                Daily overview
              </p>
              <h4 className="text-xl font-semibold text-[#1f2a44] dark:text-gray-100">
                {day.name}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {day.calories} of {targetCalories} kcal planned • P {day.macros.protein}g • C {day.macros.carbs}g • F {day.macros.fat}g
              </p>
            </div>
          </div>
          <div className="min-w-[240px] rounded-2xl border border-[#A5D6A7]/40 bg-white/80 p-5 dark:border-emerald-500/15 dark:bg-slate-900/70">
            <h5 className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400 dark:text-slate-500">
              Macro balance
            </h5>
            <div className="mt-3">
              <DailyMacroBars macros={day.macros} targets={macroTargets} />
            </div>
          </div>
        </div>
        {highlightTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {highlightTags.map(tag => (
              <span
                key={tag}
                className="rounded-full bg-[#A5D6A7]/25 px-3 py-1 font-semibold text-[#1B5E20] dark:bg-emerald-500/10 dark:text-emerald-200"
              >
                {tag}
              </span>
            ))}
            <span className="text-[11px]">
              Tuning each meal to your cooking time and budget preferences.
            </span>
          </div>
        )}
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

function DayCarousel({ days, targetCalories, selectedIndex, onSelect }) {
  const trackRef = useRef(null);
  const [scrollState, setScrollState] = useState({ prev: false, next: false });

  const computeScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const { scrollLeft, scrollWidth, clientWidth } = track;
    const maxScroll = scrollWidth - clientWidth;
    setScrollState({
      prev: scrollLeft > 12,
      next: scrollLeft < maxScroll - 12
    });
  }, []);

  useEffect(() => {
    computeScrollState();
  }, [computeScrollState, days.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const handle = () => computeScrollState();
    track.addEventListener('scroll', handle, { passive: true });
    return () => track.removeEventListener('scroll', handle);
  }, [computeScrollState]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const node = track.children[selectedIndex];
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedIndex]);

  const scrollBy = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    const amount = track.clientWidth * 0.8;
    track.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        disabled={!scrollState.prev}
        className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-[#A5D6A7]/60 bg-white/90 p-2 text-[#1B5E20] shadow-lg transition hover:bg-[#A5D6A7]/20 disabled:pointer-events-none disabled:opacity-30 dark:border-emerald-400/40 dark:bg-slate-900/90 dark:text-emerald-200 lg:flex"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-visible scroll-smooth py-3 pr-2 pl-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {days.map((day, index) => (
          <DayCard
            key={day.name}
            day={day}
            targetCalories={targetCalories}
            isActive={index === selectedIndex}
            onSelect={() => onSelect(index)}
            className="snap-center"
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => scrollBy(1)}
        disabled={!scrollState.next}
        className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-[#A5D6A7]/60 bg-white/90 p-2 text-[#1B5E20] shadow-lg transition hover:bg-[#A5D6A7]/20 disabled:pointer-events-none disabled:opacity-30 dark:border-emerald-400/40 dark:bg-slate-900/90 dark:text-emerald-200 lg:flex"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ResultsStep({ data, plan, rawPlanText, status = 'idle', errorMessage }) {
  const activePlan = useMemo(() => normalizeServerPlan(plan), [plan]);
  const hasPlan = Boolean(activePlan?.days?.length);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const selectedDay = hasPlan ? activePlan.days[selectedDayIndex] || activePlan.days[0] : null;

  useEffect(() => {
    setSelectedDayIndex(0);
  }, [activePlan]);

  const isLoadingPlan = status === 'loading';
  const isReady = status === 'success' && hasPlan;
  const showError = status === 'error' || (status === 'success' && !hasPlan);
  const preparedErrorMessage =
    errorMessage ||
    (!hasPlan && status === 'success'
      ? 'We could not format the AI plan. Please try again.'
      : 'We were unable to generate your plan. Please try again.');

  const heroTitle = isReady
    ? 'Your personalized meal plan is ready! 🎉'
    : isLoadingPlan
      ? 'Your plan is being prepared'
      : 'We hit a snag generating your plan';

  const heroSubtitle = isReady
    ? 'Here’s a full week of meals aligned with your goals, taste, and schedule.'
    : isLoadingPlan
      ? 'Hang tight while our AI chef assembles the perfect routine for you.'
      : 'Please try again in a moment or tweak your answers.';

  const dailyTargetsText = hasPlan
    ? `${activePlan.calorieTarget} kcal • P ${activePlan.macroTargets.protein}g • C ${activePlan.macroTargets.carbs}g • F ${activePlan.macroTargets.fat}g`
    : 'Waiting for the AI plan...';

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
          {heroTitle}
        </Motion.h2>
        <Motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-gray-600 dark:text-gray-300"
        >
          {heroSubtitle}
        </Motion.p>
        {isReady && (
          <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-3 flex justify-center"
          >
            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#1B5E20] dark:bg-emerald-500/20 dark:text-emerald-200">
              AI generated
            </span>
          </Motion.div>
        )}
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
              {dailyTargetsText}
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

      {isLoadingPlan && (
        <Motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="rounded-3xl border border-gray-200 bg-white/95 p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
        >
          <div className="mx-auto mb-4 h-16 w-16 rounded-full border-4 border-[#A5D6A7]/40 border-t-[#2E3A59] animate-spin" />
          <h3 className="text-xl font-semibold text-[#2E3A59] dark:text-gray-100">
            Your plan is being prepared
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This usually takes under a minute. We’ll drop your meals here the second they’re ready.
          </p>
        </Motion.div>
      )}

      {showError && (
        <Motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="rounded-3xl border border-red-200 bg-red-50/80 p-6 text-red-900 shadow-sm dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100"
        >
          <h3 className="text-lg font-semibold">We couldn’t finish your plan</h3>
          <p className="mt-2 text-sm">{preparedErrorMessage}</p>
          <p className="mt-1 text-sm">
            You can go back to adjust your answers or hit “Create My Plan” again to retry.
          </p>
          {rawPlanText && (
            <details className="mt-4 select-text rounded-2xl border border-red-200/70 bg-white/40 px-4 py-3 text-sm text-gray-700 dark:border-red-500/30 dark:bg-slate-900/60 dark:text-gray-300">
              <summary className="cursor-pointer font-semibold text-[#2E3A59] dark:text-gray-100">
                View raw AI response
              </summary>
              <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed">{rawPlanText}</pre>
            </details>
          )}
        </Motion.div>
      )}

      {isReady && (
        <Motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="space-y-6"
        >
          <div className="flex flex-col gap-6 rounded-3xl border border-gray-200 bg-white/95 p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#2E3A59] dark:text-gray-100">
                  Explore your week
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Swipe through the week and pick a day to reveal its full menu, nutrition breakdown, and quick actions.
                </p>
              </div>
              <div className="rounded-2xl bg-[#A5D6A7]/20 px-4 py-3 text-sm text-[#2E3A59] dark:bg-emerald-500/10 dark:text-emerald-200">
                <div className="font-semibold">Daily target</div>
                <div>
                  {activePlan.calorieTarget} kcal • P {activePlan.macroTargets.protein}g • C {activePlan.macroTargets.carbs}g • F {activePlan.macroTargets.fat}g
                </div>
              </div>
            </div>

            <DayCarousel
              days={activePlan.days}
              targetCalories={activePlan.calorieTarget}
              selectedIndex={selectedDayIndex}
              onSelect={setSelectedDayIndex}
            />
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white/95 p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/80">
            <SelectedDayPlan
              day={selectedDay}
              targetCalories={activePlan.calorieTarget}
              macroTargets={activePlan.macroTargets}
            />
            {rawPlanText && (
              <details className="mt-6 select-text rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-gray-300">
                <summary className="cursor-pointer font-semibold text-[#2E3A59] dark:text-gray-100">
                  View full AI response
                </summary>
                <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed">{rawPlanText}</pre>
              </details>
            )}
          </div>
        </Motion.div>
      )}
    </Motion.div>
  );
}
