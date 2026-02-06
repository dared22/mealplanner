import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useLanguage } from '@/i18n/useLanguage';
import { Lightbulb } from 'lucide-react';

export default function MealTips() {
  const { t } = useLanguage();

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <Lightbulb className="w-12 h-12 text-primary" />
          </div>
          <h1 className="headline-serif mb-4">
            {t('Meal Tips')}
          </h1>
          <p className="text-lg text-muted-foreground mb-2">
            {t('Under construction...')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('This page is coming soon with helpful tips and tricks for healthy eating and meal preparation.')}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
