import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { syncCloudDataWithLocal } from '../utils/storage';

export default function AuthModal({ isOpen, onClose, onAuthChange }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        syncCloudDataWithLocal();
      }
      if (onAuthChange) onAuthChange(currentUser);
    });

    return () => subscription.unsubscribe();
  }, [onAuthChange]);

  if (!isOpen) return null;

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password
        });
        if (error) throw error;
        setMessage({ text: '¡Cuenta creada con éxito! Ya puedes acceder.', type: 'success' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        setMessage({ text: '¡Sesión iniciada correctamente!', type: 'success' });
        setTimeout(() => {
          onClose();
        }, 1000);
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
    setMessage({ text: 'Sesión cerrada.', type: 'info' });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', minHeight: 'auto', borderRadius: '24px', padding: '2.5rem 2rem' }}>
        <button className="modal-close-btn" onClick={onClose}>✕</button>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
            {user ? '👤' : (isSignUp ? '✨' : '🔐')}
          </div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.8rem', fontWeight: 800 }}>
            {user ? 'Mi Cuenta PIRU TV' : (isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.4rem' }}>
            {user ? `Conectado como ${user.email}` : 'Guarda y sincroniza tus películas y favoritos en la nube'}
          </p>
        </div>

        {message.text && (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            marginBottom: '1.5rem',
            fontSize: '0.88rem',
            textAlign: 'center',
            background: message.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            border: `1px solid ${message.type === 'error' ? '#ef4444' : '#22c55e'}`,
            color: message.type === 'error' ? '#fca5a5' : '#86efac'
          }}>
            {message.text}
          </div>
        )}

        {user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Estado del Almacenamiento</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.2rem', color: '#86efac' }}>
                🟢 Cloud Sync Activo (Supabase)
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' }}
            >
              🚪 Cerrar Sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Correo Electrónico</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="search-input"
                style={{ paddingLeft: '1rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="search-input"
                style={{ paddingLeft: '1rem' }}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '0.5rem' }}>
              {loading ? 'Procesando...' : (isSignUp ? 'Registrarse' : 'Entrar')}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {isSignUp ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
              </span>
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setMessage({ text: '', type: '' }); }}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer' }}
              >
                {isSignUp ? 'Inicia Sesión' : 'Regístrate Gratis'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
