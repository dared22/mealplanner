import React, { useEffect, useMemo, useState } from 'react';
import { ChefHat, ExternalLink, Flame, Leaf, ListChecks, Loader2, Search, Sparkles, Tag as TagIcon } from 'lucide-react';

import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { RecipesApi } from '@/Entities/Recipes';
import { useLanguage } from '@/i18n/LanguageContext';

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '–';
  return Math.round(Number(value));
};

function MetricCard({ icon, label, value, accent = false }) {
  const IconComponent = icon;
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-border/70 p-4 shadow-sm ${accent ? 'bg-primary-light/70' : 'bg-card'}`}>
      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        <IconComponent className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function TagPill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
        active
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'bg-card text-foreground border-border hover:border-primary/40'
      }`}
    >
      {label}
    </button>
  );
}

function RecipeCard({ recipe, t }) {
  const nutrition = recipe.nutrition || {};
  const calories = nutrition.calories ?? nutrition.calories_kcal;
  const protein = nutrition.protein_g;
  const carbs = nutrition.carbs_g;
  const fat = nutrition.fat_g;
  const tags = recipe.tags || [];
  const ingredients = recipe.ingredients || [];
  const instructions = recipe.instructions || [];
  const image = recipe.image || (recipe.images?.[0]);

  return (
    <article className="group overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className="relative h-48 bg-secondary overflow-hidden">
        {image ? (
          <img src={image} alt={recipe.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <ChefHat className="w-10 h-10" />
          </div>
        )}
        <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-primary border border-primary/30">
          <Sparkles className="w-4 h-4" />
          <span>{recipe.type || 'Recipe'}</span>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold leading-tight text-foreground">{recipe.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 truncate">{recipe.source || t('Source')}</p>
          </div>
          {calories ? (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary-light text-primary border border-primary/20">
              {formatNumber(calories)} kcal
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {protein !== undefined && protein !== null && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary border border-border/60">
              <Leaf className="w-3.5 h-3.5" />
              {formatNumber(protein)} g {t('Protein')}
            </span>
          )}
          {carbs !== undefined && carbs !== null && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary border border-border/60">
              <ListChecks className="w-3.5 h-3.5" />
              {formatNumber(carbs)} g {t('Carbs')}
            </span>
          )}
          {fat !== undefined && fat !== null && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary border border-border/60">
              <Flame className="w-3.5 h-3.5" />
              {formatNumber(fat)} g {t('Fat')}
            </span>
          )}
        </div>

        {tags.length ? (
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-2.5 py-1 rounded-full bg-secondary text-foreground/90 border border-border/60"
              >
                {tag}
              </span>
            ))}
            {tags.length > 6 && (
              <span className="text-[11px] text-muted-foreground">+{tags.length - 6}</span>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl bg-secondary/70 border border-border/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('Ingredients')}</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground/90 max-h-28 overflow-hidden">
              {ingredients.length ? (
                ingredients.slice(0, 5).map((item, idx) => (
                  <li key={`${recipe.id}-ing-${idx}`} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span className="leading-snug">{item.trim()}</span>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">{t('No ingredients listed')}</li>
              )}
            </ul>
          </div>
          <div className="rounded-xl bg-secondary/70 border border-border/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('Instructions')}</p>
            <ol className="mt-2 space-y-1 text-sm text-foreground/90 max-h-28 overflow-hidden list-decimal list-inside">
              {instructions.length ? (
                instructions.slice(0, 4).map((step, idx) => (
                  <li key={`${recipe.id}-step-${idx}`} className="leading-snug">
                    {step.trim()}
                  </li>
                ))
              ) : (
                <li className="list-none text-muted-foreground">{t('No instructions listed')}</li>
              )}
            </ol>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{t('Source')}: {recipe.source || t('Unknown')}</span>
          {recipe.url ? (
            <a
              href={recipe.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              {t('View recipe')}
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function Recipes() {
  const { t } = useLanguage();
  const [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await RecipesApi.list({ limit: 60 });
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

  const availableTags = useMemo(() => {
    const tags = new Set();
    recipes.forEach((recipe) => {
      (recipe.tags || []).forEach((tag) => tags.add(tag));
    });
    return ['all', ...Array.from(tags).sort((a, b) => a.localeCompare(b))];
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return recipes.filter((recipe) => {
      if (selectedTag !== 'all' && !(recipe.tags || []).includes(selectedTag)) return false;
      if (term && !String(recipe.name || '').toLowerCase().includes(term)) return false;
      return true;
    });
  }, [recipes, search, selectedTag]);

  const nutritionSummary = useMemo(() => {
    if (!recipes.length) return null;
    const totals = recipes.reduce(
      (acc, recipe) => {
        const n = recipe.nutrition || {};
        acc.count += 1;
        acc.calories += Number(n.calories ?? n.calories_kcal ?? 0) || 0;
        acc.protein += Number(n.protein_g ?? 0) || 0;
        acc.carbs += Number(n.carbs_g ?? 0) || 0;
        acc.fat += Number(n.fat_g ?? 0) || 0;
        return acc;
      },
      { count: 0, calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const divisor = totals.count || 1;
    return {
      calories: totals.calories / divisor,
      protein: totals.protein / divisor,
      carbs: totals.carbs / divisor,
      fat: totals.fat / divisor,
    };
  }, [recipes]);

  const topTags = useMemo(() => {
    const map = new Map();
    recipes.forEach((recipe) => {
      (recipe.tags || []).forEach((tag) => {
        map.set(tag, (map.get(tag) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [recipes]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <section className="bg-card border border-border/80 rounded-3xl shadow-sm p-8">
          <div className="flex flex-col md:flex-row gap-6 md:items-center">
            <div className="flex-1 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-light text-primary font-semibold text-xs uppercase tracking-[0.2em]">
                <ChefHat className="w-4 h-4" />
                {t('Recipes')}
              </div>
              <h1 className="headline-serif">
                {t('Your recipe library')} <span className="accent">{t('is ready')}</span>
              </h1>
              <p className="text-muted-foreground text-lg">
                {t('Curated recipes pulled directly from your database.')}
              </p>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span className="px-3 py-1 rounded-full bg-secondary border border-border/70">
                  {t('{count} recipes loaded', { count: recipes.length })}
                </span>
                {topTags.length ? (
                  <span className="px-3 py-1 rounded-full bg-secondary border border-border/70 flex items-center gap-2">
                    <TagIcon className="w-4 h-4 text-primary" />
                    {t('Top tags')}: {topTags.map(([tag]) => tag).join(', ')}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="w-full md:w-80 bg-accent rounded-2xl border border-primary/10 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t('Snapshot')}</p>
                  <p className="text-sm text-muted-foreground">{t('Averages per recipe')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard icon={Flame} label={t('Avg calories')} value={`${formatNumber(nutritionSummary?.calories)} kcal`} accent />
                <MetricCard icon={Leaf} label={t('Avg protein')} value={`${formatNumber(nutritionSummary?.protein)} g`} />
                <MetricCard icon={ListChecks} label={t('Avg carbs')} value={`${formatNumber(nutritionSummary?.carbs)} g`} />
                <MetricCard icon={Sparkles} label={t('Avg fat')} value={`${formatNumber(nutritionSummary?.fat)} g`} />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            <div className="flex items-center gap-3 px-4 py-3 rounded-full bg-secondary border border-border/70 w-full lg:w-96">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent outline-none text-sm w-full text-foreground placeholder:text-muted-foreground"
                placeholder={t('Search recipes')}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {availableTags.slice(0, 10).map((tag) => (
                <TagPill
                  key={tag}
                  label={tag === 'all' ? t('All') : tag}
                  active={selectedTag === tag}
                  onClick={() => setSelectedTag(tag)}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setSelectedTag('all'); }}>
                {t('Reset')}
              </Button>
              <Button variant="default" size="sm" onClick={fetchRecipes}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('Refresh')}
              </Button>
            </div>
          </div>
        </section>

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
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-80 rounded-3xl border border-border/60 bg-secondary/60 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredRecipes.length ? (
              filteredRecipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} t={t} />
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-border/70 bg-card p-10 text-center space-y-3">
                <p className="text-lg font-semibold text-foreground">{t('No recipes match your filters.')}</p>
                <p className="text-sm text-muted-foreground">{t('Try adjusting the search or tag selection.')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
