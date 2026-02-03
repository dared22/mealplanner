import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  CheckCircle, RefreshCw, ChevronLeft, ChevronRight,
  Shuffle, ThumbsUp, ThumbsDown, MoreHorizontal, Sun, Coffee, Utensils, Moon,
  Info, ChevronDown, ChevronUp, X, Sparkles, Wand2
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useLanguage } from '@/i18n/useLanguage';
import { useRatings } from '@/hooks/useRatings';

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
const GENERATION_STAGE_LABELS = {
  finding_recipes: 'Finding recipes...',
  optimizing_nutrition: 'Optimizing nutrition...',
  finalizing: 'Finalizing plan...'
};

const MEAL_ICONS = {
  Breakfast: Coffee,
  Lunch: Sun,
  Dinner: Utensils,
  Snacks: Moon
};

const GenerationBadge = memo(function GenerationBadge({ source, t }) {
  const translate = t || ((v) => v);

  if (!source) return null;

  // Only show a badge when a personalized (solver-based) plan is available.
  const isPersonalized = source === 'solver';
  if (!isPersonalized) return null;

  const label = translate('Personalized Plan');
  const description = translate('Optimized based on your ratings');

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
      <Sparkles className="w-3.5 h-3.5" />
      <span>{label}</span>
      <span className="hidden sm:inline text-muted-foreground">
        — {description}
      </span>
    </div>
  );
});

