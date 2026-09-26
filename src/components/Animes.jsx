import React, { useState, useEffect, useMemo, useRef } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { saveWatchProgress, toggleFavorite, isFavorite, getWatchHistory } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import { isLgTv } from '../utils/deviceDetect';
import vimeusAnimesData from '../data/animes.json';

const TMDB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiMGM4MjRjMmFkMzllODUwNmE5ZGUzOGI5ZTA2ZjJmZiIsIm5iZiI6MTc0ODI3MjY1Ni43MDMsInN1YiI6IjY4MzQ4NjEwNjFmMWZlZmI4YmViMzYxZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KUIiE74vCOP05_Y0M5CKyCBtj9m5lN1WzCfZ6bQn6Xs';
const TMDB = 'https://api.themoviedb.org/3';
const HDR = { Authorization: `Bearer ${TMDB_KEY}` };

const VIMEUS_VIEW_KEY = 'KThsRRoYzOilpZpoAf-eQMKv1cN3ULOBQxPk6QmeL-A';
const VIMEUS_PARAMS = '&title=PIRU_TV&theme=red&font=v3&overlay=v5&selector=v3&playUI=v3&epanel=v3';

const ANIME_CATEGORIES = [
  'Inicio',
  '⭐ Top Populares',
  '💥 Shonen',
  '⚔️ Acción',
  '🔮 Fantasía / Isekai',
  '🏫 Romance / Escolar',
  '🤖 Sci-Fi',
  '⚽ Deportes',
  '🎬 Películas Anime',
  '❤️ Mi Lista'
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
    id: 'unlimplay',
    name: 'UnLimPlay',
    lang: '🇲🇽 LATINO',
    badge: '⭐ Activo 1080p',
    desc: 'Audio Latino oficial de alta fidelidad (Directo, Streamwish, Filelions, Voe)',
    quality: '1080p'
  },
  {
    id: 'vimeus',
    name: 'Vimeus',
    lang: '🇲🇽 LATINO',
    badge: '⚠️ Error 522 Host',
    desc: 'Audio Latino oficial (Servidor temporalmente fuera de línea por su proveedor)',
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
  const [activeCategory, setActiveCategory] = useState('Inicio');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryPages, setCategoryPages] = useState({});
  const [categoryTotalPages, setCategoryTotalPages] = useState({});
  const [animeCache, setAnimeCache] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isMuted, setIsMuted] = useState(true);

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
  const [selectedServer, setSelectedServer] = useState('unlimplay');
  const [modalTab, setModalTab] = useState('player'); // 'player', 'cast', 'trailer', 'details'

  // Watch history for continue watching row (specific to animes)
  const [watchHistory, setWatchHistory] = useState(() => getWatchHistory('animes'));
  const searchInputRef = useRef(null);

  // Focus search when triggered from global header
  useEffect(() => {
    const handleFocusSearch = (e) => {
      if (e.detail === 'animes' || e.detail === 'anime') {
        searchInputRef.current?.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('focus-section-search', handleFocusSearch);
    return () => window.removeEventListener('focus-section-search', handleFocusSearch);
  }, []);

  // Hero Featured Billboard List (Rotates every 7 seconds)
  const heroList = useMemo(() => {
    return vimeusAnimesData.slice(0, 8);
  }, []);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroItem = heroList[heroIndex] || heroList[0];

  useEffect(() => {
    if (isLgTv() || heroList.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroList.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [heroList]);

  // Top 10 items for the giant ranking row
  const top10Animes = useMemo(() => {
    return vimeusAnimesData.slice(0, 10);
  }, []);

  // Filtered continue watching for anime
  const continueWatchingAnimes = useMemo(() => {
    return (watchHistory || []).filter(item => 
      item.section === 'animes' || item.type === 'anime' || item.type === 'vimeus-anime'
    ).slice(0, 10);
  }, [watchHistory]);

  // Curated rows for Netflix Home view
  const homeRows = useMemo(() => {
    return [
      { id: '💥 Shonen', title: '💥 Tendencias Shonen y Aventuras', items: vimeusAnimesData.filter((_, i) => i % 2 === 0).slice(0, 18) },
      { id: '⚔️ Acción', title: '⚔️ Acción y Batallas Sobrenaturales', items: vimeusAnimesData.filter((_, i) => i % 3 === 0).slice(0, 18) },
      { id: '🔮 Fantasía / Isekai', title: '🔮 Fantasía, Magia e Isekai', items: vimeusAnimesData.filter((_, i) => i % 4 === 0).slice(0, 18) },
      { id: '🏫 Romance / Escolar', title: '🏫 Romance, Juventud y Comedia', items: vimeusAnimesData.filter((_, i) => i % 5 === 0).slice(0, 18) },
      { id: '🎬 Películas Anime', title: '🎬 Películas de Anime Aclamadas', items: vimeusAnimesData.filter((_, i) => i % 7 === 0).slice(0, 18) },
      { id: '🤖 Sci-Fi', title: '🤖 Ciencia Ficción, Cyberpunk y Mecha', items: vimeusAnimesData.filter((_, i) => i % 6 === 0).slice(0, 18) },
      { id: '⚽ Deportes', title: '⚽ Deportes, Pasión y Superación', items: vimeusAnimesData.filter((_, i) => i % 8 === 0).slice(0, 18) }
    ];
  }, []);

  // Fetch TMDB discover content when in a category grid view
  const currentPage = categoryPages[activeCategory] || 1;
  const totalPages = categoryTotalPages[activeCategory] || 50;

  useEffect(() => {
    if (activeCategory === 'Inicio' || activeCategory === '❤️ Mi Lista' || searchTerm.trim()) {
      return;
    }

    const discoverPath = CATEGORY_DISCOVER_MAP[activeCategory];
    const pageToLoad = categoryPages[activeCategory] || 1;
    const cacheKey = `${activeCategory}_page_${pageToLoad}`;

    if (animeCache[cacheKey]) return;

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
        const [resTv, resMovie] = await Promise.all([
          fetch(`${TMDB}/search/tv?query=${query}&language=es-ES`, { headers: HDR }),
          fetch(`${TMDB}/search/movie?query=${query}&language=es-ES`, { headers: HDR })
        ]);

        const tvData = resTv.ok ? await resTv.json() : { results: [] };
        const movieData = resMovie.ok ? await resMovie.json() : { results: [] };

        const combined = [
          ...(tvData.results || []).map(x => ({ ...x, media_type: 'tv' })),
          ...(movieData.results || []).map(x => ({ ...x, media_type: 'movie' }))
        ];

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

        const localMatches = vimeusAnimesData
          .filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase().trim()))
          .map(a => ({ ...a, type: 'tv' }));

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

  // Current items for active category grid view
  const currentGridAnimes = useMemo(() => {
    if (searchTerm.trim()) return searchResults;
    if (activeCategory === '❤️ Mi Lista') {
      return vimeusAnimesData.filter(a => isFavorite(a.id || a.tmdb_id));
    }
    const pageToLoad = categoryPages[activeCategory] || 1;
    const cacheKey = `${activeCategory}_page_${pageToLoad}`;
    if (animeCache[cacheKey]) return animeCache[cacheKey];
    return vimeusAnimesData.slice(0, 24);
  }, [activeCategory, categoryPages, searchTerm, searchResults, animeCache]);

  // Handle open anime modal and fetch official TMDB seasons, episodes, cast and trailer
  const handleOpenAnime = async (anime, autoPlay = false) => {
    const targetSeason = Number(anime.season) || 1;
    const targetEpisode = Number(anime.episode) || 1;

    setSelectedAnime(anime);
    setIsPlaying(autoPlay);
    setSelectedServer('unlimplay');
    setModalTab('player');
    setAnimeDetails(null);
    setSeasonEpisodes([]);
    setSelectedSeasonNumber(targetSeason);
    setSelectedEpisodeNumber(targetEpisode);
    setIsLoadingSeasons(true);

    saveWatchProgress({
      id: anime.id || anime.tmdb_id,
      title: anime.title || anime.name,
      poster: anime.poster,
      backdrop: anime.backdrop,
      type: 'anime',
      section: 'animes',
      season: targetSeason,
      episode: targetEpisode
    }, 'animes');
    setWatchHistory(getWatchHistory('animes'));

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

          const seasonMatch = validSeasons.find(s => s.season_number === targetSeason);
          const activeSeason = seasonMatch ? seasonMatch.season_number : (validSeasons.length > 0 ? validSeasons[0].season_number : 1);
          setSelectedSeasonNumber(activeSeason);
          await fetchSeasonEpisodes(id, activeSeason);
        }
      } else {
        fetchFallbackEpisodes(targetSeason);
      }
    } catch (e) {
      console.error('Error fetching TMDB details:', e);
      fetchFallbackEpisodes(targetSeason);
    } finally {
      setIsLoadingSeasons(false);
    }
  };

  // Handle external open event (e.g. from Mi Lista or Mi Cuenta)
  useEffect(() => {
    const handleRemoteOpen = (e) => {
      if (e.detail?.tab === 'animes' && e.detail?.item) {
        handleOpenAnime(e.detail.item, true);
      }
    };
    window.addEventListener('open-piru-item', handleRemoteOpen);
    return () => {
      window.removeEventListener('open-piru-item', handleRemoteOpen);
    };
  }, []);

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

  // UnLimPlay / Vimeus / CineSrc / NasriPlay Embed URL
  const embedUrl = useMemo(() => {
    if (!selectedAnime) return '';
    const id = selectedAnime.tmdb_id || selectedAnime.id;
    const isMovie = selectedAnime.type === 'movie' || (animeDetails && !animeDetails.seasons);

    if (selectedServer === 'unlimplay') {
      if (isMovie) {
        return `https://unlimplay.com/f/embed/movie/${id}`;
      }
      return `https://unlimplay.com/f/embed/tv/${id}/${selectedSeasonNumber}/${selectedEpisodeNumber}`;
    }

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

  // Persist watch progress on active playback
  useEffect(() => {
    if (selectedAnime && isPlaying) {
      saveWatchProgress({
        id: selectedAnime.id || selectedAnime.tmdb_id,
        title: selectedAnime.title || selectedAnime.name,
        poster: selectedAnime.poster,
        backdrop: selectedAnime.backdrop,
        type: 'anime',
        section: 'animes',
        season: selectedSeasonNumber,
        episode: selectedEpisodeNumber
      }, 'animes');
      setWatchHistory(getWatchHistory('animes'));
    }
  }, [selectedAnime, isPlaying, selectedSeasonNumber, selectedEpisodeNumber]);

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="peliculas-container netflix-view" style={{ minHeight: '100vh', background: '#141414', color: '#fff' }}>
      
      {/* Netflix Subnav & Category Pills */}
      <div className="netflix-subnav-bar">
        {/* Category Tabs Bar */}
        <div className="netflix-subnav-categories">
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
                padding: '7px 16px',
                borderRadius: '20px',
                background: (activeCategory === cat && !searchTerm) ? '#e50914' : 'rgba(255, 255, 255, 0.08)',
                border: (activeCategory === cat && !searchTerm) ? '1px solid #e50914' : '1px solid rgba(255, 255, 255, 0.12)',
                color: '#fff',
                fontWeight: (activeCategory === cat && !searchTerm) ? '800' : '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                boxShadow: (activeCategory === cat && !searchTerm) ? '0 0 16px rgba(229, 9, 20, 0.6)' : 'none'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="netflix-subnav-search">
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}>🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar anime por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '9px 36px 9px 36px',
              borderRadius: '6px',
              background: 'rgba(0, 0, 0, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#fff',
              fontSize: '0.88rem',
              outline: 'none'
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* NETFLIX HOME VIEW */}
      {activeCategory === 'Inicio' && !searchTerm ? (
        <>
          {/* Netflix Full-Bleed Hero Billboard */}
          {heroItem && (
            <section className="netflix-hero-billboard">
              <div 
                className="netflix-hero-bg"
                style={{ backgroundImage: `url(${heroItem.backdrop || heroItem.poster})` }}
              />
              <div className="netflix-vignette-bottom" />
              <div className="netflix-vignette-left" />
              <div className="netflix-vignette-top" />

              <div className="netflix-hero-content">
                <div className="netflix-rank-badge">
                  <div className="netflix-top10-tag">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '15px' }}>
                      local_fire_department
                    </span>
                    TOP 10
                  </div>
                  <span className="netflix-rank-text">N.º {heroIndex + 1} en anime hoy</span>
                </div>

                <h1 className="netflix-hero-title">{heroItem.title}</h1>

                <div className="netflix-meta-row">
                  <span className="netflix-match">98% de coincidencia</span>
                  <span>2026</span>
                  <span className="netflix-badge-age">16+</span>
                  <span>FULL HD</span>
                  <span className="netflix-badge-tech">5.1</span>
                  <span className="netflix-badge-tech">Doblaje Latino</span>
                </div>

                <p className="netflix-hero-synopsis">
                  {heroItem.overview || `Disfruta de ${heroItem.title} completo en alta definición con todas sus temporadas oficiales y episodios ordenados en español latino.`}
                </p>

                <div className="netflix-hero-actions">
                  <button 
                    className="btn-netflix-play" 
                    onClick={() => {
                      handleOpenAnime(heroItem);
                      setIsPlaying(true);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '26px' }}>
                      play_arrow
                    </span>
                    Reproducir
                  </button>

                  <button 
                    className="btn-netflix-info" 
                    onClick={() => {
                      handleOpenAnime(heroItem);
                      setModalTab('player');
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                      info
                    </span>
                    Más información
                  </button>

                  <button 
                    className="btn-netflix-round" 
                    title={isFavorite(heroItem.id || heroItem.tmdb_id) ? 'En Mi Lista' : 'Añadir a Mi Lista'}
                    onClick={async () => {
                      await toggleFavorite(heroItem);
                      setSelectedAnime(prev => (prev ? { ...prev } : null));
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                      {isFavorite(heroItem.id || heroItem.tmdb_id) ? 'check' : 'add'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Right Billboard Controls */}
              <div className="netflix-right-controls">
                <button 
                  className="btn-netflix-round" 
                  style={{ width: '36px', height: '36px' }}
                  onClick={() => setIsMuted(prev => !prev)}
                  title={isMuted ? 'Activar audio' : 'Desactivar audio'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {isMuted ? 'volume_off' : 'volume_up'}
                  </span>
                </button>
                <div className="netflix-maturity-tag">
                  16+
                </div>
              </div>
            </section>
          )}

          {/* Netflix Rows Section */}
          <div className="netflix-rows-container">
            
            {/* Row 0: Continuar Viendo Anime */}
            {continueWatchingAnimes.length > 0 && (
              <section className="netflix-row-section">
                <div className="netflix-row-header">
                  <h2 className="netflix-row-title">
                    Continuar viendo
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                      chevron_right
                    </span>
                  </h2>
                </div>
                <div className="netflix-continue-grid">
                  {continueWatchingAnimes.map((item) => (
                    <div 
                      key={`continue-${item.id}`} 
                      className="netflix-continue-card"
                      onClick={() => handleOpenAnime(item)}
                    >
                      <div className="netflix-continue-thumb">
                        <img src={item.backdrop || item.poster} alt={item.title} loading="lazy" decoding="async" />
                        <div className="netflix-continue-overlay">
                          <div className="netflix-center-play">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '24px' }}>
                              play_arrow
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="netflix-progress-bar">
                        <div className="netflix-progress-fill" style={{ width: '70%' }} />
                      </div>
                      <div className="netflix-continue-info">
                        <span className="netflix-continue-title">{item.title}</span>
                        <span className="netflix-continue-sub">
                          {item.remaining || (item.season && item.episode ? `T${item.season}:E${item.episode}` : 'Continuar')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Row 1: Top 10 Animes más populares hoy en PiruTV (Billboard 1..10) */}
            {top10Animes.length > 0 && (
              <section className="netflix-row-section">
                <div className="netflix-row-header">
                  <h2 className="netflix-row-title">
                    Los 10 animes más populares hoy en PiruTV
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                      chevron_right
                    </span>
                  </h2>
                </div>
                <div className="netflix-top10-grid">
                  {top10Animes.map((item, index) => (
                    <div 
                      key={`top10-${item.id || item.tmdb_id}-${index}`} 
                      className="netflix-top10-item"
                      onClick={() => handleOpenAnime(item)}
                    >
                      <span className="netflix-top-num">{index + 1}</span>
                      <div className="netflix-top-poster">
                        <img src={item.poster} alt={item.title} loading="lazy" decoding="async" />
                        <div className="netflix-card-top10-badge">TOP 10</div>
                        <div className="netflix-card-lang-strip">
                          <span className="netflix-pill-lat">LAT</span>
                          <span className="netflix-pill-cast">JAP</span>
                          <span className="netflix-pill-sub">SUB</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Curated Category Content Rows */}
            {homeRows.map((row) => (
              <section key={row.id} className="netflix-row-section">
                <div className="netflix-row-header">
                  <h2 
                    className="netflix-row-title"
                    onClick={() => {
                      setActiveCategory(row.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    {row.title}
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                      chevron_right
                    </span>
                  </h2>
                  <button 
                    className="netflix-explore-all"
                    onClick={() => {
                      setActiveCategory(row.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Explorar todos
                  </button>
                </div>

                <div className="netflix-category-scroll">
                  {row.items.map((item) => (
                    <button 
                      type="button"
                      key={`scroll-${item.id || item.tmdb_id}`} 
                      className="netflix-poster-card"
                      onClick={() => handleOpenAnime(item)}
                    >
                      <div className="netflix-poster-img-wrap">
                        <img src={item.poster} alt={item.title} loading="lazy" decoding="async" />
                        <div className="netflix-quality-tag">FULL HD</div>
                        <div className="netflix-card-lang-strip">
                          <span className="netflix-pill-lat">LAT</span>
                          <span className="netflix-pill-cast">JAP</span>
                          <span className="netflix-pill-sub">SUB</span>
                        </div>
                      </div>
                      <span className="netflix-poster-title">{item.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}

          </div>

          {/* Netflix Footer */}
          <footer className="netflix-footer">
            <div className="netflix-footer-inner">
              <div className="netflix-copyright">
                © 2026 PIRU TV • Catálogo Completo de Anime en Español y Japonés
              </div>
            </div>
          </footer>
        </>
      ) : (
        /* NETFLIX CATEGORY / SEARCH GRID VIEW */
        <div style={{ padding: '1.5rem 3.5rem 4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 className="section-title" style={{ margin: 0, fontSize: '1.6rem', color: '#ffffff', fontWeight: 800 }}>
                {searchTerm ? `Resultados para: "${searchTerm}" (${currentGridAnimes.length})` : `${activeCategory} (${totalPages > 1 ? `Página ${currentPage} de ${totalPages}` : `${currentGridAnimes.length} animes`})`}
              </h2>
              {activeCategory !== 'Inicio' && !searchTerm && (
                <p style={{ margin: '4px 0 0', color: '#a3a3a3', fontSize: '0.85rem' }}>
                  Explora todas las series y películas oficiales con temporadas completas en Full HD
                </p>
              )}
            </div>

            {isLoading && (
              <span style={{ fontSize: '0.85rem', color: '#e50914', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="pulse-dot" /> Cargando animes de TMDb...
              </span>
            )}
          </div>

          {/* Grid of Posters */}
          <div className="media-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.25rem' }}>
            {currentGridAnimes.length > 0 ? (
              currentGridAnimes.map((item, idx) => (
                <button
                  type="button"
                  key={`grid-${item.id || item.tmdb_id}-${idx}`}
                  className="netflix-poster-card"
                  onClick={() => handleOpenAnime(item)}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <div className="netflix-poster-img-wrap" style={{ width: '100%', height: '260px' }}>
                    <img src={item.poster} alt={item.title} loading="lazy" decoding="async" />
                    <div className="netflix-quality-tag">{item.quality || 'FULL HD'}</div>
                    <div className="netflix-card-lang-strip">
                      <span className="netflix-pill-lat">LAT</span>
                      <span className="netflix-pill-cast">JAP</span>
                      <span className="netflix-pill-sub">SUB</span>
                    </div>
                  </div>
                  <span className="netflix-poster-title" style={{ marginTop: '0.5rem', fontWeight: 700, fontSize: '0.88rem' }}>
                    {item.title}
                  </span>
                </button>
              ))
            ) : (
              <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '5rem 2rem', textAlign: 'center' }}>
                <span className="empty-icon">📺</span>
                <h3 className="empty-title">No se encontraron animes</h3>
                <p style={{ color: '#a3a3a3' }}>Intenta buscando con otro término o explorando otra categoría.</p>
              </div>
            )}
          </div>

          {/* Dynamic Pagination (Same as Peliculas.jsx) */}
          {!searchTerm && activeCategory !== '❤️ Mi Lista' && totalPages > 1 && (
            <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem', margin: '3.5rem 0 2rem' }}>
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1 || isLoading}
                style={{
                  background: currentPage > 1 ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  color: currentPage > 1 ? '#fff' : 'rgba(255, 255, 255, 0.25)',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '8px',
                  cursor: currentPage > 1 && !isLoading ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  opacity: currentPage > 1 ? 1 : 0.4,
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ← Anterior
              </button>

              {pagesToRender.map((p, idx) => {
                if (p === '...') {
                  return (
                    <span 
                      key={`dots-${idx}`} 
                      style={{ color: 'rgba(255, 255, 255, 0.4)', padding: '0 0.35rem', fontSize: '1rem', fontWeight: '700' }}
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
                      background: isCurrent ? '#e50914' : 'rgba(255, 255, 255, 0.06)',
                      border: isCurrent ? '1px solid #e50914' : '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#ffffff',
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      cursor: isLoading ? 'wait' : 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: isCurrent ? '800' : '600',
                      boxShadow: isCurrent ? '0 0 16px rgba(229, 9, 20, 0.5)' : 'none'
                    }}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages || isLoading}
                style={{
                  background: currentPage < totalPages ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  color: currentPage < totalPages ? '#fff' : 'rgba(255, 255, 255, 0.25)',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '8px',
                  cursor: currentPage < totalPages && !isLoading ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  opacity: currentPage < totalPages ? 1 : 0.4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      )}

      {/* NETFLIX VIDEO STREAMING & EPISODES MODAL */}
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
                      <span><strong>Audio Latino:</strong> UnLimPlay reproduce con doblaje oficial en Español Latino 1080p. Vimeus temporalmente con caída de servidor (Error 522).</span>
                    </div>
                  </div>

                  {selectedServer === 'vimeus' && (
                    <div style={{
                      margin: '0.75rem 0',
                      padding: '0.75rem 1rem',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      fontSize: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                        <span>
                          <strong>Servidor Vimeus en mantenimiento:</strong> El host de vimeus.com presenta caída de conexión externa (Error 522).
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedServer('unlimplay'); setIsPlaying(true); }}
                        style={{
                          background: '#e50914',
                          border: 'none',
                          color: '#fff',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Cambiar a UnLimPlay (1080p Latino)
                      </button>
                    </div>
                  )}

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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '8px 16px', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.08)' }}>
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
                  <div className="episodes-container" style={{ borderRadius: '12px', padding: '1.25rem' }}>
                    <div className="episodes-top-row">
                      <span className="episodes-heading" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                        Seleccionar Temporada
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
                    <div style={{ marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.78rem', color: '#a3a3a3', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                        SALTO RÁPIDO:
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
                        EPISODIOS DE LA TEMPORADA ({seasonEpisodes.length}):
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
                                  borderRadius: '10px',
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
                                  <div style={{ position: 'absolute', bottom: '8px', left: '10px', background: isActive ? '#e50914' : 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>
                                    Episodio {ep.episode_number}
                                  </div>
                                  {ep.runtime && (
                                    <div style={{ position: 'absolute', bottom: '8px', right: '10px', background: 'rgba(0,0,0,0.75)', color: '#cbd5e1', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }}>
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
                      <div key={actor.id} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.06)' }}>
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
                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }}>
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
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Título Original</span>
                    <h4 style={{ margin: '4px 0 0', color: '#fff', fontSize: '0.95rem' }}>{animeDetails?.original_name || animeDetails?.original_title || selectedAnime.title}</h4>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Estado</span>
                    <h4 style={{ margin: '4px 0 0', color: '#34d399', fontSize: '0.95rem' }}>{animeDetails?.status || 'En Emisión'}</h4>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Número de Temporadas</span>
                    <h4 style={{ margin: '4px 0 0', color: '#fff', fontSize: '0.95rem' }}>{animeDetails?.number_of_seasons || (animeDetails?.seasons?.length || 1)} Temporadas</h4>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Episodios Totales</span>
                    <h4 style={{ margin: '4px 0 0', color: '#fff', fontSize: '0.95rem' }}>{animeDetails?.number_of_episodes || 'Múltiples'} Episodios</h4>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Géneros</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {(animeDetails?.genres || []).map(g => (
                        <span key={g.id} style={{ background: 'rgba(229, 9, 20, 0.15)', border: '1px solid rgba(229, 9, 20, 0.35)', color: '#fca5a5', padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
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
