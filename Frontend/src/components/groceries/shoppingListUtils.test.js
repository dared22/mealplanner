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

test('buildShoppingList capitalizes a plain unmerged ingredient name', () => {
  const [item] = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Fruit', [{ name: 'ananas' }]),
      },
    }],
  });

  assert.equal(item.name, 'Ananas');
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

  assert.equal(salt.name, 'Salt');
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

  assert.deepEqual(list.map((item) => item.name), ['Apple', 'Banana']);
  assert.deepEqual(list[0], {
    name: 'Apple',
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

test('buildShoppingList merges Norwegian prep-name variants across days', () => {
  const list = buildShoppingList({
    days: [
      {
        name: 'Monday',
        meals: {
          Dinner: meal('Onion soup', [{ name: 'finhakket løk', quantity: 1, unit: 'stk' }]),
        },
      },
      {
        name: 'Tuesday',
        meals: {
          Dinner: meal('Onion tart', [{ name: 'løk', quantity: 2, unit: 'stk' }]),
        },
      },
    ],
  });

  assert.deepEqual(list, [
    {
      name: 'Løk',
      amounts: [{ quantity: 3, unit: 'stk' }],
      sources: [
        { day: 'Monday', mealType: 'Dinner', mealName: 'Onion soup' },
        { day: 'Tuesday', mealType: 'Dinner', mealName: 'Onion tart' },
      ],
    },
  ]);
});

test('buildShoppingList strips prep words at token boundaries only', () => {
  const list = buildShoppingList({
    days: [
      {
        name: 'Monday',
        meals: {
          Dinner: meal('Onions', [
            { name: 'rødløk', quantity: 1, unit: 'stk' },
            { name: 'løk', quantity: 2, unit: 'stk' },
          ]),
        },
      },
    ],
  });

  assert.deepEqual(list.map((item) => item.name), ['Løk', 'Rødløk']);
});

test('buildShoppingList merges English prep-name variants', () => {
  const list = buildShoppingList({
    days: [
      {
        name: 'Monday',
        meals: {
          Dinner: meal('Soup', ['chopped onion', 'onion']),
        },
      },
    ],
  });

  assert.deepEqual(list, [
    {
      name: 'Onion',
      amounts: [],
      sources: [{ day: 'Monday', mealType: 'Dinner', mealName: 'Soup' }],
    },
  ]);
});

test('buildShoppingList normalizes comma-separated prep words', () => {
  const list = buildShoppingList({
    days: [
      {
        name: 'Monday',
        meals: {
          Dinner: meal('Soup', [
            { name: 'løk, finhakket', quantity: 1, unit: 'stk' },
            { name: 'løk', quantity: 2, unit: 'stk' },
          ]),
        },
      },
    ],
  });

  assert.deepEqual(list[0], {
    name: 'Løk',
    amounts: [{ quantity: 3, unit: 'stk' }],
    sources: [{ day: 'Monday', mealType: 'Dinner', mealName: 'Soup' }],
  });
});

test('buildShoppingList falls back when a name contains only prep words', () => {
  const [item] = buildShoppingList({
    days: [
      {
        name: 'Monday',
        meals: {
          Dinner: meal('Produce', ['fersk']),
        },
      },
    ],
  });

  assert.equal(item.name, 'Fersk');
});

test('buildShoppingList removes parenthetical segments before merging', () => {
  const list = buildShoppingList({
    days: [
      {
        name: 'Monday',
        meals: {
          Dinner: meal('Salad', ['onion (raw)', 'onion']),
        },
      },
    ],
  });

  assert.deepEqual(list, [
    {
      name: 'Onion',
      amounts: [],
      sources: [{ day: 'Monday', mealType: 'Dinner', mealName: 'Salad' }],
    },
  ]);
});

test('buildShoppingList extracts and scales a glued ca. quantity from an object name', () => {
  const list = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Tapas', [
          { name: 'ca.20skiverspekeskinke', unit: null, quantity: null },
        ], { recipe_portions: 4, ingredient_servings: 1 }),
      },
    }],
  });

  assert.deepEqual(list, [{
    name: 'Spekeskinke',
    amounts: [{ quantity: 5, unit: 'skiver' }],
    sources: [{ day: 'Monday', mealType: 'Dinner', mealName: 'Tapas' }],
  }]);
});

test('buildShoppingList extracts decimal commas and merges with structured amounts', () => {
  const list = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Soup', [
          { name: 'ca.1,5dlvann', unit: null, quantity: null },
          { name: 'vann', quantity: 1.5, unit: 'dl' },
        ], { recipe_portions: 1, ingredient_servings: 1 }),
      },
    }],
  });

  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Vann');
  assert.deepEqual(list[0].amounts, [{ quantity: 3, unit: 'dl' }]);
});

test('buildShoppingList treats a whitespace-only structured quantity as empty', () => {
  const list = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Soup', [
          { name: '1.5dlvann', unit: null, quantity: '   ' },
        ], { recipe_portions: 1, ingredient_servings: 1 }),
      },
    }],
  });

  assert.equal(list[0].name, 'Vann');
  assert.deepEqual(list[0].amounts, [{ quantity: 1.5, unit: 'dl' }]);
});

test('buildShoppingList dedupes consecutive tokens and strips Norwegian purpose tails', () => {
  const list = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Dressing', [
          { name: 'nøytral nøytral olje til pensling', unit: 'ss', quantity: 2 },
          { name: 'nøytral olje', quantity: 5, unit: 'ss' },
        ], { recipe_portions: 1, ingredient_servings: 1 }),
      },
    }],
  });

  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Nøytral olje');
  assert.deepEqual(list[0].amounts, [{ quantity: 7, unit: 'ss' }]);
});

