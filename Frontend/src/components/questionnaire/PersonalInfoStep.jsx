import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Ruler, Weight, Calendar } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

export const validatePersonalInfo = (info = {}) => {
  const errors = {};

  const parseNumber = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const age = parseNumber(info.age);
  if (age === null) {
    errors.age = 'Age is required.';
  } else if (age < 10 || age > 100) {
    errors.age = 'Age must be between 10 and 100.';
  }

  const height = parseNumber(info.height);
  if (height === null) {
    errors.height = 'Height is required.';
  } else if (height < 140 || height > 210) {
    errors.height = 'Height should be between 140 cm and 210 cm.';
  }

  const weight = parseNumber(info.weight);
  if (weight === null) {
    errors.weight = 'Weight is required.';
  } else if (weight < 30 || weight > 400) {
    errors.weight = 'Weight should be between 30 kg and 400 kg.';
  }

  if (height !== null && weight !== null) {
    const bmi = weight / Math.pow(height / 100, 2);
    if (bmi < 10 || bmi > 80) {
      errors.logic = 'These numbers look unusual. Double-check that the units are correct.';
    }
  }

  if (!info.gender) {
    errors.gender = 'Please select a sex.';
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
};

export default function PersonalInfoStep({ data, onChange }) {
  const { t } = useLanguage();
  const { errors } = validatePersonalInfo(data);

  const handleNumberChange = (field, value) => {
    const numericValue = value === '' ? '' : Number(value);
    onChange({ [field]: Number.isFinite(numericValue) ? numericValue : '' });
  };

  const showAgeError = Boolean(errors.age && data.age !== undefined);
  const showHeightError = Boolean(errors.height && data.height !== undefined);
  const showWeightError = Boolean(errors.weight && data.weight !== undefined);
  const showGenderError = Boolean(
    errors.gender && (data.age !== undefined || data.height !== undefined || data.weight !== undefined)
  );
  const showLogicError = Boolean(errors.logic && data.height !== undefined && data.weight !== undefined);

  return (
    <Motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <Motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-primary/20 text-primary"
        >
          <User className="w-8 h-8" />
        </Motion.div>
        <h2 className="text-2xl font-semibold mb-2 text-slate-900 dark:text-slate-100">
          {t('Tell us about you')}
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          {t('We use this to set precise calorie and macro targets.')}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <Label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
            <Calendar className="w-4 h-4" />
            {t('Age')}
          </Label>
          <Input
            type="number"
            placeholder={t('Enter your age')}
            value={data.age || ''}
            min={10}
            max={100}
            onChange={(e) => handleNumberChange('age', e.target.value)}
            className={`border-gray-200 focus:border-[#A5D6A7] focus:ring-2 focus:ring-[#A5D6A7]/40 transition-colors ${
              showAgeError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/40' : ''
            }`}
          />
          {showAgeError && (
            <p className="text-sm text-red-600 dark:text-red-400">{t(errors.age)}</p>
          )}
        </Motion.div>

        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-2"
        >
          <Label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
            <User className="w-4 h-4" />
            {t('Sex')}
          </Label>
          <Select value={data.gender || ''} onValueChange={(value) => onChange({ gender: value })}>
            <SelectTrigger
              className={`border-gray-200 focus:border-[#A5D6A7] focus:ring-2 focus:ring-[#A5D6A7]/40 ${
                showGenderError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/40' : ''
              }`}
            >
              <SelectValue placeholder={t('Select an option')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">{t('Male')}</SelectItem>
              <SelectItem value="female">{t('Female')}</SelectItem>
              <SelectItem value="other">{t('Prefer to self-describe')}</SelectItem>
            </SelectContent>
          </Select>
          {showGenderError && (
            <p className="text-sm text-red-600 dark:text-red-400">{t(errors.gender)}</p>
          )}
        </Motion.div>

        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-2"
        >
          <Label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
            <Ruler className="w-4 h-4" />
            {t('Height (cm)')}
          </Label>
          <Input
            type="number"
            placeholder={t('e.g., 175')}
            value={data.height || ''}
            min={140}
            max={210}
            onChange={(e) => handleNumberChange('height', e.target.value)}
            className={`border-gray-200 focus:border-[#A5D6A7] focus:ring-2 focus:ring-[#A5D6A7]/40 transition-colors ${
              showHeightError || showLogicError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/40' : ''
            }`}
          />
          {showHeightError && (
            <p className="text-sm text-red-600 dark:text-red-400">{t(errors.height)}</p>
          )}
        </Motion.div>

        <Motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="space-y-2"
        >
          <Label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
            <Weight className="w-4 h-4" />
            {t('Weight (kg)')}
          </Label>
          <Input
            type="number"
            placeholder={t('e.g., 70')}
            value={data.weight || ''}
            min={30}
            max={400}
            onChange={(e) => handleNumberChange('weight', e.target.value)}
            className={`border-gray-200 focus:border-[#A5D6A7] focus:ring-2 focus:ring-[#A5D6A7]/40 transition-colors ${
              showWeightError || showLogicError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/40' : ''
            }`}
          />
          {showWeightError && (
            <p className="text-sm text-red-600 dark:text-red-400">{t(errors.weight)}</p>
          )}
          {showLogicError && (
            <p className="text-sm text-red-600 dark:text-red-400">{t(errors.logic)}</p>
          )}
        </Motion.div>
      </div>
    </Motion.div>
  );
}
