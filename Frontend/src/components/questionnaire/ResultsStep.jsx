import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { motion as Motion, useReducedMotion } from 'framer-motion';
import {
  CheckCircle, RefreshCw,
  Shuffle, ThumbsUp, ThumbsDown, MoreHorizontal, Sun, Coffee, Utensils, Moon,
  Info, ChevronDown, ChevronUp, X, Sparkles, AlertCircle, Bell
} from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import { useLanguage } from '@/i18n/useLanguage';
import { useRatings } from '@/hooks/useRatings';
import {
  getLeftoverMealLabel,
  normalizeServerPlan,
  toStandaloneMealOverride,
} from './resultsPlanUtils';

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
            {data.age || translate('N/A')} {translate('yrs')} • {data.height || translate('N/A')}cm • {data.weight || translate('N/A')}kg
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

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const MACRO_COLORS = { protein: 'oklch(0.36 0.04 145)', carbs: '#22c55e', fat: '#f97316' };
const GENERATION_STAGE_LABELS = {
  finding_recipes: 'Finding recipes',
  optimizing_nutrition: 'Optimizing nutrition',
  finalizing: 'Finalizing plan'
};

const ESTIMATED_DURATION_MS = 45000;
const EXTENDED_THRESHOLD_MS = 30000;
const GENERATION_TIPS = [
  'Most people eat the same 9 meals on rotation each week.',
  'Cooking once for two meals can save about 4 hours a week.',
  'Plans that include leftovers cut grocery costs by roughly 20%.',
  'Variety across cuisines correlates with better nutrient coverage.',
];

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
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-success/10 text-success">
      <Sparkles className="w-3.5 h-3.5" />
      <span>{label}</span>
      <span className="hidden sm:inline text-success/80">
        · {description}
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

