const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

const translateWithFallback = (t) => t || ((value, vars) => {
  if (!vars) return value;
  return String(value).replace(/\{(\w+)\}/g, (_, token) => {
    if (Object.prototype.hasOwnProperty.call(vars, token)) {
      return String(vars[token]);
    }
    return `{${token}}`;
  });
});

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toPositiveInt = (value, defaultValue = 1) => {
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : defaultValue;
};

const normalizeMeal = (meal, mealType, translate) => {
  const safeMeal = meal || {};
  return {
    id: safeMeal.id,
    name: safeMeal.name || translate('{mealType} option', { mealType: translate(mealType) }),
    calories: toNumber(safeMeal.calories),
    protein: toNumber(safeMeal.protein),
    carbs: toNumber(safeMeal.carbs),
    fat: toNumber(safeMeal.fat),
    cookTime: safeMeal.cookTime || '20 min',
    ingredients: Array.isArray(safeMeal.ingredients) ? safeMeal.ingredients : [],
    instructions: safeMeal.instructions || '',
    tags: Array.isArray(safeMeal.tags) ? safeMeal.tags : [],
    is_leftover: Boolean(safeMeal.is_leftover),
    leftover_from_day: safeMeal.leftover_from_day || null,
    leftover_from_meal_type: safeMeal.leftover_from_meal_type || null,
    source_recipe_id: safeMeal.source_recipe_id || safeMeal.id || null,
    cook_servings: toPositiveInt(safeMeal.cook_servings, 1),
    servings_eaten: toPositiveInt(safeMeal.servings_eaten, 1),
  };
};

export const normalizeServerPlan = (plan, t) => {
  const translate = translateWithFallback(t);
  if (!plan?.days?.length) return null;

  const normalizedDays = WEEK_DAYS.map((weekday) => {
    const match = plan.days.find((day) => day?.name?.toLowerCase() === weekday.toLowerCase());
    const macros = match?.macros || {};

    const meals = MEAL_TYPES.reduce((acc, mealType) => {
      const sourceMeal = match?.meals?.[mealType];
      const hasContent = sourceMeal && (sourceMeal.name || sourceMeal.ingredients?.length || sourceMeal.calories);

      if (mealType === 'Snacks' && !hasContent) {
        acc[mealType] = null;
        return acc;
      }

      acc[mealType] = normalizeMeal(sourceMeal, mealType, translate);
      return acc;
    }, {});

    return {
      name: match?.name || weekday,
      calories: toNumber(match?.calories),
      macros: {
        protein: toNumber(macros.protein),
        carbs: toNumber(macros.carbs),
        fat: toNumber(macros.fat),
      },
      meals,
    };
  });

  const calorieTarget = toNumber(plan?.calorieTarget)
    || Math.round(normalizedDays.reduce((sum, day) => sum + (day.calories || 0), 0) / Math.max(normalizedDays.length, 1));

  return {
    calorieTarget,
    macroTargets: {
      protein: toNumber(plan?.macroTargets?.protein),
      carbs: toNumber(plan?.macroTargets?.carbs),
      fat: toNumber(plan?.macroTargets?.fat),
    },
    days: normalizedDays,
  };
};

export const getLeftoverMealLabel = (meal, t) => {
  const translate = translateWithFallback(t);
  if (!meal?.is_leftover) return null;

  if (meal.leftover_from_day && meal.leftover_from_meal_type) {
    return translate('Leftovers from {day} {mealType}', {
      day: translate(meal.leftover_from_day),
      mealType: translate(meal.leftover_from_meal_type),
    });
  }

  return translate('Leftovers');
};

export const toStandaloneMealOverride = (mealLike = {}) => ({
  id: mealLike.id ?? null,
  name: mealLike.name || mealLike.title || 'Recipe',
  calories: toNumber(mealLike.calories),
  protein: toNumber(mealLike.protein),
  carbs: toNumber(mealLike.carbs),
  fat: toNumber(mealLike.fat),
  cookTime: mealLike.cookTime || mealLike.cook_time || '20 min',
  ingredients: Array.isArray(mealLike.ingredients) ? mealLike.ingredients : [],
  instructions: mealLike.instructions || '',
  tags: Array.isArray(mealLike.tags) ? mealLike.tags : [],
  is_leftover: false,
  leftover_from_day: null,
  leftover_from_meal_type: null,
  source_recipe_id: mealLike.id ?? mealLike.source_recipe_id ?? null,
  cook_servings: 1,
  servings_eaten: 1,
});
