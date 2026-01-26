import { API_URL } from './api';

const buildQuery = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, value);
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

export const RecipesApi = {
  async list({ search, tag, limit = 50, offset = 0, token } = {}) {
    const query = buildQuery({ search, tag, limit, offset });
    const response = await fetch(`${API_URL}/recipes${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to load recipes: ${response.status} ${body}`);
    }

    return response.json();
  },
};
