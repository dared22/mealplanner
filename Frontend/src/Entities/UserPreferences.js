const resolveApiUrl = () => {
  const configured = import.meta.env?.VITE_API_URL;
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8000';
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
