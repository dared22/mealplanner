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
