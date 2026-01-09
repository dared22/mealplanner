import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { CheckCircle, Sparkles, Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';

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

function buildInstructionSteps(meal = {}, t) {
  const translate = t || ((value, vars) => value);
  const baseText = typeof meal.instructions === 'string' ? meal.instructions : '';
  const cleaned = baseText.replace(/\s+/g, ' ').trim();
  const sentences = cleaned
    ? cleaned
        .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
        .map(step => step.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean)
    : [];

  const ingredients = Array.isArray(meal.ingredients) ? meal.ingredients.filter(Boolean) : [];

  if (ingredients.length) {
    const preview = ingredients.slice(0, 6).join(', ');
    sentences.unshift(translate('Gather ingredients: {items}.', { items: preview }));
  }

  if (meal.cookTime) {
    sentences.push(translate('Aim to finish in about {time}.', { time: meal.cookTime }));
  }

  if (!sentences.length) {
    sentences.push(
      translate('Follow your go-to method for this dish and season to taste.')
    );
  }

  return sentences.slice(0, 6);
}

function normalizeServerPlan(plan, t) {
  const translate = t || ((value, vars) => value);
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.days) || !plan.days.length) {
    return null;
  }

  const normalizedDays = WEEK_DAYS.map((weekday) => {
    const match = plan.days.find(
      (day) => typeof day?.name === 'string' && day.name.toLowerCase() === weekday.toLowerCase()
    );

    const macros = match?.macros || {};
    const meals = MEAL_TYPES.reduce((acc, mealType) => {
      const sourceMeal = match?.meals?.[mealType] || null;
      const hasContent =
        sourceMeal &&
        (
          sourceMeal.name ||
          (Array.isArray(sourceMeal.ingredients) && sourceMeal.ingredients.length > 0) ||
          (Array.isArray(sourceMeal.tags) && sourceMeal.tags.length > 0) ||
          sourceMeal.instructions ||
          sourceMeal.calories ||
          sourceMeal.protein ||
          sourceMeal.carbs ||
          sourceMeal.fat
        );

      if (mealType === 'Snacks' && !hasContent) {
        acc[mealType] = null;
        return acc;
      }

      const safeMeal = sourceMeal || {};
      acc[mealType] = {
        name:
          safeMeal.name ||
          translate('{mealType} option', { mealType: translate(mealType) }),
        calories: Number(safeMeal.calories) || 0,
        protein: Number(safeMeal.protein) || 0,
        carbs: Number(safeMeal.carbs) || 0,
        fat: Number(safeMeal.fat) || 0,
        cookTime: safeMeal.cookTime || '20 min',
        tags: Array.isArray(safeMeal.tags) ? safeMeal.tags.slice(0, 6) : [],
        ingredients: Array.isArray(safeMeal.ingredients) ? safeMeal.ingredients : [],
        instructions: typeof safeMeal.instructions === 'string' ? safeMeal.instructions.trim() : ''
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

function formatTagLabel(tag, t) {
  const translate = t || ((value) => value);
  if (!tag) return '';
  const normalized = toTitleCase(tag).replace(/\b(Budgetfriendly)\b/i, 'Budget friendly');
  return translate(normalized);
}

function DailyDonut({ value, target, unitLabel }) {
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
        <span className="text-[9px] text-gray-500 dark:text-gray-400">{unitLabel}</span>
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

function MealCard({
  meal,
  mealType,
  showMealType = false,
  className = '',
  onSwap,
  isSwapAvailable = true,
  t
}) {
  const [showDetails, setShowDetails] = useState(false);
  const translate = t || ((value) => value);

  if (!meal) return null;

  const tags = Array.isArray(meal.tags) ? meal.tags.filter(Boolean) : [];
  const hasIngredients = Array.isArray(meal.ingredients) && meal.ingredients.length > 0;
  const instructionSteps = useMemo(() => buildInstructionSteps(meal, translate), [meal, translate]);
  const displayMealType = translate(mealType);

  return (
    <div className={`flex h-full flex-col gap-3 rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/80 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {showMealType && (
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {displayMealType}
            </div>
          )}
          <div className="text-sm font-semibold text-[#2E3A59] dark:text-gray-100">
            {meal.name}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {meal.calories} {translate('kcal')} • P {meal.protein}g • C {meal.carbs}g • F {meal.fat}g
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#A5D6A7]/20 px-3 py-1 text-[11px] font-semibold text-[#1B5E20] shadow-sm whitespace-nowrap dark:bg-emerald-500/10 dark:text-emerald-200">
          {meal.cookTime ? `${meal.cookTime}` : translate('Timing not provided')}
        </span>
      </div>

      {tags.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,max-content))] gap-2">
          {tags.map(tag => (
            <span
              key={tag}
              className="rounded-2xl bg-[#A5D6A7]/25 px-3 py-1 text-[11px] font-semibold text-[#1B5E20] shadow-sm dark:bg-emerald-500/10 dark:text-emerald-200"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: '1.2',
                textAlign: 'center',
              }}
            >
              {formatTagLabel(tag, translate)}
            </span>
          ))}
        </div>
      )}

      {hasIngredients && (
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-[#2E3A59] dark:text-gray-200">{translate('Ingredients')}:</span>{' '}
          {meal.ingredients.slice(0, 6).join(', ')}
        </div>
      )}

      {showDetails && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600 shadow-inner transition-colors dark:border-slate-700 dark:bg-slate-800/60 dark:text-gray-300">
          <div className="font-semibold text-[#2E3A59] dark:text-gray-100">{translate('Instructions')}</div>
          <ol className="mt-1 list-decimal list-inside space-y-1 leading-relaxed">
            {instructionSteps.map((step, idx) => (
              <li key={`${meal.name}-step-${idx}`}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onSwap}
          disabled={!isSwapAvailable}
          className="flex-1 rounded-full border border-[#A5D6A7]/60 px-3 py-1.5 text-xs font-medium text-[#2E3A59] transition hover:bg-[#A5D6A7]/20 disabled:pointer-events-none disabled:opacity-50 dark:border-emerald-400/40 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
        >
          {translate('Swap meal')}
        </button>
        <button
          type="button"
          onClick={() => setShowDetails(prev => !prev)}
          className="flex-1 rounded-full border border-[#A5D6A7]/60 px-3 py-1.5 text-xs font-medium text-[#2E3A59] transition hover:bg-[#A5D6A7]/20 dark:border-emerald-400/40 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
        >
          {showDetails ? translate('Hide details') : translate('Details')}
        </button>
        <button className="flex-1 rounded-full border border-[#FF6F61]/60 px-3 py-1.5 text-xs font-semibold text-[#FF6F61] transition hover:bg-[#FF6F61]/10 dark:border-rose-400/50 dark:text-rose-300 dark:hover:bg-rose-500/10">
          {translate('Add to list')}
        </button>
      </div>
    </div>
  );
}

function DayCard({ day, targetCalories, isActive, onSelect, className = '', t }) {
  const translate = t || ((value, vars) => value);
  const dayIndex = WEEK_DAYS.indexOf(day.name);
  const dayNumber = dayIndex >= 0 ? dayIndex + 1 : '—';
  const dayLabel = translate(day.name);

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
          <DailyDonut value={day.calories} target={targetCalories} unitLabel={translate('kcal')} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8ea0c8] dark:text-slate-400">
            {translate('Day {number}', { number: dayNumber })}
          </p>
          <h4 className="text-lg font-semibold text-[#1f2d4c] dark:text-gray-100">
            {dayLabel}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {translate('{calories} / {target} kcal planned', {
              calories: day.calories,
              target: targetCalories,
            })}
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
        <span className="text-[11px]">
          {isActive ? translate('Viewing full plan') : translate('Preview this day')}
        </span>
        <span className="text-[10px] font-semibold text-[#1B5E20] dark:text-emerald-300">
          {isActive ? translate('Active') : translate('Preview')}
        </span>
      </div>
    </Motion.button>
  );
}

function SelectedDayPlan({ day, targetCalories, macroTargets, onSwapMeal, swapAvailability, t }) {
  const translate = t || ((value, vars) => value);
  if (!day) return null;

  const availableMealTypes = MEAL_TYPES.filter(type => day.meals?.[type]);
  const highlightTags = Array.from(
    new Set(
      availableMealTypes.flatMap(type => day.meals[type]?.tags || [])
    )
  ).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 rounded-3xl border border-[#A5D6A7]/25 bg-gradient-to-br from-white via-[#F8FBF8] to-white p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900/80 dark:to-slate-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-5">
            <div className="rounded-3xl bg-[#A5D6A7]/25 p-4 dark:bg-emerald-500/10">
              <DailyDonut value={day.calories} target={targetCalories} unitLabel={translate('kcal')} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#97A0C2] dark:text-slate-400">
                {translate('Daily summary')}
              </p>
              <h4 className="text-xl font-semibold text-[#1f2a44] dark:text-gray-100">
                {translate(day.name)}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {translate('{calories} of {target} kcal planned • P {protein}g • C {carbs}g • F {fat}g', {
                  calories: day.calories,
                  target: targetCalories,
                  protein: day.macros.protein,
                  carbs: day.macros.carbs,
                  fat: day.macros.fat,
                })}
              </p>
            </div>
          </div>
          <div className="min-w-[240px] rounded-2xl border border-[#A5D6A7]/40 bg-white/80 p-5 dark:border-emerald-500/15 dark:bg-slate-900/70">
            <h5 className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-400 dark:text-slate-500">
              {translate('Macro balance')}
            </h5>
            <div className="mt-3">
              <DailyMacroBars macros={day.macros} targets={macroTargets} />
            </div>
          </div>
        </div>
        {highlightTags.length > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(110px,max-content))] gap-2">
              {highlightTags.map(tag => (
                <span
                  key={tag}
                  className="rounded-2xl bg-[#A5D6A7]/25 px-3 py-1 text-[11px] font-semibold text-[#1B5E20] shadow-sm dark:bg-emerald-500/10 dark:text-emerald-200"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: '1.2',
                    textAlign: 'center',
                  }}
                >
                  {formatTagLabel(tag, translate)}
                </span>
              ))}
            </div>
            <span className="mt-2 block text-[11px]">
              {translate('Aligned to your cooking time and budget preferences.')}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {availableMealTypes.map(mealType => (
          <MealCard
            key={`${day.name}-${mealType}`}
            meal={day.meals[mealType]}
            mealType={mealType}
            showMealType
            className="md:min-h-[240px]"
            onSwap={onSwapMeal ? () => onSwapMeal(mealType) : undefined}
            isSwapAvailable={swapAvailability?.[mealType]}
            t={translate}
          />
        ))}
      </div>
    </div>
  );
}

function DayCarousel({ days, targetCalories, selectedIndex, onSelect, t }) {
  const trackRef = useRef(null);
  const [scrollState, setScrollState] = useState({ prev: false, next: false });
  const translate = t || ((value, vars) => value);

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
            t={translate}
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

export default function ResultsStep({
  data,
  plan,
  rawPlanText,
  status = 'idle',
  errorMessage,
  onRegenerate,
  regenerateDisabled = false
}) {
  const { t } = useLanguage();
  const activePlan = useMemo(() => normalizeServerPlan(plan, t), [plan, t]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [planOverrides, setPlanOverrides] = useState({});
  const [showAllCuisines, setShowAllCuisines] = useState(false);
  const [showAllDietary, setShowAllDietary] = useState(false);

  const displayPlan = useMemo(() => {
    if (!activePlan) return null;
    return {
      ...activePlan,
      days: activePlan.days.map((day, index) => {
        const overrides = planOverrides[index];
        if (!overrides) return day;
        return {
          ...day,
          meals: {
            ...day.meals,
            ...overrides
          }
        };
      })
    };
  }, [activePlan, planOverrides]);

  const swapPools = useMemo(() => {
    if (!activePlan?.days) return {};
    return MEAL_TYPES.reduce((acc, mealType) => {
      acc[mealType] = activePlan.days
        .map(day => day?.meals?.[mealType])
        .filter(Boolean);
      return acc;
    }, {});
  }, [activePlan]);

  const swapAvailability = useMemo(() => {
    return MEAL_TYPES.reduce((acc, mealType) => {
      acc[mealType] = (swapPools[mealType] || []).length > 1;
      return acc;
    }, {});
  }, [swapPools]);

  const hasPlan = Boolean(displayPlan?.days?.length);
  const selectedDay = hasPlan ? displayPlan.days[selectedDayIndex] || displayPlan.days[0] : null;

  useEffect(() => {
    setSelectedDayIndex(0);
    setPlanOverrides({});
  }, [activePlan]);

  const isLoadingPlan = status === 'loading';
  const isRegenerating = isLoadingPlan || regenerateDisabled;
  const isReady = status === 'success' && hasPlan;
  const showError = status === 'error' || (status === 'success' && !hasPlan);
  const preparedErrorMessage =
    errorMessage ||
    (!hasPlan && status === 'success'
      ? t('We could not finalize your plan. Please try again.')
      : t('We were unable to generate your plan. Please try again.'));

  const heroTitle = isReady
    ? t('Your customized weekly meal plan is prepared.')
    : isLoadingPlan
      ? t('Preparing your plan')
      : t("We couldn't finalize your plan");

  const heroSubtitle = isReady
    ? t('Balanced menus aligned with your goals, schedule, and preferences.')
    : isLoadingPlan
      ? t("We're assembling your plan. This usually takes less than a minute.")
      : t('Please adjust your answers or try again.');

  const dailyTargetsText = hasPlan
    ? `${displayPlan.calorieTarget} kcal • P ${displayPlan.macroTargets.protein}g • C ${displayPlan.macroTargets.carbs}g • F ${displayPlan.macroTargets.fat}g`
    : t('Waiting for the AI plan...');

  const cuisineList = (
    Array.isArray(data.preferred_cuisines) && data.preferred_cuisines.length
      ? data.preferred_cuisines
      : ['Seasonal']
  );

  const dietaryList = (
    Array.isArray(data.dietary_restrictions) && data.dietary_restrictions.length
      ? data.dietary_restrictions
      : ['None']
  );

  const cookingTimeLabel = useMemo(() => {
    const map = {
      under_15_min: t('Ready in under 15 minutes'),
      '15_30_min': t('Ready in 15–30 minutes'),
      '30_60_min': t('Ready in 30–60 minutes'),
      over_60_min: t('Takes over 60 minutes'),
    };
    return map[data.cooking_time_preference] || t('Balanced');
  }, [data.cooking_time_preference, t]);

  const budgetLabel = useMemo(() => {
    const map = {
      'budget friendly': t('Cost-efficient options'),
      moderate: t('Balanced budget'),
      premium: t('Premium ingredients'),
      no_limit: t('No defined budget'),
    };
    return map[data.budget_range] || t('Flexible');
  }, [data.budget_range, t]);

  useEffect(() => {
    setShowAllCuisines(false);
    setShowAllDietary(false);
  }, [cuisineList.join('|'), dietaryList.join('|')]);

  const handleSwap = useCallback((dayIndex, mealType) => {
    const pool = swapPools[mealType] || [];
    if (!pool.length) return;

    const currentMeal = displayPlan?.days?.[dayIndex]?.meals?.[mealType];
    const filtered = currentMeal ? pool.filter(option => option?.name !== currentMeal.name) : pool;
    const candidates = filtered.length ? filtered : pool;
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    if (!next) return;

    setPlanOverrides(prev => ({
      ...prev,
      [dayIndex]: {
        ...(prev[dayIndex] || {}),
        [mealType]: { ...next }
      }
    }));
  }, [displayPlan, swapPools]);

  const getActivityText = (level) => {
    const levels = {
      sedentary: t('Sedentary'),
      lightly_active: t('Lightly Active'),
      moderately_active: t('Moderately Active'),
      very_active: t('Very Active'),
      extremely_active: t('Extremely Active')
    };
    return levels[level] || toTitleCase(level);
  };

  const getGoalText = (goal) => {
    const goals = {
      lose_weight: t('Lose weight'),
      maintain_weight: t('Maintain weight'),
      gain_weight: t('Gain weight'),
      build_muscle: t('Build muscle'),
      improve_health: t('Improve health')
    };
    return goals[goal] || t(toTitleCase(goal));
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
              {t('AI-assisted plan')}
            </span>
          </Motion.div>
        )}
        {onRegenerate && (
          <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mt-4 flex justify-center"
          >
            <Button
              variant="outline"
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="rounded-full border-emerald-200 text-[#1B5E20] hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
            >
              {isRegenerating ? t('Generating...') : t('Regenerate plan')}
            </Button>
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
          <h3 className="font-semibold text-white">{t('Your Profile Summary')}</h3>
        </div>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl bg-white/15 p-4 text-white shadow-inner">
            <div className="font-medium">{t('Physical Stats')}</div>
            <div className="text-sm opacity-90">
              {data.age || '—'} {t('yrs')} • {data.height || '—'}cm • {data.weight || '—'}kg
            </div>
          </div>
          <div className="rounded-xl bg-white/15 p-4 text-white shadow-inner">
            <div className="font-medium">{t('Activity & Goal')}</div>
            <div className="text-sm opacity-90">
              {getActivityText(data.activity_level)} • {getGoalText(data.nutrition_goal)}
            </div>
          </div>
          <div className="rounded-xl bg-white/15 p-4 text-white shadow-inner">
            <div className="font-medium">{t('Daily Targets')}</div>
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
              {t('Weekly Plan Snapshot')}
            </h3>
          </div>
          <div className="grid grid-cols-[minmax(140px,1fr)_2fr] gap-y-3 gap-x-4 text-sm text-gray-600 dark:text-gray-300">
            <span className="text-gray-500">{t('Daily meal count')}</span>
            <span className="font-semibold text-[#2E3A59] dark:text-gray-100">
              {data.meals_per_day || 4}
            </span>

            <span className="text-gray-500">{t('Preferred cuisines')}</span>
            <div className="flex flex-col gap-2">
              {(showAllCuisines ? cuisineList : cuisineList.slice(0, 3)).map(cuisine => (
                <span
                  key={cuisine}
                  className="rounded-full bg-[#E9F7EC] px-3 py-1 text-[12px] font-semibold text-[#1B5E20] shadow-sm dark:bg-emerald-500/10 dark:text-emerald-100"
                >
                  {t(toTitleCase(cuisine))}
                </span>
              ))}
              {cuisineList.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllCuisines(prev => !prev)}
                  className="self-start text-[12px] font-semibold text-[#1B5E20] underline-offset-4 hover:underline dark:text-emerald-200"
                >
                  {showAllCuisines
                    ? t('Show less')
                    : `...${t('more ({count})', { count: cuisineList.length - 3 })}`}
                </button>
              )}
            </div>

            <span className="text-gray-500">{t('Dietary needs')}</span>
            <div className="flex flex-col gap-2">
              {(showAllDietary ? dietaryList : dietaryList.slice(0, 3)).map(restriction => (
                <span
                  key={restriction}
                  className={`rounded-full px-3 py-1 text-[12px] font-semibold shadow-sm ${
                    String(restriction).toLowerCase() === 'none'
                      ? 'bg-gray-100 text-gray-600 dark:bg-slate-800/80 dark:text-gray-300'
                      : 'bg-orange-50 text-orange-800 dark:bg-amber-500/10 dark:text-amber-100'
                  }`}
                >
                  {t(toTitleCase(restriction))}
                </span>
              ))}
              {dietaryList.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllDietary(prev => !prev)}
                  className="self-start text-[12px] font-semibold text-[#1B5E20] underline-offset-4 hover:underline dark:text-emerald-200"
                >
                  {showAllDietary
                    ? t('Show less')
                    : `...${t('more ({count})', { count: dietaryList.length - 3 })}`}
                </button>
              )}
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
              {t('Cooking preferences')}
            </h3>
          </div>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm dark:bg-slate-800/60 dark:text-slate-200">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('Cooking time')}
                </span>
                <span className="text-right font-semibold text-slate-900 dark:text-gray-100">
                  {cookingTimeLabel}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm dark:bg-slate-800/60 dark:text-slate-200">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('Budget focus')}
                </span>
                <span className="text-right font-semibold text-slate-900 dark:text-gray-100">
                  {budgetLabel}
                </span>
              </div>
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
            {t('Preparing your plan')}
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t("This usually takes under a minute. We'll surface your plan the moment it's ready.")}
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
          <h3 className="text-lg font-semibold">{t("We couldn't finalize your plan")}</h3>
          <p className="mt-2 text-sm">{preparedErrorMessage}</p>
          <p className="mt-1 text-sm">
            {t('Please adjust your answers or try generating your plan again.')}
          </p>
          {rawPlanText && (
            <details className="mt-4 select-text rounded-2xl border border-red-200/70 bg-white/40 px-4 py-3 text-sm text-gray-700 dark:border-red-500/30 dark:bg-slate-900/60 dark:text-gray-300">
              <summary className="cursor-pointer font-semibold text-[#2E3A59] dark:text-gray-100">
                {t('View raw AI response')}
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
                  {t('Weekly overview')}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('Navigate through your weekly overview and select a day to see nutrition details and actions.')}
                </p>
              </div>
              <div className="rounded-2xl bg-[#A5D6A7]/20 px-4 py-3 text-sm text-[#2E3A59] dark:bg-emerald-500/10 dark:text-emerald-200">
                <div className="font-semibold">{t('Daily target')}</div>
                <div>
                  {displayPlan.calorieTarget} kcal • P {displayPlan.macroTargets.protein}g • C {displayPlan.macroTargets.carbs}g • F {displayPlan.macroTargets.fat}g
                </div>
              </div>
            </div>

            <DayCarousel
              days={displayPlan.days}
              targetCalories={displayPlan.calorieTarget}
              selectedIndex={selectedDayIndex}
              onSelect={setSelectedDayIndex}
              t={t}
            />
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white/95 p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/80">
            <SelectedDayPlan
              day={selectedDay}
              targetCalories={displayPlan.calorieTarget}
              macroTargets={displayPlan.macroTargets}
              onSwapMeal={(mealType) => handleSwap(selectedDayIndex, mealType)}
              swapAvailability={swapAvailability}
              t={t}
            />
            {rawPlanText && (
              <details className="mt-6 select-text rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-gray-300">
                <summary className="cursor-pointer font-semibold text-[#2E3A59] dark:text-gray-100">
                  {t('View full AI response')}
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
