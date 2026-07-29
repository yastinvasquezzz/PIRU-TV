import React, { useState, useEffect, useMemo } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { saveWatchProgress, toggleFavorite, isFavorite } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import vimeusAnimesData from '../data/animes.json';

const VIMEUS_API_KEY = 'ak_YxtAmgEstw2LMOLzzd8vBG8bXE2JOBXF';
const VIMEUS_VIEW_KEY = 'iarbNU-o7YfhpHWctm-mGokugr75cd7iwSrO7NKiVAs';
const VIMEUS_PARAMS = '&title=PIRU_TV&theme=red&font=v3&overlay=v5&selector=v3&playUI=v3&epanel=v3';

const CATEGORIES = ['🔥 Todos', '⭐ Top Populares', 'FULL HD'];

export default function Animes() {
  const [activeCategory, setActiveCategory] = useState('🔥 Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Selected Anime for Modal
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedServer, setSelectedServer] = useState('vimeus'); // 'vimeus', 'vidsrc', '2embed'
  
  // Episode & Season state
  const [episodes, setEpisodes] = useState([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);

  // Hero anime index
  const [heroIndex, setHeroIndex] = useState(0);
  const heroList = useMemo(() => vimeusAnimesData.slice(0, 5), []);
  const activeHero = heroList[heroIndex] || heroList[0];

  // Auto rotate hero banner
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroList.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [heroList]);

  // Filter animes
  const filteredAnimes = useMemo(() => {
    return vimeusAnimesData.filter(item => {
      let matchCat = true;
      if (activeCategory === '⭐ Top Populares') {
        matchCat = vimeusAnimesData.indexOf(item) < 25;
      } else if (activeCategory === 'FULL HD') {
        matchCat = item.quality === 'FULL HD';
      }

      const matchSearch = !searchTerm.trim() ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase());

      return matchCat && matchSearch;
    });
  }, [activeCategory, searchTerm]);

  // Paging (24 items per page)
  const itemsPerPage = 24;
  const totalPages = Math.ceil(filteredAnimes.length / itemsPerPage);

  const paginatedAnimes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAnimes.slice(start, start + itemsPerPage);
  }, [filteredAnimes, currentPage]);

  // Handle open anime modal
  const handleOpenAnime = async (anime) => {
    setSelectedAnime(anime);
    setIsPlaying(false);
    setSelectedServer('vimeus');
    setSelectedSeason(1);
    setSelectedEpisode(1);
    setIsLoadingEpisodes(true);
    setEpisodes([]);

    saveWatchProgress({
      id: anime.id,
      titulo: anime.title,
      portada: anime.poster,
      type: 'anime'
    });

    try {
      const res = await fetch(`https://vimeus.com/api/listing/episodes?tmdb_id=${anime.tmdb_id}`, {
        headers: { 'X-API-Key': VIMEUS_API_KEY }
      });
      if (res.ok) {
        const json = await res.json();
        const epList = json.data?.result || json.data?.episodes || [];
        setEpisodes(epList);

        if (epList.length > 0) {
          const first = epList[0];
          setSelectedSeason(Number(first.season) || 1);
          setSelectedEpisode(Number(first.episode) || 1);
        }
      }
    } catch (e) {
      console.error('Error fetching Vimeus episodes:', e);
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  // Group fetched episodes by season number
  const seasonGroups = useMemo(() => {
    const groups = {};
    episodes.forEach(ep => {
      const s = Number(ep.season) || 1;
      if (!groups[s]) groups[s] = [];
      groups[s].push(ep);
    });
    return groups;
  }, [episodes]);

  const availableSeasons = useMemo(() => {
    const keys = Object.keys(seasonGroups).map(Number).sort((a, b) => a - b);
    return keys.length > 0 ? keys : [1];
  }, [seasonGroups]);

  // Current active season episodes list
  const activeSeasonEpisodes = useMemo(() => {
    const currentList = seasonGroups[selectedSeason] || [];
    if (currentList.length > 0) return currentList;

    // Fallback list if episodes API response is empty
    return Array.from({ length: 12 }, (_, i) => ({
      season: selectedSeason,
      episode: i + 1
    }));
  }, [seasonGroups, selectedSeason]);

  // Construct Embed URL matching Peliculas.jsx exact pattern!
  const embedUrl = useMemo(() => {
    if (!selectedAnime) return '';
    const id = selectedAnime.tmdb_id;

    if (selectedServer === 'vimeus') {
      return `https://vimeus.com/e/anime?tmdb=${id}&se=${selectedSeason}&ep=${selectedEpisode}&view_key=${encodeURIComponent(VIMEUS_VIEW_KEY)}${VIMEUS_PARAMS}`;
    }

    if (selectedServer === 'vidsrc') {
      return `https://vidsrc-embed.ru/embed/tv/${id}/${selectedSeason}-${selectedEpisode}?ds_lang=es`;
    }

    if (selectedServer === '2embed') {
      return `https://www.2embed.cc/embedtv/${id}&s=${selectedSeason}&e=${selectedEpisode}&lang=es`;
    }

    return '';
  }, [selectedAnime, selectedServer, selectedSeason, selectedEpisode]);

  useDpadNavigation({
    onBack: () => {
      if (selectedAnime) {
        setSelectedAnime(null);
        setIsPlaying(false);
      }
    }
  });

  return (
    <div className="animes-container" style={{ padding: '0.5rem 0 3rem' }}>
      
      {/* Header section with search */}
      <div className="category-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="section-title" style={{ margin: 0, fontSize: '1.6rem' }}>
            🔥 Animes Vimeus HD ({vimeusAnimesData.length} Series)
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
            Catálogo completo de animes con temporadas y reproductor HD integrado
          </p>
        </div>

        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar anime (ej. SPY x FAMILY, Attack on Titan, One Piece)..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Featured Hero Banner */}
      {!searchTerm.trim() && activeHero && (
        <div 
          className="hero-banner"
          style={{
            position: 'relative',
            height: '360px',
            borderRadius: '20px',
            overflow: 'hidden',
            marginBottom: '2rem',
            backgroundImage: `url(${activeHero.backdrop || activeHero.poster})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
            border: '1px solid var(--border-color)'
          }}
        >
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, rgba(10,10,18,0.95) 0%, rgba(10,10,18,0.6) 50%, rgba(10,10,18,0.1) 100%)',
            display: 'flex',
            alignItems: 'center',
            padding: '2.5rem'
          }}>
            <div style={{ maxWidth: '580px' }}>
              <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.6rem' }}>
                <span style={{ background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '3px 9px', borderRadius: '6px' }}>
                  🔥 DESTACADO VIMEUS
                </span>
                <span style={{ background: 'rgba(255,255,255,0.15)', color: '#86efac', fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: '6px' }}>
                  {activeHero.quality}
                </span>
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', margin: '0 0 0.6rem 0', lineHeight: 1.1 }}>
                {activeHero.title}
              </h2>
              <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.5', margin: '0 0 1.25rem 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                Disfruta de {activeHero.title} completo en alta definición Full HD directamente en el reproductor Vimeus.
              </p>
              <button
                type="button"
                className="btn-primary"
                style={{
                  padding: '0.75rem 1.6rem',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(229, 9, 20, 0.5)'
                }}
                onClick={() => handleOpenAnime(activeHero)}
              >
                ▶ Ver {activeHero.title}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Badges Filter */}
      <div className="filters-wrapper" style={{ margin: '0 0 1.5rem 0', display: 'flex', gap: '0.5rem' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            className={`filter-badge ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => {
              setActiveCategory(cat);
              setCurrentPage(1);
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Grid Cards */}
      <div className="media-grid">
        {paginatedAnimes.length > 0 ? (
          paginatedAnimes.map(anime => (
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
                
                <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                  {anime.quality || 'FULL HD'}
                </div>
              </div>

              <div className="card-info" style={{ padding: '0.75rem 0.25rem 0.25rem' }}>
                <span className="card-genre" style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 700 }}>
                  TMDB #{anime.tmdb_id}
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
            <p>Intenta buscando con otro término de búsqueda.</p>
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
          <button
            type="button"
            className="filter-badge"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
          >
            ◀ Anterior
          </button>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
            Página {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            className="filter-badge"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
          >
            Siguiente ▶
          </button>
        </div>
      )}

      {/* Detail & Video Streaming Player Modal (Exact Peliculas.jsx Structure) */}
      {selectedAnime && (
        <div className="modal-overlay" onClick={() => { setSelectedAnime(null); setIsPlaying(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => { setSelectedAnime(null); setIsPlaying(false); }}>✕</button>

            {/* Movie Player Container */}
            <div className="movie-player-container">
              {isPlaying ? (
                <iframe
                  src={embedUrl}
                  title={`${selectedAnime.title} - T${selectedSeason} E${selectedEpisode}`}
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                />
              ) : (
                <button
                  type="button"
                  style={{
                    background: `linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.4)), url(${selectedAnime.backdrop || selectedAnime.poster})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    gap: '1rem',
                    cursor: 'pointer',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    font: 'inherit'
                  }}
                  onClick={() => setIsPlaying(true)}
                >
                  <div className="play-icon" style={{ transform: 'scale(1.4)', background: '#fff', color: '#000' }}>▶</div>
                  <strong style={{ color: '#fff', fontSize: '1.25rem', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
                    Haga clic para reproducir
                  </strong>
                </button>
              )}
            </div>

            {/* Server Selector Bar when Playing */}
            {isPlaying && (
              <div className="player-header">
                <div className="player-title-info">
                  <span className="pulse-dot"></span>
                  <span>
                    Reproduciendo: {selectedAnime.title} - Temp. {selectedSeason}, Ep. {selectedEpisode}
                  </span>
                </div>
                <div className="server-selector">
                  <button 
                    className={`server-btn ${selectedServer === 'vimeus' ? 'active' : ''}`}
                    onClick={() => setSelectedServer('vimeus')}
                  >
                    Vimeus HD
                  </button>
                  <button 
                    className={`server-btn ${selectedServer === 'vidsrc' ? 'active' : ''}`}
                    onClick={() => setSelectedServer('vidsrc')}
                  >
                    VidSrc
                  </button>
                  <button 
                    className={`server-btn ${selectedServer === '2embed' ? 'active' : ''}`}
                    onClick={() => setSelectedServer('2embed')}
                  >
                    2Embed
                  </button>
                </div>
              </div>
            )}

            {/* Season and Episode Selector Grid */}
            <div className="episodes-section">
              <div className="episodes-header">
                <span className="episodes-title">Seleccionar Episodio</span>
                <select 
                  className="season-select"
                  value={selectedSeason}
                  onChange={(e) => {
                    setSelectedSeason(Number(e.target.value));
                    setSelectedEpisode(1);
                  }}
                >
                  {availableSeasons.map(sNum => (
                    <option key={sNum} value={sNum}>
                      Temporada {sNum}
                    </option>
                  ))}
                </select>
              </div>

              {isLoadingEpisodes ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Cargando episodios de Vimeus API...
                </div>
              ) : (
                <div className="episodes-grid">
                  {activeSeasonEpisodes.map((epItem, idx) => {
                    const epNum = Number(epItem.episode) || (idx + 1);
                    const isActive = selectedEpisode === epNum;
                    return (
                      <button
                        key={idx}
                        className={`episode-btn ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedEpisode(epNum);
                          setIsPlaying(true);
                        }}
                      >
                        {epNum}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Body & Action Buttons */}
            <div className="modal-body">
              <div className="modal-meta">
                <span className="modal-genre">🔥 Anime Vimeus HD</span>
                <span className="modal-lang">{selectedAnime.quality || 'FULL HD'}</span>
                <span className="modal-lang">TMDB #{selectedAnime.tmdb_id}</span>
              </div>
              <h2 className="modal-title">{selectedAnime.title}</h2>
              <p className="modal-summary">
                Disfruta de {selectedAnime.title} en alta definición Full HD directamente en PIRU TV con servidores Vimeus, VidSrc y 2Embed.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', margin: '1.25rem 0' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    flex: 'none',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem',
                    background: isFavorite(selectedAnime.id) ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    border: `1px solid ${isFavorite(selectedAnime.id) ? '#ef4444' : 'rgba(255, 255, 255, 0.2)'}`,
                    color: isFavorite(selectedAnime.id) ? '#fca5a5' : '#fff',
                    boxShadow: isFavorite(selectedAnime.id) ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none'
                  }}
                  onClick={async () => {
                    await toggleFavorite(selectedAnime);
                    setSelectedAnime({ ...selectedAnime });
                  }}
                >
                  {isFavorite(selectedAnime.id) ? '❤️ En Mi Lista' : '🤍 Agregar a Mi Lista'}
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    flex: 'none',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    color: '#ffffff',
                    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.45)'
                  }}
                  onClick={() => {
                    castWithWebVideoCaster(embedUrl, selectedAnime.title);
                  }}
                >
                  📱 Transmitir a TV (Web Video Caster)
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
