import { expect, test } from '@playwright/test';

const candidateId = '11111111-1111-4111-8111-111111111111';
const baseCandidate = {
  id: candidateId,
  source_post_id: '22222222-2222-4222-8222-222222222222',
  creator_id: '33333333-3333-4333-8333-333333333333',
  status: 'incomplete',
  extraction_version: 1,
  confidence: 0.94,
  duplicate_recipe_ids: [],
  blockers: ['food_safety_confirmation'],
  approved_recipe_id: null,
  rejection_reason: null,
  created_at: '2026-08-02T08:00:00Z',
  updated_at: '2026-08-02T08:00:00Z',
  data: {
    title: 'Harissa chicken bowls',
    description: 'Four lunches for the week.',
    ingredients: [{ name: 'Chicken', quantity: 800, unit: 'g', notes: '', original_text: '800g chicken' }],
    instructions: ['Cook chicken', 'Divide into four containers'],
    portions: 4,
    prep_time_minutes: 15,
    cook_time_minutes: 25,
    meal_type: 'lunch',
    cuisine: 'Mediterranean',
    tags: ['meal-prep'],
    allergens: [],
    dietary_flags: {},
    nutrition_per_serving: { calories: 520, protein_g: 48, carbs_g: 52, fat_g: 13, source: 'creator' },
    storage: {
      fridge_days: 3,
      freezer_months: 3,
      storage_instructions: 'Refrigerate promptly in sealed containers.',
      reheating_instructions: 'Reheat until steaming hot.',
      rule_version: 'foodsafety-no-2026-01',
    },
    source_url: 'https://www.instagram.com/p/example/',
    attribution: '@mealprepchef',
    thumbnail_url: 'https://res.cloudinary.com/demo/image/upload/example.jpg',
    allergen_reviewed: true,
    dietary_reviewed: true,
    food_safety_confirmed: false,
  },
};

test('admin confirms safety, saves, and publishes one candidate', async ({ page }) => {
  let savedCandidate = structuredClone(baseCandidate);
  let approved = false;

  await page.route(`**/admin/recipe-imports/candidates/${candidateId}`, async (route) => {
    if (route.request().method() === 'PATCH') {
      const payload = route.request().postDataJSON();
      savedCandidate = {
        ...savedCandidate,
        status: 'ready_for_review',
        extraction_version: 2,
        blockers: [],
        data: payload.data,
      };
      await route.fulfill({ json: savedCandidate });
      return;
    }
    await route.fulfill({ json: savedCandidate });
  });
  await page.route(`**/admin/recipe-imports/candidates/${candidateId}/approve`, async (route) => {
    approved = true;
    await route.fulfill({
      json: {
        candidate_id: candidateId,
        recipe_id: '44444444-4444-4444-8444-444444444444',
      },
    });
  });

  await page.goto(`/__e2e/recipe-imports/candidates/${candidateId}`);
  await expect(page.locator('input[value="Harissa chicken bowls"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve & publish' })).toBeDisabled();

  await page.getByLabel('Storage guidance confirmed').check();
  await page.getByRole('button', { name: 'Save review' }).click();
  await expect(page.getByRole('button', { name: 'Approve & publish' })).toBeEnabled();
  await page.getByRole('button', { name: 'Approve & publish' }).click();

  await expect(page.getByText('Published recipe opened')).toBeVisible();
  expect(approved).toBe(true);
});
