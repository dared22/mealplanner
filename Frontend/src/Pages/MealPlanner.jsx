import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Moon, Sun } from 'lucide-react'
import { UserPreferences } from '@/Entities/UserPreferences'

import { Button } from '@/components/ui/button'
import { useLanguage } from '@/i18n/LanguageContext'

import ProgressBar from '@/components/questionnaire/ProgressBar'
import PersonalInfoStep, { validatePersonalInfo } from '@/components/questionnaire/PersonalInfoStep'
import ActivityStep from '@/components/questionnaire/ActivityStep'
import GoalsStep from '@/components/questionnaire/GoalsStep'
import DietaryStep from '@/components/questionnaire/DietaryStep'
import CuisineStep from '@/components/questionnaire/CuisineStep'
import PreferencesStep from '@/components/questionnaire/PreferencesStep'
import ResultsStep from '@/components/questionnaire/ResultsStep'

const STORAGE_VERSION = 1;
const TOTAL_STEPS = 7;

const clampStep = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(Math.max(Math.trunc(numeric), 1), TOTAL_STEPS);
};

const loadStoredProgress = (storageKey) => {
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== STORAGE_VERSION) return null;
    return parsed;
  } catch (error) {
    console.warn('Failed to read stored meal planner progress', error);
    return null;
  }
};

const persistProgress = (storageKey, payload) => {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ version: STORAGE_VERSION, ...payload })
    );
  } catch (error) {
    console.warn('Failed to store meal planner progress', error);
  }
};