const ExplainabilityTooltip = memo(function ExplainabilityTooltip({ reasons, t }) {
  const translate = t || ((v) => v);
  const [isOpen, setIsOpen] = useState(false);

  if (!reasons) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="meal-action text-muted-foreground hover:text-primary"
        title={translate('Why this meal?')}
      >
        <Info className="w-4 h-4" />
      </button>

      {isOpen && (
        <Motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 top-full mt-2 w-64 p-3 rounded-lg bg-popover border border-border shadow-lg z-20"
        >
          <p className="text-sm font-medium mb-2">{translate('Why this recommendation?')}</p>
          <p className="text-xs text-muted-foreground mb-2">{reasons.summary}</p>

          {reasons.cuisine_preferences && Object.keys(reasons.cuisine_preferences).length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">{translate('Your favorites')}: </span>
              {Object.entries(reasons.cuisine_preferences)
                .map(([cuisine, count]) => `${cuisine} (${count})`)
                .join(', ')}
            </div>
          )}

          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        </Motion.div>
      )}
    </div>
  );
});

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
const DayCard = memo(function DayCard({ day, isActive, onSelect, dayNumber, t }) {
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
const MealItem = memo(function MealItem({
  meal,
  mealType,
  onSwap,
  t,
  recipeRating,
  onRate,
  ratingDisabled,
  recommendationReasons
}) {
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
              type="button"
              onClick={() => setShowMore(!showMore)}
              className="meal-action"
              title={showMore ? translate('Show less') : translate('Show more')}
            >
              {showMore ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          )}
          <button type="button" onClick={onSwap} className="meal-action" title={translate('Swap meal')}>
            <Shuffle className="w-5 h-5" />
          </button>
          {recommendationReasons && (
            <ExplainabilityTooltip reasons={recommendationReasons} t={t} />
          )}
          {meal.id && onRate && (
            <div className="flex gap-1 ml-2">
              <button
                type="button"
                onClick={() => onRate(meal.id, true)}
                disabled={ratingDisabled}
                className={`meal-action ${recipeRating?.is_liked === true ? 'text-green-500' : ''}`}
                title={translate('Like this meal')}
              >
                <ThumbsUp className={`w-4 h-4 ${recipeRating?.is_liked === true ? 'fill-current' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => onRate(meal.id, false)}
                disabled={ratingDisabled}
                className={`meal-action ${recipeRating?.is_liked === false ? 'text-red-500' : ''}`}
                title={translate('Dislike this meal')}
              >
                <ThumbsDown className={`w-4 h-4 ${recipeRating?.is_liked === false ? 'fill-current' : ''}`} />
              </button>
            </div>
          )}
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

const RatingProgress = memo(function RatingProgress({ progress, t }) {
  const translate = t || ((v) => v);
  const remaining = Math.max(progress.threshold - progress.total, 0);

  if (progress.is_unlocked) {
    return (
      <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            {translate('Personalized plans unlocked!')}
          </span>
        </div>
        <p className="mt-1 text-xs text-green-600 dark:text-green-400">
          {translate('Your next plan will be tailored to your preferences.')}
        </p>
      </div>
    );
  }

  const percentage = Math.min((progress.total / progress.threshold) * 100, 100);

  return (
    <div className="p-4 rounded-xl bg-accent border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">
          {translate('Unlock Personalized Plans')}
        </span>
        <span className="text-xs text-muted-foreground">
          {progress.total}/{progress.threshold}
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {remaining > 0
          ? translate('{count} more ratings to unlock', { count: remaining })
          : translate('Almost there!')}
      </p>
    </div>
  );
});


// Day Carousel
const DayCarousel = memo(function DayCarousel({ days, selectedIndex, onSelect, t }) {
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

// Swap Modal
const SwapModal = memo(function SwapModal({ isOpen, onClose, alternatives, loading, onSelect, currentMeal, t }) {
  const translate = t || ((v) => v);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <Motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{translate('Swap Meal')}</h3>
          <button onClick={onClose} className="btn-icon">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : alternatives.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            {translate('No alternatives found matching your preferences')}
          </p>
        ) : (
          <div className="space-y-3">
            {alternatives.map((alt) => (
              <button
                key={alt.id}
                onClick={() => onSelect(alt)}
                className="w-full p-4 rounded-xl border border-border hover:border-primary hover:bg-accent transition-colors text-left"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{alt.title}</h4>
                    <div className="text-sm text-muted-foreground mt-1">
                      {alt.calories} kcal • P{alt.protein}g • C{alt.carbs}g • F{alt.fat}g
                    </div>
                  </div>
                  {alt.is_liked && (
                    <ThumbsUp className="w-4 h-4 text-green-500 fill-current" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </Motion.div>
    </div>
  );
});

// Main ResultsStep Component
export default function ResultsStep({
  data,
  plan,
  rawPlanText,
  status = 'idle',
  generationStage: currentGenerationStage = null,
  generationSource = null,
  recommendationReasons = null,
  errorMessage,
  onRegenerate,
  regenerateDisabled = false,
  onRestart
}) {
  const { t } = useLanguage();
  const { getToken } = useAuth();
  const { progress, submitRating, getRating, loading: ratingLoading } = useRatings();
  const activePlan = useMemo(() => normalizeServerPlan(plan, t), [plan, t]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [planOverrides, setPlanOverrides] = useState({});
  const [generationStage, setGenerationStage] = useState(null);
  const [generationStartTime, setGenerationStartTime] = useState(null);
  const [showExtendedMessage, setShowExtendedMessage] = useState(false);
  const [swapModal, setSwapModal] = useState({ open: false, dayIndex: null, mealType: null, recipeId: null });
  const [alternatives, setAlternatives] = useState([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

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

  const isLoading = status === 'loading' || status === 'pending';
  const isReady = status === 'success' && hasPlan;
  const showError = status === 'error' || (status === 'success' && !hasPlan);

  useEffect(() => {
    setGenerationStage(currentGenerationStage ?? null);
  }, [currentGenerationStage]);

  useEffect(() => {
    if (isLoading) {
      if (!generationStartTime) {
        setGenerationStartTime(Date.now());
      }
      return;
    }
    setGenerationStartTime(null);
    setShowExtendedMessage(false);
  }, [isLoading, generationStartTime]);

  useEffect(() => {
    if (!generationStartTime) return undefined;
    const elapsed = Date.now() - generationStartTime;
    const remaining = 10000 - elapsed;
    if (remaining <= 0) {
      setShowExtendedMessage(true);
      return undefined;
    }
    const timeout = setTimeout(() => setShowExtendedMessage(true), remaining);
    return () => clearTimeout(timeout);
  }, [generationStartTime]);

  const generationStageLabel = useMemo(() => {
    const label = GENERATION_STAGE_LABELS[generationStage];
    return label ? t(label) : t('Preparing your meal plan...');
  }, [generationStage, t]);

  const fetchAlternatives = useCallback(async (recipeId, mealType) => {
    if (!recipeId) return;
    setLoadingAlternatives(true);
    try {
      const token = await getToken();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const url = `${apiUrl}/recipes/alternatives/${recipeId}?meal_type=${mealType.toLowerCase()}&limit=5`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAlternatives(data.alternatives || []);
      } else {
        setAlternatives([]);
      }
    } catch (err) {
      console.error('Failed to fetch alternatives:', err);
      setAlternatives([]);
    } finally {
      setLoadingAlternatives(false);
    }
  }, [getToken]);

  const handleSelectAlternative = useCallback((alt) => {
    const { dayIndex, mealType } = swapModal;
    setPlanOverrides((prev) => ({
      ...prev,
      [dayIndex]: {
        ...(prev[dayIndex] || {}),
        [mealType]: {
          id: alt.id,
          name: alt.title,
          calories: alt.calories,
          protein: alt.protein,
          carbs: alt.carbs,
          fat: alt.fat,
          cookTime: alt.cook_time || '20 min',
          ingredients: [],
          instructions: ''
        }
      }
    }));
    setSwapModal({ open: false, dayIndex: null, mealType: null, recipeId: null });
  }, [swapModal]);

  const handleSwap = useCallback((dayIndex, mealType) => {
    const meal = displayPlan?.days?.[dayIndex]?.meals?.[mealType];
    if (!meal?.id) {
      // Fallback to random swap if no recipe ID (old behavior)
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
      return;
    }
    setSwapModal({ open: true, dayIndex, mealType, recipeId: meal.id });
    fetchAlternatives(meal.id, mealType);
  }, [displayPlan, swapPools, fetchAlternatives]);

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

        {isReady && generationSource && (
          <div className="mt-4 flex justify-center">
            <GenerationBadge source={generationSource} t={t} />
          </div>
        )}

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
          <p className="text-lg font-medium text-foreground">{generationStageLabel}</p>
          {showExtendedMessage && (
            <p className="text-sm text-muted-foreground mt-2">
              {t('This is taking longer than usual, almost done...')}
            </p>
          )}
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
                      recipeRating={getRating(selectedDay.meals[mealType]?.id)}
                      onRate={submitRating}
                      ratingDisabled={ratingLoading}
                      recommendationReasons={recommendationReasons}
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
                <RatingProgress progress={progress} t={t} />
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

      {/* Swap Modal */}
      <SwapModal
        isOpen={swapModal.open}
        onClose={() => setSwapModal({ open: false, dayIndex: null, mealType: null, recipeId: null })}
        alternatives={alternatives}
        loading={loadingAlternatives}
        onSelect={handleSelectAlternative}
        currentMeal={swapModal.recipeId}
        t={t}
      />
    </div>
  );
}
