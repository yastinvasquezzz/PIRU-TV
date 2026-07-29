import React, { useState, useEffect, useMemo } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { saveWatchProgress } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import vimeusAnimesData from '../data/animes.json';

const VIMEUS_API_KEY = 'ak_YxtAmgEstw2LMOLzzd8vBG8bXE2JOBXF';
const VIMEUS_VIEW_KEY = 'iarbNU-o7YfhpHWctm-mGokugr75cd7iwSrO7NKiVAs';
const VIMEUS_PARAMS = `&title=PiruTv&theme=red`;

export default function Animes() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAnime, setSelectedAnime] = useState(null);
  
  // Episodes state fetched from Vimeus API for selected anime
  const [episodes, setEpisodes] = useState([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);

  // Filter animes by search term
  const filteredAnimes = useMemo(() => {
    if (!searchTerm.trim()) return vimeusAnimesData;
    return vimeusAnimesData.filter(a => 
      a.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  // Paginated items (24 per page)
  const itemsPerPage = 24;
  const totalPages = Math.ceil(filteredAnimes.length / itemsPerPage);

  const paginatedAnimes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAnimes.slice(start, start + itemsPerPage);
  }, [filteredAnimes, currentPage]);

  // Fetch episodes from Vimeus API when an anime is opened
  const handleOpenAnime = async (anime) => {
    setSelectedAnime(anime);
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
          const firstEp = epList[0];
          setSelectedSeason(Number(firstEp.season) || 1);
          setSelectedEpisode(Number(firstEp.episode) || 1);
        }
      }
    } catch (e) {
      console.error('Error fetching Vimeus episodes:', e);
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  // Group fetched episodes by Season
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

  // Current active season episodes
  const activeSeasonEpisodes = useMemo(() => {
    const currentList = seasonGroups[selectedSeason] || [];
    if (currentList.length > 0) return currentList;
    
    // Fallback array if API hasn't loaded individual episode details
    return Array.from({ length: 12 }, (_, i) => ({
      season: selectedSeason,
      episode: i + 1
    }));
  }, [seasonGroups, selectedSeason]);

  // Current Vimeus Player Embed URL
  const activeEmbedUrl = useMemo(() => {
    if (!selectedAnime) return '';
    return `https://vimeus.com/e/anime?tmdb=${selectedAnime.tmdb_id}&view_key=${VIMEUS_VIEW_KEY}&se=${selectedSeason}&ep=${selectedEpisode}${VIMEUS_PARAMS}`;
  }, [selectedAnime, selectedSeason, selectedEpisode]);

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
            🔥 Animes Vimeus Pro ({vimeusAnimesData.length} Series Full HD)
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
            Catálogo completo de animes integrados en directo con el reproductor Vimeus HD
          </p>
        </div>

        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar anime (ej. SPY x FAMILY, One Piece, Attack on Titan)..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Main Catalog Grid */}
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
                  Vimeus Anime • TMDB #{anime.tmdb_id}
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

      {/* Pagination Controls */}
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

      {/* Streaming Player & Season / Episode Modal */}
      {selectedAnime && (
        <div className="modal-overlay" onClick={() => setSelectedAnime(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '920px' }}>
            <button className="modal-close-btn" onClick={() => setSelectedAnime(null)}>✕</button>

            {/* Vimeus Official Video Player Container */}
            <div className="movie-player-container" style={{ height: '480px', background: '#000', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.9)' }}>
              <iframe
                src={activeEmbedUrl}
                title={`${selectedAnime.title} - Temp ${selectedSeason} Ep ${selectedEpisode}`}
                allowFullScreen
                allow="autoplay; encrypted-media"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>

            {/* Modal Body & Episode Controls */}
            <div className="modal-body" style={{ padding: '1.25rem 0 0' }}>
              
              {/* Header Title & Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h2 className="modal-title" style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>
                    {selectedAnime.title} - <span style={{ color: '#ef4444' }}>T{selectedSeason} : E{selectedEpisode}</span>
                  </h2>
                  <span style={{ fontSize: '0.8rem', color: '#86efac', fontWeight: 700, marginTop: '0.3rem', display: 'block' }}>
                    Reproductor Oficial Vimeus HD
                  </span>
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
                  onClick={() => castWithWebVideoCaster(activeEmbedUrl, `${selectedAnime.title} T${selectedSeason} E${selectedEpisode}`)}
                >
                  📱 Transmitir a TV (Web Video Caster)
                </button>
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
