import React, { useState, useEffect, lazy, Suspense } from 'react';
import useDpadNavigation from './hooks/useDpadNavigation';
import { SkeletonGrid } from './components/SkeletonLoader';
import WelcomeConfirmedModal from './components/WelcomeConfirmedModal';
import { supabase } from './lib/supabase';
import { getSelectedAvatar } from './utils/avatars';
import { isLgTv } from './utils/deviceDetect';

const Peliculas = lazy(() => import('./components/Peliculas'));
const TvLibre = lazy(() => import('./components/TvLibre'));
const Kdramas = lazy(() => import('./components/Kdramas'));
const Animes = lazy(() => import('./components/Animes'));
const MiLista = lazy(() => import('./components/MiLista'));
const MiCuenta = lazy(() => import('./components/MiCuenta'));

function App() {
  const [activeTab, setActiveTab] = useState('peliculas');
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [avatar, setAvatar] = useState(getSelectedAvatar());
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    // On LG Smart TV, keep header solid black and avoid continuous scroll listeners
    if (isLgTv()) {
      setIsScrolled(true);
      return;
    }
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 25);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Keep avatar synced reactively without continuous CPU polling
    const handleAvatarUpdate = () => {
      setAvatar(getSelectedAvatar());
    };
    window.addEventListener('piru_avatar_changed', handleAvatarUpdate);
    window.addEventListener('storage', handleAvatarUpdate);
    return () => {
      window.removeEventListener('piru_avatar_changed', handleAvatarUpdate);
      window.removeEventListener('storage', handleAvatarUpdate);
    };
  }, []);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Open item from Mi Lista or Mi Cuenta in its native player
  const handleOpenItem = (item) => {
    if (!item) return;

    let targetTab = item.section;
    if (!targetTab) {
      const t = (item.type || '').toLowerCase();
      if (t === 'kdrama' || t === 'dorama') targetTab = 'kdramas';
      else if (t === 'anime' || t === 'vimeus-anime') targetTab = 'animes';
      else if (t === 'iptv' || item.url || item.group) targetTab = 'tv-libre';
      else targetTab = 'peliculas';
    }

    setActiveTab(targetTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-piru-item', { detail: { item, tab: targetTab } }));
    }, 100);
  };

  // Handle Smart TV Remote Control (Back button / ESC key)
  useDpadNavigation({
    onBack: () => {
      if (activeTab !== 'peliculas') {
        setActiveTab('peliculas');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  });

  return (
    <div className="app-container netflix-theme">
      <header className={`netflix-header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="netflix-header-inner">
          <div className="netflix-header-left">
            <a 
              className="netflix-logo" 
              onClick={() => {
                setActiveTab('peliculas');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{ cursor: 'pointer' }}
            >
              <span className="logo-red">PIRU</span>
              <span className="logo-white">TV</span>
            </a>

            <nav className="netflix-nav">
              <button 
                className={`netflix-nav-link ${activeTab === 'peliculas' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('peliculas');
                  window.dispatchEvent(new CustomEvent('reset-piru-home'));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Inicio
              </button>
              <button 
                className={`netflix-nav-link ${activeTab === 'kdramas' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('kdramas');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Kdramas
              </button>
              <button 
                className={`netflix-nav-link ${activeTab === 'tv-libre' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('tv-libre');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                TV Libre
              </button>
              <button 
                className={`netflix-nav-link ${activeTab === 'animes' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('animes');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Animes
              </button>
              <button 
                className={`netflix-nav-link ${activeTab === 'mi-lista' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('mi-lista');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                Mi lista
              </button>
            </nav>
          </div>

          <div className="netflix-header-right">
            <button 
              className="netflix-icon-btn" 
              title="Buscar"
              onClick={() => {
                let targetTab = activeTab;
                if (targetTab === 'mi-lista' || targetTab === 'mi-cuenta') {
                  targetTab = 'peliculas';
                  setActiveTab('peliculas');
                }
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('focus-section-search', { detail: targetTab }));
                }, 50);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <span className="material-symbols-outlined">search</span>
            </button>

            <button 
              className="netflix-kids-link"
              onClick={() => {
                setActiveTab('peliculas');
                window.dispatchEvent(new CustomEvent('open-piru-category', { detail: 'Animación' }));
              }}
            >
              Niños
            </button>

            <button className="netflix-icon-btn" title="Notificaciones">
              <span className="material-symbols-outlined">notifications</span>
              <span className="netflix-notif-dot"></span>
            </button>

            <div 
              className="netflix-profile-btn" 
              onClick={() => {
                setActiveTab('mi-cuenta');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              title={user ? user.email : 'Mi Cuenta'}
            >
              <div className="netflix-avatar-box">
                {user ? avatar.emoji : <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>face</span>}
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#a3a3a3' }}>arrow_drop_down</span>
            </div>
          </div>
        </div>
      </header>

      <main className={`app-content ${activeTab === 'peliculas' || activeTab === 'kdramas' || activeTab === 'animes' ? 'netflix-full-bleed' : ''}`}>
        <Suspense fallback={
          <div style={{ padding: '2rem 1rem' }}>
            <SkeletonGrid count={12} />
          </div>
        }>
          {activeTab === 'peliculas' && <Peliculas />}
          {activeTab === 'tv-libre' && <TvLibre />}
          {activeTab === 'kdramas' && <Kdramas />}
          {activeTab === 'animes' && <Animes />}
          {activeTab === 'mi-lista' && <MiLista onOpenItem={handleOpenItem} />}
          {activeTab === 'mi-cuenta' && <MiCuenta onOpenItem={handleOpenItem} />}
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
          <span className="mobile-nav-icon">🏠</span>
          <span className="mobile-nav-label">Inicio</span>
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
          className={`mobile-nav-item ${activeTab === 'animes' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('animes');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          tabIndex={0}
        >
          <span className="mobile-nav-icon">🔥</span>
          <span className="mobile-nav-label">Animes</span>
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

      <WelcomeConfirmedModal
        isOpen={isWelcomeOpen}
        onClose={() => setIsWelcomeOpen(false)}
      />
    </div>
  );
}

export default App;