export default function MealPlanner({ onLogout, user }) {
  const { lang, setLang, t } = useLanguage();
  const userId = user?.id ?? user?.user_id ?? user?.userId ?? null;
  const storageKey = userId ? `mealplanner_progress_${userId}` : null;
  const initialProgress = useMemo(
    () => loadStoredProgress(storageKey),
    [storageKey]
  );

  const [currentStep, setCurrentStep] = useState(() =>
    clampStep(initialProgress?.currentStep ?? 1)
  );
  const [formData, setFormData] = useState(() =>
    initialProgress?.formData && typeof initialProgress.formData === 'object'
      ? initialProgress.formData
      : {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planPayload, setPlanPayload] = useState(() => initialProgress?.planPayload ?? null);
  const [rawPlanText, setRawPlanText] = useState(() => initialProgress?.rawPlanText ?? '');
  const [planStatus, setPlanStatus] = useState(() => initialProgress?.planStatus ?? 'idle');
  const [planError, setPlanError] = useState(() => initialProgress?.planError ?? null);
  const [preferenceId, setPreferenceId] = useState(() => initialProgress?.preferenceId ?? null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    return prefersDark ?? false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }
  }, [isDarkMode]);

  const totalSteps = TOTAL_STEPS;

  const updateFormData = (newData) => {
    setFormData(prev => ({ ...prev, ...newData }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return validatePersonalInfo(formData).isValid;
      case 2:
        return formData.activity_level;
      case 3:
        return formData.nutrition_goal;
      case 4:
        return formData.dietary_restrictions && formData.dietary_restrictions.length > 0;
      case 5:
        return formData.preferred_cuisines && formData.preferred_cuisines.length > 0;
      case 6:
        return formData.cooking_time_preference && formData.meals_per_day && formData.budget_range;
      default:
        return true;
    }
  };

  const pollForPlan = useCallback(async (preferenceId, language) => {
    const maxAttempts = 60;
    const delayMs = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await UserPreferences.fetch(preferenceId, language);
      const status = response?.plan_status;
      const serverPlan = response?.plan ?? null;
      const rawText = response?.raw_plan ?? '';
      const serverError = response?.error ?? '';
      const translationStatus = response?.translation_status;
      const translationError = response?.translation_error;

      if (translationStatus === 'pending') {
        setPlanPayload(null);
        setRawPlanText('');
        setPlanStatus('loading');
        setPlanError(null);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      if (translationStatus === 'error') {
        setPlanStatus('error');
        setPlanError(
          translationError || 'The plan could not be translated. Please try again.'
        );
        return;
      }

      if (status === 'success' || serverPlan) {
        setPlanPayload(serverPlan);
        setRawPlanText(rawText);
        setPlanStatus('success');
        setPlanError(null);
        return;
      }

      if (status === 'error') {
        setPlanStatus('error');
        setPlanError(
          serverError || t('The AI response did not include a plan. Please try again.')
        );
        return;
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    setPlanStatus('error');
    setPlanError(t('Plan generation is taking longer than expected. Please try again soon.'));
  }, [t]);

  useEffect(() => {
    if (!storageKey) return;
    persistProgress(storageKey, {
      currentStep,
      formData,
      planPayload,
      rawPlanText,
      planStatus,
      planError,
      preferenceId,
    });
  }, [
    storageKey,
    currentStep,
    formData,
    planPayload,
    rawPlanText,
    planStatus,
    planError,
    preferenceId,
  ]);

  useEffect(() => {
    if (!preferenceId) return;
    if (planStatus !== 'loading' && planStatus !== 'pending') return;
    pollForPlan(preferenceId, lang);
  }, [planStatus, pollForPlan, preferenceId, lang]);

  useEffect(() => {
    if (!preferenceId || planStatus !== 'success') return;
    let isActive = true;
    const refreshPlan = async () => {
      try {
        const response = await UserPreferences.fetch(preferenceId, lang);
        if (!isActive) return;
        const translationStatus = response?.translation_status;
        const translationError = response?.translation_error;
        if (translationStatus === 'pending') {
          setPlanStatus('loading');
          setPlanError(null);
          await pollForPlan(preferenceId, lang);
          return;
        }
        if (translationStatus === 'error') {
          setPlanStatus('error');
          setPlanError(
            translationError || t('The plan could not be translated. Please try again.')
          );
          return;
        }
        setPlanPayload(response?.plan ?? null);
        setRawPlanText(response?.raw_plan ?? '');
      } catch (error) {
        console.warn('Failed to refresh plan for language switch', error);
      }
    };
    refreshPlan();
    return () => {
      isActive = false;
    };
  }, [lang, preferenceId, planStatus, pollForPlan, t]);

  const handleFinish = async () => {
    if (!userId) {
      console.error(t('Cannot submit preferences without user context.'))
      return
    }
    const language = lang;

    setPlanError(null);
    setPlanPayload(null);
    setRawPlanText('');
    setPlanStatus('loading');
    setPreferenceId(null);
    setIsSubmitting(true);
    setCurrentStep(TOTAL_STEPS);

    try {
      const response = await UserPreferences.create({
        ...formData,
        user_id: userId,
        language: lang,
      });
      const serverPlan = response?.plan ?? null;
      const rawText = response?.raw_plan ?? '';
      const serverError = response?.error ?? '';
      const returnedId = response?.id ?? null;

      if (returnedId) {
        setPreferenceId(returnedId);
      }

      if (serverPlan) {
        setPlanPayload(serverPlan);
        setRawPlanText(rawText);
        setPlanStatus('success');
      } else if (response?.plan_status === 'error') {
        setPlanStatus('error');
        setPlanError(
          serverError || t('The AI response did not include a plan. Please try again.')
        );
      } else if (response?.id) {
        await pollForPlan(response.id, language);
      } else {
        setPlanStatus('error');
        setPlanError(t('Unable to start plan generation. Please try again.'));
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      setPlanStatus('error');
      setPlanError(error.message || t('Something went wrong while creating your plan.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <PersonalInfoStep data={formData} onChange={updateFormData} />;
      case 2:
        return <ActivityStep data={formData} onChange={updateFormData} />;
      case 3:
        return <GoalsStep data={formData} onChange={updateFormData} />;
      case 4:
        return <DietaryStep data={formData} onChange={updateFormData} />;
      case 5:
        return <CuisineStep data={formData} onChange={updateFormData} />;
      case 6:
        return <PreferencesStep data={formData} onChange={updateFormData} />;
      case 7:
        return (
          <ResultsStep
            data={formData}
            plan={planPayload}
            rawPlanText={rawPlanText}
            status={planStatus}
            errorMessage={planError}
            onRegenerate={handleFinish}
            regenerateDisabled={isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  const handleLogoutClick = () => {
    onLogout?.()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F5] via-white to-[#F5F5F5] p-4 md:p-8 transition-colors dark:from-[#0F172A] dark:via-[#111827] dark:to-[#0F172A]">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-end items-center gap-3 mb-4">
          {onLogout && (
            <Button
              variant="outline"
              onClick={handleLogoutClick}
              className="rounded-full bg-white/70 text-gray-600 shadow-sm hover:bg-white dark:bg-slate-800/70 dark:text-gray-200 dark:hover:bg-slate-700"
            >
              {t('Log out')}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setLang(lang === 'en' ? 'no' : 'en')}
            className="rounded-full bg-white/70 text-gray-600 shadow-sm hover:bg-white dark:bg-slate-800/70 dark:text-gray-200 dark:hover:bg-slate-700"
          >
            {lang === 'en' ? 'NO' : 'EN'}
            <span className="sr-only">{t('Language')}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDarkMode(prev => !prev)}
            className="rounded-full bg-white/70 text-gray-600 shadow-sm hover:bg-white dark:bg-slate-800/70 dark:text-gray-200 dark:hover:bg-slate-700"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="sr-only">{t('Toggle dark mode')}</span>
          </Button>
        </div>
        <Motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-semibold mb-3 text-[#0f172a] dark:text-gray-100">
            {t('Meal Intelligence')}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {t(
              'Answer a few focused questions to tailor your weekly plan. Clear, structured, and ready to use.'
            )}
          </p>
        </Motion.div>

        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-xl p-6 md:p-8 transition-colors dark:bg-slate-900 dark:shadow-[0_24px_60px_rgba(7,11,23,0.45)]"
        >
          {currentStep < 7 && (
            <ProgressBar currentStep={currentStep} totalSteps={6} />
          )}

          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>

          {currentStep < 7 && (
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex justify-between mt-8"
            >
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="flex items-center gap-2 dark:border-slate-700 dark:text-gray-200"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('Back')}
              </Button>

              {currentStep === 6 ? (
                <Button
                  onClick={handleFinish}
                  disabled={!isStepValid() || isSubmitting}
                  className="flex items-center gap-2 px-8"
                >
                  {isSubmitting ? t('Preparing your plan...') : t('Generate my plan')}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  disabled={!isStepValid()}
                  className="flex items-center gap-2"
                >
                  {t('Continue')}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </Motion.div>
          )}
        </Motion.div>
      </div>
    </div>
  );
}
