import React, { useState, useEffect, useMemo } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { SkeletonGrid } from './SkeletonLoader';
import { saveWatchProgress, toggleFavorite, isFavorite } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';

const TMDB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiMGM4MjRjMmFkMzllODUwNmE5ZGUzOGI5ZTA2ZjJmZiIsIm5iZiI6MTc0ODI3MjY1Ni43MDMsInN1YiI6IjY4MzQ4NjEwNjFmMWZlZmI4YmViMzYxZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KUIiE74vCOP05_Y0M5CKyCBtj9m5lN1WzCfZ6bQn6Xs';
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const BACK = 'https://image.tmdb.org/t/p/original';
const HDR = { Authorization: `Bearer ${TMDB_KEY}` };

const ANIME_CATEGORIES = [
  { id: 'populares', name: '🔥 Populares', endpoint: '/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc' },
  { id: 'emision', name: '⚡ En Emisión', endpoint: '/discover/tv?with_genres=16&with_original_language=ja&air_date.gte=2024-01-01&sort_by=popularity.desc' },
  { id: 'shonen', name: '⚔️ Shonen / Acción', endpoint: '/discover/tv?with_genres=16,10759&with_original_language=ja&sort_by=popularity.desc' },
  { id: 'isekai', name: '🚀 Isekai / Fantasía', endpoint: '/discover/tv?with_genres=16,10765&with_original_language=ja&sort_by=popularity.desc' },
  { id: 'peliculas', name: '🎬 Películas Anime', endpoint: '/discover/movie?with_genres=16&with_original_language=ja&sort_by=popularity.desc', isMovie: true },
  { id: 'romance', name: '❤️ Romance', endpoint: '/discover/tv?with_genres=16,10749&with_original_language=ja&sort_by=popularity.desc' }
];

