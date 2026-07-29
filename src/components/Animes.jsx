import React, { useState, useEffect, useMemo } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { saveWatchProgress, toggleFavorite, isFavorite } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import vimeusAnimesData from '../data/animes.json';

const TMDB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiMGM4MjRjMmFkMzllODUwNmE5ZGUzOGI5ZTA2ZjJmZiIsIm5iZiI6MTc0ODI3MjY1Ni43MDMsInN1YiI6IjY4MzQ4NjEwNjFmMWZlZmI4YmViMzYxZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KUIiE74vCOP05_Y0M5CKyCBtj9m5lN1WzCfZ6bQn6Xs';
const TMDB_HDR = { Authorization: `Bearer ${TMDB_KEY}` };

const VIMEUS_VIEW_KEY = 'KThsRRoYzOilpZpoAf-eQMKv1cN3ULOBQxPk6QmeL-A';
const VIMEUS_PARAMS = '&title=PIRU_TV&theme=red&font=v3&overlay=v5&selector=v3&playUI=v3&epanel=v3';

const ANIME_CATEGORIES = [
  '🔥 Todos',
  '⭐ Top Populares',
  '💥 Shonen',
  '⚔️ Acción',
  '🔮 Fantasía / Isekai',
  '🏫 Romance / Escolar',
  '🤖 Sci-Fi',
  '⚽ Deportes'
];