test('buildShoppingList strips purpose tails and new prep words without rescaling structured amounts', () => {
  const list = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Dinner', [
          { name: 'flytende margarin til steking', unit: 'ss', quantity: 0.5 },
          { name: 'margarin', quantity: 0.5, unit: 'ss' },
        ], { recipe_portions: 4, ingredient_servings: 1 }),
      },
    }],
  });

  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Margarin');
  assert.deepEqual(list[0].amounts, [{ quantity: 1, unit: 'ss' }]);
});

test('buildShoppingList repairs a lost decimal comma after a glued juice prefix', () => {
  const list = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Tacos', ['Saft av0 5stk.lime'], {
          recipe_portions: 1,
          ingredient_servings: 1,
        }),
      },
    }],
  });

  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Lime');
  assert.deepEqual(list[0].amounts, [{ quantity: 0.5, unit: 'stk' }]);
});

test('buildShoppingList repairs a two-digit lost decimal after a glued juice prefix', () => {
  const list = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Sauce', ['Saften av0 25stk.sitron'], {
          recipe_portions: 1,
          ingredient_servings: 1,
        }),
      },
    }],
  });

  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Sitron');
  assert.deepEqual(list[0].amounts, [{ quantity: 0.25, unit: 'stk' }]);
});

test('buildShoppingList strips lunkent and merges the repaired name', () => {
  const list = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Bread', [
          { name: 'lunkent vann', unit: 'dl', quantity: 0.5 },
          { name: 'vann', unit: 'dl', quantity: 0.5 },
        ], { recipe_portions: 1, ingredient_servings: 1 }),
      },
    }],
  });

  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Vann');
  assert.deepEqual(list[0].amounts, [{ quantity: 1, unit: 'dl' }]);
});

test('buildShoppingList merges singular and plural unit synonyms using the first spelling', () => {
  const list = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Tapas', [
          { name: 'spekeskinke', quantity: 20, unit: 'skiver' },
          { name: 'spekeskinke', quantity: 4, unit: 'skive' },
        ]),
      },
    }],
  });

  assert.equal(list.length, 1);
  assert.deepEqual(list[0].amounts, [{ quantity: 24, unit: 'skiver' }]);
});

test('buildShoppingList strips fresh and cut prep words before merging', () => {
  const list = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Herb sauce', [
          { name: 'Frisk gressløk', quantity: 2, unit: 'ss' },
          { name: 'finsnittet frisk gressløk', quantity: 3, unit: 'ss' },
        ]),
      },
    }],
  });

  assert.deepEqual(list, [{
    name: 'Gressløk',
    amounts: [{ quantity: 5, unit: 'ss' }],
    sources: [{ day: 'Monday', mealType: 'Dinner', mealName: 'Herb sauce' }],
  }]);
});

test('buildShoppingList strips presset before merging garlic', () => {
  const list = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Garlic sauce', [
          { name: 'presset hvitløk', quantity: 2, unit: 'båt' },
          { name: 'Hvitløk', quantity: 0.5, unit: 'båt' },
        ]),
      },
    }],
  });

  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Hvitløk');
  assert.deepEqual(list[0].amounts, [{ quantity: 2.5, unit: 'båt' }]);
});

test('buildShoppingList strips preparation phrases down to the ingredient name', () => {
  const list = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Dinner', [
          { name: 'eple i tynne skiver', quantity: 1, unit: 'stk' },
          { name: 'grovhakkede ristede pecannøtter', quantity: 2, unit: 'ss' },
          { name: 'purre i ringer', quantity: 3, unit: 'stk' },
        ]),
      },
    }],
  });

  assert.deepEqual(list.map((item) => item.name), ['Eple', 'Pecannøtter', 'Purre']);
});

test('buildShoppingList strips alternative clauses including glued eller', () => {
  const list = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Dinner', [
          { name: 'hasselnøtter eller mandler', quantity: 1, unit: 'pose' },
          { name: 'kjøttdeigeller karbonadedeig', quantity: 2, unit: 'pakke' },
        ]),
      },
    }],
  });

  assert.deepEqual(list.map((item) => item.name), ['Hasselnøtter', 'Kjøttdeig']);
});

test('buildShoppingList only splits glued eller when an alternative follows', () => {
  const repairedName = (name) => buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Dinner', [name]),
      },
    }],
  })[0].name;

  assert.equal(repairedName('kantareller'), 'Kantareller');
  assert.match(repairedName('kantareller med smør'), /^Kantareller\b/);
  assert.equal(repairedName('kjøttdeigeller karbonadedeig'), 'Kjøttdeig');
  assert.equal(repairedName('kantareller eller sjampinjong'), 'Kantareller');
});

test('buildShoppingList strips preference, package-size, and fat-percentage tails', () => {
  const list = buildShoppingList({
    days: [{
      name: 'Monday',
      meals: {
        Dinner: meal('Dinner', [
          { name: 'Cherrytomat gjerne i forskjellige farger', quantity: 1, unit: 'boks' },
          { name: 'Ravioli med ost à 250 g', quantity: 1, unit: 'pakke' },
          { name: 'Crème fraîche lett 18 %', quantity: 1, unit: 'boks' },
        ]),
      },
    }],
  });

  assert.deepEqual(list.map((item) => item.name), [
    'Cherrytomat',
    'Crème fraîche lett',
    'Ravioli med ost',
  ]);
});
