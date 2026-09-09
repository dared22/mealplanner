import React, { useEffect, useState } from 'react';
import { ExternalLink, Plus, RefreshCw, ShieldOff } from 'lucide-react';
import { recipeImportsApi } from '@/Entities/recipeImports';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import RecipeImportBadge from '@/components/admin/RecipeImportBadge';
import { useRecipeImports } from './recipeImportsContext';

const emptyForm = {
  profile_url: '',
  display_name: '',
  allowed_domains: '',
  permission_basis: '',
  permission_record_url: '',
  permission_confirmed: false,
};

export default function RecipeImportCreators() {
  const { getToken, readiness } = useRecipeImports();
  const [creators, setCreators] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [manual, setManual] = useState({
    creator_id: '',
    source_url: '',
    creator_text: '',
    media_url: '',
    media_type: null,
    media_public_id: null,
  });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try {
      const data = await recipeImportsApi.creators(getToken);
      setCreators(data.items || []);
      setManual((current) => ({
        ...current,
        creator_id: current.creator_id || data.items?.find((item) => item.status === 'active')?.id || '',
      }));
    } catch (err) {
      setError(err);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCreator = async (event) => {
    event.preventDefault();
    setBusy('create');
    setError(null);
    try {
      await recipeImportsApi.createCreator(getToken, {
        profile_url: form.profile_url,
        display_name: form.display_name.trim() || null,
        allowed_domains: form.allowed_domains.split(',').map((value) => value.trim()).filter(Boolean),
        permission_basis: form.permission_basis.trim(),
        permission_record_url: form.permission_record_url.trim() || null,
        permission_confirmed: form.permission_confirmed,
      });
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const scan = async (creatorId, mode) => {
    setBusy(`${creatorId}-${mode}`);
    setError(null);
    try {
      await recipeImportsApi.scanCreator(getToken, creatorId, { mode, limit: 100 });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (creator) => {
    if (!window.confirm(`Revoke @${creator.instagram_username}? Linked imported recipes will be deactivated.`)) return;
    setBusy(`${creator.id}-revoke`);
    try {
      await recipeImportsApi.revokeCreator(getToken, creator.id);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const submitManual = async (event) => {
    event.preventDefault();
    setBusy('manual');
    try {
      await recipeImportsApi.manualPost(getToken, {
        ...manual,
        media_url: manual.media_url.trim() || null,
      });
      setManual((current) => ({
        ...current,
        source_url: '',
        creator_text: '',
        media_url: '',
        media_type: null,
        media_public_id: null,
      }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const uploadMedia = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy('media');
    setError(null);
    try {
      const result = await recipeImportsApi.uploadManualMedia(getToken, file);
      setManual((current) => ({
        ...current,
        media_url: result.media_url,
        media_type: result.media_type,
        media_public_id: result.media_public_id,
      }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const importsDisabled = !readiness?.enabled;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,.6fr)]">
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-end justify-between border-b border-border p-5">
          <div>
            <h2 className="font-serif text-2xl text-foreground">Approved creators</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Explicit permission records for professional public accounts.
            </p>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {creators.length.toString().padStart(2, '0')} total
          </span>
        </div>
        <div className="divide-y divide-border">
          {creators.map((creator) => (
            <article key={creator.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={creator.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 font-semibold text-foreground hover:text-primary"
                  >
                    @{creator.instagram_username}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <RecipeImportBadge status={creator.status} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {creator.display_name || 'No display name'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Linked-site allowlist: {creator.allowed_domains.length ? creator.allowed_domains.join(', ') : 'none'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Permission: {creator.permission_basis}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {creator.status === 'active' && (
                  <>
                    <Button
                      size="sm"
                      disabled={importsDisabled || busy}
                      onClick={() => scan(creator.id, 'new')}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Latest 100
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={importsDisabled || busy}
                      onClick={() => scan(creator.id, 'older')}
                    >
                      Older batch
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={importsDisabled || busy}
                      onClick={() => revoke(creator)}
                      className="text-rose-700"
                    >
                      <ShieldOff className="mr-2 h-4 w-4" />
                      Revoke
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}
          {!creators.length && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No creators are approved yet.
            </div>
          )}
        </div>
      </section>

      <div className="space-y-6">
        <form onSubmit={createCreator} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
            <Plus className="h-5 w-5" />
          </div>
          <h2 className="font-serif text-xl">Approve a creator</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Their public professional profile must be visible through Meta Business Discovery.
          </p>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium">
              Instagram profile URL
              <Input
                className="mt-2"
                type="url"
                required
                placeholder="https://www.instagram.com/creator/"
                value={form.profile_url}
                onChange={(event) => setForm({ ...form, profile_url: event.target.value })}
              />
            </label>
            <label className="block text-sm font-medium">
              Display name
              <Input
                className="mt-2"
                value={form.display_name}
                onChange={(event) => setForm({ ...form, display_name: event.target.value })}
              />
            </label>
            <label className="block text-sm font-medium">
              Approved recipe domains
              <Input
                className="mt-2"
                placeholder="creator.com, recipes.creator.com"
                value={form.allowed_domains}
                onChange={(event) => setForm({ ...form, allowed_domains: event.target.value })}
              />
            </label>
            <label className="block text-sm font-medium">
              Permission basis
              <textarea
                className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm"
                required
                rows={3}
                placeholder="Where and what the creator approved"
                value={form.permission_basis}
                onChange={(event) => setForm({ ...form, permission_basis: event.target.value })}
              />
            </label>
            <label className="block text-sm font-medium">
              Permission record URL
              <Input
                className="mt-2"
                type="url"
                placeholder="Optional secure record URL"
                value={form.permission_record_url}
                onChange={(event) => setForm({ ...form, permission_record_url: event.target.value })}
              />
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[#3d5a3d]"
                checked={form.permission_confirmed}
                onChange={(event) => setForm({ ...form, permission_confirmed: event.target.checked })}
                required
              />
              I confirm the creator has approved recipe ingestion and licensed thumbnail use.
            </label>
          </div>
          <Button className="mt-5 w-full" disabled={importsDisabled || busy === 'create'}>
            {busy === 'create' ? 'Approving…' : 'Add to allowlist'}
          </Button>
        </form>

        <form onSubmit={submitManual} className="rounded-2xl border border-dashed border-[#b9a98e] bg-[#fffaf0] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8b5e3c]">
            App-review fallback
          </p>
          <h2 className="mt-2 font-serif text-xl">Submit one post manually</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use creator-supplied text. This does not run a browser scraper.
          </p>
          <div className="mt-4 space-y-3">
            <select
              className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
              required
              value={manual.creator_id}
              onChange={(event) => setManual({ ...manual, creator_id: event.target.value })}
            >
              <option value="">Select creator</option>
              {creators.filter((creator) => creator.status === 'active').map((creator) => (
                <option key={creator.id} value={creator.id}>@{creator.instagram_username}</option>
              ))}
            </select>
            <Input
              type="url"
              required
              placeholder="Instagram post URL"
              value={manual.source_url}
              onChange={(event) => setManual({ ...manual, source_url: event.target.value })}
            />
            <textarea
              required
              rows={5}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              placeholder="Creator-supplied caption or recipe text"
              value={manual.creator_text}
              onChange={(event) => setManual({ ...manual, creator_text: event.target.value })}
            />
            <Input
              type="url"
              readOnly
              placeholder="Uploaded Cloudinary media URL"
              value={manual.media_url}
            />
            <label className="block rounded-md border border-dashed border-[#c8b99e] bg-white p-3 text-xs text-muted-foreground">
              Or upload licensed image/video (max 100 MB)
              <input
                className="mt-2 block w-full text-xs"
                type="file"
                accept="image/*,video/*"
                onChange={uploadMedia}
                disabled={busy === 'media'}
              />
            </label>
          </div>
          <Button className="mt-4 w-full" variant="outline" disabled={importsDisabled || busy === 'manual'}>
            Queue manual post
          </Button>
        </form>
      </div>
      {error && (
        <div className="xl:col-span-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error.message}
        </div>
      )}
    </div>
  );
}
