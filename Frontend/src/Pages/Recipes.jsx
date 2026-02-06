import React, { useEffect, useMemo, useState } from 'react';
import {
  ChefHat,
  Flame,
  Leaf,
  Loader2,
  Search,
  Sparkles,
  Tag as TagIcon,
  Clock3,
} from 'lucide-react';

import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { RecipesApi } from '@/Entities/Recipes';
import { useLanguage } from '@/i18n/useLanguage';

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '–';
  return Math.round(Number(value));
};

const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none"><rect width="96" height="96" rx="24" fill="%23E8F4E8"/><path d="M30 62l10-12 8 8 12-14 12 14" stroke="%233D5A3D" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="36" cy="32" r="7" stroke="%233D5A3D" stroke-width="4"/></svg>';

const MEAL_TABS = [
  { key: 'all', label: 'All Meals' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

const TAG_TABS = [
  { key: 'vegan', label: 'Vegan' },
  { key: 'high_protein', label: 'High Protein' },
];

const EXCLUDE_INGREDIENTS = ['Peanuts', 'Dairy', 'Gluten', 'Egg'];

const CALORIES_MIN = 0;
const CALORIES_MAX = 1400;
const CALORIES_STEP = 20;
const PROTEIN_MAX = 80;
const PROTEIN_STEP = 5;
const valueToPercent = (value, min, max) => ((value - min) / (max - min)) * 100;

function TabPill({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all ${
        active
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'bg-card text-foreground border-border hover:border-primary/40'
      }`}
    >
      {label}
    </button>
  );
}

function FilterChip({ label, active, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
        active ? 'bg-primary-light text-primary border-primary/50' : 'bg-secondary text-foreground border-border'
      }`}
    >
      {label} {active ? '×' : ''}
    </button>
  );
}

function RecipeCard({ recipe, t }) {
  const nutrition = recipe.nutrition || {};
  const calories = nutrition.calories ?? nutrition.calories_kcal;
  const protein = nutrition.protein_g;
  const image = recipe.image || recipe.images?.[0];
  const [imgError, setImgError] = useState(false);
  const totalTime = recipe.total_time_minutes ?? null;

  const isBreakfast = recipe.is_breakfast;
  const isLunch = recipe.is_lunch;
  const mealLabel = isBreakfast ? t('Breakfast') : isLunch ? t('Lunch') : t('Dinner');

  return (
    <article className="group recipe-card-modern">
      {/* Hero Image Section */}
      <div className="recipe-image-wrapper">
        <img
          src={!imgError && image ? image : PLACEHOLDER_IMG}
          alt={recipe.name}
          className="recipe-image"
          onError={() => setImgError(true)}
        />
        <div className="recipe-overlay">
          <span className="recipe-meal-badge">{mealLabel}</span>
        </div>
      </div>

      {/* Content Section */}
      <div className="recipe-content">
        {/* Title */}
        <h3 className="recipe-title">{recipe.name}</h3>

        {/* Nutrition Stats Row */}
        <div className="recipe-stats-row">
          <div className="recipe-stat">
            <Flame className="w-3.5 h-3.5 text-primary/60" />
            <span className="recipe-stat-value">{calories ? formatNumber(calories) : '—'}</span>
          </div>

          <div className="recipe-stat">
            <Leaf className="w-3.5 h-3.5 text-primary/60" />
            <span className="recipe-stat-value">{protein ? formatNumber(protein) : '—'}g</span>
          </div>

          <div className="recipe-stat">
            <Clock3 className="w-3.5 h-3.5 text-primary/60" />
            <span className="recipe-stat-value">
              {totalTime != null ? `${formatNumber(totalTime)} min` : '—'}
            </span>
          </div>
        </div>

        {/* Tags */}
        {(recipe.tags || []).length > 0 && (
          <div className="recipe-tags">
            {(recipe.tags || []).slice(0, 2).map((tag) => (
              <span key={tag} className="recipe-tag">
                {tag}
              </span>
            ))}
            {(recipe.tags || []).length > 2 && (
              <span className="recipe-tag-more">
                +{(recipe.tags || []).length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function Recipes() {
  const { t } = useLanguage();
  const [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState('');
  const [mealTab, setMealTab] = useState('all');
  const [tagTab, setTagTab] = useState(null);
  const [excludeDraft, setExcludeDraft] = useState(['Peanuts', 'Dairy']);
  const [exclude, setExclude] = useState(['Peanuts', 'Dairy']);
  const [caloriesDraft, setCaloriesDraft] = useState({ min: 0, max: 1000 });
  const [calories, setCalories] = useState({ min: 0, max: 1000 });
  const [proteinDraft, setProteinDraft] = useState(0);
  const [protein, setProtein] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(6);

  const normalizeRecipe = (recipe) => {
    const name = recipe?.name || recipe?.title || 'Untitled recipe';
    const tags = Array.isArray(recipe?.tags) ? recipe.tags.map(String) : [];
    const ingredientsRaw = recipe?.ingredients;
    const ingredients = Array.isArray(ingredientsRaw)
      ? ingredientsRaw
          .map((i) => {
            if (typeof i === 'string') return i;
            if (i && typeof i === 'object') return i.original_text || i.name || '';
            return '';
          })
          .filter(Boolean)
      : [];
    const nutrition = recipe?.nutrition && typeof recipe.nutrition === 'object' ? recipe.nutrition : {};
    const calories = nutrition.calories ?? nutrition.calories_kcal;
    const protein = nutrition.protein_g;
    const mealType = (recipe?.meal_type || '').toLowerCase();
    const isBreakfast = recipe?.is_breakfast ?? mealType === 'breakfast';
    const isLunch = recipe?.is_lunch ?? mealType === 'lunch';
    const prepTime = recipe?.prep_time_minutes ?? null;
    const cookTime = recipe?.cook_time_minutes ?? null;
    const totalTime = recipe?.total_time_minutes ?? (prepTime && cookTime ? prepTime + cookTime : null);

    return {
      ...recipe,
      name,
      tags,
      ingredients,
      nutrition: nutrition || {},
      image: recipe?.image || recipe?.image_url || recipe?.images?.[0],
      calories,
      protein,
      is_breakfast: isBreakfast,
      is_lunch: isLunch,
      prep_time_minutes: prepTime,
      cook_time_minutes: cookTime,
      total_time_minutes: totalTime,
    };
  };

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await RecipesApi.list({ limit: 100 });
      const normalized = (data.items || []).map(normalizeRecipe);
      setRecipes(normalized);
    } catch (err) {
      setError(err?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  const applyFilters = () => {
    setCalories({ ...caloriesDraft });
    setProtein(proteinDraft);
    setExclude([...excludeDraft]);
  };

  const resetFilters = () => {
    setSearch('');
    setMealTab('all');
    setTagTab(null);
    setCaloriesDraft({ min: 0, max: 1000 });
    setProteinDraft(0);
    setExcludeDraft(['Peanuts', 'Dairy']);
    setCalories({ min: 0, max: 1000 });
    setProtein(0);
    setExclude(['Peanuts', 'Dairy']);
  };

  const filteredRecipes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return recipes.filter((recipe) => {
      if (term && !String(recipe.name || '').toLowerCase().includes(term)) return false;
      const n = recipe.nutrition || {};
      const kcal = Number(n.calories ?? n.calories_kcal ?? 0) || 0;
      const prot = Number(n.protein_g ?? 0) || 0;
      if (kcal < calories.min || kcal > calories.max) return false;
      if (prot < protein) return false;

      if (mealTab === 'breakfast' && recipe.is_breakfast !== true) return false;
      if (mealTab === 'lunch' && recipe.is_lunch !== true) return false;
      if (mealTab === 'dinner' && recipe.is_breakfast === true) return false; // rough fallback

      if (tagTab) {
        const tags = (recipe.tags || []).map((tVal) => String(tVal).toLowerCase());
        if (tagTab === 'vegan' && !tags.includes('vegan')) return false;
        if (tagTab === 'high_protein' && prot < 25) return false;
      }

      if (exclude.length) {
        const ingredients = (recipe.ingredients || []).map((i) => String(i).toLowerCase());
        const hit = exclude.some((bad) => ingredients.some((ing) => ing.includes(bad.toLowerCase())));
        if (hit) return false;
      }

      return true;
    });
  }, [recipes, search, calories, protein, mealTab, tagTab, exclude]);

  const visibleRecipes = filteredRecipes.slice(0, visibleCount);

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12">
        {/* Page Header */}
        <div className="space-y-3">
          <h1 className="headline-serif">
            <span className="accent">{t('Recipe Collection')}</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg">
            {t('Discover delicious and nutritious meals tailored to your preferences')}
          </p>
        </div>

        {/* Search Bar - Enhanced */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-2">
          <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-accent/30">
            <Search className="w-5 h-5 text-primary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-base w-full text-foreground placeholder:text-muted-foreground"
              placeholder={t('Search recipes, ingredients, or nutritional targets...')}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Filters - Enhanced */}
          <aside className="rounded-2xl border border-border/50 bg-card shadow-sm p-7 flex flex-col gap-7 h-fit sticky top-24">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                {t('Filters')}
              </p>
              <h2 className="text-2xl font-semibold text-foreground">
                {t('Refine Selection')}
              </h2>
            </div>

            <div className="space-y-6">
              {/* Calorie Range */}
              <div className="filter-group">
                <div className="filter-header">
                  <Flame className="w-4 h-4 text-primary" />
                  <span className="filter-label">{t('Calories')}</span>
                </div>
                <div className="filter-value-display">
                  {formatNumber(caloriesDraft.min)} – {formatNumber(caloriesDraft.max)} kcal
                </div>
                <div
                  className="dual-range"
                  style={{
                    '--range-min': `${valueToPercent(caloriesDraft.min, CALORIES_MIN, CALORIES_MAX)}%`,
                    '--range-max': `${valueToPercent(caloriesDraft.max, CALORIES_MIN, CALORIES_MAX)}%`,
                  }}
                >
                  <input
                    type="range"
                    min={CALORIES_MIN}
                    max={CALORIES_MAX}
                    step={CALORIES_STEP}
                    aria-label={t('Minimum calories')}
                    value={caloriesDraft.min}
                    onChange={(e) =>
                      setCaloriesDraft((prev) => ({
                        ...prev,
                        min: Math.min(Number(e.target.value), prev.max - CALORIES_STEP),
                      }))
                    }
                    className="filter-range-input"
                  />
                  <input
                    type="range"
                    min={CALORIES_MIN}
                    max={CALORIES_MAX}
                    step={CALORIES_STEP}
                    aria-label={t('Maximum calories')}
                    value={caloriesDraft.max}
                    onChange={(e) =>
                      setCaloriesDraft((prev) => ({
                        ...prev,
                        max: Math.max(Number(e.target.value), prev.min + CALORIES_STEP),
                      }))
                    }
                    className="filter-range-input"
                  />
                </div>
              </div>

              <div className="filter-divider" />

              {/* Protein */}
              <div className="filter-group">
                <div className="filter-header">
                  <Leaf className="w-4 h-4 text-primary" />
                  <span className="filter-label">{t('Protein')}</span>
                </div>
                <div className="filter-value-display">
                  {formatNumber(proteinDraft)}g {t('minimum')}
                </div>
                <div
                  className="single-range-wrapper"
                  style={{
                    '--range-max': `${valueToPercent(proteinDraft, 0, PROTEIN_MAX)}%`,
                  }}
                >
                  <input
                    type="range"
                    min={0}
                    max={PROTEIN_MAX}
                    step={PROTEIN_STEP}
                    value={proteinDraft}
                    onChange={(e) => setProteinDraft(Number(e.target.value))}
                    className="filter-range-input"
                    aria-label={t('Protein minimum')}
                  />
                </div>
              </div>

              <div className="filter-divider" />

              {/* Exclude Ingredients */}
              <div className="filter-group">
                <div className="filter-header">
                  <TagIcon className="w-4 h-4 text-primary" />
                  <span className="filter-label">{t('Exclude Ingredients')}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {EXCLUDE_INGREDIENTS.map((item) => {
                    const active = excludeDraft.includes(item);
                    const label = t(item);
                    return (
                      <FilterChip
                        key={item}
                        label={label}
                        active={active}
                        onToggle={() =>
                          setExcludeDraft((prev) =>
                            active ? prev.filter((v) => v !== item) : [...prev, item]
                          )
                        }
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                className="w-full h-12 rounded-xl font-semibold text-[15px] shadow-sm hover:shadow-md transition-shadow"
                onClick={applyFilters}
              >
                {t('Apply Filters')}
              </Button>
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl font-medium text-sm border-border/60 hover:bg-accent/50"
                onClick={resetFilters}
              >
                {t('Reset All')}
              </Button>
            </div>
          </aside>

          {/* Content */}
          <div className="space-y-6">
            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2.5">
              {MEAL_TABS.map((tab) => (
                <TabPill
                  key={tab.key}
                  label={t(tab.label)}
                  active={mealTab === tab.key}
                  onClick={() => setMealTab(tab.key)}
                />
              ))}
              {TAG_TABS.map((tab) => (
                <TabPill
                  key={tab.key}
                  label={t(tab.label)}
                  active={tagTab === tab.key}
                  onClick={() => setTagTab((prev) => (prev === tab.key ? null : tab.key))}
                />
              ))}
            </div>

            {/* Results count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {loading ? t('Loading recipes...') : (
                  <>
                    <span className="font-semibold text-foreground">{filteredRecipes.length}</span> {t('recipes found')}
                  </>
                )}
              </p>
            </div>

            {error ? (
              <div className="rounded-2xl border border-border/50 bg-card p-16 text-center space-y-5">
                <div className="w-16 h-16 rounded-full bg-red-50 mx-auto flex items-center justify-center">
                  <ChefHat className="w-8 h-8 text-red-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-semibold text-foreground">
                    {t('Unable to load recipes')}
                  </p>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">{error}</p>
                </div>
                <div className="flex justify-center pt-2">
                  <Button onClick={fetchRecipes} className="px-8 py-3 rounded-full">
                    {t('Try Again')}
                  </Button>
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="recipe-skeleton" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {visibleRecipes.length ? (
                    visibleRecipes.map((recipe, idx) => (
                      <div
                        key={recipe.id}
                        style={{
                          animation: `fadeInUp 0.5s ease-out ${idx * 0.05}s both`,
                        }}
                      >
                        <RecipeCard recipe={recipe} t={t} />
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full rounded-2xl border border-border/50 bg-accent/20 p-16 text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-secondary mx-auto flex items-center justify-center">
                        <ChefHat className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xl font-semibold text-foreground">
                          {t('No recipes found')}
                        </p>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                          {t('Try adjusting your filters or search terms to discover more recipes')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {visibleRecipes.length < filteredRecipes.length ? (
                  <div className="flex justify-center pt-6">
                    <Button
                      variant="outline"
                      onClick={() => setVisibleCount((c) => c + 6)}
                      className="px-8 py-3 rounded-full font-semibold"
                    >
                      {t('Load More')} ({filteredRecipes.length - visibleRecipes.length} {t('remaining')})
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