export default function Animes() {
  const [activeCategory, setActiveCategory] = useState('populares');
  const [animes, setAnimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedAnime, setSelectedAnime] = useState(null);
  const [selectedEp, setSelectedEp] = useState(1);
  const [activeServer, setActiveServer] = useState(1);
  const [animeDetails, setAnimeDetails] = useState(null);
  const [favUpdated, setFavUpdated] = useState(0);

  const currentCatObj = useMemo(() => {
    return ANIME_CATEGORIES.find(c => c.id === activeCategory) || ANIME_CATEGORIES[0];
  }, [activeCategory]);

  // Load Anime Catalog from TMDB
  useEffect(() => {
    const fetchAnimes = async () => {
      setLoading(true);
      try {
        const cacheKey = `anime_cache_${activeCategory}_${page}_${searchTerm}`;
        const cached = sessionStorage.getItem(cacheKey);

        if (cached && !searchTerm) {
          const parsed = JSON.parse(cached);
          setAnimes(parsed.results);
          setTotalPages(parsed.totalPages);
          setLoading(false);
          return;
        }

        let url = `${TMDB}${currentCatObj.endpoint}&page=${page}&language=es-MX`;
        if (searchTerm.trim()) {
          const isMov = currentCatObj.isMovie ? 'movie' : 'tv';
          url = `${TMDB}/search/${isMov}?query=${encodeURIComponent(searchTerm)}&page=${page}&language=es-MX`;
        }

        const res = await fetch(url, { headers: HDR });
        if (res.ok) {
          const data = await res.json();
          const processed = (data.results || []).map(item => ({
            id: item.id,
            titulo: item.name || item.title,
            originalTitle: item.original_name || item.original_title,
            overview: item.overview || 'Sinopsis disponible en catálogo anime.',
            portada: item.poster_path ? `${IMG}${item.poster_path}` : 'https://via.placeholder.com/500x750?text=Anime',
            backdrop: item.backdrop_path ? `${BACK}${item.backdrop_path}` : null,
            rating: item.vote_average ? item.vote_average.toFixed(1) : '8.5',
            year: (item.first_air_date || item.release_date || '').substring(0, 4) || '2024',
            isMovie: currentCatObj.isMovie || false
          }));

          setAnimes(processed);
          setTotalPages(Math.min(data.total_pages || 1, 50));

          if (!searchTerm) {
            sessionStorage.setItem(cacheKey, JSON.stringify({ results: processed, totalPages: Math.min(data.total_pages || 1, 50) }));
          }
        }
      } catch (e) {
        console.error('Error fetching animes:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAnimes();
  }, [activeCategory, page, searchTerm, currentCatObj]);

  // Fetch details & episode count when an anime is clicked
  useEffect(() => {
    if (!selectedAnime) return;
    const fetchDetails = async () => {
      try {
        const type = selectedAnime.isMovie ? 'movie' : 'tv';
        const res = await fetch(`${TMDB}/${type}/${selectedAnime.id}?language=es-MX`, { headers: HDR });
        if (res.ok) {
          const data = await res.json();
          const totalEps = data.number_of_episodes || (data.seasons?.[0]?.episode_count) || 24;
          setAnimeDetails({
            totalEpisodes: selectedAnime.isMovie ? 1 : Math.max(totalEps, 12),
            seasons: data.seasons || [],
            tagline: data.tagline || '',
            genres: (data.genres || []).map(g => g.name).join(', ')
          });
        }
      } catch (e) {
        setAnimeDetails({ totalEpisodes: 24, tagline: '', genres: 'Anime' });
      }
    };

    fetchDetails();
  }, [selectedAnime]);

  const handleOpenAnime = (anime) => {
    setSelectedAnime(anime);
    setSelectedEp(1);
    setActiveServer(1);

    saveWatchProgress({
      id: anime.id,
      titulo: anime.titulo,
      portada: anime.portada,
      type: 'anime'
    });
  };

  const handleToggleFav = (e, anime) => {
    e.stopPropagation();
    toggleFavorite({
      id: anime.id,
      titulo: anime.titulo,
      portada: anime.portada,
      rating: anime.rating,
      year: anime.year,
      type: 'anime'
    });
    setFavUpdated(prev => prev + 1);
  };

  // Smart TV Remote D-Pad Navigation Hook
  useDpadNavigation({
    onBack: () => {
      if (selectedAnime) setSelectedAnime(null);
    }
  });

  // Player embed stream builder
  const getEmbedUrl = () => {
    if (!selectedAnime) return '';
    const isMov = selectedAnime.isMovie;
    const id = selectedAnime.id;

    if (activeServer === 1) {
      return isMov 
        ? `https://vidsrc.cc/v2/embed/movie/${id}`
        : `https://vidsrc.cc/v2/embed/tv/${id}/1/${selectedEp}`;
    } else if (activeServer === 2) {
      return isMov
        ? `https://vidsrc.to/embed/movie/${id}`
        : `https://vidsrc.to/embed/tv/${id}/1/${selectedEp}`;
    } else {
      return isMov
        ? `https://superembed.stream/embed/movie/${id}`
        : `https://superembed.stream/embed/tv/${id}/1/${selectedEp}`;
    }
  };

  const currentEmbed = getEmbedUrl();
  const tokiAnimeUrl = `https://tokianime.tv/buscar?q=${encodeURIComponent(selectedAnime?.titulo || '')}`;

  return (
    <div className="animes-container" style={{ padding: '0.5rem 0 3rem' }}>
      {/* Category Header */}
      <div className="category-header">
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>
            ⛩️ Catálogo de Anime HD
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
            Los mejores animes en sub español y latino con integración oficial de TokiAnime
          </p>
        </div>

        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar anime (ej. Solo Leveling, Naruto)..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Spotlight Hero Banner */}
      {!searchTerm && page === 1 && animes.length > 0 && (
        <div 
          className="hero-banner"
          style={{ 
            backgroundImage: `url(${animes[0].backdrop || animes[0].portada})`,
            height: '46vh',
            minHeight: '360px',
            marginBottom: '2.5rem',
            borderRadius: '24px',
            backgroundSize: 'cover',
            backgroundPosition: 'center 25%',
            position: 'relative'
          }}
        >
          <div className="hero-content" style={{ maxWidth: '650px' }}>
            <span className="hero-tag" style={{ background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', boxShadow: '0 0 15px rgba(168, 85, 247, 0.4)' }}>
              🌸 Anime Destacado
            </span>
            <h2 className="hero-title" style={{ fontSize: '2.8rem', textShadow: '0 4px 20px rgba(0,0,0,0.95)' }}>
              {animes[0].titulo}
            </h2>
            <p className="hero-overview" style={{ fontSize: '0.95rem', color: '#f1f5f9' }}>
              {animes[0].overview}
            </p>
            <div className="hero-buttons">
              <button 
                className="btn-hero-play" 
                onClick={() => handleOpenAnime(animes[0])}
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', boxShadow: '0 6px 20px rgba(168, 85, 247, 0.5)', borderRadius: '12px' }}
              >
                <span>▶ Ver Anime</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Badges */}
      <div className="filters-wrapper" style={{ margin: '0 0 2rem 0', display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
        {ANIME_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            type="button"
            className={`filter-badge ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => { setActiveCategory(cat.id); setPage(1); setSearchTerm(''); }}
            style={{ whiteSpace: 'nowrap' }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Anime Grid */}
      {loading ? (
        <SkeletonGrid count={12} />
      ) : (
        <div className="media-grid">
          {animes.length > 0 ? (
            animes.map(anime => {
              const fav = isFavorite(anime.id);
              return (
                <div
                  key={anime.id}
                  className="media-card"
                  onClick={() => handleOpenAnime(anime)}
                  tabIndex={0}
                >
                  <div className="poster-container">
                    <img src={anime.portada} alt={anime.titulo} loading="lazy" />
                    <button
                      type="button"
                      className={`favorite-btn ${fav ? 'active' : ''}`}
                      onClick={(e) => handleToggleFav(e, anime)}
                      title={fav ? 'Quitar de Mi Lista' : 'Añadir a Mi Lista'}
                    >
                      {fav ? '❤️' : '🤍'}
                    </button>
                    <span className="card-rating">★ {anime.rating}</span>
                  </div>

                  <div className="card-info">
                    <span className="card-genre">🌸 ANIME • {anime.year}</span>
                    <h3 className="card-title">{anime.titulo}</h3>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '4rem 2rem' }}>
              <span className="empty-icon">⛩️</span>
              <h3 className="empty-title">No se encontraron animes</h3>
              <p>Intenta buscando con otro título o seleccionando la categoría "Populares".</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="pagination-container" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2.5rem', alignItems: 'center' }}>
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
            className="btn-hero-info"
            style={{ padding: '0.6rem 1.25rem', borderRadius: '12px', opacity: page === 1 ? 0.5 : 1 }}
          >
            ← Anterior
          </button>

          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 700 }}>
            Página {page} de {totalPages}
          </span>

          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
            className="btn-hero-info"
            style={{ padding: '0.6rem 1.25rem', borderRadius: '12px', opacity: page === totalPages ? 0.5 : 1 }}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Player Modal */}
      {selectedAnime && (
        <div className="modal-overlay" onClick={() => setSelectedAnime(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <button className="modal-close-btn" onClick={() => setSelectedAnime(null)}>✕</button>

            <div className="movie-player-container">
              <iframe
                src={currentEmbed}
                className="player-iframe"
                allowFullScreen
                allow="autoplay; encrypted-media"
                title={selectedAnime.titulo}
              />
            </div>

            <div className="modal-body">
              <div className="modal-meta">
                <span className="modal-genre">{animeDetails?.genres || 'Anime'}</span>
                <span className="modal-lang">★ {selectedAnime.rating}</span>
                <span className="modal-lang">{selectedAnime.year}</span>
              </div>

              <h2 className="modal-title">{selectedAnime.titulo}</h2>
              <p className="modal-overview">{selectedAnime.overview}</p>

              {/* Episode selector for TV series */}
              {!selectedAnime.isMovie && (
                <div style={{ margin: '1.25rem 0' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '0.6rem' }}>
                    📺 Episodios Disponibles ({animeDetails?.totalEpisodes || 24}):
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', maxHeight: '140px', overflowY: 'auto', paddingRight: '0.3rem' }}>
                    {Array.from({ length: animeDetails?.totalEpisodes || 24 }, (_, i) => i + 1).map(ep => (
                      <button
                        key={ep}
                        type="button"
                        onClick={() => setSelectedEp(ep)}
                        style={{
                          background: selectedEp === ep ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' : 'rgba(255,255,255,0.08)',
                          border: '1px solid var(--border-color)',
                          color: '#fff',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          fontWeight: selectedEp === ep ? 800 : 400
                        }}
                      >
                        Episodio {ep}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Server selector */}
              <div style={{ margin: '1rem 0' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                  🎛️ Servidores de Emisión:
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    { id: 1, name: 'Servidor 1 (Sub Español HD)' },
                    { id: 2, name: 'Servidor 2 (Latino HD)' },
                    { id: 3, name: 'Servidor 3 (Embed 4K)' }
                  ].map(srv => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setActiveServer(srv.id)}
                      style={{
                        background: activeServer === srv.id ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' : 'rgba(255,255,255,0.08)',
                        border: '1px solid var(--border-color)',
                        color: '#fff',
                        padding: '0.45rem 0.9rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        fontWeight: activeServer === srv.id ? 800 : 400
                      }}
                    >
                      {srv.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons: Web Video Caster & TokiAnime link */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.92rem',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    color: '#ffffff',
                    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.45)',
                    borderRadius: '12px'
                  }}
                  onClick={() => castWithWebVideoCaster(currentEmbed, selectedAnime.titulo)}
                >
                  📱 Transmitir a TV (Web Video Caster)
                </button>

                <a
                  href={tokiAnimeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-hero-info"
                  style={{ padding: '0.75rem 1.25rem', borderRadius: '12px', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  🌸 Buscar en TokiAnime.tv
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
