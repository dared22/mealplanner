const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const PREP_WORDS = [
  'finhakket', 'hakket', 'grovhakket', 'finhakkede', 'hakkede', 'revet', 'revne', 'skivet',
  'skiver', 'oppkuttet', 'kuttet', 'strimlet', 'terninger', 'most', 'kokt', 'kokte', 'fersk',
  'ferske', 'frossen', 'frosne', 'stor', 'store', 'liten', 'små', 'mellomstor', 'moden',
  'modne', 'chopped', 'finely', 'coarsely', 'roughly', 'diced', 'grated', 'sliced', 'slices',
  'shredded', 'minced', 'crushed', 'mashed', 'peeled', 'cooked', 'fresh', 'frozen', 'ripe',
  'large', 'small', 'medium', 'big', 'of', 'av',
  'lunkent', 'lunken', 'flytende',
  'frisk', 'friske', 'finsnittet', 'presset', 'ristet', 'ristede', 'grovhakkede', 'tynn',
  'tynne', 'ring', 'ringer', 'i',
];
const PREP_WORD_SET = new Set(PREP_WORDS);
const UNIT_SYNONYMS = new Map([
  ['skiver', 'skive'],
  ['båter', 'båt'],
  ['bokser', 'boks'],
  ['poser', 'pose'],
  ['never', 'neve'],
]);
const JUICE_ZEST_PREFIX = /^(?:saft(?:en)?\s+av|juice\s+of|zest\s+of|(?:revet\s+)?skall\s+av)(?=\d|\s)/i;
const PURPOSE_TAILS = [
  /\s+til\s+\S.*$/i,
  /\s+eller\s+.*$/i,
  /\s+gjerne\s+.*$/i,
  /\s+à\s+\d.*$/i,
  /\s+\d+(?:[.,]\d+)?\s*%$/,
  /\s+for\s+(?:frying|serving|brushing|greasing|garnish).*$/i,
  /\s+to\s+(?:taste|serve)$/i,
];
const QUANTITY_UNITS = 'skiver|skive|bokser|boks|poser|pose|never|neve|båter|båt|fedd|glass|stk|kg|dl|cl|ml|ss|ts|g|l';
const LOST_COMMA_AMOUNT = new RegExp(
  `^(?:ca\\.?\\s*)?(\\d+) (\\d+)(${QUANTITY_UNITS})\\.?\\s*(.+)$`,
  'i',
);
const LEADING_AMOUNT = new RegExp(
  `^(?:ca\\.?\\s*)?(\\d+(?:[.,]\\d+)?)\\s*(${QUANTITY_UNITS})\\.?\\s*(.+)$`,
  'i',
);

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeKey = (value) => value.toLowerCase();

const uppercaseFirst = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const normalizeIngredientName = (name) => {
  const preparedName = name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const strippedName = preparedName
    .split(/\s+/)
    .filter((token) => token && !PREP_WORD_SET.has(token.toLowerCase()))
    .join(' ');
  const canonicalName = strippedName || name;

  return {
    key: normalizeKey(canonicalName),
    displayName: uppercaseFirst(canonicalName),
  };
};

const parseQuantity = (value) => {
  if (value === undefined || value === null || value === '') return null;

  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;

  if (typeof value !== 'string') return null;

  const fraction = value.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*\/\s*([+-]?\d+(?:\.\d+)?)$/);
  if (!fraction) return null;

  const numerator = Number(fraction[1]);
  const denominator = Number(fraction[2]);
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
    ? numerator / denominator
    : null;
};

const collapseAndDedupeTokens = (name) => name
  .replace(/\s+/g, ' ')
  .trim()
  .split(' ')
  .filter((token, index, tokens) => (
    index === 0 || token.toLowerCase() !== tokens[index - 1].toLowerCase()
  ))
  .join(' ');

const extractLeadingAmount = (name) => {
  const lostCommaMatch = name.match(LOST_COMMA_AMOUNT);
  if (lostCommaMatch) {
    return {
      name: lostCommaMatch[4].trim(),
      quantity: Number(`${lostCommaMatch[1]}.${lostCommaMatch[2]}`),
      unit: lostCommaMatch[3].toLowerCase(),
    };
  }

  const match = name.match(LEADING_AMOUNT);
  if (!match) return null;

  return {
    name: match[3].trim(),
    quantity: Number(match[1].replace(',', '.')),
    unit: match[2].toLowerCase(),
  };
};

const positiveFiniteOrOne = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
};

const isMissingQuantity = (value) => (
  value === null || value === undefined || (typeof value === 'string' && !value.trim())
);

