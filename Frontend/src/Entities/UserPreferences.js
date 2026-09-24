import { API_URL, jsonHeaders, withAuthorization } from './api';

export const UserPreferences = {
  create: async (data, token) => {
    const response = await fetch(`${API_URL}/preferences`, {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to save preferences: ${response.status} ${errorBody}`);
    }

    return response.json();
  },
  fetch: async (preferenceId, language, token) => {
    const query = language ? `?lang=${encodeURIComponent(language)}` : '';
    const response = await fetch(`${API_URL}/preferences/${preferenceId}${query}`, {
      method: 'GET',
      headers: withAuthorization(token),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to fetch preferences: ${response.status} ${errorBody}`);
    }

    return response.json();
  }
};
