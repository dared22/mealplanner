import React, { memo, useCallback } from 'react';
import { motion as Motion } from 'framer-motion';
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

const genderOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Prefer to self-describe' },
];

const PersonalInfoStep = memo(function PersonalInfoStep({ data, onChange }) {
  const { t } = useLanguage();
  const { errors } = validatePersonalInfo(data);

  const handleNumberChange = useCallback(
    (field, value) => {
      const numericValue = value === '' ? '' : Number(value);
      onChange({ [field]: Number.isFinite(numericValue) ? numericValue : '' });
    },
    [onChange]
  );

  const showAgeError = Boolean(errors.age && data.age !== undefined);
  const showHeightError = Boolean(errors.height && data.height !== undefined);
  const showWeightError = Boolean(errors.weight && data.weight !== undefined);
  const showGenderError = Boolean(
    errors.gender &&
      (data.age !== undefined || data.height !== undefined || data.weight !== undefined)
  );
  const showLogicError = Boolean(
    errors.logic && data.height !== undefined && data.weight !== undefined
  );

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="space-y-10"
    >
      {/* Headline */}
      <div>
        <h1 className="headline-serif mb-3">
          {t('Tell us about')} <span className="accent">{t('yourself')}</span>
        </h1>
        <p className="text-muted-foreground text-lg">
          {t('We use this to set precise calorie and macro targets.')}
        </p>
      </div>

      {/* Form Grid with underline inputs */}
      <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
        {/* Age */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <label className="input-label">{t('Age')}</label>
          <input
            type="number"
            placeholder={t('Enter your age')}
            value={data.age || ''}
            min={10}
            max={100}
            onChange={(e) => handleNumberChange('age', e.target.value)}
            className={`input-underline ${showAgeError ? 'border-red-500 focus:border-red-500' : ''}`}
          />
          {showAgeError && (
            <p className="text-sm text-red-500 mt-2">{t(errors.age)}</p>
          )}
        </Motion.div>

        {/* Sex */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <label className="input-label">{t('Sex')}</label>
          <select
            value={data.gender || ''}
            onChange={(e) => onChange({ gender: e.target.value })}
            className={`select-underline ${showGenderError ? 'border-red-500 focus:border-red-500' : ''}`}
          >
            <option value="">{t('Select an option')}</option>
            {genderOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.label)}
              </option>
            ))}
          </select>
          {showGenderError && (
            <p className="text-sm text-red-500 mt-2">{t(errors.gender)}</p>
          )}
        </Motion.div>

        {/* Height */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <label className="input-label">{t('Height')}</label>
          <div className="relative">
            <input
              type="number"
              placeholder={t('e.g., 175')}
              value={data.height || ''}
              min={140}
              max={210}
              onChange={(e) => handleNumberChange('height', e.target.value)}
              className={`input-underline pr-12 ${
                showHeightError || showLogicError ? 'border-red-500 focus:border-red-500' : ''
              }`}
            />
            <span className="absolute right-0 bottom-3 text-muted-foreground">cm</span>
          </div>
          {(showHeightError || showLogicError) && (
            <p className="text-sm text-red-500 mt-2">
              {showLogicError ? t(errors.logic) : t(errors.height)}
            </p>
          )}
        </Motion.div>

        {/* Weight */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <label className="input-label">{t('Weight')}</label>
          <div className="relative">
            <input
              type="number"
              placeholder={t('e.g., 70')}
              value={data.weight || ''}
              min={30}
              max={400}
              onChange={(e) => handleNumberChange('weight', e.target.value)}
              className={`input-underline pr-12 ${
                showWeightError || showLogicError ? 'border-red-500 focus:border-red-500' : ''
              }`}
            />
            <span className="absolute right-0 bottom-3 text-muted-foreground">kg</span>
          </div>
          {(showWeightError || showLogicError) && !showHeightError && (
            <p className="text-sm text-red-500 mt-2">
              {showLogicError ? t(errors.logic) : t(errors.weight)}
            </p>
          )}
        </Motion.div>
      </div>
    </Motion.div>
  );
});

export default PersonalInfoStep;
