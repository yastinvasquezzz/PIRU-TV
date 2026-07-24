import { supabase } from '../lib/supabase';

export const AVATARS = [
  { id: 'popcorn', emoji: '🍿', name: 'Piru Palomitas', gradient: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)' },
  { id: 'ninja', emoji: '🐱‍👤', name: 'Ninja Anime', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' },
  { id: 'hero', emoji: '🦸‍♂️', name: 'Superhéroe', gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' },
  { id: 'kdrama', emoji: '🌸', name: 'Estrella Kdrama', gradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)' },
  { id: 'dragon', emoji: '🐉', name: 'Maestro Dragón', gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' },
  { id: 'cyber', emoji: '👾', name: 'Cyber Gamer', gradient: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)' },
  { id: 'scifi', emoji: '🚀', name: 'Piloto Sci-Fi', gradient: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)' },
  { id: 'crown', emoji: '👑', name: 'Rey VIP', gradient: 'linear-gradient(135deg, #f43f5e 0%, #9f1239 100%)' }
];

const AVATAR_KEY = 'piru_user_avatar';

export const getSelectedAvatar = () => {
  const saved = localStorage.getItem(AVATAR_KEY);
  if (saved) {
    const found = AVATARS.find(a => a.id === saved);
    if (found) return found;
  }
  return AVATARS[0];
};

export const setSelectedAvatar = async (avatarId) => {
  localStorage.setItem(AVATAR_KEY, avatarId);
  const found = AVATARS.find(a => a.id === avatarId);
  
  // Sync to Supabase user metadata if logged in
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.auth.updateUser({
        data: { avatar: avatarId }
      });
    }
  } catch (e) {
    console.error('Error syncing avatar to Supabase:', e);
  }

  return found || AVATARS[0];
};
