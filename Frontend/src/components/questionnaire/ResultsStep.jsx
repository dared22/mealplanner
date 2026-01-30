import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  CheckCircle, RefreshCw, ChevronLeft, ChevronRight,
  Shuffle, MoreHorizontal, Sun, Coffee, Utensils, Moon,
  Info, ChevronDown, ChevronUp
} from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

// Profile Summary Component
const ProfileSummary = memo(function ProfileSummary({ data, calorieTarget, t, onRestart }) {
  const translate = t || ((v) => v);

  const getActivityText = (level) => ({
    sedentary: translate('Sedentary'),
    lightly_active: translate('Lightly Active'),
    moderately_active: translate('Moderately Active'),
    very_active: translate('Very Active'),
    extremely_active: translate('Extremely Active')
  }[level] || level);

  const getGoalText = (goal) => ({
    lose_weight: translate('Lose weight'),
    maintain_weight: translate('Maintain weight'),
    gain_weight: translate('Gain weight'),
    build_muscle: translate('Build muscle'),
    improve_health: translate('Improve health')
  }[goal] || goal);

  return (
    <div className="profile-summary">
      {/* Header */}
      <div className="profile-summary-header">
        <div className="profile-summary-header-left">
          <div className="profile-summary-icon">
            <Info className="w-4 h-4" />
          </div>
          <span className="profile-summary-title">
            {translate('Your Profile Summary')}
          </span>
        </div>
        {onRestart && (
          <button type="button" className="profile-summary-cta" onClick={onRestart}>
            {translate('Retake questionnaire')}
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="profile-summary-grid">
        <div className="profile-summary-card">
          <span className="profile-summary-label">{translate('Physical Stats')}</span>
          <span className="profile-summary-value">
            {data.age || '—'} {translate('yrs')} • {data.height || '—'}cm • {data.weight || '—'}kg
          </span>
        </div>

        <div className="profile-summary-card">
          <span className="profile-summary-label">{translate('Activity & Goal')}</span>
          <span className="profile-summary-value">
            {getActivityText(data.activity_level)} • {getGoalText(data.nutrition_goal)}
          </span>
        </div>

        <div className="profile-summary-card">
          <span className="profile-summary-label">{translate('Daily Targets')}</span>
          <span className="profile-summary-value">
            {calorieTarget} kcal <span className="text-muted-foreground">/ day</span>
          </span>
        </div>
      </div>
    </div>
  );
});

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const MACRO_COLORS = { protein: '#3D5A3D', carbs: '#22c55e', fat: '#f97316' };

const MEAL_ICONS = {
  Breakfast: Coffee,
  Lunch: Sun,
  Dinner: Utensils,
  Snacks: Moon
};

const formatIngredient = (value) => {
  // Prefer structured objects from the backend (name, quantity, unit, notes).
  if (value && typeof value === 'object') {
    const qty = value.quantity;
    const unit = value.unit;
    const name = value.name || '';
    const notes = value.notes || '';

    const parts = [];
    // Ensure each part is properly converted to string and trimmed
    if (qty !== undefined && qty !== null && qty !== '') {
      parts.push(String(qty));
    }
    if (unit) {
      parts.push(String(unit).trim());
    }
    if (name) {
      parts.push(String(name).trim());
    }

    // Join with spaces and normalize any multiple spaces to single space
    const text = parts.join(' ').replace(/\s+/g, ' ').trim();
    return notes ? `${text} (${notes})` : text;
  }
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const toTitleCase = (value) => {
  if (!value) return '';
  return value.toString().replace(/_/g, ' ').split(' ')
    .map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
};

const normalizeServerPlan = (plan, t) => {
  const translate = t || ((v) => v);
  if (!plan?.days?.length) return null;

  const normalizedDays = WEEK_DAYS.map((weekday) => {
    const match = plan.days.find((d) => d?.name?.toLowerCase() === weekday.toLowerCase());
    const macros = match?.macros || {};
      const meals = MEAL_TYPES.reduce((acc, mealType) => {
        const src = match?.meals?.[mealType];
        const hasContent = src && (src.name || src.ingredients?.length || src.calories);
        if (mealType === 'Snacks' && !hasContent) {
          acc[mealType] = null;
        return acc;
      }
      const safeMeal = src || {};
      acc[mealType] = {
        id: safeMeal.id,
        name: safeMeal.name || translate('{mealType} option', { mealType: translate(mealType) }),
        calories: Number(safeMeal.calories) || 0,
        protein: Number(safeMeal.protein) || 0,
        carbs: Number(safeMeal.carbs) || 0,
        fat: Number(safeMeal.fat) || 0,
        cookTime: safeMeal.cookTime || '20 min',
        ingredients: Array.isArray(safeMeal.ingredients) ? safeMeal.ingredients : [],
        instructions: safeMeal.instructions || '',
      };
      return acc;
    }, {});
    return {
      name: match?.name || weekday,
      calories: Number(match?.calories) || 0,
      macros: { protein: Number(macros.protein) || 0, carbs: Number(macros.carbs) || 0, fat: Number(macros.fat) || 0 },
      meals
    };
  });

  const macroTargets = {
    protein: Number(plan?.macroTargets?.protein) || 0,
    carbs: Number(plan?.macroTargets?.carbs) || 0,
    fat: Number(plan?.macroTargets?.fat) || 0
  };
  const calorieTarget = Number(plan?.calorieTarget) || Math.round(normalizedDays.reduce((s, d) => s + (d.calories || 0), 0) / Math.max(normalizedDays.length, 1));

  return { calorieTarget, macroTargets, days: normalizedDays };
};

// Day Card for carousel
const DayCard = memo(function DayCard({ day, targetCalories, isActive, onSelect, dayNumber, t }) {
  const translate = t || ((v) => v);
  const mealCount = Object.values(day.meals || {}).filter(Boolean).length;

  return (
    <Motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      className={`day-card ${isActive ? 'active' : ''}`}
    >
      {/* Icon */}
      <div className="day-icon">
        <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </div>

      {/* Label */}
      <span className="day-label">{translate('Day')} {dayNumber}</span>

      {/* Day Name */}
      <h3 className="day-name">{translate(day.name)}</h3>

      {/* Dots representing meals */}
      <div className="day-dots">
        {[...Array(mealCount)].map((_, i) => (
          <span key={i} className="day-dot" />
        ))}
      </div>

      {/* Stats */}
      <div className="day-stats">
        <span className="day-kcal">{day.calories} kcal</span>
        <span className="day-macro">P{day.macros.protein}g</span>
      </div>
    </Motion.button>
  );
});

// Meal Item for the list
const MealItem = memo(function MealItem({ meal, mealType, onSwap, t }) {
  const translate = t || ((v) => v);
  const [showMore, setShowMore] = useState(false);

  if (!meal) return null;

  const Icon = MEAL_ICONS[mealType] || Utensils;
  const hasDetails = meal.instructions || (meal.ingredients && meal.ingredients.length > 0);

  return (
    <div className="meal-item-wrapper">
      <div className="meal-item">
        <div className="meal-icon">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="meal-content">
          <span className="meal-type">{translate(mealType)}</span>
          <h4 className="meal-name">{meal.name}</h4>
          <div className="meal-meta">
            <span>{meal.calories} kcal</span>
            <span>P{meal.protein}g</span>
            <span>C{meal.carbs}g</span>
            <span>F{meal.fat}g</span>
          </div>
        </div>
        <div className="meal-actions">
          {hasDetails && (
            <button
              onClick={() => setShowMore(!showMore)}
              className="meal-action"
              title={showMore ? translate('Show less') : translate('Show more')}
            >
              {showMore ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          )}
          <button onClick={onSwap} className="meal-action" title={translate('Swap meal')}>
            <Shuffle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showMore && hasDetails && (
        <Motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="meal-details"
        >
          {meal.ingredients && meal.ingredients.length > 0 && (
            <div className="meal-section">
              <h5 className="meal-section-title">{translate('Ingredients')}</h5>
              <ul className="meal-list">
                {meal.ingredients.map((ingredient, idx) => (
                  <li key={idx} className="meal-list-item">{formatIngredient(ingredient)}</li>
                ))}
              </ul>
            </div>
          )}

          {meal.instructions && (
            <div className="meal-section">
              <h5 className="meal-section-title">{translate('Instructions')}</h5>
              <p className="meal-instructions">{meal.instructions}</p>
            </div>
          )}
        </Motion.div>
      )}
    </div>
  );
});

// Macro Balance Panel
const MacroPanel = memo(function MacroPanel({ macros, targets, t }) {
  const translate = t || ((v) => v);

  const macroData = [
    { key: 'protein', label: translate('Protein'), value: macros.protein, target: targets.protein, color: MACRO_COLORS.protein },
    { key: 'carbs', label: translate('Carbs'), value: macros.carbs, target: targets.carbs, color: MACRO_COLORS.carbs },
    { key: 'fat', label: translate('Fat'), value: macros.fat, target: targets.fat, color: MACRO_COLORS.fat },
  ];

  return (
    <div className="macro-panel">
      <div className="macro-panel-header">
        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <span className="text-sm font-semibold text-foreground">{translate('Macro Balance')}</span>
      </div>

      {macroData.map(({ key, label, value, target, color }) => (
        <div key={key} className="macro-row">
          <div className="macro-label">
            <span className="macro-dot" style={{ backgroundColor: color }} />
            <span className="macro-name">{label}</span>
          </div>
          <div className="macro-bar">
            <div
              className="macro-fill"
              style={{
                width: `${Math.min((value / Math.max(target, 1)) * 100, 100)}%`,
                backgroundColor: color
              }}
            />
          </div>
          <div className="macro-value">
            <span className="macro-amount">{value}g</span>
            <span className="macro-target">/ {target}g</span>
          </div>
        </div>
      ))}
    </div>
  );
});

// Day Carousel
const DayCarousel = memo(function DayCarousel({ days, targetCalories, selectedIndex, onSelect, t }) {
  const trackRef = useRef(null);
  const [canScroll, setCanScroll] = useState({ prev: false, next: false });

  const checkScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const { scrollLeft, scrollWidth, clientWidth } = track;
    setCanScroll({ prev: scrollLeft > 12, next: scrollLeft < scrollWidth - clientWidth - 12 });
  }, []);

  useEffect(() => { checkScroll(); }, [checkScroll, days.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener('scroll', checkScroll, { passive: true });
    return () => track.removeEventListener('scroll', checkScroll);
  }, [checkScroll]);

  useEffect(() => {
    const track = trackRef.current;
    const node = track?.children[selectedIndex];
    node?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedIndex]);

  const scroll = (dir) => trackRef.current?.scrollBy({ left: dir * trackRef.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scroll(-1)}
        disabled={!canScroll.prev}
        className="absolute left-0 top-1/2 z-10 -translate-y-1/2 hidden lg:flex btn-icon disabled:opacity-30"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div ref={trackRef} className="flex gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory py-2 px-1">
        {days.map((day, idx) => (
          <DayCard
            key={day.name}
            day={day}
            targetCalories={targetCalories}
            isActive={idx === selectedIndex}
            onSelect={() => onSelect(idx)}
            dayNumber={idx + 1}
            t={t}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => scroll(1)}
        disabled={!canScroll.next}
        className="absolute right-0 top-1/2 z-10 -translate-y-1/2 hidden lg:flex btn-icon disabled:opacity-30"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
});

// Main ResultsStep Component
export default function ResultsStep({
  data,
  plan,
  rawPlanText,
  status = 'idle',
  errorMessage,
  onRegenerate,
  regenerateDisabled = false,
  onRestart
}) {
  const { t } = useLanguage();
  const activePlan = useMemo(() => normalizeServerPlan(plan, t), [plan, t]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [planOverrides, setPlanOverrides] = useState({});

  const displayPlan = useMemo(() => {
    if (!activePlan) return null;
    return {
      ...activePlan,
      days: activePlan.days.map((day, idx) => {
        const overrides = planOverrides[idx];
        return overrides ? { ...day, meals: { ...day.meals, ...overrides } } : day;
      })
    };
  }, [activePlan, planOverrides]);

  const swapPools = useMemo(() => {
    if (!activePlan?.days) return {};
    return MEAL_TYPES.reduce((acc, mealType) => {
      acc[mealType] = activePlan.days.map((d) => d?.meals?.[mealType]).filter(Boolean);
      return acc;
    }, {});
  }, [activePlan]);

  const hasPlan = Boolean(displayPlan?.days?.length);
  const selectedDay = hasPlan ? displayPlan.days[selectedDayIndex] || displayPlan.days[0] : null;

  useEffect(() => { setSelectedDayIndex(0); setPlanOverrides({}); }, [activePlan]);

  const isLoading = status === 'loading';
  const isReady = status === 'success' && hasPlan;
  const showError = status === 'error' || (status === 'success' && !hasPlan);

  const handleSwap = useCallback((dayIndex, mealType) => {
    const pool = swapPools[mealType] || [];
    if (pool.length <= 1) return;
    const currentMeal = displayPlan?.days?.[dayIndex]?.meals?.[mealType];
    const filtered = currentMeal
      ? pool.filter((o) => {
          if (o?.id && currentMeal?.id) return o.id !== currentMeal.id;
          return o?.name !== currentMeal?.name;
        })
      : pool;
    const candidates = filtered.length ? filtered : pool;
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    if (!next) return;
    setPlanOverrides((prev) => ({ ...prev, [dayIndex]: { ...(prev[dayIndex] || {}), [mealType]: { ...next } } }));
  }, [displayPlan, swapPools]);

  const getGoalText = (goal) => ({
    lose_weight: t('Lose Weight'),
    maintain_weight: t('Maintain Weight'),
    gain_weight: t('Gain Weight'),
    build_muscle: t('Build Muscle'),
    improve_health: t('Improve Health')
  }[goal] || toTitleCase(goal));

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary flex items-center justify-center">
          {isLoading ? (
            <RefreshCw className="w-10 h-10 text-white animate-spin" />
          ) : (
            <CheckCircle className="w-10 h-10 text-white" />
          )}
        </div>

        <h1 className="headline-serif mb-3">
          {isReady ? (
            <>{t('Your')} <span className="accent">{t('meal plan')}</span> {t('is ready')}</>
          ) : isLoading ? (
            <>{t('Preparing your')} <span className="accent">{t('plan')}</span>...</>
          ) : (
            <>{t('Something went')} <span className="accent">{t('wrong')}</span></>
          )}
        </h1>

        <p className="text-muted-foreground text-lg max-w-lg mx-auto">
          {isReady
            ? t('Balanced menus aligned with your goals and preferences.')
            : isLoading
            ? t("We're assembling your personalized plan.")
            : t('Please try again or adjust your preferences.')}
        </p>

        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isLoading || regenerateDisabled}
            className="btn-secondary mt-6"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? t('Generating...') : t('Regenerate')}
          </button>
        )}
      </Motion.div>

      {/* Loading State */}
      {isLoading && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-12 rounded-2xl bg-card border border-border text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-border border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground">{t('This usually takes less than a minute.')}</p>
        </Motion.div>
      )}

      {/* Error State */}
      {showError && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900"
        >
          <h3 className="font-semibold text-red-900 dark:text-red-200">{t("We couldn't finalize your plan")}</h3>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {errorMessage || t('Please adjust your answers or try generating again.')}
          </p>
        </Motion.div>
      )}

      {/* Dashboard Content */}
      {isReady && (
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <ProfileSummary data={data} calorieTarget={displayPlan.calorieTarget} t={t} onRestart={onRestart} />

          {/* Weekly Overview Section */}
          <div className="p-6 rounded-2xl bg-card border border-border">
            <div className="section-header">
              <div>
                <span className="section-subtitle">{t('Week Overview')}</span>
                <h2 className="section-title">{t('Your Weekly Plan')}</h2>
              </div>
              <button className="btn-icon">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            <DayCarousel
              days={displayPlan.days}
              targetCalories={displayPlan.calorieTarget}
              selectedIndex={selectedDayIndex}
              onSelect={setSelectedDayIndex}
              t={t}
            />
          </div>

          {/* Selected Day Details */}
          {selectedDay && (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Meals List */}
              <div className="lg:col-span-2 p-6 rounded-2xl bg-card border border-border">
                <div className="section-header mb-4">
                  <div>
                    <span className="section-subtitle">{t(selectedDay.name)}</span>
                    <h2 className="section-title">{t("Today's Meals")}</h2>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {MEAL_TYPES.filter(type => selectedDay.meals?.[type]).map((mealType) => (
                    <MealItem
                      key={`${selectedDay.name}-${mealType}`}
                      meal={selectedDay.meals[mealType]}
                      mealType={mealType}
                      onSwap={() => handleSwap(selectedDayIndex, mealType)}
                      t={t}
                    />
                  ))}
                </div>
              </div>

              {/* Macro Balance Sidebar */}
              <div className="space-y-6">
                <MacroPanel
                  macros={selectedDay.macros}
                  targets={displayPlan.macroTargets}
                  t={t}
                />

                {/* Day Summary Card */}
                <div className="p-6 rounded-2xl bg-accent">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">{t('Day Summary')}</span>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('Total Calories')}</span>
                      <span className="font-semibold text-foreground">{selectedDay.calories} kcal</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('Target')}</span>
                      <span className="font-semibold text-foreground">{displayPlan.calorieTarget} kcal</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('Difference')}</span>
                      <span className={`font-semibold ${selectedDay.calories <= displayPlan.calorieTarget ? 'text-primary' : 'text-orange-500'}`}>
                        {selectedDay.calories - displayPlan.calorieTarget > 0 ? '+' : ''}{selectedDay.calories - displayPlan.calorieTarget} kcal
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Raw Response (collapsible for debug) */}
          {rawPlanText && (
            <details className="p-4 rounded-2xl bg-secondary text-sm">
              <summary className="cursor-pointer font-semibold text-foreground">{t('View AI Response')}</summary>
              <pre className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground overflow-auto max-h-64">{rawPlanText}</pre>
            </details>
          )}
        </Motion.div>
      )}
    </div>
  );
}
