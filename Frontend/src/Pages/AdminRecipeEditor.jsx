import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { API_URL } from '@/Entities/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const normalizeLines = (value) => {
  if (!Array.isArray(value)) return '';
  return value
    .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
    .join('\n');
};

const splitLines = (value) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const formatNutritionValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && !Number.isNaN(value)) return String(value);
  if (typeof value === 'string') return value;
  return '';
};

const parseNutritionNumber = (label, value) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number in ${label}.`);
  }
  return parsed;
};

const buildFormState = (recipe) => ({
  title: recipe?.title || '',
  description: recipe?.description || '',
  source_url: recipe?.source_url || '',
  image_url: recipe?.image_url || '',
  cuisine: recipe?.cuisine || '',
  meal_type: recipe?.meal_type || '',
  tags: recipe?.tags?.length ? recipe.tags.join(', ') : '',
  ingredients: normalizeLines(recipe?.ingredients),
  instructions: normalizeLines(recipe?.instructions),
  calories: formatNutritionValue(recipe?.nutrition?.calories),
  protein: formatNutritionValue(recipe?.nutrition?.protein),
  carbs: formatNutritionValue(recipe?.nutrition?.carbs),
  fat: formatNutritionValue(recipe?.nutrition?.fat),
  is_active: recipe?.is_active ? 'true' : 'false',
});

export default function AdminRecipeEditor() {
  const { recipeId } = useParams();
  const isCreateMode = !recipeId;
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [status, setStatus] = useState(isCreateMode ? 'ready' : 'loading');
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [recipe, setRecipe] = useState(null);
  const [form, setForm] = useState(() => buildFormState(null));
  const [initialForm, setInitialForm] = useState(() => buildFormState(null));

  const hasChanges = useMemo(() => {
    if (isCreateMode) return true;
    return Object.keys(initialForm).some((key) => form[key] !== initialForm[key]);
  }, [form, initialForm, isCreateMode]);

  const fetchRecipe = async () => {
    if (!recipeId) return;
    setStatus('loading');
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Missing authentication token. Please sign in again.');
      }
      const response = await fetch(`${API_URL}/admin/recipes/${recipeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const data = await response.json();
      setRecipe(data);
      const nextForm = buildFormState(data);
      setForm(nextForm);
      setInitialForm(nextForm);
      setStatus('ready');
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  };

  useEffect(() => {
    if (isCreateMode) {
      setStatus('ready');
      setRecipe(null);
      const emptyForm = buildFormState(null);
      setForm(emptyForm);
      setInitialForm(emptyForm);
      return;
    }
    fetchRecipe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId, isCreateMode]);

  const handleSave = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setActionError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Missing authentication token. Please sign in again.');
      }

      const payload = {};
      const maybeUpdate = (key, value) => {
        if (form[key] !== initialForm[key]) {
          payload[key] = value;
        }
      };

      const titleValue = form.title.trim();
      const mealTypeValue = form.meal_type.trim();
      const tagsValue = form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const ingredientsValue = splitLines(form.ingredients);
      const instructionsValue = splitLines(form.instructions);
      const nutrition = {
        calories: parseNutritionNumber('calories', form.calories),
        protein: parseNutritionNumber('protein', form.protein),
        carbs: parseNutritionNumber('carbs', form.carbs),
        fat: parseNutritionNumber('fat', form.fat),
      };
      Object.keys(nutrition).forEach((key) => {
        if (nutrition[key] === null) {
          delete nutrition[key];
        }
      });

      if (isCreateMode) {
        if (!titleValue || !mealTypeValue) {
          throw new Error('Title and meal type are required.');
        }
        payload.title = titleValue;
        payload.meal_type = mealTypeValue;
        payload.tags = tagsValue;
        payload.ingredients = ingredientsValue;
        payload.instructions = instructionsValue;
        payload.nutrition = nutrition;
        payload.description = form.description.trim() || null;
        payload.source_url = form.source_url.trim() || null;
        payload.image_url = form.image_url.trim() || null;
        payload.cuisine = form.cuisine.trim() || null;
      } else {
        if (!recipeId) return;
        maybeUpdate('title', titleValue);
        maybeUpdate('description', form.description.trim() || null);
        maybeUpdate('source_url', form.source_url.trim() || null);
        maybeUpdate('image_url', form.image_url.trim() || null);
        maybeUpdate('cuisine', form.cuisine.trim() || null);
        maybeUpdate('meal_type', mealTypeValue || null);
        if (form.tags !== initialForm.tags) {
          payload.tags = tagsValue;
        }
        if (form.ingredients !== initialForm.ingredients) {
          payload.ingredients = ingredientsValue;
        }
        if (form.instructions !== initialForm.instructions) {
          payload.instructions = instructionsValue;
        }
        if (
          form.calories !== initialForm.calories ||
          form.protein !== initialForm.protein ||
          form.carbs !== initialForm.carbs ||
          form.fat !== initialForm.fat
        ) {
          payload.nutrition = nutrition;
        }
        if (form.is_active !== initialForm.is_active) {
          payload.is_active = form.is_active === 'true';
        }
      }

      if (!isCreateMode && Object.keys(payload).length === 0) {
        setIsSaving(false);
        return;
      }

      const response = await fetch(
        `${API_URL}/admin/recipes${isCreateMode ? '' : `/${recipeId}`}`,
        {
          method: isCreateMode ? 'POST' : 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Save failed with status ${response.status}`);
      }

      const updated = await response.json();
      setRecipe(updated);
      const nextForm = buildFormState(updated);
      setForm(nextForm);
      setInitialForm(nextForm);
      navigate('/admin/recipes');
    } catch (err) {
      setActionError(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
        Loading recipe...
      </div>
    );
  }

  if (status === 'error') {
    const errorMessage = error?.message || 'Something went wrong while fetching recipe details.';
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold">Failed to load recipe</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
        <Button variant="default" onClick={fetchRecipe} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/admin/recipes')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to recipes
          </button>
          <h1 className="text-2xl font-bold text-foreground mt-2">
            {isCreateMode ? 'Add Recipe' : 'Edit Recipe'}
          </h1>
          <p className="text-muted-foreground">
            {isCreateMode
              ? 'Add a new recipe to the database for meal plan generation.'
              : 'Update core details and keep recipes current for the meal planner.'}
          </p>
        </div>
        {!isCreateMode && recipe && (
          <div className="flex flex-col items-end gap-2 text-sm text-muted-foreground">
            <span>Last updated: {formatDateTime(recipe.updated_at || recipe.created_at)}</span>
            <span>Slug: {recipe.slug}</span>
          </div>
        )}
      </div>

      {actionError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold">Save failed</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {actionError?.message || 'Unable to save recipe.'}
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-title">
              Title
            </label>
            <Input
              id="recipe-title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-meal-type">
              Meal type
            </label>
            <Input
              id="recipe-meal-type"
              value={form.meal_type}
              onChange={(event) => setForm((prev) => ({ ...prev, meal_type: event.target.value }))}
              placeholder="e.g. breakfast, lunch, dinner"
              required={isCreateMode}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-cuisine">
              Cuisine
            </label>
            <Input
              id="recipe-cuisine"
              value={form.cuisine}
              onChange={(event) => setForm((prev) => ({ ...prev, cuisine: event.target.value }))}
            />
          </div>
          {!isCreateMode && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="recipe-status">
                Status
              </label>
              <select
                id="recipe-status"
                value={form.is_active}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, is_active: event.target.value }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-source">
              Source URL
            </label>
            <Input
              id="recipe-source"
              value={form.source_url}
              onChange={(event) => setForm((prev) => ({ ...prev, source_url: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-image">
              Image URL
            </label>
            <Input
              id="recipe-image"
              value={form.image_url}
              onChange={(event) => setForm((prev) => ({ ...prev, image_url: event.target.value }))}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-tags">
              Tags
            </label>
            <Input
              id="recipe-tags"
              value={form.tags}
              onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
              placeholder="comma-separated"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-description">
              Description
            </label>
            <textarea
              id="recipe-description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-ingredients">
              Ingredients (one per line)
            </label>
            <textarea
              id="recipe-ingredients"
              value={form.ingredients}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, ingredients: event.target.value }))
              }
              className="min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-instructions">
              Instructions (one per line)
            </label>
            <textarea
              id="recipe-instructions"
              value={form.instructions}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, instructions: event.target.value }))
              }
              className="min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-calories">
              Calories
            </label>
            <Input
              id="recipe-calories"
              value={form.calories}
              onChange={(event) => setForm((prev) => ({ ...prev, calories: event.target.value }))}
              placeholder="kcal"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-protein">
              Protein
            </label>
            <Input
              id="recipe-protein"
              value={form.protein}
              onChange={(event) => setForm((prev) => ({ ...prev, protein: event.target.value }))}
              placeholder="g"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-carbs">
              Carbs
            </label>
            <Input
              id="recipe-carbs"
              value={form.carbs}
              onChange={(event) => setForm((prev) => ({ ...prev, carbs: event.target.value }))}
              placeholder="g"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-fat">
              Fat
            </label>
            <Input
              id="recipe-fat"
              value={form.fat}
              onChange={(event) => setForm((prev) => ({ ...prev, fat: event.target.value }))}
              placeholder="g"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/admin/recipes" className="text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </Link>
          <div className="flex items-center gap-3">
            {!isCreateMode && (
              <span className="text-xs text-muted-foreground">
                {hasChanges ? 'Unsaved changes' : 'All changes saved'}
              </span>
            )}
            <Button type="submit" disabled={isSaving || (!hasChanges && !isCreateMode)}>
              {isSaving ? 'Saving...' : isCreateMode ? 'Create recipe' : 'Save changes'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
