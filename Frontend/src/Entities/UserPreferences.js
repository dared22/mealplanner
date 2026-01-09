import { API_URL } from './api';

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
  },
  fetch: async (preferenceId, language) => {
    const query = language ? `?lang=${encodeURIComponent(language)}` : '';
    const response = await fetch(`${API_URL}/preferences/${preferenceId}${query}`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to fetch preferences: ${response.status} ${errorBody}`);
    }

    return response.json();
  }
};
