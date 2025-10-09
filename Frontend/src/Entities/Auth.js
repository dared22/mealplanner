const API_URL = import.meta?.env?.VITE_API_URL || 'http://localhost:8000';

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      `${response.status} ${response.statusText || 'Request failed'}`;
    throw new Error(message);
  }
  return data;
}

export const Auth = {
  register: async ({ email, password }) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    return handleResponse(response);
  },
  login: async ({ email, password }) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    return handleResponse(response);
  },
};
