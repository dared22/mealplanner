import React from 'react';
import { cn } from '@/lib/utils';

const tones = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  ready_for_review: 'border-sky-200 bg-sky-50 text-sky-800',
  processing: 'border-amber-200 bg-amber-50 text-amber-800',
  discovering: 'border-amber-200 bg-amber-50 text-amber-800',
  queued: 'border-stone-200 bg-stone-50 text-stone-700',
  incomplete: 'border-orange-200 bg-orange-50 text-orange-800',
  failed: 'border-rose-200 bg-rose-50 text-rose-800',
  partial_failed: 'border-rose-200 bg-rose-50 text-rose-800',
  revoked: 'border-stone-300 bg-stone-100 text-stone-600',
  rejected: 'border-stone-300 bg-stone-100 text-stone-600',
  cancelled: 'border-stone-300 bg-stone-100 text-stone-600',
};

export default function RecipeImportBadge({ status, className }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
        tones[status] || tones.queued,
        className,
      )}
    >
      {String(status || 'unknown').replaceAll('_', ' ')}
    </span>
  );
}
