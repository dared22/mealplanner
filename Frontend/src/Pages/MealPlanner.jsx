// src/pages/MealPlanner.jsx
import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Moon, Sun } from 'lucide-react'
import { UserPreferences } from '@/Entities/UserPreferences'

// If you don’t use shadcn yet, use our simple Button below
import { Button } from '@/components/ui/button'

import ProgressBar from '@/components/questionnaire/ProgressBar'
import PersonalInfoStep from '@/components/questionnaire/PersonalInfoStep'
import ActivityStep from '@/components/questionnaire/ActivityStep'
import GoalsStep from '@/components/questionnaire/GoalsStep'
import DietaryStep from '@/components/questionnaire/DietaryStep'
import CuisineStep from '@/components/questionnaire/CuisineStep'
import PreferencesStep from '@/components/questionnaire/PreferencesStep'
import ResultsStep from '@/components/questionnaire/ResultsStep'

// …paste your MealPlanner component code here unchanged…


export default function MealPlanner({ onLogout, user }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [planData, setPlanData] = useState(null);
  const [rawPlanText, setRawPlanText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const totalSteps = 7;

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
        return formData.age && formData.gender && formData.height && formData.weight;
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

  const handleFinish = async () => {
    if (!user?.id) {
      console.error('Cannot submit preferences without user context.')
      return
    }

    setIsSubmitting(true);
    try {
      const result = await UserPreferences.create({ ...formData, user_id: user.id });
      if (result?.plan) {
        setPlanData(result.plan);
      } else {
        setPlanData(null);
      }
      if (result?.raw_plan) {
        setRawPlanText(result.raw_plan);
      } else {
        setRawPlanText('');
      }
      setCurrentStep(7);
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
    setIsSubmitting(false);
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
        return <ResultsStep data={formData} plan={planData} rawPlanText={rawPlanText} />;
      default:
        return null;
    }
  };

  const handleLogoutClick = () => {
    setPlanData(null)
    setRawPlanText('')
    setFormData({})
    setCurrentStep(1)
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
              Log out
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDarkMode(prev => !prev)}
            className="rounded-full bg-white/70 text-gray-600 shadow-sm hover:bg-white dark:bg-slate-800/70 dark:text-gray-200 dark:hover:bg-slate-700"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="sr-only">Toggle dark mode</span>
          </Button>
        </div>
        <Motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2 text-[#2E3A59] dark:text-gray-100">
            Personal Meal Planner
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Answer a few questions to get your customized weekly meal plan
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
                Previous
              </Button>

              {currentStep === 6 ? (
                <Button
                  onClick={handleFinish}
                  disabled={!isStepValid() || isSubmitting}
                  className="flex items-center gap-2 px-8"
                >
                  {isSubmitting ? 'Creating Plan...' : 'Create My Plan'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  disabled={!isStepValid()}
                  className="flex items-center gap-2"
                >
                  Next
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