const repairIngredient = (ingredient, canExtractAmount, meal) => {
  let name = collapseAndDedupeTokens(ingredient.name)
    .replace(JUICE_ZEST_PREFIX, '')
    .trim();

  if (canExtractAmount) {
    const extracted = extractLeadingAmount(name);
    if (extracted) {
      const scale = positiveFiniteOrOne(meal?.ingredient_servings)
        / positiveFiniteOrOne(meal?.recipe_portions);
      name = extracted.name;
      ingredient.quantity = extracted.quantity * scale;
      ingredient.unit = extracted.unit;
      ingredient.hasAmount = true;
    }
  }

  PURPOSE_TAILS.forEach((pattern) => {
    name = name.replace(pattern, '');
  });
  name = name.replace(/\b(\S{3,})eller\s+(?!med\b|i\b|til\b|på\b|uten\b|av\b|og\b)\S.*$/i, '$1');

  ingredient.name = name.trim() || collapseAndDedupeTokens(ingredient.name);
  return ingredient;
};

const normalizeIngredient = (ingredient, meal) => {
  if (typeof ingredient === 'string') {
    const name = ingredient.trim();
    return name
      ? repairIngredient({ name, quantity: null, unit: '', hasAmount: false }, true, meal)
      : null;
  }

  if (!ingredient || typeof ingredient !== 'object' || Array.isArray(ingredient)) return null;

  const name = toTrimmedString(ingredient.name);
  if (!name) return null;

  return repairIngredient({
    name,
    quantity: parseQuantity(ingredient.quantity),
    unit: toTrimmedString(ingredient.unit),
    hasAmount: true,
  }, isMissingQuantity(ingredient.quantity), meal);
};

const addAmount = (item, ingredient) => {
  if (!ingredient.hasAmount) return;

  const normalizedUnit = normalizeKey(ingredient.unit);
  const unitKey = UNIT_SYNONYMS.get(normalizedUnit) ?? normalizedUnit;
  let amount = item.amountsByUnit.get(unitKey);

  if (!amount) {
    amount = { quantity: null, unit: ingredient.unit };
    item.amountsByUnit.set(unitKey, amount);
    item.amounts.push(amount);
  }

  if (ingredient.quantity !== null) {
    amount.quantity = (amount.quantity ?? 0) + ingredient.quantity;
  }
};

const addSource = (item, source) => {
  const sourceKey = `${source.day}\u0000${source.mealType}`;
  if (item.sourceKeys.has(sourceKey)) return;

  item.sourceKeys.add(sourceKey);
  item.sources.push(source);
};

const roundQuantity = (value) => {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toFixed(2).replace(/\.?0+$/, '');
};

export const buildShoppingList = (plan) => {
  if (!plan?.days?.length) return [];

  const itemsByName = new Map();

  WEEK_DAYS.forEach((weekday) => {
    const day = plan.days.find((candidate) => candidate?.name?.toLowerCase() === weekday.toLowerCase());
    if (!day?.meals) return;

    MEAL_TYPES.forEach((mealType) => {
      const meal = day.meals?.[mealType];
      const ingredients = Array.isArray(meal?.ingredients) ? meal.ingredients : [];
      if (!meal || meal.is_leftover === true || !ingredients.length) return;

      ingredients.forEach((rawIngredient) => {
        const ingredient = normalizeIngredient(rawIngredient, meal);
        if (!ingredient) return;

        const normalizedName = normalizeIngredientName(ingredient.name);
        const itemKey = normalizedName.key;
        let item = itemsByName.get(itemKey);

        if (!item) {
          item = {
            name: normalizedName.displayName,
            amounts: [],
            amountsByUnit: new Map(),
            sources: [],
            sourceKeys: new Set(),
          };
          itemsByName.set(itemKey, item);
        }

        addAmount(item, ingredient);
        addSource(item, { day: day.name || weekday, mealType, mealName: meal.name || '' });
      });
    });
  });

  return [...itemsByName.values()]
    .map((item) => ({
      name: item.name,
      amounts: item.amounts,
      sources: item.sources,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
};

export const formatAmounts = (item) => {
  const amounts = Array.isArray(item?.amounts) ? item.amounts : [];

  return amounts
    .map((amount) => {
      const unit = toTrimmedString(amount?.unit);
      const hasQuantity = typeof amount?.quantity === 'number' && Number.isFinite(amount.quantity);

      if (hasQuantity && unit) return `${roundQuantity(amount.quantity)} ${unit}`;
      if (hasQuantity) return roundQuantity(amount.quantity);
      return unit;
    })
    .filter(Boolean)
    .join(' + ');
};
