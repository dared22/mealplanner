import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/i18n/useLanguage';
import { MoreHorizontal } from 'lucide-react';

export default function More() {
  const { t } = useLanguage();

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <MoreHorizontal className="w-12 h-12 text-primary" />
          </div>
          <h1 className="headline-serif mb-4">
            {t('More')}
          </h1>
          <p className="text-lg text-muted-foreground mb-2">
            {t('Under construction...')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('This page is coming soon with additional features and settings.')}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
