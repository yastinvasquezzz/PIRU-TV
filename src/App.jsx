import React, { useState } from 'react';
import Peliculas from './components/Peliculas';
import TvLibre from './components/TvLibre';
import Kdramas from './components/Kdramas';

function App() {
  const [activeTab, setActiveTab] = useState('peliculas');

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
          >
            🎬 Pelis
          </button>
          <button 
            className={`nav-tab ${activeTab === 'tv-libre' ? 'active' : ''}`}
            onClick={() => setActiveTab('tv-libre')}
          >
            📺 TV Libre
          </button>
          <button 
            className={`nav-tab ${activeTab === 'kdramas' ? 'active' : ''}`}
            onClick={() => setActiveTab('kdramas')}
          >
            🌸 Kdramas
          </button>
        </nav>
      </header>

      <main className="app-content">
        {activeTab === 'peliculas' && <Peliculas />}
        {activeTab === 'tv-libre' && <TvLibre />}
        {activeTab === 'kdramas' && <Kdramas />}
      </main>

      <nav className="mobile-bottom-nav">
        <button 
          className={`mobile-nav-item ${activeTab === 'peliculas' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('peliculas');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
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
        >
          <span className="mobile-nav-icon">🌸</span>
          <span className="mobile-nav-label">Kdramas</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
