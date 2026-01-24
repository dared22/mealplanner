import { API_URL } from './api';

const buildHeaders = (token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export const UserPreferences = {
  create: async (data, token) => {
    const response = await fetch(`${API_URL}/preferences`, {
      method: 'POST',
      headers: buildHeaders(token),
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
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to fetch preferences: ${response.status} ${errorBody}`);
    }

    return response.json();
  }
};
