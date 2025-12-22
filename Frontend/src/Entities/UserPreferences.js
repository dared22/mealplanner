const resolveApiUrl = () => {
  const configured = import.meta.env?.VITE_API_URL;
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost') {
      return 'http://localhost:8000';
    }

    if (window.location.hostname === 'mealplanner-frontend-cc0005e5d9b0.herokuapp.com') {
      return 'https://mealplanner-backend.herokuapp.com';
    }
  }

  return '/api';
};

const API_URL = resolveApiUrl();

export const UserPreferences = {
  create: async (data) => {
    const response = await fetch(`${API_URL}/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to save preferences: ${response.status} ${errorBody}`);
    }

    return response.json();
  }
};
