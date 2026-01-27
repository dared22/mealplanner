import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { API_URL } from '@/Entities/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DEFAULT_LIMIT = 20;

const formatDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString();
};

const formatMealType = (value) => {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getStatusBadge = (isActive) => {
  if (isActive) {
    return 'bg-emerald-100 text-emerald-700';
  }
  return 'bg-rose-100 text-rose-700';
};

export default function AdminRecipes() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: DEFAULT_LIMIT,
    offset: 0,
  });
  const [inputs, setInputs] = useState({
    search: '',
    status: 'all',
  });
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
  });

  const totalPages = useMemo(() => {
    if (!pagination.total) return 1;
    return Math.max(1, Math.ceil(pagination.total / pagination.limit));
  }, [pagination.limit, pagination.total]);

  const currentPage = useMemo(() => {
    return Math.floor(pagination.offset / pagination.limit) + 1;
  }, [pagination.limit, pagination.offset]);

  const canGoBack = pagination.offset > 0;
  const canGoNext = pagination.offset + pagination.limit < pagination.total;

  const applyFilters = () => {
    setFilters({
      search: inputs.search.trim(),
      status: inputs.status,
    });
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const clearFilters = () => {
    setInputs({ search: '', status: 'all' });
    setFilters({ search: '', status: 'all' });
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const fetchRecipes = async () => {
    setStatus('loading');
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Missing authentication token. Please sign in again.');
      }

      const params = new URLSearchParams();
      if (filters.search) {
        params.set('search', filters.search);
      }
      if (filters.status === 'active') {
        params.set('active', 'true');
      }
      if (filters.status === 'inactive') {
        params.set('active', 'false');
      }
      params.set('limit', String(pagination.limit));
      params.set('offset', String(pagination.offset));

      const response = await fetch(`${API_URL}/admin/recipes?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setRecipes(data.items || []);
      if (data.pagination) {
        setPagination({
          total: data.pagination.total,
          limit: data.pagination.limit,
          offset: data.pagination.offset,
        });
      } else {
        setPagination((prev) => ({ ...prev, total: 0 }));
      }
      setStatus('ready');
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  };


  useEffect(() => {
    fetchRecipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pagination.offset, pagination.limit]);

  const handlePageChange = (direction) => {
    if (direction === 'prev' && canGoBack) {
      setPagination((prev) => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }));
    }
    if (direction === 'next' && canGoNext) {
      setPagination((prev) => ({ ...prev, offset: prev.offset + prev.limit }));
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
        Loading recipes...
      </div>
    );
  }

  if (status === 'error') {
    const errorMessage = error?.message || 'Something went wrong while fetching recipes.';
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold">Failed to load recipes</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
        </div>
        <Button variant="default" onClick={fetchRecipes} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      </div>
    );
  }

  const startIndex = pagination.total === 0 ? 0 : pagination.offset + 1;
  const endIndex = Math.min(pagination.offset + pagination.limit, pagination.total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Recipe Database</h1>
        <p className="text-muted-foreground">
          Search recipes, review tags, and manage active listings.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-search">
              Search
            </label>
            <Input
              id="recipe-search"
              placeholder="Search by name or tag"
              value={inputs.search}
              onChange={(event) =>
                setInputs((prev) => ({ ...prev, search: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="recipe-status">
              Status
            </label>
            <select
              id="recipe-status"
              value={inputs.status}
              onChange={(event) =>
                setInputs((prev) => ({ ...prev, status: event.target.value }))
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={applyFilters}>Apply filters</Button>
          <Button variant="outline" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <div className="text-sm font-medium text-foreground">All recipes</div>
            <div className="text-xs text-muted-foreground">
              {pagination.total} total recipes
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
        </div>

        {recipes.length === 0 ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">
            No recipes match your filters. Try adjusting the search or status.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recipes.map((recipe) => {
              const statusLabel = recipe.is_active ? 'Active' : 'Inactive';
              const tagsLabel = recipe.tags?.length ? recipe.tags.join(', ') : 'No tags';
              return (
                <div
                  key={recipe.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                >
                  <div>
                    <div className="font-medium text-foreground">{recipe.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatMealType(recipe.meal_type)} · {tagsLabel}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(
                        recipe.is_active,
                      )}`}
                    >
                      {statusLabel}
                    </span>
                    <span className="text-muted-foreground">{formatDate(recipe.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div className="text-xs text-muted-foreground">
            Showing {startIndex}-{endIndex} of {pagination.total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange('prev')}
              disabled={!canGoBack}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange('next')}
              disabled={!canGoNext}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
