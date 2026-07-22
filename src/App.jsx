import React, { useState, lazy, Suspense } from 'react';
import useDpadNavigation from './hooks/useDpadNavigation';
import { SkeletonGrid } from './components/SkeletonLoader';

const Peliculas = lazy(() => import('./components/Peliculas'));
const TvLibre = lazy(() => import('./components/TvLibre'));
const Kdramas = lazy(() => import('./components/Kdramas'));

function App() {
  const [activeTab, setActiveTab] = useState('peliculas');

  // Handle LG webOS TV Remote Control (Back button / ESC key)
  useDpadNavigation({
    onBack: () => {
      if (activeTab !== 'peliculas') {
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
        </nav>
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
      </nav>
    </div>
  );
}

export default App;
