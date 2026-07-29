import React, { useState, useEffect, useMemo } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { saveWatchProgress } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import vimeusAnimesData from '../data/animes.json';

const VIMEUS_API_KEY = 'ak_YxtAmgEstw2LMOLzzd8vBG8bXE2JOBXF';
const VIMEUS_VIEW_KEY = 'iarbNU-o7YfhpHWctm-mGokugr75cd7iwSrO7NKiVAs';
const VIMEUS_PARAMS = '&title=PiruTv&theme=red';

const CATEGORIES = ['🔥 Todos', '⭐ Top Populares', 'FULL HD'];

export default function Animes() {
  const [activeCategory, setActiveCategory] = useState('🔥 Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Selected Anime for modal
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  
  // Watch State
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [playerMode, setPlayerMode] = useState('embed'); // 'embed' or 'direct'

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
    setSelectedSeason(1);
    setSelectedEpisode(1);
    setPlayerMode('embed');
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

  // Vimeus Embed URL
  const activeEmbedUrl = useMemo(() => {
    if (!selectedAnime) return '';
    return `https://vimeus.com/e/anime?tmdb=${selectedAnime.tmdb_id}&view_key=${VIMEUS_VIEW_KEY}&se=${selectedSeason}&ep=${selectedEpisode}${VIMEUS_PARAMS}`;
  }, [selectedAnime, selectedSeason, selectedEpisode]);

  const openDirectPlayerWindow = () => {
    if (activeEmbedUrl) {
      window.open(activeEmbedUrl, '_blank', 'width=1080,height=650');
    }
  };

  useDpadNavigation({
    onBack: () => {
      if (selectedAnime) {
        setSelectedAnime(null);
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

      {/* Streaming Player & Season Selector Modal */}
      {selectedAnime && (
        <div className="modal-overlay" onClick={() => setSelectedAnime(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '920px' }}>
            <button className="modal-close-btn" onClick={() => setSelectedAnime(null)}>✕</button>

            {/* Video Player Frame Container */}
            <div className="movie-player-container" style={{ height: '460px', background: '#000', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.9)' }}>
              {playerMode === 'embed' ? (
                <iframe
                  src={activeEmbedUrl}
                  title={`${selectedAnime.title} - T${selectedSeason} E${selectedEpisode}`}
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', color: '#fff', background: 'linear-gradient(135deg, rgba(20,20,32,0.98), rgba(10,10,18,0.99))' }}>
                  <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🎬</div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-title)', fontSize: '1.25rem' }}>
                    Reproductor Directo Vimeus
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: '#cbd5e1', maxWidth: '440px', lineHeight: '1.5', marginBottom: '1.25rem' }}>
                    Abre el reproductor Vimeus en una ventana dedicada en alta definición o transmítelo a tu TV.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)', border: 'none', padding: '0.75rem 1.4rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800 }}
                      onClick={openDirectPlayerWindow}
                    >
                      ▶ Abrir en Ventana Directa
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none', padding: '0.75rem 1.4rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800 }}
                      onClick={() => castWithWebVideoCaster(activeEmbedUrl, `${selectedAnime.title} T${selectedSeason} E${selectedEpisode}`)}
                    >
                      📱 Transmitir a TV (Web Video Caster)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Body & Controls */}
            <div className="modal-body" style={{ padding: '1.25rem 0 0' }}>
              
              {/* Header Title & Mode Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h2 className="modal-title" style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>
                    {selectedAnime.title} - <span style={{ color: '#ef4444' }}>T{selectedSeason} : Ep. {selectedEpisode}</span>
                  </h2>
                  <span style={{ fontSize: '0.8rem', color: '#86efac', fontWeight: 700, marginTop: '0.3rem', display: 'block' }}>
                    Reproductor Oficial Vimeus HD
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{
                      padding: '0.6rem 1rem',
                      fontSize: '0.82rem',
                      background: playerMode === 'embed' ? 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)' : 'rgba(255,255,255,0.08)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '8px'
                    }}
                    onClick={() => setPlayerMode('embed')}
                  >
                    📺 Reproductor Integrado
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{
                      padding: '0.6rem 1rem',
                      fontSize: '0.82rem',
                      background: playerMode === 'direct' ? 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)' : 'rgba(255,255,255,0.08)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '8px'
                    }}
                    onClick={() => setPlayerMode('direct')}
                  >
                    🚀 Reproductor Directo
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{
                      padding: '0.6rem 1rem',
                      fontSize: '0.82rem',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '8px'
                    }}
                    onClick={() => castWithWebVideoCaster(activeEmbedUrl, `${selectedAnime.title} T${selectedSeason} E${selectedEpisode}`)}
                  >
                    📱 Transmitir a TV
                  </button>
                </div>
              </div>

              {/* Season Selector Tabs */}
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>
                  🌸 SELECCIONAR TEMPORADA ({availableSeasons.length}):
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.4rem', scrollbarWidth: 'none' }}>
                  {availableSeasons.map((seasonNum) => (
                    <button
                      key={seasonNum}
                      type="button"
                      onClick={() => {
                        setSelectedSeason(seasonNum);
                        setSelectedEpisode(1);
                      }}
                      style={{
                        background: selectedSeason === seasonNum ? 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)' : 'rgba(255,255,255,0.08)',
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
                      Temporada {seasonNum}
                    </button>
                  ))}
                </div>
              </div>

              {/* Episode Grid Buttons */}
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>
                  📋 EPISODIOS ({activeSeasonEpisodes.length}):
                </span>
                
                {isLoadingEpisodes ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Cargando episodios de Vimeus API...
                  </div>
                ) : (
                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.5rem', paddingRight: '0.2rem' }}>
                    {activeSeasonEpisodes.map((epItem, idx) => {
                      const epNum = Number(epItem.episode) || (idx + 1);
                      const isActive = selectedEpisode === epNum;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedEpisode(epNum)}
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
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
