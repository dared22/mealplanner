import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { recipeImportsApi } from '@/Entities/recipeImports';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import RecipeImportBadge from '@/components/admin/RecipeImportBadge';
import { useRecipeImports } from './recipeImportsContext';

const blankIngredient = { name: '', quantity: null, unit: '', notes: '', original_text: '' };
const plannerMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];

const isInstagramPostUrl = (value) => {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    return url.protocol === 'https:'
      && ['instagram.com', 'www.instagram.com'].includes(url.hostname)
      && parts.length >= 2
      && ['p', 'reel', 'tv'].includes(parts[0]);
  } catch {
    return false;
  }
};

const isCloudinaryImageUrl = (value) => {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    return url.protocol === 'https:'
      && url.hostname === 'res.cloudinary.com'
      && parts.length >= 3
      && parts[1] === 'image'
      && parts[2] === 'upload';
  } catch {
    return false;
  }
};

const approvalChecks = (data) => {
  const checks = [
    ['title', Boolean(data.title?.trim())],
    ['quantified ingredients', Boolean(data.ingredients?.length) && data.ingredients.every((item) => Number(item.quantity) > 0)],
    ['instructions', Boolean(data.instructions?.length) && data.instructions.every((step) => step.trim())],
    ['batch yield', Number(data.portions) > 0],
    ['planner meal type', plannerMealTypes.includes(data.meal_type)],
    ['per-serving macros', Number(data.nutrition_per_serving?.calories) > 0 && ['protein_g', 'carbs_g', 'fat_g'].every((key) => data.nutrition_per_serving?.[key] !== null && data.nutrition_per_serving?.[key] !== '')],
    ['storage guidance', Boolean(data.storage?.storage_instructions?.trim())],
    ['reheating guidance', Boolean(data.storage?.reheating_instructions?.trim())],
    ['trusted source and attribution', isInstagramPostUrl(data.source_url) && Boolean(data.attribution?.trim())],
    ['licensed Cloudinary thumbnail', isCloudinaryImageUrl(data.thumbnail_url)],
    ['allergen review', Boolean(data.allergen_reviewed)],
    ['dietary review', Boolean(data.dietary_reviewed)],
    ['food-safety confirmation', Boolean(data.food_safety_confirmed)],
  ];
  return checks;
};

const numberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export default function RecipeImportCandidateEditor() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const { getToken } = useRecipeImports();
  const [candidate, setCandidate] = useState(null);
  const [data, setData] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setError(null);
    try {
      const result = await recipeImportsApi.candidate(getToken, candidateId);
      setCandidate(result);
      setData(result.data);
      setSavedSnapshot(JSON.stringify(result.data));
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  const checks = useMemo(() => (data ? approvalChecks(data) : []), [data]);
  const blockers = checks.filter(([, complete]) => !complete);
  const dirty = data ? JSON.stringify(data) !== savedSnapshot : false;
  const reviewed = ['approved', 'rejected'].includes(candidate?.status);

  const patch = (key, value) => setData((current) => ({ ...current, [key]: value }));
  const patchNested = (group, key, value) =>
    setData((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));

  const updateIngredient = (index, key, value) => {
    patch('ingredients', data.ingredients.map((ingredient, currentIndex) => (
      currentIndex === index ? { ...ingredient, [key]: value } : ingredient
    )));
  };

  const save = async () => {
    setBusy('save');
    setError(null);
    try {
      const normalized = {
        ...data,
        portions: numberOrNull(data.portions),
        prep_time_minutes: numberOrNull(data.prep_time_minutes),
        cook_time_minutes: numberOrNull(data.cook_time_minutes),
        ingredients: data.ingredients.map((item) => ({
          ...item,
          quantity: numberOrNull(item.quantity),
        })),
        nutrition_per_serving: Object.fromEntries(
          Object.entries(data.nutrition_per_serving).map(([key, value]) => [
            key,
            ['calories', 'protein_g', 'carbs_g', 'fat_g'].includes(key) ? numberOrNull(value) : value,
          ]),
        ),
        storage: {
          ...data.storage,
          fridge_days: numberOrNull(data.storage.fridge_days),
          freezer_months: numberOrNull(data.storage.freezer_months),
        },
      };
      const result = await recipeImportsApi.updateCandidate(getToken, candidateId, normalized);
      setCandidate(result);
      setData(result.data);
      setSavedSnapshot(JSON.stringify(result.data));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const approve = async () => {
    setBusy('approve');
    setError(null);
    try {
      const result = await recipeImportsApi.approveCandidate(getToken, candidateId);
      navigate(`/admin/recipes/${result.recipe_id}/edit`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    const reason = window.prompt('Why is this candidate being rejected?');
    if (!reason?.trim()) return;
    setBusy('reject');
    try {
      const result = await recipeImportsApi.rejectCandidate(getToken, candidateId, reason.trim());
      setCandidate(result);
      setData(result.data);
      setSavedSnapshot(JSON.stringify(result.data));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const retry = async () => {
    setBusy('retry');
    try {
      await recipeImportsApi.retryCandidate(getToken, candidateId);
      navigate('/admin/recipe-imports/jobs');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        {error ? (
          <div className="text-sm text-rose-800">{error.message}</div>
        ) : (
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <main className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <button
                type="button"
                onClick={() => navigate('/admin/recipe-imports/candidates')}
                className="mb-2 p-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-primary"
              >
                ← Review queue
              </button>
              <div className="flex items-center gap-3">
                <h2 className="font-serif text-3xl">Recipe review</h2>
                <RecipeImportBadge status={candidate.status} />
              </div>
            </div>
            <a
              href={data.source_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm font-semibold text-primary"
            >
              View source <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          {error && (
            <div className="mt-5 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error.message}
            </div>
          )}
          {!!candidate.duplicate_recipe_ids.length && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Possible near duplicate of {candidate.duplicate_recipe_ids.length} active recipe(s).
              This is a warning only; nothing is merged automatically.
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8b5e3c]">01 · Identity</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium md:col-span-2">
              Recipe title
              <Input className="mt-2 text-base" value={data.title || ''} onChange={(event) => patch('title', event.target.value)} disabled={reviewed} />
            </label>
            <label className="text-sm font-medium">
              Batch yield / portions
              <Input className="mt-2" type="number" min="1" value={data.portions ?? ''} onChange={(event) => patch('portions', event.target.value)} disabled={reviewed} />
            </label>
            <label className="text-sm font-medium">
              Meal type
              <select
                className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm capitalize"
                value={plannerMealTypes.includes(data.meal_type) ? data.meal_type : ''}
                onChange={(event) => patch('meal_type', event.target.value || null)}
                disabled={reviewed}
              >
                <option value="">Select meal type</option>
                {plannerMealTypes.map((mealType) => (
                  <option key={mealType} value={mealType}>{mealType}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Prep minutes
              <Input className="mt-2" type="number" min="0" value={data.prep_time_minutes ?? ''} onChange={(event) => patch('prep_time_minutes', event.target.value)} disabled={reviewed} />
            </label>
            <label className="text-sm font-medium">
              Cook minutes
              <Input className="mt-2" type="number" min="0" value={data.cook_time_minutes ?? ''} onChange={(event) => patch('cook_time_minutes', event.target.value)} disabled={reviewed} />
            </label>
            <label className="text-sm font-medium md:col-span-2">
              Description
              <textarea className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm" rows={3} value={data.description || ''} onChange={(event) => patch('description', event.target.value)} disabled={reviewed} />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8b5e3c]">02 · Quantified ingredients</p>
            {!reviewed && (
              <Button size="sm" variant="outline" onClick={() => patch('ingredients', [...data.ingredients, blankIngredient])}>
                <Plus className="mr-2 h-4 w-4" /> Ingredient
              </Button>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {data.ingredients.map((ingredient, index) => (
              <div key={`${index}-${ingredient.original_text}`} className="grid gap-2 rounded-xl border border-border bg-[#fcfbf8] p-3 md:grid-cols-[1fr_110px_110px_1fr_auto]">
                <Input aria-label={`Ingredient ${index + 1} name`} placeholder="Ingredient" value={ingredient.name} onChange={(event) => updateIngredient(index, 'name', event.target.value)} disabled={reviewed} />
                <Input aria-label={`Ingredient ${index + 1} quantity`} type="number" min="0" step="any" placeholder="Quantity" value={ingredient.quantity ?? ''} onChange={(event) => updateIngredient(index, 'quantity', event.target.value)} disabled={reviewed} />
                <Input aria-label={`Ingredient ${index + 1} unit`} placeholder="Unit" value={ingredient.unit || ''} onChange={(event) => updateIngredient(index, 'unit', event.target.value)} disabled={reviewed} />
                <Input aria-label={`Ingredient ${index + 1} notes`} placeholder="Notes" value={ingredient.notes || ''} onChange={(event) => updateIngredient(index, 'notes', event.target.value)} disabled={reviewed} />
                {!reviewed && (
                  <Button aria-label={`Remove ingredient ${index + 1}`} size="sm" variant="ghost" onClick={() => patch('ingredients', data.ingredients.filter((_, currentIndex) => currentIndex !== index))}>
                    <Trash2 className="h-4 w-4 text-rose-700" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8b5e3c]">03 · Method and nutrition</p>
          <label className="mt-4 block text-sm font-medium">
            Instructions — one step per line
            <textarea
              className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm"
              rows={7}
              value={(data.instructions || []).join('\n')}
              onChange={(event) => patch('instructions', event.target.value.split('\n'))}
              disabled={reviewed}
            />
          </label>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['calories', 'Calories'],
              ['protein_g', 'Protein (g)'],
              ['carbs_g', 'Carbs (g)'],
              ['fat_g', 'Fat (g)'],
            ].map(([key, label]) => (
              <label key={key} className="text-sm font-medium">
                {label} / serving
                <Input className="mt-2" type="number" min="0" step="any" value={data.nutrition_per_serving[key] ?? ''} onChange={(event) => patchNested('nutrition_per_serving', key, event.target.value)} disabled={reviewed} />
              </label>
            ))}
          </div>
          {data.nutrition_calculation?.complete && (
            <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
              <div className="font-semibold">Calculated macro cross-check</div>
              <p className="mt-1 text-xs text-sky-800">
                Matvaretabellen is used first, with USDA FoodData Central as fallback.
                Verify each ingredient match before accepting calculated values.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {data.nutrition_calculation.sources.map((source) => (
                  <div key={`${source.ingredient}-${source.source_id}`} className="rounded-lg bg-white/70 p-2 text-xs">
                    {source.ingredient} → <strong>{source.matched_food}</strong>
                    <span className="block text-sky-700">{source.database} · {source.grams} g</span>
                  </div>
                ))}
              </div>
              {!!Object.keys(data.nutrition_calculation.comparison_percent || {}).length && (
                <p className="mt-3 text-xs text-sky-800">
                  Difference from creator values:{' '}
                  {Object.entries(data.nutrition_calculation.comparison_percent)
                    .map(([key, value]) => `${key.replace('_g', '')} ${value > 0 ? '+' : ''}${value}%`)
                    .join(' · ')}
                </p>
              )}
            </div>
          )}
          <label className="mt-4 block text-sm font-medium">
            Macro source
            <select className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm" value={data.nutrition_per_serving.source || ''} onChange={(event) => patchNested('nutrition_per_serving', 'source', event.target.value || null)} disabled={reviewed}>
              <option value="">Select source</option>
              <option value="creator">Creator stated</option>
              <option value="calculated">Calculated</option>
              <option value="admin">Admin supplied</option>
            </select>
          </label>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8b5e3c]">04 · Storage and provenance</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">
              Fridge days
              <Input className="mt-2" type="number" min="0" max="14" value={data.storage.fridge_days ?? ''} onChange={(event) => patchNested('storage', 'fridge_days', event.target.value)} disabled={reviewed} />
            </label>
            <label className="text-sm font-medium">
              Freezer months
              <Input className="mt-2" type="number" min="0" max="24" value={data.storage.freezer_months ?? ''} onChange={(event) => patchNested('storage', 'freezer_months', event.target.value)} disabled={reviewed} />
            </label>
            <label className="text-sm font-medium md:col-span-2">
              Storage guidance
              <textarea className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm" rows={3} value={data.storage.storage_instructions || ''} onChange={(event) => patchNested('storage', 'storage_instructions', event.target.value)} disabled={reviewed} />
            </label>
            <label className="text-sm font-medium md:col-span-2">
              Reheating guidance
              <textarea className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm" rows={3} value={data.storage.reheating_instructions || ''} onChange={(event) => patchNested('storage', 'reheating_instructions', event.target.value)} disabled={reviewed} />
            </label>
            <label className="text-sm font-medium">
              Attribution
              <Input className="mt-2" value={data.attribution || ''} onChange={(event) => patch('attribution', event.target.value)} disabled={reviewed} />
            </label>
            <label className="text-sm font-medium">
              Source URL
              <Input className="mt-2" type="url" value={data.source_url || ''} onChange={(event) => patch('source_url', event.target.value)} disabled={reviewed} />
            </label>
            <label className="text-sm font-medium md:col-span-2">
              Licensed Cloudinary thumbnail URL
              <Input className="mt-2" type="url" value={data.thumbnail_url || ''} onChange={(event) => patch('thumbnail_url', event.target.value)} disabled={reviewed} />
            </label>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              ['allergen_reviewed', 'Allergens reviewed'],
              ['dietary_reviewed', 'Dietary flags reviewed'],
              ['food_safety_confirmed', 'Storage guidance confirmed'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm font-medium">
                <input type="checkbox" checked={Boolean(data[key])} onChange={(event) => patch(key, event.target.checked)} disabled={reviewed} className="h-4 w-4 accent-[#3d5a3d]" />
                {label}
              </label>
            ))}
          </div>
        </section>
      </main>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <section className="rounded-2xl border border-[#d7c8aa] bg-[#fffaf0] p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8b5e3c]">Approval gate</p>
          <div className="mt-4 space-y-2">
            {checks.map(([label, complete]) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                {complete ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border border-amber-400 bg-white" />
                )}
                <span className={complete ? 'text-[#566052]' : 'font-medium text-[#6d4c2f]'}>{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-[#e3d8c2] pt-4 text-sm">
            {blockers.length ? (
              <span className="font-semibold text-amber-900">{blockers.length} checks remain</span>
            ) : (
              <span className="font-semibold text-emerald-800">Ready to publish</span>
            )}
          </div>
        </section>

        {!reviewed && (
          <section className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <Button className="w-full" onClick={save} disabled={!dirty || busy}>
              {busy === 'save' ? 'Saving…' : dirty ? 'Save review' : 'Review saved'}
            </Button>
            <Button className="w-full" onClick={approve} disabled={dirty || blockers.length > 0 || busy}>
              {busy === 'approve' ? 'Publishing…' : 'Approve & publish'}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={retry} disabled={busy}>Retry AI</Button>
              <Button variant="ghost" className="text-rose-700" onClick={reject} disabled={busy}>Reject</Button>
            </div>
            {dirty && <p className="text-center text-xs text-muted-foreground">Save edits before publishing.</p>}
          </section>
        )}
      </aside>
    </div>
  );
}
