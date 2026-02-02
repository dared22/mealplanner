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

  const isBreakfast = recipe.is_breakfast;
  const isLunch = recipe.is_lunch;
  const mealLabel = isBreakfast ? t('Breakfast') : isLunch ? t('Lunch') : t('Dinner');

  return (
    <article className="rounded-3xl border border-border/70 bg-card shadow-sm p-5 flex flex-col gap-4 hover:-translate-y-1 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="w-12 h-12 rounded-full bg-primary-light text-primary flex items-center justify-center overflow-hidden">
          <img
            src={!imgError && image ? image : PLACEHOLDER_IMG}
            alt={recipe.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        </div>
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="w-4 h-4" />
          <Sparkles className="w-4 h-4 opacity-70" />
          <Sparkles className="w-4 h-4 opacity-50" />
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{mealLabel}</p>
        <h3 className="text-lg font-semibold text-foreground leading-tight">{recipe.name}</h3>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="inline-flex items-center gap-1">
          <Clock3 className="w-4 h-4" />
          <span>{t('N/A')}</span>
        </div>
        {calories ? (
          <div className="inline-flex items-center gap-1">
            <Flame className="w-4 h-4" />
            <span>{formatNumber(calories)} kcal</span>
          </div>
        ) : null}
        {protein ? (
          <div className="inline-flex items-center gap-1">
            <Leaf className="w-4 h-4" />
            <span>{formatNumber(protein)} g {t('Protein')}</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {(recipe.tags || []).slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-1 rounded-full bg-secondary border border-border/70">
              {tag}
            </span>
          ))}
        </div>
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

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await RecipesApi.list({ limit: 100 });
      setRecipes(data.items || []);
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
        const ingredients = (recipe.ingredients || []).map((i) => i.toLowerCase());
        const hit = exclude.some((bad) => ingredients.some((ing) => ing.includes(bad.toLowerCase())));
        if (hit) return false;
      }

      return true;
    });
  }, [recipes, search, calories, protein, mealTab, tagTab, exclude]);

  const visibleRecipes = filteredRecipes.slice(0, visibleCount);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="rounded-3xl border border-border/70 bg-card shadow-sm p-6">
          <div className="flex items-center gap-3 px-4 py-3 rounded-full bg-secondary border border-border/70">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm w-full text-foreground placeholder:text-muted-foreground"
              placeholder={t('Search recipes, ingredients, or nutritional targets...')}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
          {/* Filters */}
          <aside className="rounded-3xl border border-border/70 bg-card shadow-sm p-6 flex flex-col gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                {t('Advanced filters')}
              </p>
              <h2 className="text-xl font-semibold text-foreground mt-1">{t('Refine your selection')}</h2>
            </div>

            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                  <span>{t('Calories')}</span>
                  <span className="text-muted-foreground">
                    {formatNumber(caloriesDraft.min)}–{formatNumber(caloriesDraft.max)} {t('kcal')}
                  </span>
                </div>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="1400"
                    step="20"
                    value={caloriesDraft.min}
                    onChange={(e) =>
                      setCaloriesDraft((prev) => ({
                        ...prev,
                        min: Math.min(Number(e.target.value), prev.max - 20),
                      }))
                    }
                    className="w-full accent-[var(--primary)]"
                  />
                  <input
                    type="range"
                    min="0"
                    max="1400"
                    step="20"
                    value={caloriesDraft.max}
                    onChange={(e) =>
                      setCaloriesDraft((prev) => ({
                        ...prev,
                        max: Math.max(Number(e.target.value), prev.min + 20),
                      }))
                    }
                    className="w-full accent-[var(--primary)]"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                  <span>{t('Protein')}</span>
                  <span className="text-muted-foreground">{formatNumber(proteinDraft)}g+</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="5"
                  value={proteinDraft}
                  onChange={(e) => setProteinDraft(Number(e.target.value))}
                  className="w-full accent-[var(--primary)]"
                />
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('Exclude ingredients')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {EXCLUDE_INGREDIENTS.map((item) => {
                    const active = excludeDraft.includes(item);
                    return (
                      <FilterChip
                        key={item}
                        label={item}
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

            <div className="flex flex-col gap-3">
              <Button className="w-full" onClick={applyFilters}>
                {t('Apply filters')}
              </Button>
              <Button variant="secondary" className="w-full" onClick={resetFilters}>
                {t('Reset all filters')}
              </Button>
            </div>
          </aside>

          {/* Content */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
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

            {error ? (
              <div className="rounded-2xl border border-border/70 bg-card p-8 text-center space-y-3">
                <p className="text-lg font-semibold text-foreground">{t('Could not load recipes.')}</p>
                <p className="text-muted-foreground text-sm">{error}</p>
                <div className="flex justify-center">
                  <Button onClick={fetchRecipes}>{t('Try again')}</Button>
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="h-56 rounded-3xl border border-border/60 bg-secondary/60 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {visibleRecipes.length ? (
                    visibleRecipes.map((recipe) => (
                      <RecipeCard key={recipe.id} recipe={recipe} t={t} />
                    ))
                  ) : (
                    <div className="col-span-full rounded-2xl border border-border/70 bg-card p-10 text-center space-y-3">
                      <p className="text-lg font-semibold text-foreground">{t('No recipes match your filters.')}</p>
                      <p className="text-sm text-muted-foreground">{t('Try adjusting the search or tag selection.')}</p>
                    </div>
                  )}
                </div>
                {visibleRecipes.length < filteredRecipes.length ? (
                  <div className="flex justify-center pt-4">
                    <Button variant="outline" onClick={() => setVisibleCount((c) => c + 6)}>
                      {t('Load more recipes')}
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
