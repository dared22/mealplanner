import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getLeftoverMealLabel,
  normalizeServerPlan,
  toStandaloneMealOverride,
} from './resultsPlanUtils.js';


test('normalizeServerPlan preserves leftover metadata', () => {
  const plan = {
    calorieTarget: 2000,
    macroTargets: { protein: 150, carbs: 200, fat: 70 },
    days: [
      {
        name: 'Monday',
        calories: 1800,
        macros: { protein: 135, carbs: 170, fat: 60 },
        meals: {
          Breakfast: { id: 'breakfast-1', name: 'Oats', calories: 400, protein: 20, carbs: 50, fat: 10 },
          Lunch: {
            id: 'dinner-1',
            name: 'Chili',
            calories: 700,
            protein: 55,
            carbs: 55,
            fat: 25,
            is_leftover: true,
            leftover_from_day: 'Sunday',
            leftover_from_meal_type: 'Dinner',
            source_recipe_id: 'dinner-1',
            cook_servings: 2,
            servings_eaten: 1,
            recipe_portions: 4,
            ingredient_servings: 1,
          },
          Dinner: { id: 'dinner-2', name: 'Salmon', calories: 700, protein: 60, carbs: 40, fat: 25 },
          Snacks: null,
        },
      },
    ],
  };

  const normalized = normalizeServerPlan(plan);
  const lunch = normalized.days[0].meals.Lunch;

  assert.equal(lunch.is_leftover, true);
  assert.equal(lunch.leftover_from_day, 'Sunday');
  assert.equal(lunch.leftover_from_meal_type, 'Dinner');
  assert.equal(lunch.source_recipe_id, 'dinner-1');
  assert.equal(lunch.cook_servings, 2);
  assert.equal(lunch.servings_eaten, 1);
  assert.equal(lunch.recipe_portions, 4);
  assert.equal(lunch.ingredient_servings, 1);
});


test('getLeftoverMealLabel returns a readable label', () => {
  const label = getLeftoverMealLabel(
    {
      is_leftover: true,
      leftover_from_day: 'Monday',
      leftover_from_meal_type: 'Dinner',
    },
    (key, vars) => key.replace('{day}', vars?.day ?? '').replace('{mealType}', vars?.mealType ?? ''),
  );

  assert.equal(label, 'Leftovers from Monday Dinner');
});


test('toStandaloneMealOverride strips leftover linkage for swaps', () => {
  const swappedMeal = toStandaloneMealOverride({
    id: 'recipe-2',
    name: 'Pasta',
    calories: 650,
    protein: 35,
    carbs: 70,
    fat: 18,
    is_leftover: true,
    leftover_from_day: 'Tuesday',
    leftover_from_meal_type: 'Dinner',
    cook_servings: 2,
    servings_eaten: 1,
  });

  assert.equal(swappedMeal.id, 'recipe-2');
  assert.equal(swappedMeal.is_leftover, false);
  assert.equal(swappedMeal.leftover_from_day, null);
  assert.equal(swappedMeal.leftover_from_meal_type, null);
  assert.equal(swappedMeal.cook_servings, 1);
  assert.equal(swappedMeal.servings_eaten, 1);
  assert.equal(swappedMeal.recipe_portions, 1);
  assert.equal(swappedMeal.ingredient_servings, 1);
});
