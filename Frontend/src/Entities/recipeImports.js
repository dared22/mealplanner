import { API_URL } from './api';

const request = async (getToken, path, options = {}) => {
  const token = await getToken();
  if (!token) throw new Error('Missing authentication token. Please sign in again.');
  const response = await fetch(`${API_URL}/admin/recipe-imports${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      if (typeof payload.detail === 'string') detail = payload.detail;
      if (payload.detail?.message) {
        detail = `${payload.detail.message}: ${(payload.detail.blockers || []).join(', ')}`;
      }
    } catch {
      // Keep the status-based error when the response is not JSON.
    }
    throw new Error(detail);
  }
  return response.json();
};

export const recipeImportsApi = {
  readiness: (getToken) => request(getToken, '/readiness'),
  creators: (getToken) => request(getToken, '/creators'),
  createCreator: (getToken, body) =>
    request(getToken, '/creators', { method: 'POST', body: JSON.stringify(body) }),
  updateCreator: (getToken, id, body) =>
    request(getToken, `/creators/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  scanCreator: (getToken, id, body) =>
    request(getToken, `/creators/${id}/scans`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  revokeCreator: (getToken, id) =>
    request(getToken, `/creators/${id}/revoke`, { method: 'POST' }),
  manualPost: (getToken, body) =>
    request(getToken, '/manual-posts', { method: 'POST', body: JSON.stringify(body) }),
  uploadManualMedia: (getToken, file) => {
    const body = new FormData();
    body.append('media', file);
    return request(getToken, '/manual-media', { method: 'POST', body });
  },
  jobs: (getToken) => request(getToken, '/jobs'),
  cancelJob: (getToken, id) => request(getToken, `/jobs/${id}/cancel`, { method: 'POST' }),
  candidates: (getToken, status) =>
    request(getToken, `/candidates${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  candidate: (getToken, id) => request(getToken, `/candidates/${id}`),
  updateCandidate: (getToken, id, data) =>
    request(getToken, `/candidates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ data }),
    }),
  approveCandidate: (getToken, id) =>
    request(getToken, `/candidates/${id}/approve`, { method: 'POST' }),
  retryCandidate: (getToken, id) =>
    request(getToken, `/candidates/${id}/retry`, { method: 'POST' }),
  rejectCandidate: (getToken, id, reason) =>
    request(getToken, `/candidates/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};
