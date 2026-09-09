import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import MealPlanner from '@/Pages/MealPlanner.jsx'
import Login from '@/Pages/Login.jsx'
import Recipes from '@/Pages/Recipes.jsx'
import Groceries from '@/Pages/Groceries.jsx'
// Explicitly point to the provider file to avoid resolving the plain context (.js) file
import LanguageProvider from '@/i18n/LanguageContext.jsx'
import AdminGuard from '@/components/admin/AdminGuard'
import AdminDashboard from '@/Pages/AdminDashboard'
import AdminUsers from '@/Pages/AdminUsers'
import AdminRecipes from '@/Pages/AdminRecipes'
import AdminRecipeEditor from '@/Pages/AdminRecipeEditor'
import AdminLogs from '@/Pages/AdminLogs'
import AdminUserDetails from '@/Pages/AdminUserDetails'
import Forbidden from '@/Pages/Forbidden'
import RecipeImportsLayout from '@/Pages/RecipeImportsLayout'
import RecipeImportCreators from '@/Pages/RecipeImportCreators'
import RecipeImportJobs from '@/Pages/RecipeImportJobs'
import RecipeImportCandidates from '@/Pages/RecipeImportCandidates'
import RecipeImportCandidateEditor from '@/Pages/RecipeImportCandidateEditor'
import RecipeImportE2EHarness from '@/test/RecipeImportE2EHarness'

function AuthenticatedAppRoutes() {
  const { user } = useUser()
  const normalizedUser = user
    ? { id: user.id, email: user.primaryEmailAddress?.emailAddress || '' }
    : null

  return (
    <>
      <SignedIn>
        <Routes>
          <Route path="/admin" element={<AdminGuard />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:userId" element={<AdminUserDetails />} />
            <Route path="recipes" element={<AdminRecipes />} />
            <Route path="recipes/new" element={<AdminRecipeEditor />} />
            <Route path="recipes/:recipeId/edit" element={<AdminRecipeEditor />} />
            <Route path="logs" element={<AdminLogs />} />
            <Route path="recipe-imports" element={<RecipeImportsLayout />}>
              <Route index element={<Navigate to="creators" replace />} />
              <Route path="creators" element={<RecipeImportCreators />} />
              <Route path="jobs" element={<RecipeImportJobs />} />
              <Route path="candidates" element={<RecipeImportCandidates />} />
              <Route path="candidates/:candidateId" element={<RecipeImportCandidateEditor />} />
            </Route>
          </Route>
          <Route path="/forbidden" element={<Forbidden />} />
          <Route path="/" element={<Navigate to="/planner" replace />} />
          <Route path="/planner" element={<MealPlanner user={normalizedUser} />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/groceries" element={<Groceries />} />
        </Routes>
      </SignedIn>
      <SignedOut>
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      </SignedOut>
    </>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <Router>
        {import.meta.env.MODE === 'e2e' ? <RecipeImportE2EHarness /> : <AuthenticatedAppRoutes />}
      </Router>
    </LanguageProvider>
  )
}
