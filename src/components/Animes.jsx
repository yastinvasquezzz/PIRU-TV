import React, { useState, useEffect, useMemo, useRef } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { saveWatchProgress, toggleFavorite, isFavorite } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import vimeusAnimesData from '../data/animes.json';

const TMDB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiMGM4MjRjMmFkMzllODUwNmE5ZGUzOGI5ZTA2ZjJmZiIsIm5iZiI6MTc0ODI3MjY1Ni43MDMsInN1YiI6IjY4MzQ4NjEwNjFmMWZlZmI4YmViMzYxZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KUIiE74vCOP05_Y0M5CKyCBtj9m5lN1WzCfZ6bQn6Xs';
const TMDB = 'https://api.themoviedb.org/3';
const HDR = { Authorization: `Bearer ${TMDB_KEY}` };

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
  '⚽ Deportes',
  '🎬 Películas Anime',
  '❤️ Mis Favoritos'
];

const CATEGORY_DISCOVER_MAP = {
  '⭐ Top Populares': '/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc',
  '💥 Shonen': '/discover/tv?with_genres=16,10759&with_original_language=ja&sort_by=popularity.desc',
  '⚔️ Acción': '/discover/tv?with_genres=16,10759&with_original_language=ja&sort_by=vote_count.desc',
  '🔮 Fantasía / Isekai': '/discover/tv?with_genres=16,10765&with_original_language=ja&sort_by=popularity.desc',
  '🏫 Romance / Escolar': '/discover/tv?with_genres=16,35&with_original_language=ja&sort_by=popularity.desc',
  '🤖 Sci-Fi': '/discover/tv?with_genres=16,10765&with_original_language=ja&sort_by=vote_count.desc',
  '⚽ Deportes': '/discover/tv?with_genres=16&with_keywords=6075|207881|180547&with_original_language=ja',
  '🎬 Películas Anime': '/discover/movie?with_genres=16&with_original_language=ja&sort_by=popularity.desc'
};

const ANIME_SERVERS = [
  {
    id: 'vimeus',
    name: 'Vimeus',
    lang: '🇲🇽 LATINO',
    badge: '⭐ Oficial Latino',
    desc: 'Audio Latino oficial de alta fidelidad sin anuncios invasivos (Recomendado)',
    quality: '1080p'
  },
  {
    id: 'cinesrc',
    name: 'CineSrc',
    lang: 'MULTI / JAP / SUB',
    badge: '⚡ Ultra Rápido',
    desc: 'Servidor CineSrc de alta velocidad con interfaz moderna y soporte multi-idioma',
    quality: '1080p'
  },
  {
    id: 'nsrplay',
    name: 'NasriPlay',
    lang: 'HD / SUB',
    badge: '💎 Respaldo HD',
    desc: 'Servidor alternativo de respaldo con subtítulos en español y máxima velocidad',
    quality: 'HD'
  }
];

