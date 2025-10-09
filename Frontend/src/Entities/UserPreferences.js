const API_URL = import.meta?.env?.VITE_API_URL || 'http://localhost:8000';

export const UserPreferences = {
  create: async (data) => {
    if (!data?.user_id) {
      throw new Error('user_id is required to save preferences');
    }
    const response = await fetch(`${API_URL}/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to save preferences: ${response.status} ${errorBody}`);
    }

    return response.json();
  }
};
