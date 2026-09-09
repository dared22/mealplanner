import React, { useEffect, useState } from 'react';
import { Ban, RefreshCw } from 'lucide-react';
import { recipeImportsApi } from '@/Entities/recipeImports';
import RecipeImportBadge from '@/components/admin/RecipeImportBadge';
import { Button } from '@/components/ui/button';
import { useRecipeImports } from './recipeImportsContext';

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—');

export default function RecipeImportJobs() {
  const { getToken } = useRecipeImports();
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setError(null);
    try {
      const data = await recipeImportsApi.jobs(getToken);
      setJobs(data.items || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 10000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = async (jobId) => {
    try {
      await recipeImportsApi.cancelJob(getToken, jobId);
      await load();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border p-5">
        <div>
          <h2 className="font-serif text-2xl">Import jobs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Durable worker progress. This view refreshes every ten seconds.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </header>
      {error && <div className="m-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error.message}</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-[#faf8f3] text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Started</th>
              <th className="px-5 py-3">Mode</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Progress</th>
              <th className="px-5 py-3">Candidates</th>
              <th className="px-5 py-3">Failures</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="px-5 py-4 font-mono text-xs">{formatDate(job.started_at || job.created_at)}</td>
                <td className="px-5 py-4 capitalize">{job.mode}</td>
                <td className="px-5 py-4"><RecipeImportBadge status={job.status} /></td>
                <td className="px-5 py-4">{job.processed_count} / {job.discovered_count || job.requested_limit}</td>
                <td className="px-5 py-4 font-semibold">{job.candidate_count}</td>
                <td className="px-5 py-4">{job.failed_count}</td>
                <td className="px-5 py-4 text-right">
                  {['queued', 'discovering', 'processing'].includes(job.status) && (
                    <Button size="sm" variant="ghost" onClick={() => cancel(job.id)}>
                      <Ban className="mr-2 h-4 w-4" /> Cancel
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!jobs.length && !loading && <div className="p-10 text-center text-sm text-muted-foreground">No import jobs yet.</div>}
    </section>
  );
}
