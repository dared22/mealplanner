import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/i18n/useLanguage';

const LAST_UPDATED = 'February 8, 2026';

export default function PrivacyPolicy() {
  const { t } = useLanguage();

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t('Privacy Policy')}
            </p>
            <h1 className="headline-serif">
              {t('Privacy Policy')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('Last updated')}: {LAST_UPDATED}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-6 md:p-10 shadow-sm space-y-6 text-sm text-muted-foreground leading-relaxed">
          <p>
            Preppr collects and uses personal data only to deliver your meal plans,
            personalize recommendations, and keep the service running. This summary
            is intentionally simple and will be expanded as we add more features.
          </p>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Information we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Account details you provide (name, email, authentication details).</li>
              <li>Questionnaire answers, dietary preferences, and meal plan feedback.</li>
              <li>Usage data such as feature interactions and basic device information.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">How we use your information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Generate and personalize meal plans and recipes.</li>
              <li>Improve recommendations, analytics, and product stability.</li>
              <li>Provide support and respond to your requests.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">How we share information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>We do not sell your personal data.</li>
              <li>We share data with service providers who help operate the app.</li>
              <li>We may disclose information if required by law or to protect users.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Data retention</h2>
            <p>
              We keep your data only as long as needed to provide the service or as
              required for legal, accounting, or security purposes.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Your choices</h2>
            <p>
              You can request a copy of your data, ask us to correct it, or request
              deletion. Visit the{' '}
              <Link to="/data-deletion" className="text-primary font-medium hover:underline">
                data deletion page
              </Link>{' '}
              to get started.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Contact</h2>
            <p>
              Questions about privacy can be sent to pashatheboss1@berkeley.edu.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
