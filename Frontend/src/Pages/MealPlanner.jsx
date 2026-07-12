import React, { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Lock, Moon, Sun } from 'lucide-react';
import { UserPreferences } from '@/Entities/UserPreferences';
import { useLanguage } from '@/i18n/useLanguage';
import { LogoInline } from '@/components/Logo';
import { AppShell } from '@/components/DashboardLayout';

import PersonalInfoStep from '@/components/questionnaire/PersonalInfoStep';
import { validatePersonalInfo } from '@/components/questionnaire/validation';
import ActivityStep from '@/components/questionnaire/ActivityStep';
import GoalsStep from '@/components/questionnaire/GoalsStep';
import DietaryStep from '@/components/questionnaire/DietaryStep';
import CuisineStep from '@/components/questionnaire/CuisineStep';
import PreferencesStep from '@/components/questionnaire/PreferencesStep';
import ResultsStep from '@/components/questionnaire/ResultsStep';

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
  } catch {
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
  } catch {
    // ignore storage errors
  }
};

// Header with logo, step dots, and controls
const Header = memo(function Header({ currentStep, totalSteps, lang, setLang, isDarkMode, setIsDarkMode, t }) {
  return (
    <header className="header">
      <div className="header-inner">
        {/* Logo */}
        <LogoInline />

        {/* Step dots - only show on onboarding */}
        {currentStep < 7 && (
          <div className="flex items-center gap-3">
            <span className="step-badge">
              {t('Step {current} of {total}', { current: currentStep, total: 6 })}
            </span>
            <div className="step-dots">
              {Array.from({ length: totalSteps - 1 }).map((_, i) => (
                <div
                  key={i}
                  className={`step-dot ${i + 1 === currentStep ? 'active' : ''} ${i + 1 < currentStep ? 'completed' : ''}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(lang === 'en' ? 'no' : 'en')} className="btn-secondary px-4 py-2 text-xs">
            {lang === 'en' ? 'NO' : 'EN'}
          </button>
          <button onClick={() => setIsDarkMode(p => !p)} className="btn-icon">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
});

// Footer with privacy note
const Footer = memo(function Footer({ t }) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="w-4 h-4" />
          <span className="footer-text">
            {t('Your data is encrypted and used solely for nutritional analysis.')}
          </span>
        </div>
        <div className="footer-links">
          <Link to="/privacy-policy" className="footer-link font-semibold">
            {t('View Privacy Policy')}
          </Link>
          <Link to="/data-deletion" className="footer-link">
            {t('Data Deletion')}
          </Link>
        </div>
      </div>
    </footer>
  );
});

export default function MealPlanner({ user }) {
  const { getToken } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const userId = user?.id ?? user?.user_id ?? user?.userId ?? null;
  const storageKey = userId ? `mealplanner_progress_${userId}` : null;
  const initialProgress = useMemo(() => loadStoredProgress(storageKey), [storageKey]);

  const [currentStep, setCurrentStep] = useState(() => clampStep(initialProgress?.currentStep ?? 1));
  const [formData, setFormData] = useState(() =>
    initialProgress?.formData && typeof initialProgress.formData === 'object' ? initialProgress.formData : {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planPayload, setPlanPayload] = useState(() => initialProgress?.planPayload ?? null);
  const [rawPlanText, setRawPlanText] = useState(() => initialProgress?.rawPlanText ?? '');
  const [planStatus, setPlanStatus] = useState(() => initialProgress?.planStatus ?? 'idle');
  const [generationStage, setGenerationStage] = useState(() => initialProgress?.generationStage ?? null);
  const [generationSource, setGenerationSource] = useState(null);
  const [recommendationReasons, setRecommendationReasons] = useState(null);
  const [planError, setPlanError] = useState(() => initialProgress?.planError ?? null);
  const [preferenceId, setPreferenceId] = useState(() => initialProgress?.preferenceId ?? null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDarkMode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }
  }, [isDarkMode]);

  const updateFormData = useCallback((newData) => {
    setFormData((prev) => ({ ...prev, ...newData }));
  }, []);

  const resetQuestionnaire = useCallback(() => {
    setCurrentStep(1);
    setFormData({});
    setPlanPayload(null);
    setRawPlanText('');
    setPlanStatus('idle');
    setGenerationStage(null);
    setPlanError(null);
    setPreferenceId(null);
    setIsSubmitting(false);
    if (storageKey && typeof window !== 'undefined') {
      try { window.localStorage.removeItem(storageKey); } catch {
        // ignore storage errors
      }
    }
  }, [storageKey]);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const isStepValid = useMemo(() => {
    switch (currentStep) {
      case 1: return validatePersonalInfo(formData).isValid;
      case 2: return Boolean(formData.activity_level);
      case 3: return Boolean(formData.nutrition_goal);
      case 4: return formData.dietary_restrictions?.length > 0;
      case 5: return formData.preferred_cuisines?.length > 0;
      case 6: return Boolean(formData.cooking_time_preference && formData.meals_per_day && formData.budget_range);
      default: return true;
    }
  }, [currentStep, formData]);

  const getAuthToken = useCallback(async () => {
    try { return await getToken(); } catch { return null; }
  }, [getToken]);

  const pollForPlan = useCallback(async (prefId, language) => {
    const maxAttempts = 60;
    const delayMs = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const token = await getAuthToken();
      const response = await UserPreferences.fetch(prefId, language, token);
      const status = response?.plan_status;
      const serverPlan = response?.plan ?? null;
      const rawText = response?.raw_plan ?? '';
      const serverError = response?.error ?? '';
      const serverGenerationSource = response?.generation_source ?? null;
      const serverRecommendationReasons = response?.recommendation_reasons ?? null;
      const translationStatus = response?.translation_status;
      const translationError = response?.translation_error;
      setGenerationStage(response?.generation_stage ?? null);

      if (translationStatus === 'pending') {
        setPlanPayload(null);
        setRawPlanText('');
        setPlanStatus('loading');
        setPlanError(null);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (translationStatus === 'error') {
        setPlanStatus('error');
        setPlanError(translationError || 'The plan could not be translated.');
        return;
      }

      if (status === 'success' || serverPlan) {
        setPlanPayload(serverPlan);
        setRawPlanText(rawText);
        setPlanStatus('success');
        setPlanError(null);
        setGenerationSource(serverGenerationSource);
        setRecommendationReasons(serverRecommendationReasons);
        return;
      }

      if (status === 'error') {
        setPlanStatus('error');
        setPlanError(serverError || t('Plan generation failed. Please try again.'));
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    setPlanStatus('error');
    setPlanError(t('Plan generation timed out. Please try again.'));
  }, [t, getAuthToken]);

  useEffect(() => {
    if (!storageKey) return;
    persistProgress(storageKey, {
      currentStep,
      formData,
      planPayload,
      rawPlanText,
      planStatus,
      generationStage,
      planError,
      preferenceId
    });
  }, [storageKey, currentStep, formData, planPayload, rawPlanText, planStatus, generationStage, planError, preferenceId]);

  useEffect(() => {
    if (!preferenceId || (planStatus !== 'loading' && planStatus !== 'pending')) return;
    pollForPlan(preferenceId, lang);
  }, [planStatus, pollForPlan, preferenceId, lang]);

  useEffect(() => {
    if (!preferenceId || planStatus !== 'success') return;
    let isActive = true;
    const refreshPlan = async () => {
      try {
        const token = await getAuthToken();
        const response = await UserPreferences.fetch(preferenceId, lang, token);
        if (!isActive) return;
        const translationStatus = response?.translation_status;
        if (translationStatus === 'pending') {
          setPlanStatus('loading');
          await pollForPlan(preferenceId, lang);
          return;
        }
        if (translationStatus === 'error') {
          setPlanStatus('error');
          setPlanError(response?.translation_error || t('Translation failed.'));
          return;
        }
        setGenerationStage(response?.generation_stage ?? null);
        setPlanPayload(response?.plan ?? null);
        setRawPlanText(response?.raw_plan ?? '');
        setGenerationSource(response?.generation_source ?? null);
        setRecommendationReasons(response?.recommendation_reasons ?? null);
      } catch {
        // ignore refresh errors
      }
    };
    refreshPlan();
    return () => { isActive = false; };
  }, [lang, preferenceId, planStatus, pollForPlan, t, getAuthToken]);

  const handleFinish = useCallback(async () => {
    if (!userId) return;
    setPlanError(null);
    setPlanPayload(null);
    setRawPlanText('');
    setPlanStatus('loading');
    setGenerationStage('finding_recipes');
    setGenerationSource(null);
    setRecommendationReasons(null);
    setPreferenceId(null);
    setIsSubmitting(true);
    setCurrentStep(TOTAL_STEPS);

    try {
      const token = await getAuthToken();
      const response = await UserPreferences.create(
        {
          ...formData,
          carry_forward_enabled: Boolean(formData.carry_forward_enabled),
          language: lang,
        },
        token,
      );
      const serverPlan = response?.plan ?? null;
      const rawText = response?.raw_plan ?? '';
      const serverError = response?.error ?? '';
      const returnedId = response?.id ?? null;

      if (returnedId) setPreferenceId(returnedId);

      if (serverPlan) {
        setPlanPayload(serverPlan);
        setRawPlanText(rawText);
        setPlanStatus('success');
      } else if (response?.plan_status === 'error') {
        setPlanStatus('error');
        setPlanError(serverError || t('Plan generation failed.'));
      } else if (response?.id) {
        await pollForPlan(response.id, lang);
      } else {
        setPlanStatus('error');
        setPlanError(t('Unable to start plan generation.'));
      }
    } catch (error) {
      setPlanStatus('error');
      setPlanError(error.message || t('Something went wrong.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, formData, lang, getAuthToken, pollForPlan, t]);

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <PersonalInfoStep data={formData} onChange={updateFormData} />;
      case 2: return <ActivityStep data={formData} onChange={updateFormData} />;
      case 3: return <GoalsStep data={formData} onChange={updateFormData} />;
      case 4: return <DietaryStep data={formData} onChange={updateFormData} />;
      case 5: return <CuisineStep data={formData} onChange={updateFormData} />;
      case 6: return <PreferencesStep data={formData} onChange={updateFormData} />;
      case 7: return (
        <ResultsStep
          data={formData}
          plan={planPayload}
          rawPlanText={rawPlanText}
          status={planStatus}
          generationStage={generationStage}
          generationSource={generationSource}
          recommendationReasons={recommendationReasons}
          errorMessage={planError}
          onRegenerate={handleFinish}
          regenerateDisabled={isSubmitting}
          onRestart={resetQuestionnaire}
        />
      );
      default: return null;
    }
  };

  // Dashboard layout for results
  if (currentStep === 7) {
    return (
      <AppShell lang={lang} setLang={setLang} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} t={t}>
        <div className="pb-20 md:pb-0">
          <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
        </div>
      </AppShell>
    );
  }

  // Onboarding layout
  return (
    <div className="onboarding-container">
      <div className="onboarding-right">
        <Header currentStep={currentStep} totalSteps={TOTAL_STEPS} lang={lang} setLang={setLang} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} t={t} />

        <main className="flex-1 flex flex-col pt-24 pb-8 px-6 md:px-12 lg:px-16">
          <div className="flex-1 max-w-4xl mx-auto w-full">
            <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="max-w-4xl mx-auto w-full mt-12 flex items-center justify-between">
            <button onClick={prevStep} disabled={currentStep === 1} className="btn-text disabled:opacity-30">
              <ArrowLeft className="w-4 h-4" />
              {t('Back')}
            </button>

            {currentStep === 6 ? (
              <button onClick={handleFinish} disabled={!isStepValid || isSubmitting} className="btn-primary">
                {isSubmitting ? t('Generating...') : t('Continue')}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={nextStep} disabled={!isStepValid} className="btn-primary">
                {t('Continue')}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </main>

        <Footer t={t} />
      </div>
    </div>
  );
}
