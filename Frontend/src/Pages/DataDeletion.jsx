import React from 'react';
import { Link } from 'react-router-dom';
import { UserX } from 'lucide-react';

import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/i18n/useLanguage';

const LAST_UPDATED = 'February 8, 2026';

export default function DataDeletion() {
  const { t } = useLanguage();

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <UserX className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t('Data Deletion')}
            </p>
            <h1 className="headline-serif">
              {t('User Data Deletion')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('Last updated')}: {LAST_UPDATED}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-6 md:p-10 shadow-sm space-y-6 text-sm text-muted-foreground leading-relaxed">
          <p>
            You can request deletion of your Preppr account data at any time. We
            will verify your request before removing your information.
          </p>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">How to request deletion</h2>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Email pashatheboss1@berkeley.edu with the subject line "Delete my data".</li>
              <li>Include the email address you use to sign in to Preppr.</li>
              <li>We will confirm the request and complete deletion within 30 days.</li>
            </ol>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">What we delete</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Your account profile and authentication identifiers.</li>
              <li>Questionnaire answers, preferences, and saved meal plans.</li>
              <li>App usage data linked to your account.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">What we may keep</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Records required for legal, security, or compliance purposes.</li>
              <li>Aggregated or de-identified analytics that cannot be linked back to you.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Related policy</h2>
            <p>
              Review the{' '}
              <Link to="/privacy-policy" className="text-primary font-medium hover:underline">
                privacy policy
              </Link>{' '}
              for more details about how we handle data.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
