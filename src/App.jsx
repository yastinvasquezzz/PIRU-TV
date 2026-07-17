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
    </div>
  );
}

export default App;
