import React, { useState, useMemo, useEffect } from 'react';
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
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [selectedAudio, setSelectedAudio] = useState('sub'); // 'sub' or 'latino'
  const [selectedServer, setSelectedServer] = useState(1); // 1, 2, 3
  const [episodeBatch, setEpisodeBatch] = useState(0); // 0 = 1-100, 1 = 101-200, etc.

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
    setCurrentEpisode(1);
    setSelectedAudio(anime.hasLatino ? 'latino' : 'sub');
    setSelectedServer(1);
    setEpisodeBatch(0);

    saveWatchProgress({
      id: anime.id,
      titulo: anime.title,
      portada: anime.poster,
      type: 'anime'
    });
  };

  // Generate episode numbers array based on totalEpisodes
  const episodesList = useMemo(() => {
    if (!selectedAnime) return [];
    const count = selectedAnime.totalEpisodes || 12;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [selectedAnime]);

  // Batched episode chunks (100 episodes per tab)
  const episodeBatches = useMemo(() => {
    if (episodesList.length <= 100) return [episodesList];
    const batches = [];
    for (let i = 0; i < episodesList.length; i += 100) {
      batches.push(episodesList.slice(i, i + 100));
    }
    return batches;
  }, [episodesList]);

  // Current TokiAnime Embed URL
  const activeEmbedUrl = useMemo(() => {
    if (!selectedAnime) return '';
    // TokiAnime watch URL
    return `https://tokianime.tv/watch/${selectedAnime.slug}/${currentEpisode}?server=${selectedServer}&audio=${selectedAudio}`;
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
          <h1 className="section-title" style={{ margin: 0 }}>
            🔥 Animes TokiAnime (HD & Audio Latino)
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
            Catálogo completo de anime en emisión, subtitulado y doblaje latino oficial
          </p>
        </div>

        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar anime (ej. One Piece, Demon Slayer, Jujutsu)..."
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

      {/* Main Grid */}
      <div className="media-grid">
        {filteredAnimes.length > 0 ? (
          filteredAnimes.map(anime => (
            <button
              type="button"
              key={anime.id}
              className="media-card"
              onClick={() => handleOpenAnime(anime)}
              style={{ textAlign: 'left', cursor: 'pointer' }}
            >
              <div className="card-poster" style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden' }}>
                <img
                  src={anime.poster}
                  alt={anime.title}
                  loading="lazy"
                  style={{ width: '100%', height: '280px', objectFit: 'cover' }}
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/200x280?text=Anime'; }}
                />
                
                {/* Audio Badges Overlay */}
                <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {anime.hasLatino && (
                    <span style={{ background: 'rgba(34, 197, 94, 0.9)', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', backdropFilter: 'blur(4px)' }}>
                      🇲🇽 LATINO
                    </span>
                  )}
                  {anime.hasSub && (
                    <span style={{ background: 'rgba(229, 9, 20, 0.9)', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', backdropFilter: 'blur(4px)' }}>
                      💬 SUB
                    </span>
                  )}
                </div>

                <div className="card-rating" style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.75)', padding: '2px 8px', borderRadius: '8px', fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>
                  ⭐ {anime.rating}
                </div>
              </div>

              <div className="card-info" style={{ padding: '0.75rem 0.25rem 0' }}>
                <span className="card-genre" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {anime.totalEpisodes} Episodios • TokiAnime
                </span>
                <h3 className="card-title" style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0.2rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

      {/* Streaming Player & Episode Selector Modal */}
      {selectedAnime && (
        <div className="modal-overlay" onClick={() => setSelectedAnime(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '920px' }}>
            <button className="modal-close-btn" onClick={() => setSelectedAnime(null)}>✕</button>

            {/* Video Player Frame */}
            <div className="movie-player-container" style={{ height: '480px', background: '#000', borderRadius: '16px', overflow: 'hidden' }}>
              <iframe
                src={activeEmbedUrl}
                title={`${selectedAnime.title} - Episodio ${currentEpisode}`}
                allowFullScreen
                allow="autoplay; encrypted-media"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>

            {/* Modal Body & Episode Controls */}
            <div className="modal-body" style={{ padding: '1.25rem 0 0' }}>
              
              {/* Header Title & Meta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h2 className="modal-title" style={{ margin: 0, fontSize: '1.3rem' }}>
                    {selectedAnime.title} - <span style={{ color: '#ef4444' }}>Capítulo {currentEpisode}</span>
                  </h2>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                    {selectedAnime.genres.map(g => (
                      <span key={g} style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
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

              {/* Audio Selector & Server Switcher */}
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

              {/* Episode Batch Tabs (for series with >100 episodes) */}
              {episodeBatches.length > 1 && (
                <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', marginBottom: '0.85rem', scrollbarWidth: 'none' }}>
                  {episodeBatches.map((batch, idx) => {
                    const start = idx * 100 + 1;
                    const end = Math.min((idx + 1) * 100, selectedAnime.totalEpisodes);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEpisodeBatch(idx)}
                        style={{
                          background: episodeBatch === idx ? '#e50914' : 'rgba(255,255,255,0.08)',
                          border: 'none',
                          color: '#fff',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {start}-{end}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Episode Grid Buttons */}
              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.5rem', paddingRight: '0.2rem' }}>
                {(episodeBatches[episodeBatch] || episodeBatches[0] || []).map(epNum => {
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
      )}
    </div>
  );
}
