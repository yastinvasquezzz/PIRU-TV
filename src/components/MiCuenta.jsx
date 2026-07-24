import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getFavorites, getWatchHistory, toggleFavorite, syncCloudDataWithLocal } from '../utils/storage';

export default function MiCuenta({ onOpenItem }) {
  const [user, setUser] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('history'); // 'history' or 'favorites'

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) syncCloudDataWithLocal();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) syncCloudDataWithLocal();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadData = () => {
    setFavorites(getFavorites());
    setHistory(getWatchHistory());
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        if (data?.user && data?.user?.identities && data.user.identities.length === 0) {
          setMessage({ text: '⚠️ Este correo ya está registrado. Por favor inicia sesión.', type: 'error' });
        } else {
          setMessage({ text: '¡Te hemos enviado un correo de confirmación! Revisa tu bandeja de entrada.', type: 'success' });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage({ text: '¡Sesión iniciada con éxito!', type: 'success' });
      }
    } catch (err) {
      setMessage({ text: err.message || 'Error en la autenticación', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMessage({ text: 'Sesión cerrada correctamente.', type: 'info' });
  };

  const handleRemoveFavorite = (e, item) => {
    e.stopPropagation();
    toggleFavorite(item);
    loadData();
  };

  return (
    <div className="mi-cuenta-container" style={{ padding: '1rem 0' }}>
      {/* Profile Header */}
      <div 
        style={{
          background: 'linear-gradient(135deg, rgba(229, 9, 20, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '2.5rem',
          marginBottom: '2.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
          boxShadow: '0 15px 35px rgba(0,0,0,0.5)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div 
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #e50914 0%, #9333ea 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              boxShadow: '0 0 25px rgba(229, 9, 20, 0.5)'
            }}
          >
            👤
          </div>
          <div>
            <span style={{ fontSize: '0.82rem', color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              {user ? 'Plan Gratuito PIRU TV' : 'Modo Invitado (Dispositivo Local)'}
            </span>
            <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', fontWeight: 900, color: '#fff', margin: '0.2rem 0' }}>
              {user ? user.email : 'Mi Perfil de Streaming'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {user ? '🟢 Sincronización en la nube activa con Supabase' : '💡 Registra tu cuenta gratis para sincronizar tus favoritos en cualquier dispositivo'}
            </p>
          </div>
        </div>

        {user ? (
          <button
            onClick={handleSignOut}
            className="btn-primary"
            style={{
              flex: 'none',
              background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              padding: '0.8rem 1.75rem',
              borderRadius: '12px',
              boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
            }}
          >
            🚪 Cerrar Sesión
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => { setIsSignUp(false); window.scrollTo({ top: 400, behavior: 'smooth' }); }}
              className="btn-primary"
              style={{ flex: 'none', padding: '0.75rem 1.5rem', borderRadius: '12px' }}
            >
              🔐 Iniciar Sesión
            </button>
            <button
              onClick={() => { setIsSignUp(true); window.scrollTo({ top: 400, behavior: 'smooth' }); }}
              className="btn-hero-info"
              style={{ padding: '0.75rem 1.5rem', borderRadius: '12px' }}
            >
              ✨ Crear Cuenta
            </button>
          </div>
        )}
      </div>

      {/* If not logged in, show Auth Form Card */}
      {!user && (
        <div 
          style={{
            maxWidth: '520px',
            margin: '0 auto 3rem',
            background: 'linear-gradient(145deg, rgba(20, 20, 32, 0.95) 0%, rgba(10, 10, 18, 0.98) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '24px',
            padding: '2.5rem',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.8), 0 0 25px rgba(229, 9, 20, 0.15)'
          }}
        >
          {/* Tab Switcher */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', padding: '0.3rem', borderRadius: '14px', marginBottom: '1.75rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setMessage({ text: '', type: '' }); }}
              style={{
                flex: 1,
                padding: '0.65rem',
                border: 'none',
                borderRadius: '10px',
                fontFamily: 'var(--font-title)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                background: !isSignUp ? 'linear-gradient(135deg, #e50914 0%, #9333ea 100%)' : 'transparent',
                color: '#fff',
                boxShadow: !isSignUp ? '0 4px 15px rgba(229, 9, 20, 0.4)' : 'none',
                transition: 'all 0.25s ease'
              }}
            >
              🔐 Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setMessage({ text: '', type: '' }); }}
              style={{
                flex: 1,
                padding: '0.65rem',
                border: 'none',
                borderRadius: '10px',
                fontFamily: 'var(--font-title)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                background: isSignUp ? 'linear-gradient(135deg, #e50914 0%, #9333ea 100%)' : 'transparent',
                color: '#fff',
                boxShadow: isSignUp ? '0 4px 15px rgba(229, 9, 20, 0.4)' : 'none',
                transition: 'all 0.25s ease'
              }}
            >
              ✨ Crear Cuenta Gratis
            </button>
          </div>

          {message.text && (
            <div style={{
              padding: '0.8rem 1rem',
              borderRadius: '12px',
              marginBottom: '1.25rem',
              fontSize: '0.88rem',
              textAlign: 'center',
              fontWeight: 600,
              background: message.type === 'error' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(34, 197, 94, 0.18)',
              border: `1px solid ${message.type === 'error' ? '#ef4444' : '#22c55e'}`,
              color: message.type === 'error' ? '#fca5a5' : '#86efac'
            }}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', fontWeight: 700 }}>
                ✉️ Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="search-input"
                style={{ paddingLeft: '1.25rem', borderRadius: '12px', background: 'rgba(0,0,0,0.4)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', fontWeight: 700 }}>
                🔒 Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="search-input"
                style={{ paddingLeft: '1.25rem', borderRadius: '12px', background: 'rgba(0,0,0,0.4)' }}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '0.5rem', borderRadius: '12px', padding: '0.9rem', fontSize: '1rem' }}>
              {loading ? 'Cargando...' : (isSignUp ? '✨ Registrarse Gratis' : '🚀 Entrar a PIRU TV')}
            </button>
          </form>
        </div>
      )}

      {/* Sub Tabs: Watch History vs Favorites */}
      <div className="dashboard-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
          <h2 className="dashboard-section-title" style={{ margin: 0, border: 'none' }}>
            {activeTab === 'history' ? '🕒 Pelis y Series Vistas Hace Poco' : '❤️ Mis Favoritos Guardados'}
          </h2>

          <div className="filters-wrapper" style={{ margin: 0, padding: 0 }}>
            <button
              className={`filter-badge ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              🕒 Vistas Recientemente ({history.length})
            </button>
            <button
              className={`filter-badge ${activeTab === 'favorites' ? 'active' : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              ❤️ Mi Lista ({favorites.length})
            </button>
          </div>
        </div>

        {activeTab === 'history' ? (
          history.length > 0 ? (
            <div className="media-grid">
              {history.map((item) => (
                <button
                  type="button"
                  key={`${item.type}-${item.id}`}
                  className="media-card"
                  onClick={() => onOpenItem && onOpenItem(item)}
                  style={{ textAlign: 'left', font: 'inherit', color: 'inherit', padding: 0 }}
                >
                  <div className="card-thumbnail-wrapper" style={{ aspectRatio: '16/9' }}>
                    <img
                      src={item.poster || item.portada || 'https://via.placeholder.com/160x240?text=?'}
                      alt={item.title || item.titulo}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div className="play-hover-btn">
                      <div className="play-icon">▶</div>
                    </div>
                  </div>
                  <div className="card-info">
                    <span className="card-genre">Continuar Viendo</span>
                    <h3 className="card-title">{item.title || item.titulo}</h3>
                    <p className="card-summary">
                      {item.season && item.episode ? `Temp. ${item.season} • Episodio ${item.episode}` : 'Reanudar video'}
                    </p>
                    <div className="card-footer">
                      <span>Visto recientemente</span>
                      <span className="card-lang">PLAY</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '4rem 2rem' }}>
              <span className="empty-icon">🕒</span>
              <h3 className="empty-title">Aún no has visto películas o series</h3>
              <p>Las películas y episodios que comiences a reproducir aparecerán aquí automáticamente.</p>
            </div>
          )
        ) : (
          favorites.length > 0 ? (
            <div className="media-grid">
              {favorites.map((item) => (
                <button
                  type="button"
                  key={`${item.type}-${item.id}`}
                  className="media-card"
                  onClick={() => onOpenItem && onOpenItem(item)}
                  style={{ textAlign: 'left', font: 'inherit', color: 'inherit', padding: 0 }}
                >
                  <div className="card-thumbnail-wrapper" style={{ aspectRatio: '2/3' }}>
                    <img
                      src={item.poster || item.portada || 'https://via.placeholder.com/160x240?text=?'}
                      alt={item.title || item.titulo}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div className="play-hover-btn">
                      <div className="play-icon">▶</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveFavorite(e, item)}
                      title="Quitar de favoritos"
                      style={{
                        position: 'absolute',
                        top: '0.6rem',
                        right: '0.6rem',
                        background: 'rgba(239, 68, 68, 0.85)',
                        border: 'none',
                        color: 'white',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        zIndex: 10
                      }}
                    >
                      ❤️
                    </button>
                  </div>
                  <div className="card-info">
                    <span className="card-genre">{item.category || item.type || 'Contenido'}</span>
                    <h3 className="card-title">{item.title || item.titulo}</h3>
                    <div className="card-footer">
                      <span>Guardado</span>
                      <span className="card-lang">FAV</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '4rem 2rem' }}>
              <span className="empty-icon">❤️</span>
              <h3 className="empty-title">Aún no tienes favoritos guardados</h3>
              <p>Haz clic en "Agregar a Mi Lista" en cualquier película o dorama para agregarlo aquí.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
