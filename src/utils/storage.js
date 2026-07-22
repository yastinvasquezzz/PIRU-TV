/**
 * PIRU TV - Local Storage Helper
 * Persists watch history, favorites, and user preferences for TV & Web users.
 */

const KEYS = {
  WATCH_HISTORY: 'piru_tv_watch_history',
  FAVORITES: 'piru_tv_favorites',
  LAST_TAB: 'piru_tv_last_tab'
};

export const getWatchHistory = () => {
  try {
    const data = localStorage.getItem(KEYS.WATCH_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading watch history:', e);
    return [];
  }
};

export const saveWatchProgress = (item) => {
  if (!item || !item.id) return;
  try {
    const history = getWatchHistory();
    const filtered = history.filter(h => h.id !== item.id);
    const updatedItem = {
      ...item,
      updatedAt: new Date().toISOString()
    };
    // Keep top 30 recent items
    const newHistory = [updatedItem, ...filtered].slice(0, 30);
    localStorage.setItem(KEYS.WATCH_HISTORY, JSON.stringify(newHistory));
  } catch (e) {
    console.error('Error saving watch progress:', e);
  }
};

export const getFavorites = () => {
  try {
    const data = localStorage.getItem(KEYS.FAVORITES);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading favorites:', e);
    return [];
  }
};

export const toggleFavorite = (item) => {
  if (!item || !item.id) return false;
  try {
    const favorites = getFavorites();
    const exists = favorites.some(f => f.id === item.id);
    let updated;
    if (exists) {
      updated = favorites.filter(f => f.id !== item.id);
    } else {
      updated = [{ ...item, addedAt: new Date().toISOString() }, ...favorites];
    }
    localStorage.setItem(KEYS.FAVORITES, JSON.stringify(updated));
    return !exists;
  } catch (e) {
    console.error('Error toggling favorite:', e);
    return false;
  }
};

export const isFavorite = (itemId) => {
  if (!itemId) return false;
  const favorites = getFavorites();
  return favorites.some(f => f.id === itemId);
};
