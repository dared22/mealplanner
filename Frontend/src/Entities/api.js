const resolveApiUrl = () => {
  const configured = import.meta.env?.VITE_API_URL;
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8000';
    }

    if (host === 'mealplanner-frontend-cc0005e5d9b0.herokuapp.com') {
      return 'https://mealplanner-backend-d6ab87c9c7b5.herokuapp.com';
    }
  }

  return '/api';
};

export const API_URL = resolveApiUrl();
