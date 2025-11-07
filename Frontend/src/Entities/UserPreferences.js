const API_URL = import.meta?.env?.VITE_API_URL || '/api';

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
