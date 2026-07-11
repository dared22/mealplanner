import { API_URL } from './api';

const buildHeaders = (token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export const Plans = {
  history: async (token, limit = 10) => {
    const response = await fetch(`${API_URL}/plans/history?limit=${limit}`, {
      method: 'GET',
      headers: buildHeaders(token),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to fetch plan history: ${response.status} ${errorBody}`);
    }

    return response.json();
  },
};
