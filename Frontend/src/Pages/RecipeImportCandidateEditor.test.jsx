import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { recipeImportsApi } from '@/Entities/recipeImports';
import RecipeImportCandidateEditor from './RecipeImportCandidateEditor';
import { RecipeImportsContext } from './recipeImportsContext';

vi.mock('@/Entities/recipeImports', () => ({
  recipeImportsApi: {
    candidate: vi.fn(),
    updateCandidate: vi.fn(),
    approveCandidate: vi.fn(),
    rejectCandidate: vi.fn(),
    retryCandidate: vi.fn(),
  },
}));

const candidate = {
  id: '11111111-1111-4111-8111-111111111111',
  source_post_id: '22222222-2222-4222-8222-222222222222',
  creator_id: '33333333-3333-4333-8333-333333333333',
  status: 'incomplete',
  extraction_version: 1,
  confidence: 0.91,
  duplicate_recipe_ids: [],
  blockers: ['ingredient_quantities', 'food_safety_confirmation'],
  approved_recipe_id: null,
  rejection_reason: null,
  created_at: '2026-08-02T08:00:00Z',
  updated_at: '2026-08-02T08:00:00Z',
  data: {
    title: 'Chicken bowls',
    description: '',
    ingredients: [{ name: 'Chicken', quantity: null, unit: 'g', notes: '', original_text: 'chicken' }],
    instructions: ['Cook chicken'],
    portions: 4,
    prep_time_minutes: 10,
    cook_time_minutes: 20,
    meal_type: 'lunch',
    cuisine: '',
    tags: [],
    allergens: [],
    dietary_flags: {},
    nutrition_per_serving: { calories: 500, protein_g: 40, carbs_g: 50, fat_g: 12, source: 'creator' },
    storage: {
      fridge_days: 3,
      freezer_months: 3,
      storage_instructions: 'Refrigerate promptly.',
      reheating_instructions: 'Reheat until steaming.',
      rule_version: 'foodsafety-no-2026-01',
    },
    source_url: 'https://www.instagram.com/p/example/',
    attribution: '@mealprepchef',
    thumbnail_url: 'https://res.cloudinary.com/demo/example.jpg',
    allergen_reviewed: true,
    dietary_reviewed: true,
    food_safety_confirmed: false,
  },
};

describe('RecipeImportCandidateEditor', () => {
  it('keeps publishing locked while strict review checks are missing', async () => {
    recipeImportsApi.candidate.mockResolvedValue(candidate);

    render(
      <RecipeImportsContext.Provider value={{ getToken: vi.fn() }}>
        <MemoryRouter initialEntries={[`/candidate/${candidate.id}`]}>
          <Routes>
            <Route path="/candidate/:candidateId" element={<RecipeImportCandidateEditor />} />
          </Routes>
        </MemoryRouter>
      </RecipeImportsContext.Provider>,
    );

    expect(await screen.findByDisplayValue('Chicken bowls')).toBeInTheDocument();
    expect(screen.getByText('quantified ingredients')).toBeInTheDocument();
    expect(screen.getByText('food-safety confirmation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve & publish' })).toBeDisabled();
  });

  it('keeps publishing locked for unsupported meal types and provenance URLs', async () => {
    recipeImportsApi.candidate.mockResolvedValue({
      ...candidate,
      status: 'ready_for_review',
      blockers: [],
      data: {
        ...candidate.data,
        meal_type: 'brunch',
        source_url: 'https://example.com/copied-recipe',
        thumbnail_url: 'https://example.com/unlicensed-image.jpg',
        food_safety_confirmed: true,
      },
    });

    render(
      <RecipeImportsContext.Provider value={{ getToken: vi.fn() }}>
        <MemoryRouter initialEntries={[`/candidate/${candidate.id}`]}>
          <Routes>
            <Route path="/candidate/:candidateId" element={<RecipeImportCandidateEditor />} />
          </Routes>
        </MemoryRouter>
      </RecipeImportsContext.Provider>,
    );

    expect(await screen.findByDisplayValue('Chicken bowls')).toBeInTheDocument();
    expect(screen.getByText('planner meal type')).toBeInTheDocument();
    expect(screen.getByText('trusted source and attribution')).toBeInTheDocument();
    expect(screen.getByText('licensed Cloudinary thumbnail')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve & publish' })).toBeDisabled();
  });
});
