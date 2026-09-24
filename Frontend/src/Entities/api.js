const resolveApiUrl = () => {
  const configured = import.meta.env?.VITE_API_URL?.trim();
  return (configured || 'http://localhost:8000').replace(/\/$/, '');
};

export const API_URL = resolveApiUrl();

export const withAuthorization = (token, headers = {}) => (
  token ? { ...headers, Authorization: `Bearer ${token}` } : headers
);

export const jsonHeaders = (token) => withAuthorization(token, {
  'Content-Type': 'application/json',
});
