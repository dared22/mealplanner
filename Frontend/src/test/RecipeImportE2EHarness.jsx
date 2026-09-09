import React from 'react';
import { Route, Routes } from 'react-router-dom';
import RecipeImportCandidateEditor from '@/Pages/RecipeImportCandidateEditor';
import { RecipeImportsContext } from '@/Pages/recipeImportsContext';

export default function RecipeImportE2EHarness() {
  return (
    <RecipeImportsContext.Provider value={{ getToken: async () => 'e2e-token' }}>
      <Routes>
        <Route
          path="/__e2e/recipe-imports/candidates/:candidateId"
          element={<RecipeImportCandidateEditor />}
        />
        <Route
          path="/admin/recipes/:recipeId/edit"
          element={<div>Published recipe opened</div>}
        />
      </Routes>
    </RecipeImportsContext.Provider>
  );
}
