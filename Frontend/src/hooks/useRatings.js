import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function useRatings() {
  const { getToken } = useAuth();
  const [ratings, setRatings] = useState({}); // { recipe_id: { is_liked: boolean, id: string } }
  const [progress, setProgress] = useState({ total: 0, threshold: 10, is_unlocked: false });
  const [loading, setLoading] = useState(false);

  // Fetch user's existing ratings on mount
  const fetchRatings = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/ratings/me?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const map = {};
        for (const r of data.items || []) {
          map[r.recipe_id] = { is_liked: r.is_liked, id: r.id };
        }
        setRatings(map);
      }
    } catch (err) {
      console.error('Failed to fetch ratings:', err);
    }
  }, [getToken]);

  // Fetch progress toward personalization
  const fetchProgress = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/ratings/progress`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProgress({
          total: data.total_ratings,
          threshold: data.threshold,
          is_unlocked: data.is_unlocked
        });
      }
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    }
  }, [getToken]);

  // Submit a rating (like or dislike)
  const submitRating = useCallback(async (recipeId, isLiked) => {
    if (!recipeId) return;
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ recipe_id: recipeId, is_liked: isLiked })
      });
      if (res.ok) {
        const data = await res.json();
        setRatings(prev => ({
          ...prev,
          [recipeId]: { is_liked: data.is_liked, id: data.id }
        }));
        // Increment progress if this is a new rating
        setProgress(prev => {
          const newTotal = Object.keys({ ...ratings, [recipeId]: true }).length;
          return {
            ...prev,
            total: newTotal,
            is_unlocked: newTotal >= prev.threshold
          };
        });
        // Re-fetch progress for accuracy
        fetchProgress();
      }
    } catch (err) {
      console.error('Failed to submit rating:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken, ratings, fetchProgress]);

  // Get rating for a specific recipe
  const getRating = useCallback((recipeId) => {
    return ratings[recipeId] || null;
  }, [ratings]);

  useEffect(() => {
    fetchRatings();
    fetchProgress();
  }, [fetchRatings, fetchProgress]);

  return {
    ratings,
    progress,
    loading,
    submitRating,
    getRating,
    refetch: () => { fetchRatings(); fetchProgress(); }
  };
}
