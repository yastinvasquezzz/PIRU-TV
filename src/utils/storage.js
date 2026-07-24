import { supabase } from '../lib/supabase';

/**
 * PIRU TV - Hybrid Storage & Supabase Sync Helper
 * Persists watch history, favorites, and user preferences locally & syncs with Supabase Cloud.
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

export const saveWatchProgress = async (item) => {
  if (!item || !item.id) return;
  try {
    const history = getWatchHistory();
    const filtered = history.filter(h => String(h.id) !== String(item.id));
    const updatedItem = {
      ...item,
      updatedAt: new Date().toISOString()
    };
    const newHistory = [updatedItem, ...filtered].slice(0, 30);
    localStorage.setItem(KEYS.WATCH_HISTORY, JSON.stringify(newHistory));

    // Async sync to Supabase if logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('watch_history').upsert({
        user_id: user.id,
        item_id: String(item.id),
        item_data: updatedItem,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,item_id' });
    }
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

export const toggleFavorite = async (item) => {
  if (!item || !item.id) return false;
  try {
    const favorites = getFavorites();
    const exists = favorites.some(f => String(f.id) === String(item.id));
    let updated;
    if (exists) {
      updated = favorites.filter(f => String(f.id) !== String(item.id));
    } else {
      updated = [{ ...item, addedAt: new Date().toISOString() }, ...favorites];
    }
    localStorage.setItem(KEYS.FAVORITES, JSON.stringify(updated));

    // Async sync to Supabase if logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (exists) {
        await supabase.from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('item_id', String(item.id));
      } else {
        await supabase.from('favorites').upsert({
          user_id: user.id,
          item_id: String(item.id),
          item_data: item,
          created_at: new Date().toISOString()
        }, { onConflict: 'user_id,item_id' });
      }
    }
    return !exists;
  } catch (e) {
    console.error('Error toggling favorite:', e);
    return false;
  }
};

export const isFavorite = (itemId) => {
  if (!itemId) return false;
  const favorites = getFavorites();
  return favorites.some(f => String(f.id) === String(itemId));
};

export const syncCloudDataWithLocal = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch cloud favorites
    const { data: cloudFavs } = await supabase.from('favorites').select('*').eq('user_id', user.id);
    if (cloudFavs && cloudFavs.length > 0) {
      const localFavs = getFavorites();
      const mergedMap = new Map();
      localFavs.forEach(f => mergedMap.set(String(f.id), f));
      cloudFavs.forEach(cf => mergedMap.set(String(cf.item_id), cf.item_data));
      localStorage.setItem(KEYS.FAVORITES, JSON.stringify(Array.from(mergedMap.values())));
    }

    // Fetch cloud watch history
    const { data: cloudHistory } = await supabase.from('watch_history').select('*').eq('user_id', user.id);
    if (cloudHistory && cloudHistory.length > 0) {
      const localHistory = getWatchHistory();
      const mergedMap = new Map();
      localHistory.forEach(h => mergedMap.set(String(h.id), h));
      cloudHistory.forEach(ch => mergedMap.set(String(ch.item_id), ch.item_data));
      localStorage.setItem(KEYS.WATCH_HISTORY, JSON.stringify(Array.from(mergedMap.values())));
    }
  } catch (e) {
    console.error('Cloud sync error:', e);
  }
};
