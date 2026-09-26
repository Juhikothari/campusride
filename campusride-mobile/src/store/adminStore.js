// campusride-mobile/src/store/adminStore.js
import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../services/api';

let globalStats = null;
let globalLoading = false;
const listeners = new Set();

const notifyListeners = () => {
  listeners.forEach(fn => fn({ stats: globalStats, loading: globalLoading }));
};

export const fetchAdminStats = async () => {
  globalLoading = true;
  notifyListeners();
  try {
    const res = await apiClient.get('/admin/stats');
    globalStats = res.data;
    return globalStats;
  } catch (err) {
    console.warn('fetchAdminStats warning:', err.message);
    return globalStats;
  } finally {
    globalLoading = false;
    notifyListeners();
  }
};

export function useAdminStore() {
  const [state, setState] = useState({ stats: globalStats, loading: globalLoading });

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const fetchStats = useCallback(async () => {
    return await fetchAdminStats();
  }, []);

  return {
    stats: state.stats,
    loading: state.loading,
    fetchStats,
  };
}
