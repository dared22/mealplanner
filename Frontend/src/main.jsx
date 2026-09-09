import React from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import './styles.css'   

const isE2E = import.meta.env.MODE === 'e2e'
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY && !isE2E) {
  throw new Error('Add your Clerk Publishable Key to the .env file')
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isE2E ? (
      <App />
    ) : (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    )}
  </React.StrictMode>
)
