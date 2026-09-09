import React, { useEffect, useState } from 'react';
import { ArrowRight, Copy, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { recipeImportsApi } from '@/Entities/recipeImports';
import RecipeImportBadge from '@/components/admin/RecipeImportBadge';
import { Button } from '@/components/ui/button';
import { useRecipeImports } from './recipeImportsContext';

export default function RecipeImportCandidates() {
  const { getToken } = useRecipeImports();
  const [filter, setFilter] = useState('');
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      const data = await recipeImportsApi.candidates(getToken, filter);
      setItems(data.items || []);
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="font-serif text-2xl">Review queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One source post may contain several individually reviewed recipes.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Candidate status"
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="incomplete">Incomplete</option>
            <option value="ready_for_review">Ready for review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>
      {error && <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error.message}</div>}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((candidate) => (
          <article key={candidate.id} className="group overflow-hidden rounded-xl border border-border bg-[#fdfcf9]">
            <div className="aspect-[16/9] bg-[#e7e2d7]">
              {candidate.data.thumbnail_url ? (
                <img src={candidate.data.thumbnail_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs uppercase tracking-widest text-muted-foreground">Thumbnail required</div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <RecipeImportBadge status={candidate.status} />
                {!!candidate.duplicate_recipe_ids.length && (
                  <span className="flex items-center gap-1 text-xs text-amber-800">
                    <Copy className="h-3.5 w-3.5" /> possible duplicate
                  </span>
                )}
              </div>
              <h3 className="mt-3 line-clamp-2 font-serif text-xl">
                {candidate.data.title || 'Untitled extraction'}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {candidate.data.ingredients.length} ingredients · {candidate.data.portions || '—'} servings
              </p>
              <p className="mt-3 text-xs text-orange-800">
                {candidate.blockers.length ? `${candidate.blockers.length} approval checks remain` : 'All approval checks complete'}
              </p>
              <Link
                to={`/admin/recipe-imports/candidates/${candidate.id}`}
                className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm font-semibold text-primary"
              >
                Open review <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </article>
        ))}
      </div>
      {!items.length && <div className="p-12 text-center text-sm text-muted-foreground">No candidates match this filter.</div>}
    </section>
  );
}
