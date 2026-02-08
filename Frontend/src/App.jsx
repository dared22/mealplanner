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
import PrivacyPolicy from '@/Pages/PrivacyPolicy'
import DataDeletion from '@/Pages/DataDeletion'

function AppRoutes() {
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
          </Route>
          <Route path="/forbidden" element={<Forbidden />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
          <Route path="/" element={<Navigate to="/planner" replace />} />
          <Route path="/planner" element={<MealPlanner user={normalizedUser} />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/groceries" element={<Groceries />} />
        </Routes>
      </SignedIn>
      <SignedOut>
        <Routes>
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/data-deletion" element={<DataDeletion />} />
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
        <AppRoutes />
      </Router>
    </LanguageProvider>
  )
}
