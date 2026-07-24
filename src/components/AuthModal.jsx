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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
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
        setMessage({ text: '¡Bienvenido a PIRU TV!', type: 'success' });
        setTimeout(() => onClose(), 800);
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

  return (
    <div className="modal-overlay" onClick={onClose} style={{ backdropFilter: 'blur(16px)', background: 'rgba(2, 2, 6, 0.85)' }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: '460px', 
          minHeight: 'auto', 
          borderRadius: '28px', 
          padding: '2.5rem 2.25rem',
          background: 'linear-gradient(145deg, rgba(20, 20, 32, 0.95) 0%, rgba(10, 10, 18, 0.98) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(229, 9, 20, 0.2)'
        }}
      >
        <button className="modal-close-btn" onClick={onClose}>✕</button>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ fontFamily: 'var(--font-title)', fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-0.05em', marginBottom: '0.4rem' }}>
            <span style={{ color: '#e50914' }}>PIRU</span><span style={{ color: '#fff' }}>TV</span>
          </div>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {user ? 'Perfil de Usuario' : 'Tu Experiencia de Streaming Personal'}
          </h3>
        </div>

        {user ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ 
              background: 'rgba(34, 197, 94, 0.08)', 
              padding: '1.25rem', 
              borderRadius: '16px', 
              border: '1px solid rgba(34, 197, 94, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{ fontSize: '2.2rem' }}>👤</div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Usuario Conectado</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginTop: '0.1rem' }}>{user.email}</div>
                <div style={{ fontSize: '0.78rem', color: '#86efac', marginTop: '0.2rem' }}>🟢 Sincronización Nube Activa</div>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)', boxShadow: '0 6px 20px rgba(229, 9, 20, 0.4)', borderRadius: '12px' }}
            >
              🚪 Cerrar Sesión
            </button>
          </div>
        ) : (
          <>
            {/* Tab Switcher */}
            <div style={{ 
              display: 'flex', 
              background: 'rgba(255, 255, 255, 0.05)', 
              padding: '0.3rem', 
              borderRadius: '14px', 
              marginBottom: '1.75rem',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
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
                ✨ Crear Cuenta
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
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', fontWeight: 700 }}>
                  ✉️ Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@ejemplo.com"
                  className="search-input"
                  style={{ paddingLeft: '1.25rem', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255,255,255,0.15)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', fontWeight: 700 }}>
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
                  style={{ paddingLeft: '1.25rem', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255,255,255,0.15)' }}
                />
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="btn-primary" 
                style={{ 
                  marginTop: '0.5rem', 
                  borderRadius: '12px', 
                  fontSize: '1.05rem', 
                  padding: '0.95rem',
                  background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)',
                  boxShadow: '0 6px 20px rgba(229, 9, 20, 0.4)'
                }}
              >
                {loading ? 'Cargando...' : (isSignUp ? '✨ Registrarse Gratis' : '🚀 Entrar a PIRU TV')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
