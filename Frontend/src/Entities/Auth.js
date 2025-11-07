const resolveApiUrl = () => {
  const configured = import.meta.env?.VITE_API_URL;
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8000';
  }

  return '/api';
};

const API_URL = resolveApiUrl();

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
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    return handleResponse(response);
  },
  login: async ({ email, password }) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    return handleResponse(response);
  },
  logout: async () => {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to logout');
    }
  },
  session: async () => {
    const response = await fetch(`${API_URL}/auth/session`, {
      method: 'GET',
      credentials: 'include',
    });

    return handleResponse(response);
  },
};