export default function Animes() {
  const [activeCategory, setActiveCategory] = useState('🔥 Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredAnimeKey, setHoveredAnimeKey] = useState(null); // Unique key per row + ID
  
  // Selected Anime State
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedServer, setSelectedServer] = useState('vimeus'); // 'vimeus', 'vidsrc', '2embed'
  
  // TMDB Seasons & Episodes State
  const [animeDetails, setAnimeDetails] = useState(null);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState([]);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [selectedEpisodeNumber, setSelectedEpisodeNumber] = useState(1);
  const [activeEpisodeData, setActiveEpisodeData] = useState(null);

  // Hero Top Populares Slider State
  const [heroIndex, setHeroIndex] = useState(0);
  const heroList = useMemo(() => vimeusAnimesData.slice(0, 6), []);
  const activeHero = heroList[heroIndex] || heroList[0];

  // Auto rotate hero banner
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroList.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [heroList]);

  // Categorized Datasets for Dashboard Rows (Like Peliculas.jsx Home State)
  const categorySections = useMemo(() => {
    return {
      '⭐ Top Populares': vimeusAnimesData.slice(0, 16),
      '💥 Shonen': vimeusAnimesData.filter((_, i) => i % 2 === 0).slice(0, 16),
      '⚔️ Acción': vimeusAnimesData.filter((_, i) => i % 3 === 0).slice(0, 16),
      '🔮 Fantasía / Isekai': vimeusAnimesData.filter((_, i) => i % 4 === 0).slice(0, 16),
      '🏫 Romance / Escolar': vimeusAnimesData.filter((_, i) => i % 5 === 0).slice(0, 16),
      '🤖 Sci-Fi': vimeusAnimesData.filter((_, i) => i % 6 === 0).slice(0, 16),
      '⚽ Deportes': vimeusAnimesData.filter((_, i) => i % 7 === 0).slice(0, 16)
    };
  }, []);

  // Filter animes for category grid view
  const currentCategoryItems = useMemo(() => {
    if (activeCategory === '🔥 Todos') return vimeusAnimesData;
    if (categorySections[activeCategory]) return categorySections[activeCategory];
    return vimeusAnimesData;
  }, [activeCategory, categorySections]);

  const filteredAnimes = useMemo(() => {
    return currentCategoryItems.filter(item => {
      const matchSearch = !searchTerm.trim() ||
        item.title.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSearch;
    });
  }, [currentCategoryItems, searchTerm]);

  // Paging (24 items per page)
  const itemsPerPage = 24;
  const totalPages = Math.ceil(filteredAnimes.length / itemsPerPage);

  const paginatedAnimes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAnimes.slice(start, start + itemsPerPage);
  }, [filteredAnimes, currentPage]);

  // Handle open anime modal and fetch real TMDB Season details
  const handleOpenAnime = async (anime) => {
    setSelectedAnime(anime);
    setIsPlaying(false);
    setSelectedServer('vimeus');
    setAnimeDetails(null);
    setSeasonEpisodes([]);
    setSelectedSeasonNumber(1);
    setSelectedEpisodeNumber(1);
    setIsLoadingSeasons(true);

    saveWatchProgress({
      id: anime.id,
      titulo: anime.title,
      portada: anime.poster,
      type: 'anime'
    });

    try {
      // 1. Fetch TV show details from TMDB to get real Seasons list
      const res = await fetch(`https://api.themoviedb.org/3/tv/${anime.tmdb_id}?language=es-ES`, { headers: TMDB_HDR });
      if (res.ok) {
        const data = await res.json();
        setAnimeDetails(data);

        // Pick first valid season number (season_number >= 1)
        const validSeasons = (data.seasons || []).filter(s => s.season_number > 0);
        const initialSeasonNum = validSeasons.length > 0 ? validSeasons[0].season_number : 1;
        setSelectedSeasonNumber(initialSeasonNum);

        // 2. Fetch episodes for initial season
        fetchSeasonEpisodes(anime.tmdb_id, initialSeasonNum);
      } else {
        fetchFallbackEpisodes(1);
      }
    } catch (e) {
      console.error('Error fetching TMDB details:', e);
      fetchFallbackEpisodes(1);
    } finally {
      setIsLoadingSeasons(false);
    }
  };

  // Fetch episodes with previews for a specific season number from TMDB
  const fetchSeasonEpisodes = async (tmdbId, seasonNum) => {
    setIsLoadingEpisodes(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNum}?language=es-ES`, { headers: TMDB_HDR });
      if (res.ok) {
        const data = await res.json();
        const eps = data.episodes || [];
        setSeasonEpisodes(eps);
        if (eps.length > 0) {
          setSelectedEpisodeNumber(eps[0].episode_number || 1);
          setActiveEpisodeData(eps[0]);
        }
      } else {
        fetchFallbackEpisodes(seasonNum);
      }
    } catch (e) {
      console.error('Error fetching season episodes:', e);
      fetchFallbackEpisodes(seasonNum);
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  const fetchFallbackEpisodes = (seasonNum) => {
    const fallbackList = Array.from({ length: 12 }, (_, i) => ({
      episode_number: i + 1,
      name: `Episodio ${i + 1}`,
      overview: `Episodio ${i + 1} de la serie.`,
      still_path: null
    }));
    setSeasonEpisodes(fallbackList);
    setSelectedEpisodeNumber(1);
    setActiveEpisodeData(fallbackList[0]);
  };

  // Switch Season tab
  const handleSelectSeason = (seasonNum) => {
    setSelectedSeasonNumber(seasonNum);
    if (selectedAnime) {
      fetchSeasonEpisodes(selectedAnime.tmdb_id, seasonNum);
    }
  };

  // Switch Episode
  const handleSelectEpisode = (ep) => {
    setSelectedEpisodeNumber(ep.episode_number);
    setActiveEpisodeData(ep);
    setIsPlaying(true);
  };

  // Vimeus / VidSrc / 2Embed Embed URL
  const embedUrl = useMemo(() => {
    if (!selectedAnime) return '';
    const id = selectedAnime.tmdb_id;

    if (selectedServer === 'vimeus') {
      const vk = VIMEUS_VIEW_KEY ? `&view_key=${encodeURIComponent(VIMEUS_VIEW_KEY)}` : '';
      return `https://vimeus.com/e/anime?tmdb=${id}&se=${selectedSeasonNumber}&ep=${selectedEpisodeNumber}${vk}${VIMEUS_PARAMS}`;
    }

    if (selectedServer === 'vidsrc') {
      return `https://vidsrc-embed.ru/embed/tv/${id}/${selectedSeasonNumber}-${selectedEpisodeNumber}?ds_lang=es`;
    }

    if (selectedServer === '2embed') {
      return `https://www.2embed.cc/embedtv/${id}&s=${selectedSeasonNumber}&e=${selectedEpisodeNumber}&lang=es`;
    }

    return '';
  }, [selectedAnime, selectedServer, selectedSeasonNumber, selectedEpisodeNumber]);

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
      <div className="category-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="section-title" style={{ margin: 0, fontSize: '1.75rem', color: '#ffffff', letterSpacing: '-0.5px' }}>
            🔥 PIRU-TV ANIME HUB (1069 Animes)
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.3rem' }}>
            Explora catálogos por temporadas oficiales, carátulas de episodios en HD
          </p>
        </div>

        <div className="search-container" style={{ width: '340px' }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar anime (ej. SPY x FAMILY, One Piece)..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Category Pills Bar - PLACED ABOVE THE HERO BANNER */}
      <div className="filters-wrapper" style={{ margin: '0 0 1.75rem 0', display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
        {ANIME_CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            className={`filter-badge ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => {
              setActiveCategory(cat);
              setCurrentPage(1);
            }}
            style={{
              background: activeCategory === cat ? 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)' : 'rgba(255,255,255,0.06)',
              borderColor: activeCategory === cat ? '#e50914' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              whiteSpace: 'nowrap'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Render Dashboard Categories Rows (Like Peliculas.jsx) vs Filtered Grid */}
      {activeCategory === '🔥 Todos' && !searchTerm.trim() ? (
        /* DASHBOARD ROW VIEWS (LIKE PELICULAS.JSX) */
        <div className="dashboard-home">
          
          {/* Top Populares Featured Hero Banner Slider (COMPLETELY CLEAN IMAGE - NO BLACK OVERLAY FADE) */}
          {activeHero && (
            <div 
              className="hero-banner"
              style={{
                position: 'relative',
                height: '420px',
                borderRadius: '24px',
                overflow: 'hidden',
                marginBottom: '2.5rem',
                backgroundImage: `url(${activeHero.backdrop || activeHero.poster})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center 15%',
                boxShadow: '0 25px 50px rgba(0,0,0,0.85)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              {/* CLEAN CONTAINER WITHOUT BLACK OVERLAY LAYER */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                padding: '3rem 3.5rem'
              }}>
                <div style={{ maxWidth: '580px', zIndex: 5 }}>
                  {/* Top Category Badges (e.g. En Emisión, Acción, Shonen) */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ background: 'rgba(34, 197, 94, 0.35)', border: '1px solid rgba(34, 197, 94, 0.7)', color: '#ffffff', fontSize: '0.72rem', fontWeight: 900, padding: '4px 12px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', backdropFilter: 'blur(8px)', boxShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e' }} /> En emisión
                    </span>
                    <span style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.25)', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, padding: '4px 12px', borderRadius: '12px', backdropFilter: 'blur(8px)', boxShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
                      Top Populares #{heroIndex + 1}
                    </span>
                    <span style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.25)', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, padding: '4px 12px', borderRadius: '12px', backdropFilter: 'blur(8px)', boxShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
                      {activeHero.quality || 'FULL HD'}
                    </span>
                  </div>

                  {/* Hero Title with crisp text shadows over full image */}
                  <h2 style={{ fontSize: '2.8rem', fontWeight: 900, color: '#ffffff', margin: '0 0 0.8rem 0', lineHeight: 1.1, letterSpacing: '-0.5px', textShadow: '0 4px 20px rgba(0,0,0,1), 0 0 35px rgba(0,0,0,1)' }}>
                    {activeHero.title}
                  </h2>

                  {/* Hero Synopsis Description with text shadow over full image */}
                  <p style={{ fontSize: '0.95rem', color: '#ffffff', lineHeight: '1.6', margin: '0 0 1.6rem 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '0 2px 12px rgba(0,0,0,1), 0 0 25px rgba(0,0,0,1)', fontWeight: 600 }}>
                    Disfruta de {activeHero.title} completo en alta definición Full HD directamente en PIRU-TV con subtítulos y doblaje en español.
                  </p>

                  {/* Hero Action Buttons (VER AHORA & + AÑADIR) */}
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{
                        padding: '0.85rem 1.8rem',
                        fontSize: '0.95rem',
                        fontWeight: 900,
                        background: '#ffffff',
                        border: 'none',
                        color: '#0b0b12',
                        borderRadius: '12px',
                        boxShadow: '0 6px 25px rgba(0,0,0,0.6)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.6rem'
                      }}
                      onClick={() => handleOpenAnime(activeHero)}
                    >
                      <span style={{ color: '#e50914' }}>▶</span> VER AHORA
                    </button>

                    <button
                      type="button"
                      style={{
                        padding: '0.85rem 1.6rem',
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        background: 'rgba(0, 0, 0, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        color: '#ffffff',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.6)'
                      }}
                      onClick={async () => {
                        await toggleFavorite(activeHero);
                        setActiveCategory(activeCategory);
                      }}
                    >
                      <span>+</span> {isFavorite(activeHero.id) ? 'EN MI LISTA' : 'AÑADIR'}
                    </button>
                  </div>

                  {/* Left Bottom Line Progress Indicators (Red Bar for Active Slide) */}
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '1.75rem', alignItems: 'center' }}>
                    {heroList.map((h, idx) => (
                      <div 
                        key={h.id || idx}
                        onClick={() => setHeroIndex(idx)}
                        style={{
                          width: heroIndex === idx ? '32px' : '10px',
                          height: '4px',
                          borderRadius: '2px',
                          background: heroIndex === idx ? '#e50914' : 'rgba(255, 255, 255, 0.4)',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.8)'
                        }}
                        title={h.title}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Left Navigation Arrow (<) */}
              <button
                type="button"
                onClick={() => setHeroIndex(prev => (prev - 1 + heroList.length) % heroList.length)}
                style={{
                  position: 'absolute',
                  left: '1.25rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'rgba(0, 0, 0, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#ffffff',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 10,
                  backdropFilter: 'blur(6px)',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.7)'
                }}
              >
                ❮
              </button>

              {/* Right Navigation Arrow (>) */}
              <button
                type="button"
                onClick={() => setHeroIndex(prev => (prev + 1) % heroList.length)}
                style={{
                  position: 'absolute',
                  right: '1.25rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'rgba(0, 0, 0, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#ffffff',
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 10,
                  backdropFilter: 'blur(6px)',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.7)'
                }}
              >
                ❯
              </button>
            </div>
          )}

          {Object.entries(categorySections).map(([catTitle, itemsList]) => (
            <div key={catTitle} className="dashboard-section" style={{ marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 className="dashboard-section-title" style={{ margin: 0, border: 'none', color: '#ffffff', fontSize: '1.3rem', fontWeight: 800 }}>
                  {catTitle}
                </h2>
                <button
                  type="button"
                  className="server-btn active"
                  style={{ fontSize: '0.82rem', padding: '0.45rem 1.1rem', cursor: 'pointer', background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)', border: 'none', color: '#fff', borderRadius: '8px', fontWeight: 700 }}
                  onClick={() => {
                    setActiveCategory(catTitle);
                    setCurrentPage(1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Ver más →
                </button>
              </div>

              {/* Horizontal Scroll Row */}
              <div className="carousel-row">
                <div className="carousel-scroll">
                  {itemsList.map((anime, idx) => {
                    const uniqueCardKey = `row-${catTitle}-${anime.id}-${idx}`;
                    const isCardHovered = hoveredAnimeKey === uniqueCardKey;

                    return (
                      <div
                        key={uniqueCardKey}
                        className="carousel-item-card media-card"
                        onMouseEnter={() => setHoveredAnimeKey(uniqueCardKey)}
                        onMouseLeave={() => setHoveredAnimeKey(null)}
                        onClick={() => handleOpenAnime(anime)}
                        style={{
                          position: 'relative',
                          textAlign: 'left',
                          cursor: 'pointer',
                          background: 'rgba(20, 20, 32, 0.6)',
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          padding: '0.5rem',
                          transition: 'transform 0.25s ease, border-color 0.25s ease',
                          transform: isCardHovered ? 'translateY(-4px) scale(1.02)' : 'none',
                          borderColor: isCardHovered ? '#e50914' : 'rgba(255,255,255,0.08)',
                          minWidth: '180px'
                        }}
                      >
                        <div className="card-poster" style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', height: '240px' }}>
                          <img
                            src={anime.poster}
                            alt={anime.title}
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/200x280?text=Anime'; }}
                          />
                          
                          <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)', color: '#fff', fontSize: '0.65rem', fontWeight: 900, padding: '3px 7px', borderRadius: '5px' }}>
                            {anime.quality || 'FULL HD'}
                          </div>

                          {/* Hover Synopsis Popover (UNIQUE TO THIS EXACT CARD) */}
                          {isCardHovered && (
                            <div 
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(10, 10, 18, 0.95)',
                                backdropFilter: 'blur(8px)',
                                padding: '0.85rem',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                animation: 'fadeIn 0.2s ease-in-out'
                              }}
                            >
                              <div>
                                <span style={{ fontSize: '0.68rem', color: '#86efac', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                                  PIRU-TV ANIME • TMDB #{anime.tmdb_id}
                                </span>
                                <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.88rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                                  {anime.title}
                                </h4>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1', lineHeight: '1.35', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  Disfruta de {anime.title} completo en alta definición Full HD con temporadas oficiales.
                                </p>
                              </div>

                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                                <span style={{ background: 'rgba(229, 9, 20, 0.25)', color: '#f87171', border: '1px solid rgba(229, 9, 20, 0.4)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>
                                  ▶ REPRODUCIR
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="card-info" style={{ padding: '0.6rem 0.2rem 0.2rem' }}>
                          <h3 className="card-title" style={{ fontSize: '0.88rem', fontWeight: 800, margin: '0.2rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>
                            {anime.title}
                          </h3>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* CATEGORY FILTERED GRID VIEW */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 className="section-title" style={{ margin: 0, fontSize: '1.4rem', color: '#ffffff' }}>
              Catálogo: {activeCategory} ({filteredAnimes.length} Series)
            </h2>
          </div>

          <div className="media-grid">
            {paginatedAnimes.length > 0 ? (
              paginatedAnimes.map((anime, idx) => {
                const uniqueCardKey = `grid-${activeCategory}-${anime.id}-${idx}`;
                const isCardHovered = hoveredAnimeKey === uniqueCardKey;

                return (
                  <div
                    key={uniqueCardKey}
                    className="media-card"
                    onMouseEnter={() => setHoveredAnimeKey(uniqueCardKey)}
                    onMouseLeave={() => setHoveredAnimeKey(null)}
                    onClick={() => handleOpenAnime(anime)}
                    style={{
                      position: 'relative',
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: 'rgba(20, 20, 32, 0.6)',
                      borderRadius: '18px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      padding: '0.6rem',
                      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s ease',
                      transform: isCardHovered ? 'translateY(-6px) scale(1.02)' : 'none',
                      borderColor: isCardHovered ? '#e50914' : 'rgba(255,255,255,0.08)'
                    }}
                  >
                    <div className="card-poster" style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', height: '270px' }}>
                      <img
                        src={anime.poster}
                        alt={anime.title}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/200x280?text=Anime'; }}
                      />
                      
                      <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)', color: '#fff', fontSize: '0.68rem', fontWeight: 900, padding: '3px 8px', borderRadius: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                        {anime.quality || 'FULL HD'}
                      </div>

                      {/* Hover Synopsis Popover (UNIQUE TO THIS EXACT CARD) */}
                      {isCardHovered && (
                        <div 
                          style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(10, 10, 18, 0.95)',
                            backdropFilter: 'blur(8px)',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            animation: 'fadeIn 0.2s ease-in-out'
                          }}
                        >
                          <div>
                            <span style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                              PIRU-TV ANIME • TMDB #{anime.tmdb_id}
                            </span>
                            <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.92rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                              {anime.title}
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              Disfruta de {anime.title} completo en alta definición Full HD con reproductor sin anuncios y temporadas oficiales.
                            </p>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                            <span style={{ background: 'rgba(229, 9, 20, 0.25)', color: '#f87171', border: '1px solid rgba(229, 9, 20, 0.4)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                              ▶ REPRODUCIR
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="card-info" style={{ padding: '0.75rem 0.25rem 0.25rem' }}>
                      <span className="card-genre" style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700 }}>
                        PIRU-TV • TMDB #{anime.tmdb_id}
                      </span>
                      <h3 className="card-title" style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0.2rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>
                        {anime.title}
                      </h3>
                    </div>
                  </div>
                );
              })
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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2.5rem' }}>
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
        </div>
      )}

      {/* PIRU-TV Modal Detail & Video Streaming Player */}
      {selectedAnime && (
        <div className="modal-overlay" onClick={() => { setSelectedAnime(null); setIsPlaying(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '960px' }}>
            <button className="modal-close-btn" onClick={() => { setSelectedAnime(null); setIsPlaying(false); }}>✕</button>

            {/* Movie Player Container with EXACT Peliculas.jsx CSS classes */}
            <div className="movie-player-container">
              {isPlaying ? (
                <iframe
                  src={embedUrl}
                  className="player-iframe"
                  title={`${selectedAnime.title} - T${selectedSeasonNumber} E${selectedEpisodeNumber}`}
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                />
              ) : (
                <button
                  type="button"
                  className="player-placeholder-btn"
                  style={{
                    background: `linear-gradient(to top, rgba(15,15,25,0.98), rgba(15,15,25,0.4)), url(${selectedAnime.backdrop || selectedAnime.poster})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    gap: '1rem',
                    cursor: 'pointer',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onClick={() => setIsPlaying(true)}
                >
                  <div className="play-icon" style={{ transform: 'scale(1.4)', background: '#fff', color: '#000' }}>▶</div>
                  <strong style={{ color: '#fff', fontSize: '1.25rem', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
                    Haga clic para reproducir {activeEpisodeData ? `Ep. ${selectedEpisodeNumber}: ${activeEpisodeData.name}` : ''}
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
                    Reproduciendo: {selectedAnime.title} - Temp. {selectedSeasonNumber}, Ep. {selectedEpisodeNumber} {activeEpisodeData ? `(${activeEpisodeData.name})` : ''}
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

            {/* PIRU-TV Seasons Selector Bar */}
            <div className="episodes-section" style={{ padding: '1.5rem 2rem 1rem' }}>
              <div className="episodes-header" style={{ marginBottom: '1.25rem' }}>
                <span className="episodes-title" style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 800 }}>
                  🌸 Seleccionar Temporada
                </span>
                
                {animeDetails && animeDetails.seasons ? (
                  <select 
                    className="season-select"
                    value={selectedSeasonNumber}
                    onChange={(e) => handleSelectSeason(Number(e.target.value))}
                    style={{ background: 'var(--glass-bg)', color: '#fff', border: '1px solid var(--primary)', padding: '0.5rem 1rem', borderRadius: '10px', fontWeight: 700 }}
                  >
                    {animeDetails.seasons
                      .filter(s => s.season_number > 0)
                      .map(s => (
                        <option key={s.id || s.season_number} value={s.season_number}>
                          {s.name || `Temporada ${s.season_number}`} ({s.episode_count} eps)
                        </option>
                      ))
                    }
                  </select>
                ) : (
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Temporada 1</span>
                )}
              </div>

              {/* PIRU-TV Episode Cards Grid with Thumbnails & Synopses */}
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.85rem' }}>
                  📺 EPISODIOS DE LA TEMPORADA ({seasonEpisodes.length}):
                </span>

                {isLoadingEpisodes ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Cargando carátulas de episodios desde TMDB...
                  </div>
                ) : (
                  <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', paddingRight: '0.4rem' }}>
                    {seasonEpisodes.map((ep, idx) => {
                      const isActive = selectedEpisodeNumber === ep.episode_number;
                      const thumb = ep.still_path 
                        ? `https://image.tmdb.org/t/p/w300${ep.still_path}` 
                        : (selectedAnime.backdrop || selectedAnime.poster);

                      return (
                        <button
                          key={ep.id || idx}
                          type="button"
                          onClick={() => handleSelectEpisode(ep)}
                          style={{
                            background: isActive ? 'rgba(229, 9, 20, 0.18)' : 'rgba(255,255,255,0.04)',
                            border: `2px solid ${isActive ? '#e50914' : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: '14px',
                            overflow: 'hidden',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                        >
                          {/* Episode Thumbnail */}
                          <div style={{ position: 'relative', height: '140px', width: '100%', overflow: 'hidden' }}>
                            <img
                              src={thumb}
                              alt={ep.name}
                              loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => { e.target.onerror = null; e.target.src = selectedAnime.poster; }}
                            />
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)' }} />
                            <div style={{ position: 'absolute', bottom: '8px', left: '10px', background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)', color: '#fff', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '6px' }}>
                              Episodio {ep.episode_number}
                            </div>
                          </div>

                          {/* Episode Title & Overview */}
                          <div style={{ padding: '0.85rem' }}>
                            <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '0.9rem', fontWeight: 800, color: isActive ? '#f87171' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ep.name || `Episodio ${ep.episode_number}`}
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {ep.overview || 'Sin descripción disponible para este episodio.'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Body & Action Buttons */}
            <div className="modal-body">
              <div className="modal-meta">
                <span className="modal-genre">🔥 PIRU-TV Anime</span>
                <span className="modal-lang">{selectedAnime.quality || 'FULL HD 1080p'}</span>
                <span className="modal-lang">TMDB #{selectedAnime.tmdb_id}</span>
              </div>
              <h2 className="modal-title">{selectedAnime.title}</h2>
              <p className="modal-summary">
                {animeDetails?.overview || `Disfruta de ${selectedAnime.title} en alta definición Full HD directamente en PIRU TV con servidores Vimeus, VidSrc y 2Embed.`}
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
