import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { API_URL } from '@/Entities/api';
import { Button, buttonVariants } from '@/components/ui/button';
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
  const [deletingId, setDeletingId] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importStatus, setImportStatus] = useState('idle');
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);

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

  const handleDelete = async (recipeId, recipeTitle) => {
    const confirmed = window.confirm(
      `Delete "${recipeTitle}"? This will deactivate the recipe and remove it from meal plan generation.`,
    );
    if (!confirmed) return;

    setDeletingId(recipeId);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Missing authentication token. Please sign in again.');
      }

      const response = await fetch(`${API_URL}/admin/recipes/${recipeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Delete failed with status ${response.status}`);
      }

      await fetchRecipes();
    } catch (err) {
      setError(err);
      setStatus('error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      setImportError(new Error('Select a CSV or Parquet file to upload.'));
      return;
    }

    setImportStatus('uploading');
    setImportProgress(0);
    setImportError(null);
    setImportResult(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Missing authentication token. Please sign in again.');
      }

      const ext = importFile.name.split('.').pop()?.toLowerCase();
      const contentType = ext === 'csv' ? 'text/csv' : 'application/octet-stream';
      const payload = await importFile.arrayBuffer();

      const data = await new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', `${API_URL}/admin/recipes/import`);
        request.responseType = 'json';
        request.setRequestHeader('Authorization', `Bearer ${token}`);
        request.setRequestHeader('Content-Type', contentType);
        request.setRequestHeader('X-File-Name', importFile.name);

        request.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const percent = Math.round((event.loaded / event.total) * 100);
          setImportProgress(percent);
        };

        request.onerror = () => reject(new Error('Import failed due to a network error.'));
        request.onload = () => {
          if (request.status < 200 || request.status >= 300) {
            reject(new Error(`Import failed with status ${request.status}`));
            return;
          }
          setImportProgress(100);
          resolve(request.response || {});
        };

        request.send(payload);
      });
      setImportResult(data);
      setImportStatus('success');
      await fetchRecipes();
    } catch (err) {
      setImportError(err);
      setImportStatus('error');
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recipe Database</h1>
          <p className="text-muted-foreground">
            Search recipes, review tags, and manage active listings.
          </p>
        </div>
        <Link to="/admin/recipes/new" className={buttonVariants({ size: 'sm' })}>
          Add recipe
        </Link>
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
              onChange={(event) => {
                const nextStatus = event.target.value;
                setInputs((prev) => ({ ...prev, status: nextStatus }));
                setFilters((prev) => ({ ...prev, status: nextStatus }));
                setPagination((prev) => ({ ...prev, offset: 0 }));
              }}
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

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Bulk import</h2>
            <p className="text-sm text-muted-foreground">
              Upload a CSV or Parquet file to add or update recipes in bulk.
            </p>
          </div>
          <Button onClick={handleImport} disabled={importStatus === 'uploading'}>
            {importStatus === 'uploading' ? 'Uploading...' : 'Upload file'}
          </Button>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            id="bulk-import-file"
            type="file"
            accept=".csv,.parquet,.pq"
            className="sr-only"
            onChange={(event) => {
              setImportFile(event.target.files?.[0] || null);
              setImportStatus('idle');
              setImportProgress(0);
              setImportError(null);
              setImportResult(null);
            }}
          />
          <label htmlFor="bulk-import-file" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Velg fil
          </label>
          <div className="text-sm text-muted-foreground">
            {importFile ? importFile.name : 'No file selected'}
          </div>
        </div>
        {importStatus === 'uploading' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Uploading...</span>
              <span>{importProgress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/60">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}
        {importError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {importError?.message || 'Import failed.'}
          </div>
        )}
        {importResult && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-foreground">
            Imported {importResult.created} created, {importResult.updated} updated, {importResult.skipped} skipped.
          </div>
        )}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Name</th>
                  <th className="px-6 py-3 text-left font-medium">Tags</th>
                  <th className="px-6 py-3 text-left font-medium">Meal type</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-left font-medium">Last updated</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recipes.map((recipe) => {
                  const statusLabel = recipe.is_active ? 'Active' : 'Inactive';
                  const tagsLabel = recipe.tags?.length ? recipe.tags.join(', ') : '—';
                  return (
                    <tr key={recipe.id} className="hover:bg-muted/20">
                      <td className="px-6 py-4 font-medium text-foreground">{recipe.title}</td>
                      <td className="px-6 py-4 text-muted-foreground">{tagsLabel}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatMealType(recipe.meal_type)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(
                            recipe.is_active,
                          )}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatDate(recipe.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            to={`/admin/recipes/${recipe.id}/edit`}
                            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            Edit
                          </Link>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(recipe.id, recipe.title)}
                            disabled={deletingId === recipe.id}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
