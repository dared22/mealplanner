import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import MealPlanner from '@/Pages/MealPlanner.jsx'
import Login from '@/Pages/Login.jsx'
import Recipes from '@/Pages/Recipes.jsx'
import Groceries from '@/Pages/Groceries.jsx'
import { LanguageProvider } from '@/i18n/LanguageContext'

function AppRoutes() {
  const { user } = useUser()
  const normalizedUser = user
    ? { id: user.id, email: user.primaryEmailAddress?.emailAddress || '' }
    : null

  return (
    <>
      <SignedIn>
        <Routes>
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
        <AppRoutes />
      </Router>
    </LanguageProvider>
  )
}
