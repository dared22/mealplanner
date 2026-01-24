import React from 'react'
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react'
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
        <div className="absolute right-4 top-4 z-50">
          <UserButton />
        </div>
        <MealPlanner user={normalizedUser} />
      </SignedIn>
      <SignedOut>
        <Login />
      </SignedOut>
    </LanguageProvider>
  )
}
