const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeKey = (value) => value.toLowerCase();

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

const normalizeIngredient = (ingredient) => {
  if (typeof ingredient === 'string') {
    const name = ingredient.trim();
    return name ? { name, quantity: null, unit: '', hasAmount: false } : null;
  }

  if (!ingredient || typeof ingredient !== 'object' || Array.isArray(ingredient)) return null;

  const name = toTrimmedString(ingredient.name);
  if (!name) return null;

  return {
    name,
    quantity: parseQuantity(ingredient.quantity),
    unit: toTrimmedString(ingredient.unit),
    hasAmount: true,
  };
};

const addAmount = (item, ingredient) => {
  if (!ingredient.hasAmount) return;

  const unitKey = normalizeKey(ingredient.unit);
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
        const ingredient = normalizeIngredient(rawIngredient);
        if (!ingredient) return;

        const itemKey = normalizeKey(ingredient.name);
        let item = itemsByName.get(itemKey);

        if (!item) {
          item = {
            name: ingredient.name,
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
