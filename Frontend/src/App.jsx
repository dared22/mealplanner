import React from 'react'
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import MealPlanner from '@/Pages/MealPlanner.jsx'
import Login from '@/Pages/Login.jsx'
import { LanguageProvider } from '@/i18n/LanguageContext'

export default function App() {
  const { user } = useUser()
  const normalizedUser = user
    ? { id: user.id, email: user.primaryEmailAddress?.emailAddress || '' }
    : null

  return (
    <LanguageProvider>
      <SignedIn>
        <MealPlanner user={normalizedUser} />
      </SignedIn>
      <SignedOut>
        <Login />
      </SignedOut>
    </LanguageProvider>
  )
}
