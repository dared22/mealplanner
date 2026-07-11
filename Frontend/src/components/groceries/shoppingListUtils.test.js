import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildShoppingList,
  formatAmounts,
} from './shoppingListUtils.js';

const meal = (name, ingredients, overrides = {}) => ({
  name,
  is_leftover: false,
  ingredients,
  ...overrides,
});

test('buildShoppingList sums same name and unit across two days', () => {
  const list = buildShoppingList({
    days: [
      {
        name: 'Monday',
        meals: {
          Dinner: meal('Chicken bowl', [{ name: 'Chicken', quantity: 400, unit: 'g' }]),
        },
      },
      {
        name: 'Tuesday',
        meals: {
          Dinner: meal('Chicken salad', [{ name: 'chicken', quantity: '400', unit: 'g' }]),
        },
      },
    ],
  });

  assert.deepEqual(list, [
    {
      name: 'Chicken',
      amounts: [{ quantity: 800, unit: 'g' }],
      sources: [
        { day: 'Monday', mealType: 'Dinner', mealName: 'Chicken bowl' },
        { day: 'Tuesday', mealType: 'Dinner', mealName: 'Chicken salad' },
      ],
    },
  ]);
});

test('buildShoppingList keeps same name with different units in first-seen order', () => {
  const [chicken] = buildShoppingList({
    days: [
      {
        name: 'Monday',
        meals: {
          Dinner: meal('Chicken tacos', [
            { name: 'Chicken', quantity: 400, unit: 'g' },
            { name: 'Chicken', quantity: 2, unit: 'stk' },
          ]),
        },
      },
    ],
  });

  assert.deepEqual(chicken.amounts, [
    { quantity: 400, unit: 'g' },
    { quantity: 2, unit: 'stk' },
  ]);
  assert.equal(formatAmounts(chicken), '400 g + 2 stk');
});

test('buildShoppingList skips leftover meals', () => {
  const list = buildShoppingList({
    days: [
      {
        name: 'Monday',
        meals: {
          Dinner: meal('Chili', [{ name: 'Beans', quantity: 2, unit: 'can' }]),
        },
      },
      {
        name: 'Tuesday',
        meals: {
          Dinner: meal(
            'Chili leftovers',
            [{ name: 'Beans', quantity: 2, unit: 'can' }],
            { is_leftover: true },
          ),
        },
      },
    ],
  });

  assert.deepEqual(list[0].amounts, [{ quantity: 2, unit: 'can' }]);
  assert.deepEqual(list[0].sources, [
    { day: 'Monday', mealType: 'Dinner', mealName: 'Chili' },
  ]);
});

test('buildShoppingList merges string ingredients case-insensitively without amounts', () => {
  const [salt] = buildShoppingList({
    days: [
      {
        name: 'Monday',
        meals: {
          Lunch: meal('Soup', ['salt to taste', ' Salt to taste ']),
        },
      },
    ],
  });

  assert.equal(salt.name, 'salt to taste');
  assert.deepEqual(salt.amounts, []);
  assert.equal(formatAmounts(salt), '');
  assert.deepEqual(salt.sources, [
    { day: 'Monday', mealType: 'Lunch', mealName: 'Soup' },
  ]);
});

test('buildShoppingList parses fractions and keeps unparseable units without corrupting sums', () => {
  const [oil] = buildShoppingList({
    days: [
      {
        name: 'Monday',
        meals: {
          Dinner: meal('Dressing', [
            { name: 'Oil', quantity: '1/2', unit: 'dl' },
            { name: 'Oil', quantity: 'a splash', unit: 'dl' },
            { name: 'Oil', quantity: 'many', unit: 'bottle' },
          ]),
        },
      },
    ],
  });

  assert.deepEqual(oil.amounts, [
    { quantity: 0.5, unit: 'dl' },
    { quantity: null, unit: 'bottle' },
  ]);
  assert.equal(formatAmounts(oil), '0.5 dl + bottle');
});

test('buildShoppingList sorts alphabetically and dedupes sources by day and meal type', () => {
  const list = buildShoppingList({
    days: [
      {
        name: 'Monday',
        meals: {
          Breakfast: meal('Oats', [
            { name: 'Banana', quantity: 1, unit: 'stk' },
            { name: 'apple', quantity: 1, unit: 'stk' },
            { name: 'APPLE', quantity: 2, unit: 'stk' },
          ]),
        },
      },
    ],
  });

  assert.deepEqual(list.map((item) => item.name), ['apple', 'Banana']);
  assert.deepEqual(list[0], {
    name: 'apple',
    amounts: [{ quantity: 3, unit: 'stk' }],
    sources: [{ day: 'Monday', mealType: 'Breakfast', mealName: 'Oats' }],
  });
});

test('buildShoppingList handles null and missing shapes defensively', () => {
  assert.deepEqual(buildShoppingList(null), []);
  assert.deepEqual(buildShoppingList({}), []);
  assert.deepEqual(buildShoppingList({ days: null }), []);
  assert.deepEqual(buildShoppingList({
    days: [
      null,
      { name: 'Monday' },
      { name: 'Tuesday', meals: null },
      { name: 'Wednesday', meals: { Dinner: null } },
      { name: 'Thursday', meals: { Dinner: meal('Empty', null) } },
    ],
  }), []);
});
