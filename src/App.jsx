import React, { useState, useEffect, lazy, Suspense } from 'react';
import useDpadNavigation from './hooks/useDpadNavigation';
import { SkeletonGrid } from './components/SkeletonLoader';
import AuthModal from './components/AuthModal';
import WelcomeConfirmedModal from './components/WelcomeConfirmedModal';
import { supabase } from './lib/supabase';

const Peliculas = lazy(() => import('./components/Peliculas'));
const TvLibre = lazy(() => import('./components/TvLibre'));
const Kdramas = lazy(() => import('./components/Kdramas'));
const MiLista = lazy(() => import('./components/MiLista'));

function App() {
  const [activeTab, setActiveTab] = useState('peliculas');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if coming from email confirmation link
    const hash = window.location.hash || '';
    if (hash.includes('access_token') || hash.includes('type=signup') || hash.includes('type=email_confirmation')) {
      setIsWelcomeOpen(true);
      window.history.replaceState(null, '', window.location.pathname);
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (event === 'USER_UPDATED' || (event === 'SIGNED_IN' && window.location.hash.includes('access_token'))) {
        setIsWelcomeOpen(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle Smart TV Remote Control (Back button / ESC key)
  useDpadNavigation({
    onBack: () => {
      if (isAuthOpen) {
        setIsAuthOpen(false);
      } else if (activeTab !== 'peliculas') {
        setActiveTab('peliculas');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  });

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">
            <span>PIRU</span>TV
          </div>
        </div>

        <nav className="app-nav">
          <button 
            className={`nav-tab ${activeTab === 'peliculas' ? 'active' : ''}`}
            onClick={() => setActiveTab('peliculas')}
            tabIndex={0}
          >
            🎬 Pelis
          </button>
          <button 
            className={`nav-tab ${activeTab === 'tv-libre' ? 'active' : ''}`}
            onClick={() => setActiveTab('tv-libre')}
            tabIndex={0}
          >
            📺 TV Libre
          </button>
          <button 
            className={`nav-tab ${activeTab === 'kdramas' ? 'active' : ''}`}
            onClick={() => setActiveTab('kdramas')}
            tabIndex={0}
          >
            🌸 Kdramas
          </button>
          <button 
            className={`nav-tab ${activeTab === 'mi-lista' ? 'active' : ''}`}
            onClick={() => setActiveTab('mi-lista')}
            tabIndex={0}
          >
            ❤️ Mi Lista
          </button>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setIsAuthOpen(true)}
            style={{
              background: user ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${user ? '#22c55e' : 'var(--glass-border)'}`,
              color: user ? '#86efac' : 'var(--text-primary)',
              fontFamily: 'var(--font-title)',
              fontSize: '0.88rem',
              fontWeight: 700,
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'var(--transition-fast)'
            }}
          >
            <span>{user ? '👤' : '🔐'}</span>
            <span>{user ? (user.email.split('@')[0]) : 'Mi Cuenta'}</span>
          </button>
        </div>
      </header>

      <main className="app-content">
        <Suspense fallback={
          <div style={{ padding: '2rem 1rem' }}>
            <SkeletonGrid count={12} />
          </div>
        }>
          {activeTab === 'peliculas' && <Peliculas />}
          {activeTab === 'tv-libre' && <TvLibre />}
          {activeTab === 'kdramas' && <Kdramas />}
          {activeTab === 'mi-lista' && <MiLista />}
        </Suspense>
      </main>

      <nav className="mobile-bottom-nav">
        <button 
          className={`mobile-nav-item ${activeTab === 'peliculas' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('peliculas');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          tabIndex={0}
        >
          <span className="mobile-nav-icon">🎬</span>
          <span className="mobile-nav-label">Pelis</span>
        </button>
        <button 
          className={`mobile-nav-item ${activeTab === 'tv-libre' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('tv-libre');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          tabIndex={0}
        >
          <span className="mobile-nav-icon">📺</span>
          <span className="mobile-nav-label">TV Libre</span>
        </button>
        <button 
          className={`mobile-nav-item ${activeTab === 'kdramas' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('kdramas');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          tabIndex={0}
        >
          <span className="mobile-nav-icon">🌸</span>
          <span className="mobile-nav-label">Kdramas</span>
        </button>
        <button 
          className={`mobile-nav-item ${activeTab === 'mi-lista' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('mi-lista');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          tabIndex={0}
        >
          <span className="mobile-nav-icon">❤️</span>
          <span className="mobile-nav-label">Mi Lista</span>
        </button>
      </nav>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthChange={(user) => setUser(user)}
      />

      <WelcomeConfirmedModal
        isOpen={isWelcomeOpen}
        onClose={() => setIsWelcomeOpen(false)}
      />
    </div>
  );
}

export default App;
