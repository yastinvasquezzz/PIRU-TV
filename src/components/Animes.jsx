import React, { useState, useMemo } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { saveWatchProgress } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import animeDataset from '../data/animes.json';

const ANIME_CATEGORIES = [
  '🔥 Todos',
  '🇲🇽 Audio Latino',
  '💬 Subtitulado',
  '⚔️ Acción',
  '🔮 Fantasía',
  '🏫 Escolar',
  '🤖 Sci-Fi',
  '⚽ Deportes'
];

export default function Animes() {
  const [activeCategory, setActiveCategory] = useState('🔥 Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnime, setSelectedAnime] = useState(null);
  
  // Watch State inside modal
  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [selectedAudio, setSelectedAudio] = useState('sub'); // 'sub' or 'latino'
  const [selectedServer, setSelectedServer] = useState(1); // 1, 2, 3

  // Filter animes by category and search
  const filteredAnimes = useMemo(() => {
    return animeDataset.filter(item => {
      let matchCategory = true;
      if (activeCategory === '🇲🇽 Audio Latino') matchCategory = item.hasLatino;
      else if (activeCategory === '💬 Subtitulado') matchCategory = item.hasSub;
      else if (activeCategory === '⚔️ Acción') matchCategory = item.genres.includes('Acción');
      else if (activeCategory === '🔮 Fantasía') matchCategory = item.genres.includes('Fantasía') || item.genres.includes('Sobrenatural');
      else if (activeCategory === '🏫 Escolar') matchCategory = item.genres.includes('Escolar') || item.genres.includes('Comedia');
      else if (activeCategory === '🤖 Sci-Fi') matchCategory = item.genres.includes('Sci-Fi') || item.genres.includes('Cyberpunk');
      else if (activeCategory === '⚽ Deportes') matchCategory = item.genres.includes('Deportes');

      const matchSearch = !searchTerm.trim() ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.genres.some(g => g.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchCategory && matchSearch;
    });
  }, [activeCategory, searchTerm]);

  // Open anime detail modal
  const handleOpenAnime = (anime) => {
    setSelectedAnime(anime);
    setSelectedSeasonIdx(0);
    setCurrentEpisode(1);
    setSelectedAudio(anime.hasLatino ? 'latino' : 'sub');
    setSelectedServer(1);

    saveWatchProgress({
      id: anime.id,
      titulo: anime.title,
      portada: anime.poster,
      type: 'anime'
    });
  };

  // Current active season object
  const activeSeason = useMemo(() => {
    if (!selectedAnime || !selectedAnime.seasons || selectedAnime.seasons.length === 0) {
      return { seasonNumber: 1, title: 'Temporada 1', episodeCount: 12 };
    }
    return selectedAnime.seasons[selectedSeasonIdx] || selectedAnime.seasons[0];
  }, [selectedAnime, selectedSeasonIdx]);

  // List of episodes for current active season
  const currentSeasonEpisodes = useMemo(() => {
    const count = activeSeason.episodeCount || 12;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [activeSeason]);

  // Current Player Embed URL with proxy bypass
  const activeEmbedUrl = useMemo(() => {
    if (!selectedAnime) return '';
    const rawUrl = `https://tokianime.tv/watch/${selectedAnime.slug}/${currentEpisode}?server=${selectedServer}&audio=${selectedAudio}`;
    const cfProxy = 'https://pirutv-proxy.skillful-part.workers.dev';
    return `${cfProxy}?url=${encodeURIComponent(rawUrl)}`;
  }, [selectedAnime, currentEpisode, selectedServer, selectedAudio]);

  useDpadNavigation({
    onBack: () => {
      if (selectedAnime) {
        setSelectedAnime(null);
      }
    }
  });

  return (
    <div className="animes-container" style={{ padding: '0.5rem 0 3rem' }}>
      
      {/* Header section */}
      <div className="category-header">
        <div>
          <h1 className="section-title" style={{ margin: 0, fontSize: '1.6rem' }}>
            🔥 Animes TokiAnime ({animeDataset.length} Series Destacadas)
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
            Series completas organizadas por temporadas, audio latino oficial y subtítulos
          </p>
        </div>

        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar anime (ej. Solo Leveling, One Piece, Demon Slayer)..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Category Badges Filter */}
      <div className="filters-wrapper" style={{ margin: '0 0 2rem 0', display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
        {ANIME_CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            className={`filter-badge ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Grid with Unique Posters */}
      <div className="media-grid">
        {filteredAnimes.length > 0 ? (
          filteredAnimes.map(anime => (
            <button
              type="button"
              key={anime.id}
              className="media-card"
              onClick={() => handleOpenAnime(anime)}
              style={{ textAlign: 'left', cursor: 'pointer', background: 'rgba(20, 20, 32, 0.5)', borderRadius: '18px', border: '1px solid var(--border-color)', padding: '0.6rem', transition: 'var(--transition-smooth)' }}
            >
              <div className="card-poster" style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', height: '270px' }}>
                <img
                  src={anime.poster}
                  alt={anime.title}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/200x280?text=Anime'; }}
                />
                
                {/* Audio Badges Overlay */}
                <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {anime.hasLatino && (
                    <span style={{ background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                      🇲🇽 LATINO
                    </span>
                  )}
                  {anime.hasSub && (
                    <span style={{ background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                      💬 SUB
                    </span>
                  )}
                </div>

                <div className="card-rating" style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.85)', padding: '3px 8px', borderRadius: '8px', fontSize: '0.78rem', color: '#f59e0b', fontWeight: 800 }}>
                  ⭐ {anime.rating}
                </div>
              </div>

              <div className="card-info" style={{ padding: '0.75rem 0.25rem 0.25rem' }}>
                <span className="card-genre" style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 700 }}>
                  {anime.seasons ? `${anime.seasons.length} ${anime.seasons.length === 1 ? 'Temporada' : 'Temporadas'}` : 'Serie TV'}
                </span>
                <h3 className="card-title" style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0.2rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>
                  {anime.title}
                </h3>
              </div>
            </button>
          ))
        ) : (
          <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '4rem 2rem', textAlign: 'center' }}>
            <span className="empty-icon">🔥</span>
            <h3 className="empty-title">No se encontraron animes</h3>
            <p>Intenta buscando con otro término o seleccionando la categoría "Todos".</p>
          </div>
        )}
      </div>

      {/* Streaming Player & Season Selector Modal */}
      {selectedAnime && (
        <div className="modal-overlay" onClick={() => setSelectedAnime(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '920px' }}>
            <button className="modal-close-btn" onClick={() => setSelectedAnime(null)}>✕</button>

            {/* Video Player Frame */}
            <div className="movie-player-container" style={{ height: '480px', background: '#000', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.9)' }}>
              <iframe
                src={activeEmbedUrl}
                title={`${selectedAnime.title} - ${activeSeason.title} Ep ${currentEpisode}`}
                allowFullScreen
                allow="autoplay; encrypted-media"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>

            {/* Modal Body & Season / Episode Controls */}
            <div className="modal-body" style={{ padding: '1.25rem 0 0' }}>
              
              {/* Header Title & Meta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h2 className="modal-title" style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>
                    {selectedAnime.title} - <span style={{ color: '#ef4444' }}>Capítulo {currentEpisode}</span>
                  </h2>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                    {selectedAnime.genres.map(g => (
                      <span key={g} style={{ background: 'rgba(255,255,255,0.08)', padding: '3px 9px', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {g}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    padding: '0.65rem 1.25rem',
                    fontSize: '0.88rem',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    color: '#ffffff',
                    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.45)',
                    borderRadius: '10px'
                  }}
                  onClick={() => castWithWebVideoCaster(activeEmbedUrl, `${selectedAnime.title} Ep ${currentEpisode}`)}
                >
                  📱 Transmitir a TV (Web Video Caster)
                </button>
              </div>

              {/* Audio Selector & Server Switcher Bar */}
              <div style={{ background: 'rgba(20,20,32,0.8)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                
                {/* Audio Type Auto-Detector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>AUDIO:</span>
                  {selectedAnime.hasLatino && (
                    <button
                      type="button"
                      onClick={() => setSelectedAudio('latino')}
                      style={{
                        background: selectedAudio === 'latino' ? 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)' : 'rgba(255,255,255,0.08)',
                        border: 'none',
                        color: '#fff',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      🇲🇽 Latino
                    </button>
                  )}
                  {selectedAnime.hasSub && (
                    <button
                      type="button"
                      onClick={() => setSelectedAudio('sub')}
                      style={{
                        background: selectedAudio === 'sub' ? 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)' : 'rgba(255,255,255,0.08)',
                        border: 'none',
                        color: '#fff',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      💬 Subtitulado
                    </button>
                  )}
                </div>

                {/* Video Server Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>SERVIDOR:</span>
                  {[1, 2, 3].map(srv => (
                    <button
                      key={srv}
                      type="button"
                      onClick={() => setSelectedServer(srv)}
                      style={{
                        background: selectedServer === srv ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${selectedServer === srv ? '#fff' : 'transparent'}`,
                        color: '#fff',
                        padding: '0.35rem 0.7rem',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Servidor {srv} {srv === 1 ? '(Sin Anuncios)' : ''}
                    </button>
                  ))}
                </div>

              </div>

              {/* Season Selector Tabs */}
              {selectedAnime.seasons && selectedAnime.seasons.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>
                    🌸 SELECCIONAR TEMPORADA ({selectedAnime.seasons.length}):
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.4rem', scrollbarWidth: 'none' }}>
                    {selectedAnime.seasons.map((season, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => {
                          setSelectedSeasonIdx(sIdx);
                          setCurrentEpisode(1);
                        }}
                        style={{
                          background: selectedSeasonIdx === sIdx ? 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)' : 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#fff',
                          padding: '0.45rem 0.9rem',
                          borderRadius: '10px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer'
                        }}
                      >
                        {season.title} ({season.episodeCount} eps)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Episode Grid Buttons */}
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>
                  📋 EPISODIOS ({currentSeasonEpisodes.length}):
                </span>
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.5rem', paddingRight: '0.2rem' }}>
                  {currentSeasonEpisodes.map(epNum => {
                    const isActive = currentEpisode === epNum;
                    return (
                      <button
                        key={epNum}
                        type="button"
                        onClick={() => setCurrentEpisode(epNum)}
                        style={{
                          padding: '0.5rem 0.25rem',
                          background: isActive ? 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${isActive ? '#e50914' : 'transparent'}`,
                          color: '#fff',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: isActive ? 800 : 500,
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                      >
                        Episodio {epNum}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