// Day Card for carousel
const DayCard = memo(function DayCard({ day, isActive, onSelect, dayNumber, t }) {
  const translate = t || ((v) => v);
  const prefersReducedMotion = useReducedMotion();
  const translatedDayName = translate(day.name);
  const dayAbbr = translatedDayName.slice(0, 3).toUpperCase();
  const macros = day.macros || {};
  const protein = Number(macros.protein) || 0;
  const carbs = Number(macros.carbs) || 0;
  const fat = Number(macros.fat) || 0;
  const macroTotal = Math.max(protein + carbs + fat, 1);
  const macroSegments = [
    { key: 'protein', value: protein, color: MACRO_COLORS.protein },
    { key: 'carbs', value: carbs, color: MACRO_COLORS.carbs },
    { key: 'fat', value: fat, color: MACRO_COLORS.fat },
  ];

  return (
    <Motion.button
      type="button"
      onClick={onSelect}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      aria-label={translate('Day {number}', { number: dayNumber })}
      className={`day-card ${isActive ? 'active' : ''}`}
    >
      <span className="day-abbr">{dayAbbr}</span>
      <span className="day-number">{dayNumber}</span>
      <div className="day-sparkbar" aria-hidden="true">
        {macroSegments.map((segment) => (
          <span
            key={segment.key}
            className="day-sparkbar-segment"
            style={{
              width: `${(segment.value / macroTotal) * 100}%`,
              backgroundColor: segment.color,
            }}
          />
        ))}
      </div>
      <span className="day-kcal">{day.calories}{translate('kcal')}</span>
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
  const leftoverLabel = getLeftoverMealLabel(meal, translate);

  if (!meal) return null;

  const Icon = MEAL_ICONS[mealType] || Utensils;
  const hasDetails = meal.instructions || (meal.ingredients && meal.ingredients.length > 0);
  const ingredientTitle = meal.ingredient_servings === 1
    ? translate('Ingredients (1 serving)')
    : translate('Ingredients');

  return (
    <div className="meal-item-wrapper">
      <div className="meal-item">
        <div className="meal-icon">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="meal-content">
          <span className="meal-type">{translate(mealType)}</span>
          <h4 className="meal-name">{meal.name}</h4>
          {leftoverLabel && (
            <p className="text-sm font-medium text-primary">{leftoverLabel}</p>
          )}
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
                className={`meal-action ${recipeRating?.is_liked === true ? 'text-success' : ''}`}
                title={translate('Like this meal')}
              >
                <ThumbsUp className={`w-4 h-4 ${recipeRating?.is_liked === true ? 'fill-current' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => onRate(meal.id, false)}
                disabled={ratingDisabled}
                className={`meal-action ${recipeRating?.is_liked === false ? 'text-destructive' : ''}`}
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
              <h5 className="meal-section-title">{ingredientTitle}</h5>
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
      <div className="p-4 rounded-xl bg-success/10 border border-success/25">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-success" />
          <span className="text-sm font-medium text-success">
            {translate('Personalized plans unlocked!')}
          </span>
        </div>
        <p className="mt-1 text-xs text-success">
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
          className="h-full bg-primary transition-[width] duration-300"
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
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const track = trackRef.current;
    const node = track?.children[selectedIndex];
    node?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [prefersReducedMotion, selectedIndex]);

  return (
    <div className="day-timeline">
      <div ref={trackRef} className="day-timeline-track hide-scrollbar">
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
    </div>
  );
});

// Swap Modal
const SwapModal = memo(function SwapModal({ isOpen, onClose, alternatives, loading, onSelect, t }) {
  const translate = t || ((v) => v);
  const prefersReducedMotion = useReducedMotion();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const openerRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    openerRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    const getFocusableElements = () => {
      if (!dialogRef.current) return [];
      return Array.from(
        dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
    };

    const focusFirstElement = () => {
      const focusableElements = getFocusableElements();
      const firstElement = closeButtonRef.current || focusableElements[0];
      firstElement?.focus();
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    focusFirstElement();
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      openerRef.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40" onClick={onClose}>
      <Motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-modal-title"
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id="swap-modal-title" className="text-lg font-semibold">{translate('Swap Meal')}</h3>
          <button ref={closeButtonRef} onClick={onClose} className="btn-icon" aria-label={translate('Close swap modal')}>
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
                    <ThumbsUp className="w-4 h-4 text-success fill-current" />
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

// Loading-state components
const ProgressArc = memo(function ProgressArc({ progress, prefersReducedMotion }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(progress, 0.97));
  const offset = circumference * (1 - clamped);

  return (
    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
      <circle
        cx="40" cy="40" r={radius}
        fill="none"
        strokeWidth="4"
        className="stroke-primary/15"
      />
      <circle
        cx="40" cy="40" r={radius}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="stroke-primary"
        style={prefersReducedMotion ? undefined : {
          transition: 'stroke-dashoffset 400ms cubic-bezier(0.22, 1, 0.36, 1)'
        }}
      />
    </svg>
  );
});

const ProfileChips = memo(function ProfileChips({ data, t }) {
  const translate = t || ((v) => v);

  const goalMap = {
    lose_weight: translate('Lose weight'),
    maintain_weight: translate('Maintain weight'),
    gain_weight: translate('Gain weight'),
    build_muscle: translate('Build muscle'),
    improve_health: translate('Improve health'),
  };
  const goalLabel = data?.nutrition_goal ? goalMap[data.nutrition_goal] : null;
  const cuisines = Array.isArray(data?.preferred_cuisines)
    ? data.preferred_cuisines.slice(0, 2).map((c) => translate(c)).join(' + ')
    : null;
  const cookingTime = data?.cooking_time_preference ? translate(data.cooking_time_preference) : null;

  const chips = [
    data?.age ? `${data.age} ${translate('yrs')}` : null,
    goalLabel,
    cuisines || null,
    cookingTime,
  ].filter(Boolean);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {chips.map((chip, i) => (
        <span
          key={`${chip}-${i}`}
          className="inline-flex items-center px-2.5 py-1 rounded-full bg-accent text-xs font-medium text-foreground"
        >
          {chip}
        </span>
      ))}
    </div>
  );
});

const RotatingTip = memo(function RotatingTip({ t, prefersReducedMotion }) {
  const translate = t || ((v) => v);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % GENERATION_TIPS.length);
    }, 5200);
    return () => window.clearInterval(id);
  }, [prefersReducedMotion]);

  return (
    <div className="min-h-[44px] flex items-center justify-center">
      <Motion.p
        key={index}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="text-sm text-muted-foreground max-w-md text-center"
      >
        {translate(GENERATION_TIPS[index])}
      </Motion.p>
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
  const prefersReducedMotion = useReducedMotion();
  const activePlan = useMemo(() => normalizeServerPlan(plan, t), [plan, t]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [planOverrides, setPlanOverrides] = useState({});
  const [generationStage, setGenerationStage] = useState(null);
  const [generationStartTime, setGenerationStartTime] = useState(null);
  const [showExtendedMessage, setShowExtendedMessage] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [notifyState, setNotifyState] = useState('idle'); // idle | armed | unsupported | denied
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
        setLoadingProgress(0);
      }
      return;
    }
    setGenerationStartTime(null);
    setShowExtendedMessage(false);
    setLoadingProgress(isReady ? 1 : 0);
  }, [isLoading, isReady, generationStartTime]);

  useEffect(() => {
    if (!generationStartTime) return undefined;
    const elapsed = Date.now() - generationStartTime;
    const remaining = EXTENDED_THRESHOLD_MS - elapsed;
    if (remaining <= 0) {
      setShowExtendedMessage(true);
      return undefined;
    }
    const timeout = setTimeout(() => setShowExtendedMessage(true), remaining);
    return () => clearTimeout(timeout);
  }, [generationStartTime]);

  useEffect(() => {
    if (!generationStartTime) return undefined;
    let cancelled = false;
    const update = () => {
      if (cancelled) return;
      const elapsed = Date.now() - generationStartTime;
      // Eases toward 0.95: fast early, slow late. Never quite reaches 1 until success arrives.
      const t = Math.min(elapsed / ESTIMATED_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 2.2);
      setLoadingProgress(Math.min(eased, 0.95));
    };
    update();
    const interval = window.setInterval(update, prefersReducedMotion ? 1000 : 250);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [generationStartTime, prefersReducedMotion]);

  const generationStageLabel = useMemo(() => {
    const label = GENERATION_STAGE_LABELS[generationStage];
    return label ? t(label) : t('Preparing your meal plan');
  }, [generationStage, t]);

  const handleArmNotification = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifyState('unsupported');
      return;
    }
    if (Notification.permission === 'granted') {
      setNotifyState('armed');
      return;
    }
    if (Notification.permission === 'denied') {
      setNotifyState('denied');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotifyState(result === 'granted' ? 'armed' : result === 'denied' ? 'denied' : 'idle');
    } catch {
      setNotifyState('unsupported');
    }
  }, []);

  useEffect(() => {
    if (notifyState !== 'armed' || !isReady) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      setNotifyState('idle');
      return;
    }
    try {
      const n = new Notification(t('Your meal plan is ready'), {
        body: t('Tap to open your weekly plan.'),
        tag: 'preppr-plan-ready',
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // Notification creation can fail in private windows; ignore.
    }
    setNotifyState('idle');
  }, [notifyState, isReady, t]);

  useEffect(() => {
    if (!isLoading) setNotifyState('idle');
  }, [isLoading]);

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
        [mealType]: toStandaloneMealOverride(alt)
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
      setPlanOverrides((prev) => ({
        ...prev,
        [dayIndex]: {
          ...(prev[dayIndex] || {}),
          [mealType]: toStandaloneMealOverride(next),
        },
      }));
      return;
    }
    setSwapModal({ open: true, dayIndex, mealType, recipeId: meal.id });
    fetchAlternatives(meal.id, mealType);
  }, [displayPlan, swapPools, fetchAlternatives]);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <Motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="text-center"
      >
        <div className="w-20 h-20 mx-auto mb-6 relative flex items-center justify-center">
          {isLoading ? (
            <>
              <ProgressArc progress={loadingProgress} prefersReducedMotion={prefersReducedMotion} />
              <span className="absolute text-sm font-semibold text-primary tabular-nums">
                {Math.round(loadingProgress * 100)}%
              </span>
            </>
          ) : (
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${showError ? 'bg-destructive/10' : 'bg-primary'}`}>
              {showError ? (
                <AlertCircle className="w-10 h-10 text-destructive" />
              ) : (
                <CheckCircle className="w-10 h-10 text-primary-foreground" />
              )}
            </div>
          )}
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.01em] text-foreground leading-tight mb-3">
          {isReady ? (
            <>{t('Your')} <span className="text-primary">{t('meal plan')}</span> {t('is ready')}</>
          ) : isLoading ? (
            <>{t('Preparing your')} <span className="text-primary">{t('plan')}</span></>
          ) : (
            <>{t('Something went')} <span className="text-primary">{t('wrong')}</span></>
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
            ? t('Usually under a minute. You can leave this tab open or come back to it.')
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

      {/* Loading anchor: profile + rotating tip + reassurance */}
      {isLoading && (
        <Motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-xl mx-auto p-6 rounded-2xl bg-card border border-border"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium text-center">
                {t('Generating plan for')}
              </p>
              <ProfileChips data={data} t={t} />
            </div>

            <div className="pt-3 border-t border-border">
              <RotatingTip t={t} prefersReducedMotion={prefersReducedMotion} />
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                {!prefersReducedMotion && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                )}
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
              </span>
              <span>{generationStageLabel}</span>
            </div>

            {showExtendedMessage && (
              <div className="pt-2 space-y-3">
                <p className="text-xs text-foreground/70 text-center">
                  {t('Still working on it. Your progress is saved if you need to close this tab.')}
                </p>
                <div className="flex justify-center">
                  {notifyState === 'armed' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {t("We'll ping you when it's ready.")}
                    </span>
                  ) : notifyState === 'denied' ? (
                    <span className="text-xs text-muted-foreground">
                      {t('Notifications are blocked in your browser settings.')}
                    </span>
                  ) : notifyState === 'unsupported' ? null : (
                    <button
                      type="button"
                      onClick={handleArmNotification}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      {t('Notify me when ready')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </Motion.div>
      )}

      {/* Error State */}
      {showError && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-6 rounded-2xl bg-destructive/10 border border-destructive/25"
        >
          <h3 className="font-semibold text-destructive">{t("We couldn't finalize your plan")}</h3>
          <p className="mt-2 text-sm text-destructive">
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
                      <span className={`font-semibold ${selectedDay.calories <= displayPlan.calorieTarget ? 'text-primary' : 'text-warning'}`}>
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
          {import.meta.env.DEV && rawPlanText && (
            <details className="p-4 rounded-2xl bg-secondary text-sm">
              <summary className="cursor-pointer font-semibold text-foreground">{t('debugAiResponse')}</summary>
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
        t={t}
      />
    </div>
  );
}
