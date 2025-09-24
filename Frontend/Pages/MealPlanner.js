import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { UserPreferences } from '@/entities/UserPreferences';

import ProgressBar from '../components/questionnaire/ProgressBar';
import PersonalInfoStep from '../components/questionnaire/PersonalInfoStep';
import ActivityStep from '../components/questionnaire/ActivityStep';
import GoalsStep from '../components/questionnaire/GoalsStep';
import DietaryStep from '../components/questionnaire/DietaryStep';
import CuisineStep from '../components/questionnaire/CuisineStep';
import PreferencesStep from '../components/questionnaire/PreferencesStep';
import ResultsStep from '../components/questionnaire/ResultsStep';

export default function MealPlanner() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);
    try {
      await UserPreferences.create(formData);
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
        return <ResultsStep data={formData} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F5] via-white to-[#F5F5F5] p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: '#2E3A59' }}>
            Personal Meal Planner
          </h1>
          <p className="text-gray-600">
            Answer a few questions to get your customized weekly meal plan
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-xl p-6 md:p-8"
        >
          {currentStep < 7 && (
            <ProgressBar currentStep={currentStep} totalSteps={6} />
          )}

          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>

          {currentStep < 7 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex justify-between mt-8"
            >
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </Button>

              {currentStep === 6 ? (
                <Button
                  onClick={handleFinish}
                  disabled={!isStepValid() || isSubmitting}
                  className="flex items-center gap-2 px-8"
                  style={{ backgroundColor: '#A5D6A7' }}
                >
                  {isSubmitting ? 'Creating Plan...' : 'Create My Plan'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  disabled={!isStepValid()}
                  className="flex items-center gap-2"
                  style={{ backgroundColor: '#A5D6A7' }}
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}