export default function Animes() {
  const [activeCategory, setActiveCategory] = useState('🔥 Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryPages, setCategoryPages] = useState({});
  const [categoryTotalPages, setCategoryTotalPages] = useState({});
  const [animeCache, setAnimeCache] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [hoveredAnimeKey, setHoveredAnimeKey] = useState(null);

  // Selected Anime & Modal State
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [animeDetails, setAnimeDetails] = useState(null);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState([]);
  const [selectedEpisodeNumber, setSelectedEpisodeNumber] = useState(1);
  const [activeEpisodeData, setActiveEpisodeData] = useState(null);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedServer, setSelectedServer] = useState('vimeus');
  const [modalTab, setModalTab] = useState('player'); // 'player', 'cast', 'trailer', 'details'

  // Hero Featured Carousel
  const [heroIndex, setHeroIndex] = useState(0);
  const heroList = useMemo(() => {
    return vimeusAnimesData.slice(0, 8);
  }, []);
  const activeHero = heroList[heroIndex] || heroList[0];

  // Auto-rotate Hero banner every 7s
  useEffect(() => {
    if (heroList.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroList.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [heroList]);

  // Current page for active category
  const currentPage = categoryPages[activeCategory] || 1;
  const totalPages = categoryTotalPages[activeCategory] || 50;

  // Fetch TMDB discover content when active category changes or page changes
  useEffect(() => {
    if (searchTerm.trim() || activeCategory === '❤️ Mis Favoritos') {
      return;
    }

    const discoverPath = CATEGORY_DISCOVER_MAP[activeCategory];
    const pageToLoad = categoryPages[activeCategory] || 1;
    const cacheKey = `${activeCategory}_page_${pageToLoad}`;

    // If already in cache, skip fetch
    if (animeCache[cacheKey]) {
      return;
    }

    // For '🔥 Todos', page 1 uses local bundle
    if (activeCategory === '🔥 Todos' && pageToLoad === 1) {
      return;
    }

    const fetchAnimes = async () => {
      setIsLoading(true);
      try {
        const url = discoverPath 
          ? `${TMDB}${discoverPath}&language=es-ES&page=${pageToLoad}`
          : `${TMDB}/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&language=es-ES&page=${pageToLoad}`;

        const res = await fetch(url, { headers: HDR });
        if (res.ok) {
          const data = await res.json();
          if (data.total_pages) {
            setCategoryTotalPages(prev => ({
              ...prev,
              [activeCategory]: Math.min(data.total_pages, 500)
            }));
          }

          const isMovieCat = activeCategory === '🎬 Películas Anime';
          const items = (data.results || []).map(x => ({
            id: isMovieCat ? `movie-${x.id}` : `anime-${x.id}`,
            tmdb_id: x.id,
            title: x.title || x.name || 'Anime',
            poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : (x.backdrop_path ? `https://image.tmdb.org/t/p/w500${x.backdrop_path}` : 'https://via.placeholder.com/300x450?text=Anime'),
            backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
            overview: x.overview || 'Sin descripción disponible.',
            rating: x.vote_average ? Math.round(x.vote_average * 10) / 10 : null,
            year: (x.first_air_date || x.release_date || '').slice(0, 4) || '—',
            quality: 'FULL HD',
            type: isMovieCat ? 'movie' : 'tv'
          }));

          setAnimeCache(prev => ({
            ...prev,
            [cacheKey]: items
          }));
        }
      } catch (err) {
        console.error('Error fetching TMDB anime category:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnimes();
  }, [activeCategory, categoryPages, searchTerm, animeCache]);

  // Live TMDb Search with Debounce
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const delayTimer = setTimeout(async () => {
      try {
        const query = encodeURIComponent(searchTerm.trim());
        // Search both TV and movies
        const [resTv, resMovie] = await Promise.all([
          fetch(`${TMDB}/search/tv?query=${query}&language=es-ES`, { headers: HDR }),
          fetch(`${TMDB}/search/movie?query=${query}&language=es-ES`, { headers: HDR })
        ]);

        const tvData = resTv.ok ? await resTv.json() : { results: [] };
        const movieData = resMovie.ok ? await resMovie.json() : { results: [] };

        // Filter for animation or Japanese origin
        const combined = [
          ...(tvData.results || []).map(x => ({ ...x, media_type: 'tv' })),
          ...(movieData.results || []).map(x => ({ ...x, media_type: 'movie' }))
        ];

        // Format search items
        const formatted = combined
          .filter(x => (x.genre_ids && x.genre_ids.includes(16)) || x.original_language === 'ja' || (x.origin_country && x.origin_country.includes('JP')))
          .map(x => ({
            id: x.media_type === 'movie' ? `movie-${x.id}` : `anime-${x.id}`,
            tmdb_id: x.id,
            title: x.name || x.title,
            poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://via.placeholder.com/300x450?text=Anime',
            backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
            overview: x.overview || 'Sin descripción disponible.',
            rating: x.vote_average ? Math.round(x.vote_average * 10) / 10 : null,
            year: (x.first_air_date || x.release_date || '').slice(0, 4) || '—',
            quality: 'FULL HD',
            type: x.media_type
          }));

        // Also check local animes matching search
        const localMatches = vimeusAnimesData
          .filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase().trim()))
          .map(a => ({ ...a, type: 'tv' }));

        // Deduplicate
        const seen = new Set();
        const merged = [];
        [...localMatches, ...formatted].forEach(item => {
          const key = item.tmdb_id || item.id;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(item);
          }
        });

        setSearchResults(merged);
      } catch (err) {
        console.error('Anime search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 380);

    return () => clearTimeout(delayTimer);
  }, [searchTerm]);

  // Current items for category
  const currentAnimes = useMemo(() => {
    if (searchTerm.trim()) {
      return searchResults;
    }

    if (activeCategory === '❤️ Mis Favoritos') {
      return vimeusAnimesData.filter(a => isFavorite(a.id || a.tmdb_id));
    }

    const pageToLoad = categoryPages[activeCategory] || 1;
    const cacheKey = `${activeCategory}_page_${pageToLoad}`;

    if (animeCache[cacheKey]) {
      return animeCache[cacheKey];
    }

    // Default '🔥 Todos' Page 1: use high-quality local bundle
    if (activeCategory === '🔥 Todos' && pageToLoad === 1) {
      return vimeusAnimesData.slice(0, 32);
    }

    // Fallback while loading
    return vimeusAnimesData.slice(0, 24);
  }, [activeCategory, categoryPages, searchTerm, searchResults, animeCache]);

  // Handle open anime modal and fetch official TMDB seasons, episodes, cast and trailer
  const handleOpenAnime = async (anime) => {
    setSelectedAnime(anime);
    setIsPlaying(false);
    setSelectedServer('vimeus');
    setModalTab('player');
    setAnimeDetails(null);
    setSeasonEpisodes([]);
    setSelectedSeasonNumber(1);
    setSelectedEpisodeNumber(1);
    setIsLoadingSeasons(true);

    saveWatchProgress({
      id: anime.id || anime.tmdb_id,
      title: anime.title || anime.name,
      poster: anime.poster,
      type: anime.type || 'anime'
    });

    const isMovie = anime.type === 'movie';
    const mediaType = isMovie ? 'movie' : 'tv';
    const id = anime.tmdb_id || anime.id;

    try {
      const res = await fetch(`${TMDB}/${mediaType}/${id}?append_to_response=credits,videos&language=es-ES`, { headers: HDR });
      if (res.ok) {
        const data = await res.json();
        setAnimeDetails(data);

        if (!isMovie && data.seasons && data.seasons.length > 0) {
          const validSeasons = data.seasons
            .filter(s => s.season_number > 0)
            .sort((a, b) => a.season_number - b.season_number);

          const initialSeason = validSeasons.length > 0 ? validSeasons[0].season_number : 1;
          setSelectedSeasonNumber(initialSeason);
          await fetchSeasonEpisodes(id, initialSeason);
        }
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

  // Fetch episodes for a specific season from TMDb with proper order
  const fetchSeasonEpisodes = async (tmdbId, seasonNum) => {
    setIsLoadingEpisodes(true);
    try {
      const res = await fetch(`${TMDB}/tv/${tmdbId}/season/${seasonNum}?language=es-ES`, { headers: HDR });
      if (res.ok) {
        const data = await res.json();
        const eps = (data.episodes || []).sort((a, b) => a.episode_number - b.episode_number);
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
      id: `fb_${seasonNum}_${i + 1}`,
      episode_number: i + 1,
      name: `Episodio ${i + 1}`,
      overview: `Episodio ${i + 1} de la temporada ${seasonNum}.`,
      still_path: null
    }));
    setSeasonEpisodes(fallbackList);
    setSelectedEpisodeNumber(1);
    setActiveEpisodeData(fallbackList[0]);
  };

  // Switch Season tab
  const handleSelectSeason = (seasonNum) => {
    setSelectedSeasonNumber(seasonNum);
    const tmdbId = selectedAnime?.tmdb_id || selectedAnime?.id;
    if (tmdbId) {
      fetchSeasonEpisodes(tmdbId, seasonNum);
    }
  };

  // Switch Episode
  const handleSelectEpisode = (ep) => {
    setSelectedEpisodeNumber(ep.episode_number);
    setActiveEpisodeData(ep);
    setIsPlaying(true);
  };

  // Zapping: Next / Previous episode
  const handlePrevEpisode = () => {
    if (selectedEpisodeNumber > 1) {
      const prevEp = seasonEpisodes.find(e => e.episode_number === selectedEpisodeNumber - 1);
      if (prevEp) {
        handleSelectEpisode(prevEp);
      } else {
        setSelectedEpisodeNumber(p => p - 1);
      }
    }
  };

  const handleNextEpisode = () => {
    const nextEp = seasonEpisodes.find(e => e.episode_number === selectedEpisodeNumber + 1);
    if (nextEp) {
      handleSelectEpisode(nextEp);
    } else if (selectedEpisodeNumber < seasonEpisodes.length) {
      setSelectedEpisodeNumber(p => p + 1);
    }
  };

  // Vimeus / CineSrc / NasriPlay Embed URL
  const embedUrl = useMemo(() => {
    if (!selectedAnime) return '';
    const id = selectedAnime.tmdb_id || selectedAnime.id;
    const isMovie = selectedAnime.type === 'movie' || (animeDetails && !animeDetails.seasons);

    if (selectedServer === 'vimeus') {
      const vk = VIMEUS_VIEW_KEY ? `&view_key=${encodeURIComponent(VIMEUS_VIEW_KEY)}` : '';
      if (isMovie) {
        return `https://vimeus.com/e/movie?tmdb=${id}${vk}${VIMEUS_PARAMS}`;
      }
      return `https://vimeus.com/e/anime?tmdb=${id}&se=${selectedSeasonNumber}&ep=${selectedEpisodeNumber}${vk}${VIMEUS_PARAMS}`;
    }

    if (selectedServer === 'cinesrc') {
      if (isMovie) {
        return `https://cinesrc.st/embed/movie/${id}?color=%23e50914`;
      }
      return `https://cinesrc.st/embed/tv/${id}?s=${selectedSeasonNumber}&e=${selectedEpisodeNumber}&color=%23e50914`;
    }

    if (selectedServer === 'nsrplay') {
      if (isMovie) {
        return `https://nsrplay.space/embed/movie/${id}`;
      }
      return `https://nsrplay.space/embed/tv/${id}/${selectedSeasonNumber}/${selectedEpisodeNumber}`;
    }

    return '';
  }, [selectedAnime, selectedServer, selectedSeasonNumber, selectedEpisodeNumber, animeDetails]);

  // Trailer URL
  const trailerKey = useMemo(() => {
    if (!animeDetails?.videos?.results) return null;
    const vids = animeDetails.videos.results;
    const trailer = vids.find(v => v.type === 'Trailer' && v.site === 'YouTube') || vids.find(v => v.site === 'YouTube');
    return trailer ? trailer.key : null;
  }, [animeDetails]);

  // Cast members
  const castList = useMemo(() => {
    return animeDetails?.credits?.cast?.slice(0, 16) || [];
  }, [animeDetails]);

  // Pagination navigation helper (like Peliculas.jsx)
  const getPaginationList = (curr, total) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (curr <= 3) {
      return [1, 2, 3, 4, 5, '...', total];
    }
    if (curr >= total - 2) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', curr - 1, curr, curr + 1, '...', total];
  };

  const pagesToRender = getPaginationList(currentPage, totalPages);

  const goToPage = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage || isLoading) return;
    setCategoryPages(prev => ({
      ...prev,
      [activeCategory]: newPage
    }));
    window.scrollTo({ top: 480, behavior: 'smooth' });
  };

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
            🔥 PIRU-TV ANIME HUB (Más de 5,000 Animes y Películas)
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.3rem' }}>
            Catálogos completos con todas las temporadas y episodios ordenados en Full HD con audio Latino y Japonés
          </p>
        </div>

        <div className="search-container" style={{ width: '360px', position: 'relative' }}>
          <span className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar anime (ej. SPY x FAMILY, One Piece, Kimetsu)..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 38px 10px 38px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="filters-wrapper" style={{ margin: '0 0 1.75rem 0', display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
        {ANIME_CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            className={`filter-badge ${activeCategory === cat && !searchTerm ? 'active' : ''}`}
            onClick={() => {
              setActiveCategory(cat);
              setSearchTerm('');
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              background: (activeCategory === cat && !searchTerm) ? 'linear-gradient(135deg, #e50914, #b91c1c)' : 'rgba(255, 255, 255, 0.05)',
              border: (activeCategory === cat && !searchTerm) ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              fontWeight: (activeCategory === cat && !searchTerm) ? '700' : '500',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              boxShadow: (activeCategory === cat && !searchTerm) ? '0 4px 15px rgba(229, 9, 20, 0.35)' : 'none'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Hero Featured Billboard (Only visible when not searching) */}
      {!searchTerm && activeHero && (
        <div style={{
          position: 'relative',
          borderRadius: '20px',
          overflow: 'hidden',
          marginBottom: '2.5rem',
          aspectRatio: '21/9',
          minHeight: '340px',
          maxHeight: '440px',
          display: 'flex',
          alignItems: 'flex-end',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <img
            src={activeHero.backdrop || activeHero.poster}
            alt={activeHero.title}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 25%',
              transition: 'all 0.7s ease'
            }}
          />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, rgba(5, 5, 10, 0.95) 0%, rgba(5, 5, 10, 0.7) 45%, rgba(5, 5, 10, 0.1) 100%), linear-gradient(to top, rgba(5, 5, 10, 0.95) 0%, transparent 60%)'
          }} />

          {/* Hero Content */}
          <div style={{ position: 'relative', zIndex: 2, padding: '2.5rem', maxWidth: '640px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ background: '#10b981', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px' }}>
                🟢 En emisión
              </span>
              <span style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: '4px' }}>
                Top Popular #{heroIndex + 1}
              </span>
              <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
                FULL HD • Audio Latino & Jap
              </span>
            </div>

            <h2 style={{ fontSize: '2.4rem', fontWeight: 900, margin: '0 0 0.5rem 0', color: '#fff', letterSpacing: '-0.5px', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
              {activeHero.title}
            </h2>

            <p style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: '1.5', margin: '0 0 1.5rem 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              Disfruta de {activeHero.title} completo en alta definición Full HD con todas las temporadas oficiales y carátulas de episodios.
            </p>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                onClick={() => {
                  handleOpenAnime(activeHero);
                  setIsPlaying(true);
                }}
                style={{
                  padding: '12px 28px',
                  background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(229, 9, 20, 0.45)',
                  transition: 'transform 0.2s ease'
                }}
              >
                ▶ VER AHORA
              </button>

              <button
                onClick={async () => {
                  await toggleFavorite(activeHero);
                }}
                style={{
                  padding: '12px 22px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)'
                }}
              >
                {isFavorite(activeHero.id || activeHero.tmdb_id) ? '❤️ EN MI LISTA' : '+ AÑADIR A MI LISTA'}
              </button>
            </div>
          </div>

          {/* Hero Slider Dots */}
          <div style={{ position: 'absolute', bottom: '18px', right: '24px', display: 'flex', gap: '6px', zIndex: 3 }}>
            {heroList.map((_, i) => (
              <button
                key={i}
                onClick={() => setHeroIndex(i)}
                style={{
                  width: i === heroIndex ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: i === heroIndex ? '#e50914' : 'rgba(255,255,255,0.3)',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Content Grid Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 className="section-title" style={{ margin: 0, fontSize: '1.4rem', color: '#ffffff' }}>
            {searchTerm ? `Resultados de búsqueda (${currentAnimes.length})` : `${activeCategory} (Página ${currentPage})`}
          </h2>
          {isLoading && (
            <span style={{ fontSize: '0.85rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot" /> Cargando animes...
            </span>
          )}
        </div>

        {/* Media Grid */}
        <div className="media-grid">
          {currentAnimes.length > 0 ? (
            currentAnimes.map((anime, idx) => {
              const uniqueCardKey = `grid-${anime.id || anime.tmdb_id}-${idx}`;
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
                    borderRadius: '16px',
                    border: isCardHovered ? '1px solid #e50914' : '1px solid rgba(255,255,255,0.08)',
                    padding: '0.55rem',
                    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s ease',
                    transform: isCardHovered ? 'translateY(-6px) scale(1.02)' : 'none',
                    boxShadow: isCardHovered ? '0 10px 25px rgba(229, 9, 20, 0.25)' : 'none'
                  }}
                >
                  <div className="card-poster" style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', height: '270px' }}>
                    <img
                      src={anime.poster}
                      alt={anime.title}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/300x450?text=Anime'; }}
                    />
                    
                    <div style={{ position: 'absolute', top: '8px', left: '8px', background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)', color: '#fff', fontSize: '0.68rem', fontWeight: 900, padding: '3px 8px', borderRadius: '5px' }}>
                      {anime.quality || 'FULL HD'}
                    </div>

                    {anime.year && (
                      <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: '#e2e8f0', fontSize: '0.68rem', fontWeight: 700, padding: '3px 7px', borderRadius: '5px', backdropFilter: 'blur(4px)' }}>
                        {anime.year}
                      </div>
                    )}

                    {/* Hover Synopsis Popover */}
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
                          <span style={{ fontSize: '0.68rem', color: '#86efac', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                            {anime.type === 'movie' ? '🎬 PELÍCULA ANIME' : '📺 SERIE ANIME'}
                          </span>
                          <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.92rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                            {anime.title}
                          </h4>
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {anime.overview || `Disfruta de ${anime.title} completo en Full HD con doblaje y subtítulos.`}
                          </p>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                          <span style={{ background: 'rgba(229, 9, 20, 0.25)', color: '#f87171', border: '1px solid rgba(229, 9, 20, 0.4)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                            ▶ VER EPISODIOS
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="card-info" style={{ padding: '0.65rem 0.2rem 0.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span className="card-genre" style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700 }}>
                        {anime.type === 'movie' ? '🎬 Película' : '📺 Anime'}
                      </span>
                      {anime.rating && (
                        <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 700 }}>
                          ⭐ {anime.rating}
                        </span>
                      )}
                    </div>
                    <h3 className="card-title" style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0.2rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>
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
              <p style={{ color: '#94a3b8' }}>Intenta buscando con otro término o seleccionando otra categoría.</p>
            </div>
          )}
        </div>

        {/* Dynamic Pagination Bar (Same as Peliculas.jsx) */}
        {!searchTerm && activeCategory !== '❤️ Mis Favoritos' && (
          <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem', margin: '3rem 0 2rem' }}>
            {/* Previous Button */}
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1 || isLoading}
              style={{
                background: currentPage > 1 ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                color: currentPage > 1 ? '#fff' : 'rgba(255, 255, 255, 0.25)',
                padding: '0.6rem 1.25rem',
                borderRadius: '10px',
                cursor: currentPage > 1 && !isLoading ? 'pointer' : 'not-allowed',
                fontSize: '0.9rem',
                fontWeight: '700',
                opacity: currentPage > 1 ? 1 : 0.4,
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Página Anterior"
            >
              ← Anterior
            </button>

            {/* Dynamic Pages List */}
            {pagesToRender.map((p, idx) => {
              if (p === '...') {
                return (
                  <span 
                    key={`dots-${idx}`} 
                    style={{ 
                      color: 'rgba(255, 255, 255, 0.4)', 
                      padding: '0 0.35rem', 
                      fontSize: '1rem',
                      fontWeight: '700',
                      userSelect: 'none'
                    }}
                  >
                    ...
                  </span>
                );
              }

              const isCurrent = p === currentPage;
              return (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => goToPage(p)}
                  disabled={isLoading}
                  style={{
                    background: isCurrent ? 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)' : 'rgba(255, 255, 255, 0.05)',
                    border: isCurrent ? '1px solid #ef4444' : '1px solid var(--border-color)',
                    color: isCurrent ? '#ffffff' : '#cbd5e1',
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    cursor: isLoading ? 'wait' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: isCurrent ? '800' : '600',
                    transition: 'all 0.2s ease',
                    boxShadow: isCurrent ? '0 0 16px rgba(229, 9, 20, 0.45)' : 'none'
                  }}
                >
                  {p}
                </button>
              );
            })}

            {/* Next Button */}
            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              style={{
                background: currentPage < totalPages ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                color: currentPage < totalPages ? '#fff' : 'rgba(255, 255, 255, 0.25)',
                padding: '0.6rem 1.25rem',
                borderRadius: '10px',
                cursor: currentPage < totalPages && !isLoading ? 'pointer' : 'not-allowed',
                fontSize: '0.9rem',
                fontWeight: '700',
                opacity: currentPage < totalPages ? 1 : 0.4,
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Página Siguiente"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Video Streaming & Details Modal (Inspired by Peliculas.jsx series modal) */}
      {selectedAnime && (
        <div className="modal-overlay" onClick={() => { setSelectedAnime(null); setIsPlaying(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '980px' }}>
            <button className="modal-close-btn" onClick={() => { setSelectedAnime(null); setIsPlaying(false); }}>✕</button>

            {/* Movie / Anime Player Container */}
            <div className="movie-player-container">
              {isPlaying ? (
                <iframe
                  src={embedUrl}
                  className="player-iframe"
                  title={`${selectedAnime.title} - T${selectedSeasonNumber} E${selectedEpisodeNumber}`}
                  allowFullScreen
                  allow="autoplay; encrypted-media; picture-in-picture"
                />
              ) : (
                <button
                  type="button"
                  className="player-placeholder-btn"
                  style={{
                    backgroundImage: `linear-gradient(to top, rgba(11, 12, 22, 0.95) 0%, rgba(11, 12, 22, 0.45) 50%, rgba(11, 12, 22, 0.75) 100%), url(${selectedAnime.backdrop || selectedAnime.poster})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center 30%',
                    flexDirection: 'column',
                    gap: '0.85rem',
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
                  <div className="player-play-circle">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#000" style={{ marginLeft: '3px' }}>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <strong className="player-play-text">
                    Haga clic para reproducir {activeEpisodeData ? `Ep. ${selectedEpisodeNumber}: ${activeEpisodeData.name}` : ''}
                  </strong>
                </button>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="modal-tab-nav">
              <button 
                type="button" 
                className={`modal-tab-btn ${modalTab === 'player' ? 'active' : ''}`}
                onClick={() => setModalTab('player')}
              >
                <span>📺</span> Reproductor y Episodios
              </button>
              <button 
                type="button" 
                className={`modal-tab-btn ${modalTab === 'cast' ? 'active' : ''}`}
                onClick={() => setModalTab('cast')}
              >
                <span>👥</span> Reparto y Seiyuus {castList.length ? `(${castList.length})` : ''}
              </button>
              {trailerKey && (
                <button 
                  type="button" 
                  className={`modal-tab-btn ${modalTab === 'trailer' ? 'active' : ''}`}
                  onClick={() => setModalTab('trailer')}
                >
                  <span>✨</span> Tráiler Oficial
                </button>
              )}
              <button 
                type="button" 
                className={`modal-tab-btn ${modalTab === 'details' ? 'active' : ''}`}
                onClick={() => setModalTab('details')}
              >
                <span>📄</span> Ficha Técnica
              </button>
            </div>

            {/* TAB 1: REPRODUCTOR, SERVIDORES Y EPISODIOS */}
            {modalTab === 'player' && (
              <div className="modal-tab-body">
                
                {/* Servidores Selector */}
                <div className="player-servers-block" style={{ marginBottom: '1.25rem' }}>
                  <div className="player-subbar">
                    <div className="player-title-info">
                      <span className="bullet-dot">•</span>
                      <span className="player-title-text">
                        {selectedAnime.title} 
                        {selectedAnime.type !== 'movie' && ` - Temp. ${selectedSeasonNumber}, Ep. ${selectedEpisodeNumber}`}
                      </span>
                    </div>

                    <div className="latino-notice-pill">
                      <span>🇲🇽</span>
                      <span><strong>Audio Latino:</strong> Vimeus reproduce con doblaje oficial en Español Latino.</span>
                    </div>
                  </div>

                  <div className="server-selector-row">
                    {ANIME_SERVERS.map(srv => (
                      <button
                        key={srv.id}
                        type="button"
                        className={`server-pill-btn ${selectedServer === srv.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedServer(srv.id);
                          setIsPlaying(true);
                        }}
                      >
                        <span className="server-pill-name">{srv.name}</span>
                        <span className="server-pill-lang">{srv.lang}</span>
                        <span className="server-pill-badge">{srv.badge}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zapping bar when playing */}
                {isPlaying && selectedAnime.type !== 'movie' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '8px 16px', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <button
                      onClick={handlePrevEpisode}
                      disabled={selectedEpisodeNumber <= 1}
                      style={{ background: 'none', border: 'none', color: selectedEpisodeNumber <= 1 ? '#64748b' : '#fff', cursor: selectedEpisodeNumber <= 1 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                    >
                      ⏮ Episodio Anterior
                    </button>
                    <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>
                      Temporada {selectedSeasonNumber} • Episodio {selectedEpisodeNumber} {activeEpisodeData?.name ? `(${activeEpisodeData.name})` : ''}
                    </span>
                    <button
                      onClick={handleNextEpisode}
                      disabled={seasonEpisodes.length > 0 && selectedEpisodeNumber >= seasonEpisodes.length}
                      style={{ background: 'none', border: 'none', color: (seasonEpisodes.length > 0 && selectedEpisodeNumber >= seasonEpisodes.length) ? '#64748b' : '#fff', cursor: (seasonEpisodes.length > 0 && selectedEpisodeNumber >= seasonEpisodes.length) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                    >
                      Siguiente Episodio ⏭
                    </button>
                  </div>
                )}

                {/* Episodes Section (ONLY FOR SERIES) */}
                {selectedAnime.type !== 'movie' && (
                  <div className="episodes-container" style={{ borderRadius: '14px', padding: '1.25rem' }}>
                    <div className="episodes-top-row">
                      <span className="episodes-heading" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                        🌸 Temporadas y Episodios Ordenados
                      </span>

                      {animeDetails && animeDetails.seasons && animeDetails.seasons.length > 0 ? (
                        <select 
                          className="season-dropdown"
                          value={selectedSeasonNumber}
                          onChange={(e) => handleSelectSeason(Number(e.target.value))}
                        >
                          {animeDetails.seasons
                            .filter(s => s.season_number > 0)
                            .sort((a, b) => a.season_number - b.season_number)
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

                    {/* Quick Episode Bubbles Row */}
                    <div style={{ marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                        SALTO RÁPIDO A EPISODIO:
                      </span>
                      <div className="episodes-bubbles-row">
                        {seasonEpisodes.map(ep => (
                          <button
                            key={`bubble-${ep.id || ep.episode_number}`}
                            className={`episode-bubble-btn ${selectedEpisodeNumber === ep.episode_number ? 'active' : ''}`}
                            onClick={() => handleSelectEpisode(ep)}
                          >
                            {ep.episode_number}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Rich Episode Cards Grid with Thumbnails and Synopses */}
                    <div>
                      <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 800, display: 'block', marginBottom: '0.75rem' }}>
                        📺 CATÁLOGO DE EPISODIOS CON CARÁTULAS EN HD ({seasonEpisodes.length}):
                      </span>

                      {isLoadingEpisodes ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <span className="pulse-dot" /> Cargando episodios oficiales desde TMDB...
                        </div>
                      ) : (
                        <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', paddingRight: '0.4rem' }}>
                          {seasonEpisodes.map((ep) => {
                            const isActive = selectedEpisodeNumber === ep.episode_number;
                            const thumb = ep.still_path 
                              ? `https://image.tmdb.org/t/p/w300${ep.still_path}` 
                              : (selectedAnime.backdrop || selectedAnime.poster);

                            return (
                              <button
                                key={`card-${ep.id || ep.episode_number}`}
                                type="button"
                                onClick={() => handleSelectEpisode(ep)}
                                style={{
                                  background: isActive ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.04)',
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
                                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)' }} />
                                  <div style={{ position: 'absolute', bottom: '8px', left: '10px', background: isActive ? '#e50914' : 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '6px' }}>
                                    Episodio {ep.episode_number}
                                  </div>
                                  {ep.runtime && (
                                    <div style={{ position: 'absolute', bottom: '8px', right: '10px', background: 'rgba(0,0,0,0.7)', color: '#cbd5e1', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }}>
                                      ⏱ {ep.runtime} min
                                    </div>
                                  )}
                                </div>

                                {/* Episode Title & Overview */}
                                <div style={{ padding: '0.85rem' }}>
                                  <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.9rem', fontWeight: 800, color: isActive ? '#f87171' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                )}

                {/* Modal Info Section */}
                <div className="modal-info-section">
                  <div className="modal-badges-row">
                    <span className="modal-badge-type tv">
                      {selectedAnime.type === 'movie' ? '🎬 PELÍCULA ANIME' : '📺 SERIE ANIME'}
                    </span>
                    {selectedAnime.year && <span className="modal-badge-meta">{selectedAnime.year}</span>}
                    {selectedAnime.rating && <span className="modal-badge-meta">⭐ {selectedAnime.rating}</span>}
                    <span className="modal-badge-meta">⚡ {selectedAnime.quality || 'FULL HD'}</span>
                  </div>

                  <h2 className="modal-main-title">{selectedAnime.title}</h2>
                  {animeDetails?.tagline && (
                    <p className="modal-tagline">"{animeDetails.tagline}"</p>
                  )}
                  <p className="modal-overview-text">
                    {animeDetails?.overview || selectedAnime.overview || `Disfruta de ${selectedAnime.title} completo en Full HD directamente en PIRU TV.`}
                  </p>

                  <div className="modal-actions-row">
                    <button
                      type="button"
                      className="btn-modal-list"
                      onClick={async () => {
                        await toggleFavorite(selectedAnime);
                        setSelectedAnime({ ...selectedAnime });
                      }}
                    >
                      {isFavorite(selectedAnime.id || selectedAnime.tmdb_id) ? '❤️ En Mi Lista' : '🤍 Agregar a Mi Lista'}
                    </button>

                    <button
                      type="button"
                      className="btn-modal-cast"
                      onClick={() => {
                        castWithWebVideoCaster(embedUrl, selectedAnime.title);
                      }}
                    >
                      📱 Transmitir a TV (Web Video Caster)
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: REPARTO Y SEIYUUS */}
            {modalTab === 'cast' && (
              <div className="modal-tab-body" style={{ padding: '1.5rem 0' }}>
                <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.25rem' }}>
                  Reparto Principal y Voces (Seiyuus)
                </h3>
                {castList.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem' }}>
                    {castList.map(actor => (
                      <div key={actor.id} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', margin: '0 auto 0.5rem', background: 'rgba(0,0,0,0.3)' }}>
                          <img
                            src={actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : 'https://via.placeholder.com/100x100?text=Actor'}
                            alt={actor.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/100x100?text=Actor'; }}
                          />
                        </div>
                        <strong style={{ fontSize: '0.82rem', color: '#fff', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {actor.name}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {actor.character || 'Voz'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    Información de reparto no disponible para este título.
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TRÁILER OFICIAL */}
            {modalTab === 'trailer' && trailerKey && (
              <div className="modal-tab-body" style={{ padding: '1.5rem 0' }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
                    title="Tráiler Oficial"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {/* TAB 4: FICHA TÉCNICA */}
            {modalTab === 'details' && (
              <div className="modal-tab-body" style={{ padding: '1.5rem 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Título Original</span>
                    <h4 style={{ margin: '4px 0 0', color: '#fff', fontSize: '0.95rem' }}>{animeDetails?.original_name || animeDetails?.original_title || selectedAnime.title}</h4>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Estado</span>
                    <h4 style={{ margin: '4px 0 0', color: '#34d399', fontSize: '0.95rem' }}>{animeDetails?.status || 'En Emisión'}</h4>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Número de Temporadas</span>
                    <h4 style={{ margin: '4px 0 0', color: '#fff', fontSize: '0.95rem' }}>{animeDetails?.number_of_seasons || (animeDetails?.seasons?.length || 1)} Temporadas</h4>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Episodios Totales</span>
                    <h4 style={{ margin: '4px 0 0', color: '#fff', fontSize: '0.95rem' }}>{animeDetails?.number_of_episodes || 'Múltiples'} Episodios</h4>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Géneros</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {(animeDetails?.genres || []).map(g => (
                        <span key={g.id} style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#fca5a5', padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                          {g.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
