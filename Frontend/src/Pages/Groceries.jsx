import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/i18n/useLanguage';

export default function Groceries() {
  const { t } = useLanguage();

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <h1 className="headline-serif text-2xl text-muted-foreground">
          {t('Under Construction')}
        </h1>
      </div>
    </DashboardLayout>
  );
}
