import React, { useState, useEffect, useMemo, useRef } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { SkeletonGrid } from './SkeletonLoader';
import { saveWatchProgress, toggleFavorite, isFavorite, getWatchHistory } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import { isLgTv } from '../utils/deviceDetect';
import curatedData from '../data/kdramas_curated.json';

const TMDB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiMGM4MjRjMmFkMzllODUwNmE5ZGUzOGI5ZTA2ZjJmZiIsIm5iZiI6MTc0ODI3MjY1Ni43MDMsInN1YiI6IjY4MzQ4NjEwNjFmMWZlZmI4YmViMzYxZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KUIiE74vCOP05_Y0M5CKyCBtj9m5lN1WzCfZ6bQn6Xs';
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const BACK = 'https://image.tmdb.org/t/p/original';
const HDR = { Authorization: `Bearer ${TMDB_KEY}` };

const VIMEUS_VIEW_KEY = 'KThsRRoYzOilpZpoAf-eQMKv1cN3ULOBQxPk6QmeL-A';
const VIMEUS_PARAMS = '&title=PIRU_TV&theme=red&font=v3&overlay=v5&selector=v3&playUI=v3&epanel=v3';

const PROXY_WORKER = 'https://pirutv-proxy.skillful-part.workers.dev';

// ── Nombres Oficiales de Servidores Nativos Doramasflix ──
const SERVER_NAMES = {
  "4721": "PrimeLoad ⚡",
  "69c690a20bef0992e5c91fa1": "PrimeLoad ⚡",
  "1113": "Voe",
  "60ac0f0eac46a43f59a5b220": "Voe",
  "38585": "Streamwish",
  "7286": "Streamwish",
  "1233": "Streamwish",
  "64b18fdc35461c5d64ef5b59": "Streamwish",
  "576857": "Filemoon",
  "1230": "Filemoon",
  "64b19a4035461c5d64ef5b84": "Filemoon",
  "60ac0eb8ac46a43f59a5b21f": "Streamtape",
  "60ac0d08ac46a43f59a5b21d": "Mixdrop",
  "60ac0f2eac46a43f59a5b221": "Uqload",
  "60ac0f52ac46a43f59a5b222": "Mp4Upload",
  "60ac0abeac46a43f59a5b21b": "Okru",
  "60ac0e7eac46a43f59a5b21e": "Dood",
  "1004": "Doodstream",
  "1007": "Lulustream",
  "65c6b7f9149d4675d1547a5c": "VidHide",
  "61707703fa461256758155c5": "Mega"
};

const LANG_NAMES = {
  "38": "Latino 🗣️",
  "13109": "Coreano 🇰🇷",
  "13110": "Japonés 🇯🇵",
  "13111": "Chino 🇨🇳",
  "13112": "Japonés/Tailandés 🇯🇵🇹🇭",
  "13113": "Taiwanés 🇹🇼",
  "36": "Inglés 🇬🇧"
};

const getPlayerUrl = (embed) => {
  if (!embed) return '';
  if (embed.includes('primeload.co')) {
    if (import.meta.env.DEV) {
      return embed.replace('https://primeload.co', '/primeload-proxy');
    } else {
      return embed.replace('https://primeload.co', PROXY_WORKER);
    }
  }
  return embed;
};

const getHostName = (url, server_ref) => {
  if (SERVER_NAMES[server_ref]) return SERVER_NAMES[server_ref];
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.replace('www.', '').split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch (e) {
    return "Servidor HD";
  }
};

const queryFlix = async (query, variables = {}) => {
  const endpoints = ['/api/gql', PROXY_WORKER];
  let lastErr = null;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data && !json.errors) return json;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('GraphQL request failed');
};

const DETAIL_DORAMA_EXTRA_QUERY = `
  query detailDoramaExtra($slug: String!, $season_number: Int!) {
    detailDorama(filter: { slug: $slug }) {
      _id
      name
      slug
      premiere
      overview
      name_es
      poster_path
      backdrop_path
    }
    listSeasons(sort: NUMBER_ASC, filter: { serie_slug: $slug }) {
      slug
      season_number
      poster_path
      air_date
      serie_name
    }
    listEpisodes(
      sort: NUMBER_ASC
      filter: {
        type_serie: DORAMA
        serie_slug: $slug
        season_number: $season_number
      }
    ) {
      _id
      name
      name_es
      slug
      episode_number
      languages
    }
  }
`;

const LINKS_FLIX_QUERY = `
  query GetEpisodeLinks($id: ID!, $app: String) {
    getEpisodeLinks(id: $id, app: $app) {
      links_online {
        _id
        link
        server
        lang
      }
    }
  }
`;

const MOVIE_LINKS_QUERY = `
  query getMovieLinks($id: ID!) {
    getMovieLinks(id: $id) {
      links_online {
        _id
        link
        server
        lang
      }
    }
  }
`;

const KDRAMA_CATEGORIES = [
  'Inicio',
  '⭐ Más Populares',
  '🍙 Doblaje Latino',
  '💬 Nuevos Estrenos',
  '💖 Romance & Comedia',
  '⚡ Acción & Suspenso',
  '🎬 Películas Asiáticas',
  '❤️ Mi Lista'
];

const CATEGORY_DISCOVER_MAP = {
  '⭐ Más Populares': '/discover/tv?with_original_language=ko&sort_by=popularity.desc&without_genres=10763,10767',
  '🍙 Doblaje Latino': '/discover/tv?with_original_language=ko&with_genres=18&sort_by=vote_count.desc&vote_count.gte=30',
  '💬 Nuevos Estrenos': '/discover/tv?with_original_language=ko&first_air_date.gte=2024-01-01&without_genres=10763,10767&sort_by=popularity.desc',
  '💖 Romance & Comedia': '/discover/tv?with_original_language=ko&with_genres=18,10749&sort_by=popularity.desc',
  '⚡ Acción & Suspenso': '/discover/tv?with_original_language=ko&with_genres=10759,9648&sort_by=popularity.desc',
  '🎬 Películas Asiáticas': '/discover/movie?with_original_language=ko&sort_by=popularity.desc'
};

export default function Kdramas() {
  const [activeCategory, setActiveCategory] = useState('Inicio');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  // Home curated rows preloaded from verified curated datasets
  const [homePopularKdramas, setHomePopularKdramas] = useState(() => (curatedData?.kdramas || []));
  const [homeLatinoDoramas, setHomeLatinoDoramas] = useState(() => (curatedData?.kdramas || []));
  const [homeRecentDoramas, setHomeRecentDoramas] = useState(() => (curatedData?.kdramas || []).slice(0, 15));
  const [homeRomanceDoramas, setHomeRomanceDoramas] = useState(() => (curatedData?.kdramas || []).slice(4, 20));
  const [homeActionDoramas, setHomeActionDoramas] = useState(() => (curatedData?.kdramas || []).slice(1, 16));
  const [homeAsianMovies, setHomeAsianMovies] = useState(() => (curatedData?.movies || []));

  // Billboard hero rotation
  const [heroIndex, setHeroIndex] = useState(0);

  // Category Grid & Pagination State
  const [gridItems, setGridItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // Watch history (isolated to kdramas)
  const [watchHistory, setWatchHistory] = useState(() => getWatchHistory('kdramas'));
  const searchInputRef = useRef(null);

  // Modal State
  const [selectedDrama, setSelectedDrama] = useState(null);
  const [seasonsList, setSeasonsList] = useState([]);
  const [activeSeason, setActiveSeason] = useState(1);
  const [episodesData, setEpisodesData] = useState([]);
  const [activeEpisode, setActiveEpisode] = useState(1);
  const [allEpisodeLinks, setAllEpisodeLinks] = useState([]);
  const [serversList, setServersList] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [activePlayerUrl, setActivePlayerUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [modalTab, setModalTab] = useState('player'); // 'player', 'details'

  // Focus search when triggered from global header
  useEffect(() => {
    const handleFocusSearch = (e) => {
      if (e.detail === 'kdramas') {
        searchInputRef.current?.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('focus-section-search', handleFocusSearch);
    return () => window.removeEventListener('focus-section-search', handleFocusSearch);
  }, []);

  // Fetch extensive live catalogue on mount from TMDB
  useEffect(() => {
    let isCancelled = false;

    const loadLiveCatalog = async () => {
      try {
        const fetchSection = async (endpoint, type = 'tv') => {
          const res = await fetch(`${TMDB}${endpoint}&language=es-MX&page=1`, { headers: HDR });
          if (!res.ok) return [];
          const data = await res.json();
          return (data.results || []).map(x => ({
            id: x.id,
            tmdbId: x.id,
            type: type === 'movie' ? 'movie' : 'dorama',
            title: x.name || x.title || x.original_name || x.original_title || 'Kdrama',
            original_title: x.original_name || x.original_title,
            poster: x.poster_path ? `${IMG}${x.poster_path}` : 'https://via.placeholder.com/300x450?text=Kdrama',
            backdrop: x.backdrop_path ? `${BACK}${x.backdrop_path}` : null,
            overview: x.overview || 'Disfruta de este aclamado drama asiático con audio latino y subtítulos.',
            year: (x.first_air_date || x.release_date || '').slice(0, 4) || '2024',
            rating: x.vote_average ? x.vote_average.toFixed(1) : '8.5',
            lang: 'LAT',
            match: `${Math.min(99, Math.round((x.vote_average || 8.5) * 10 + 10))}%`
          }));
        };

        const [livePopular, liveRecent, liveRomance, liveAction, liveMovies] = await Promise.all([
          fetchSection('/discover/tv?with_original_language=ko&sort_by=popularity.desc&without_genres=10763,10767', 'tv'),
          fetchSection('/discover/tv?with_original_language=ko&first_air_date.gte=2024-01-01&without_genres=10763,10767&sort_by=popularity.desc', 'tv'),
          fetchSection('/discover/tv?with_original_language=ko&with_genres=18,10749&sort_by=popularity.desc', 'tv'),
          fetchSection('/discover/tv?with_original_language=ko&with_genres=10759,9648&sort_by=popularity.desc', 'tv'),
          fetchSection('/discover/movie?with_original_language=ko&sort_by=popularity.desc', 'movie')
        ]);

        if (!isCancelled) {
          if (livePopular.length > 0) {
            const map = new Map();
            (curatedData?.kdramas || []).forEach(it => map.set(it.id, it));
            livePopular.forEach(it => map.set(it.id, it));
            const fullList = Array.from(map.values());
            setHomePopularKdramas(fullList);
            setHomeLatinoDoramas(fullList);
          }
          if (liveRecent.length > 0) setHomeRecentDoramas(liveRecent);
          if (liveRomance.length > 0) setHomeRomanceDoramas(liveRomance);
          if (liveAction.length > 0) setHomeActionDoramas(liveAction);
          if (liveMovies.length > 0) {
            const movieMap = new Map();
            (curatedData?.movies || []).forEach(m => movieMap.set(m.id, m));
            liveMovies.forEach(m => movieMap.set(m.id, m));
            setHomeAsianMovies(Array.from(movieMap.values()));
          }
        }
      } catch (err) {
        console.warn('Live Kdrama catalogue augmentation fallback:', err);
      }
    };

    loadLiveCatalog();
    return () => { isCancelled = true; };
  }, []);

  // Top 10 items for giant ranking row (guaranteed 10 items)
  const top10Kdramas = useMemo(() => {
    return homePopularKdramas.slice(0, 10);
  }, [homePopularKdramas]);

  // Hero billboard item & rotation
  const heroList = useMemo(() => {
    return homePopularKdramas.length > 0 ? homePopularKdramas.slice(0, 8) : [];
  }, [homePopularKdramas]);
  const heroItem = heroList[heroIndex] || heroList[0];

  useEffect(() => {
    if (isLgTv() || heroList.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroList.length);
    }, 7500);
    return () => clearInterval(timer);
  }, [heroList]);

  // Filtered continue watching for kdrama
  const continueWatchingKdramas = useMemo(() => {
    return (watchHistory || []).filter(item => 
      item.section === 'kdramas' || item.type === 'kdrama' || item.type === 'dorama'
    );
  }, [watchHistory]);

  // Load category grid when not in 'Inicio'
  useEffect(() => {
    if (activeCategory === 'Inicio' || activeCategory === '❤️ Mi Lista' || searchTerm.trim()) {
      return;
    }

    const loadCategory = async () => {
      setIsLoading(true);
      try {
        const path = CATEGORY_DISCOVER_MAP[activeCategory];
        if (!path) return;
        const isMovie = activeCategory === '🎬 Películas Asiáticas';

        const res = await fetch(`${TMDB}${path}&language=es-MX&page=${page}`, { headers: HDR });
        if (res.ok) {
          const data = await res.json();
          setTotalPages(Math.min(data.total_pages || 1, 100));
          const items = (data.results || []).map(x => ({
            id: x.id,
            tmdbId: x.id,
            type: isMovie ? 'movie' : 'dorama',
            title: x.name || x.title || x.original_name || x.original_title || 'Kdrama',
            original_title: x.original_name || x.original_title,
            poster: x.poster_path ? `${IMG}${x.poster_path}` : 'https://via.placeholder.com/300x450?text=Kdrama',
            backdrop: x.backdrop_path ? `${BACK}${x.backdrop_path}` : null,
            overview: x.overview || 'Sin descripción disponible.',
            year: (x.first_air_date || x.release_date || '').slice(0, 4) || '—',
            rating: x.vote_average ? x.vote_average.toFixed(1) : '8.0',
            lang: 'LAT',
            match: `${Math.min(99, Math.round((x.vote_average || 8.0) * 10 + 10))}%`
          }));
          setGridItems(items);
        }
      } catch (err) {
        console.error('Error fetching category kdramas:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCategory();
  }, [activeCategory, page, searchTerm]);

  // Live Search with Debounce (Search TMDB TV & Movies)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const query = encodeURIComponent(searchTerm.trim());
        const [tvRes, movieRes] = await Promise.all([
          fetch(`${TMDB}/search/tv?query=${query}&language=es-MX&page=1`, { headers: HDR }),
          fetch(`${TMDB}/search/movie?query=${query}&language=es-MX&page=1`, { headers: HDR })
        ]);

        const [tvData, movieData] = await Promise.all([
          tvRes.ok ? tvRes.json() : { results: [] },
          movieRes.ok ? movieRes.json() : { results: [] }
        ]);

        const isAsian = (item) => {
          return item.origin_country?.includes('KR') ||
                 item.origin_country?.includes('JP') ||
                 item.origin_country?.includes('CN') ||
                 item.original_language === 'ko' ||
                 item.original_language === 'ja' ||
                 item.original_language === 'zh';
        };

        const sortedTv = (tvData.results || []).sort((a, b) => (isAsian(b) ? 1 : 0) - (isAsian(a) ? 1 : 0));
        const sortedMovie = (movieData.results || []).sort((a, b) => (isAsian(b) ? 1 : 0) - (isAsian(a) ? 1 : 0));

        const tvItems = sortedTv.map(x => ({
          id: x.id,
          tmdbId: x.id,
          type: 'dorama',
          title: x.name || x.original_name,
          poster: x.poster_path ? `${IMG}${x.poster_path}` : 'https://via.placeholder.com/300x450?text=Kdrama',
          backdrop: x.backdrop_path ? `${BACK}${x.backdrop_path}` : null,
          overview: x.overview || 'Sin descripción disponible.',
          year: (x.first_air_date || '').slice(0, 4) || '—',
          rating: x.vote_average ? x.vote_average.toFixed(1) : '8.0',
          lang: 'LAT',
          match: `${Math.min(99, Math.round((x.vote_average || 8.0) * 10 + 10))}%`
        }));

        const movieItems = sortedMovie.map(x => ({
          id: x.id,
          tmdbId: x.id,
          type: 'movie',
          title: x.title || x.original_title,
          poster: x.poster_path ? `${IMG}${x.poster_path}` : 'https://via.placeholder.com/300x450?text=Película',
          backdrop: x.backdrop_path ? `${BACK}${x.backdrop_path}` : null,
          overview: x.overview || 'Sin descripción disponible.',
          year: (x.release_date || '').slice(0, 4) || '—',
          rating: x.vote_average ? x.vote_average.toFixed(1) : '8.0',
          lang: 'LAT',
          match: `${Math.min(99, Math.round((x.vote_average || 8.0) * 10 + 10))}%`
        }));

        setSearchResults([...tvItems, ...movieItems]);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Current items for active view
  const currentRenderItems = useMemo(() => {
    if (searchTerm.trim()) return searchResults;
    if (activeCategory === '❤️ Mi Lista') {
      return homePopularKdramas.filter(d => isFavorite(d.id));
    }
    return gridItems;
  }, [searchTerm, searchResults, activeCategory, homePopularKdramas, gridItems]);

  // Format streaming servers: combines native Doramasflix servers with reliable backups
  const handleServerClick = (server) => {
    setActiveServer(server);
    if (server && server.embed) {
      setActivePlayerUrl(getPlayerUrl(server.embed));
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (!selectedDrama) {
      setServersList([]);
      setActiveServer(null);
      setActivePlayerUrl('');
      return;
    }

    const tmdbId = selectedDrama.tmdbId || selectedDrama.id;
    const isMovie = selectedDrama.type === 'movie';
    const s = activeSeason || 1;
    const e = activeEpisode || 1;

    // 1. Native Doramasflix servers from GraphQL if available
    const validLinks = (allEpisodeLinks || []).filter(l => (l.embed || l.link) && l.is_active !== false);
    const isLatino = (l) => String(l.lang) === '38' || l.language_code === 'es';
    const sortedLinks = [...validLinks].sort((a, b) => {
      const aLat = isLatino(a);
      const bLat = isLatino(b);
      if (aLat && !bLat) return -1;
      if (!aLat && bLat) return 1;
      return 0;
    });

    const flixServers = sortedLinks.map(l => {
      const rawUrl = l.embed || l.link;
      const lat = isLatino(l);
      return {
        hash: l._id || rawUrl,
        name: getHostName(rawUrl, l.server_ref),
        embed: rawUrl,
        lang: l.lang,
        isLat: lat,
        langLabel: lat ? '🇲🇽 LAT' : '💬 SUB'
      };
    });

    // 2. Default original suite of servers: PrimeLoad, Voe, Streamwish, Filemoon, Streamtape, UnLimPlay, CineSrc, VidSrc HD, Vimeus
    const defaultServers = [
      {
        hash: `primeload_${tmdbId}_${s}_${e}`,
        name: 'PrimeLoad ⚡',
        embed: `https://unlimplay.com/f/embed/${isMovie ? 'movie' : 'tv'}/${tmdbId}${!isMovie ? `/${s}/${e}` : ''}`,
        langLabel: '🇲🇽 LAT',
        isLat: true
      },
      {
        hash: `voe_${tmdbId}_${s}_${e}`,
        name: 'Voe',
        embed: `https://unlimplay.com/f/embed/${isMovie ? 'movie' : 'tv'}/${tmdbId}${!isMovie ? `/${s}/${e}` : ''}`,
        langLabel: '🇲🇽 LAT',
        isLat: true
      },
      {
        hash: `streamwish_${tmdbId}_${s}_${e}`,
        name: 'Streamwish',
        embed: `https://unlimplay.com/f/embed/${isMovie ? 'movie' : 'tv'}/${tmdbId}${!isMovie ? `/${s}/${e}` : ''}`,
        langLabel: '🇲🇽 LAT',
        isLat: true
      },
      {
        hash: `filemoon_${tmdbId}_${s}_${e}`,
        name: 'Filemoon',
        embed: `https://unlimplay.com/f/embed/${isMovie ? 'movie' : 'tv'}/${tmdbId}${!isMovie ? `/${s}/${e}` : ''}`,
        langLabel: '🇲🇽 LAT',
        isLat: true
      },
      {
        hash: `streamtape_${tmdbId}_${s}_${e}`,
        name: 'Streamtape',
        embed: `https://cinesrc.st/embed/${isMovie ? 'movie' : 'tv'}/${tmdbId}${!isMovie ? `?s=${s}&e=${e}` : ''}`,
        langLabel: '💬 SUB',
        isLat: false
      },
      {
        hash: `unlimplay_${tmdbId}_${s}_${e}`,
        name: 'UnLimPlay',
        embed: `https://unlimplay.com/f/embed/${isMovie ? 'movie' : 'tv'}/${tmdbId}${!isMovie ? `/${s}/${e}` : ''}`,
        langLabel: '🇲🇽 LAT 1080p',
        isLat: true
      },
      {
        hash: `cinesrc_${tmdbId}_${s}_${e}`,
        name: 'CineSrc',
        embed: isMovie ? `https://cinesrc.st/embed/movie/${tmdbId}?color=%23e50914` : `https://cinesrc.st/embed/tv/${tmdbId}?s=${s}&e=${e}&color=%23e50914`,
        langLabel: '⚡ SUB',
        isLat: false
      },
      {
        hash: `vidsrc_${tmdbId}_${s}_${e}`,
        name: 'VidSrc HD',
        embed: isMovie ? `https://vidsrc.me/embed/movie?tmdb=${tmdbId}` : `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${s}&episode=${e}`,
        langLabel: '🚀 1080p',
        isLat: true
      },
      {
        hash: `vimeus_${tmdbId}_${s}_${e}`,
        name: 'Vimeus',
        embed: isMovie 
          ? `https://vimeus.com/e/movie?tmdb=${tmdbId}&view_key=${encodeURIComponent(VIMEUS_VIEW_KEY)}${VIMEUS_PARAMS}` 
          : `https://vimeus.com/e/serie?tmdb=${tmdbId}&se=${s}&ep=${e}&view_key=${encodeURIComponent(VIMEUS_VIEW_KEY)}${VIMEUS_PARAMS}`,
        langLabel: '🇲🇽 LAT',
        isLat: true
      }
    ];

    // Merge: Put native Doramasflix servers first, followed by backup suite
    const combined = flixServers.length > 0 
      ? [...flixServers, ...defaultServers.filter(d => !flixServers.some(f => f.name.toLowerCase().startsWith(d.name.toLowerCase().slice(0, 4))))]
      : defaultServers;

    setServersList(combined);
    if (combined.length > 0) {
      setActiveServer(combined[0]);
      setActivePlayerUrl(getPlayerUrl(combined[0].embed));
    }
  }, [allEpisodeLinks, selectedDrama, activeSeason, activeEpisode]);

  // Persist watch progress on active server url
  useEffect(() => {
    if (selectedDrama && activePlayerUrl) {
      saveWatchProgress({
        id: selectedDrama.tmdbId || selectedDrama.id,
        title: selectedDrama.title,
        poster: selectedDrama.poster,
        backdrop: selectedDrama.backdrop,
        type: selectedDrama.type || 'kdrama',
        section: 'kdramas',
        season: activeSeason,
        episode: activeEpisode
      }, 'kdramas');
      setWatchHistory(getWatchHistory('kdramas'));
    }
  }, [selectedDrama, activePlayerUrl, activeSeason, activeEpisode]);

  // Fetch season episodes from TMDB
  const fetchSeasonEpisodes = async (tvId, seasonNum) => {
    setIsDetailsLoading(true);
    try {
      const res = await fetch(`${TMDB}/tv/${tvId}/season/${seasonNum}?language=es-MX`, { headers: HDR });
      if (!res.ok) throw new Error('Failed to load season');
      const data = await res.json();
      const eps = (data.episodes || []).map(e => ({
        id: e.id,
        episode_number: e.episode_number,
        name: e.name || `Episodio ${e.episode_number}`,
        overview: e.overview || '',
        still_path: e.still_path ? `${IMG}${e.still_path}` : null
      }));
      if (eps.length > 0) {
        setEpisodesData(eps);
        setActiveEpisode(eps[0].episode_number);
      } else {
        throw new Error('No episodes returned from TMDB');
      }
    } catch (err) {
      console.warn('Fallback episodes generation for season', seasonNum);
      const fallbackList = Array.from({ length: 16 }, (_, i) => ({
        id: `fb_${seasonNum}_${i + 1}`,
        episode_number: i + 1,
        name: `Episodio ${i + 1}`,
        overview: `Episodio ${i + 1} de la temporada ${seasonNum}.`,
        still_path: null
      }));
      setEpisodesData(fallbackList);
      setActiveEpisode(1);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  // Handle open drama modal and load seasons & episodes
  const handleOpenDrama = async (drama, autoPlay = true) => {
    const tmdbId = drama.tmdbId || drama.id;
    const targetSeason = Number(drama.season) || 1;
    const targetEpisode = Number(drama.episode) || 1;

    setIsDetailsLoading(true);
    setSelectedDrama(drama);
    setSeasonsList([]);
    setActiveSeason(targetSeason);
    setEpisodesData([]);
    setActiveEpisode(targetEpisode);
    setAllEpisodeLinks([]);
    setServersList([]);
    setActiveServer(null);
    setActivePlayerUrl('');
    setIsPlaying(autoPlay);
    setModalTab('player');

    saveWatchProgress({
      id: tmdbId,
      title: drama.title,
      poster: drama.poster,
      backdrop: drama.backdrop,
      type: drama.type || 'dorama',
      section: 'kdramas',
      season: targetSeason,
      episode: targetEpisode
    }, 'kdramas');
    setWatchHistory(getWatchHistory('kdramas'));

    try {
      // 1. If drama has slug, attempt native Doramasflix episode links query in parallel
      if (drama.slug) {
        if (drama.type === 'movie') {
          queryFlix(MOVIE_LINKS_QUERY, { id: drama.id }).then(res => {
            const links = res.data?.getMovieLinks?.links_online || [];
            if (links.length > 0) setAllEpisodeLinks(links);
          }).catch(() => {});
        } else {
          queryFlix(DETAIL_DORAMA_EXTRA_QUERY, { slug: drama.slug, season_number: targetSeason }).then(async res => {
            if (res.data) {
              const episodes = res.data.listEpisodes || [];
              if (episodes.length > 0) {
                const linksRes = await queryFlix(LINKS_FLIX_QUERY, { id: episodes[0]._id, app: 'com.asiapp.doramasgo' });
                const links = linksRes.data?.getEpisodeLinks?.links_online || [];
                if (links.length > 0) setAllEpisodeLinks(links);
              }
            }
          }).catch(() => {});
        }
      }

      if (drama.type === 'movie') {
        setIsDetailsLoading(false);
        return;
      }

      // 2. Fetch TMDB details for seasons & episodes
      const res = await fetch(`${TMDB}/tv/${tmdbId}?language=es-MX`, { headers: HDR });
      if (res.ok) {
        const data = await res.json();
        const validSeasons = (data.seasons || []).filter(s => s.season_number > 0);
        setSeasonsList(validSeasons.length > 0 ? validSeasons : [{ season_number: 1, name: 'Temporada 1', episode_count: 16 }]);
        await fetchSeasonEpisodes(tmdbId, targetSeason);
      } else {
        setSeasonsList([{ season_number: 1, name: 'Temporada 1', episode_count: 16 }]);
        await fetchSeasonEpisodes(tmdbId, targetSeason);
      }
    } catch (err) {
      console.error('Error opening drama details:', err);
      setSeasonsList([{ season_number: 1, name: 'Temporada 1', episode_count: 16 }]);
      await fetchSeasonEpisodes(tmdbId, targetSeason);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  // Handle external open event (e.g. from Mi Lista or Mi Cuenta)
  useEffect(() => {
    const handleRemoteOpen = (e) => {
      if (e.detail?.tab === 'kdramas' && e.detail?.item) {
        handleOpenDrama(e.detail.item, true);
      }
    };
    window.addEventListener('open-piru-item', handleRemoteOpen);
    return () => {
      window.removeEventListener('open-piru-item', handleRemoteOpen);
    };
  }, []);

  // Change season
  const handleSeasonChange = async (seasonNum) => {
    if (!selectedDrama || selectedDrama.type === 'movie') return;
    setActiveSeason(seasonNum);
    setActiveEpisode(1);
    setAllEpisodeLinks([]);
    const tmdbId = selectedDrama.tmdbId || selectedDrama.id;
    await fetchSeasonEpisodes(tmdbId, seasonNum);
  };

  // Change episode
  const handleEpisodeChange = async (epNum) => {
    setActiveEpisode(epNum);
    setIsPlaying(true);
    setAllEpisodeLinks([]);

    if (selectedDrama) {
      saveWatchProgress({
        id: selectedDrama.tmdbId || selectedDrama.id,
        title: selectedDrama.title,
        poster: selectedDrama.poster,
        backdrop: selectedDrama.backdrop,
        type: selectedDrama.type || 'dorama',
        section: 'kdramas',
        season: activeSeason,
        episode: epNum
      }, 'kdramas');
      setWatchHistory(getWatchHistory('kdramas'));
    }
  };

  // Next / Prev Episode
  const handlePrevEpisode = () => {
    if (activeEpisode > 1) {
      handleEpisodeChange(activeEpisode - 1);
    }
  };

  const handleNextEpisode = () => {
    if (activeEpisode < episodesData.length) {
      handleEpisodeChange(activeEpisode + 1);
    }
  };

  // Handle Smart TV remote D-Pad back key
  useDpadNavigation({
    onBack: () => {
      if (selectedDrama) {
        setSelectedDrama(null);
        setIsPlaying(false);
      }
    }
  });

  // Pagination navigation helper
  const goToPage = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      setPage(newPage);
      window.scrollTo({ top: 350, behavior: 'smooth' });
    }
  };

  const getPaginationList = (curr, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (curr <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (curr >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', curr - 1, curr, curr + 1, '...', total];
  };

  const pagesToRender = useMemo(() => getPaginationList(page, totalPages), [page, totalPages]);

  return (
    <div className="kdramas-container netflix-view" style={{ minHeight: '100vh', background: '#141414', color: '#fff' }}>
      
      {/* Netflix Subnav Bar: Category Pills & Section-Scoped Search */}
      <div className="netflix-subnav-bar">
        <div className="netflix-subnav-categories">
          {KDRAMA_CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              className={`filter-badge ${(activeCategory === cat && !searchTerm) ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory(cat);
                setSearchTerm('');
                setPage(1);
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

        {/* Section Search Bar */}
        <div className="netflix-subnav-search">
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}>🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar en Kdramas y doramas..."
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
                  <span className="netflix-rank-text">N.º {heroIndex + 1} en kdramas hoy</span>
                </div>

                <h1 className="netflix-hero-title">{heroItem.title}</h1>

                <div className="netflix-meta-row">
                  <span className="netflix-match">{heroItem.match || '98% de coincidencia'}</span>
                  <span>{heroItem.year}</span>
                  <span className="netflix-badge-age">16+</span>
                  <span>FULL HD</span>
                  <span className="netflix-badge-tech">5.1</span>
                  <span className="netflix-badge-tech">Audio Latino & Coreano</span>
                </div>

                <p className="netflix-hero-synopsis">
                  {heroItem.overview || `Disfruta de ${heroItem.title} completo en alta definición Full HD con todas las temporadas y episodios en español latino.`}
                </p>

                <div className="netflix-hero-actions">
                  <button 
                    className="btn-netflix-play" 
                    onClick={() => {
                      handleOpenDrama(heroItem);
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
                      handleOpenDrama(heroItem);
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
                    title={isFavorite(heroItem.id) ? 'En Mi Lista' : 'Añadir a Mi Lista'}
                    onClick={async () => {
                      await toggleFavorite(heroItem);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                      {isFavorite(heroItem.id) ? 'check' : 'add'}
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

          {/* Netflix Content Rows Container */}
          <div className="netflix-rows-container" style={{ marginTop: heroItem ? '-3.5rem' : '1.5rem', position: 'relative', zIndex: 10 }}>
            
            {/* Row 0: Continuar Viendo */}
            {continueWatchingKdramas.length > 0 && (
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
                  {continueWatchingKdramas.map((item) => (
                    <div 
                      key={`continue-${item.id}`} 
                      className="netflix-continue-card"
                      onClick={() => handleOpenDrama(item)}
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
                        <div className="netflix-progress-fill" style={{ width: `${item.progress || 70}%` }} />
                      </div>
                      <div className="netflix-continue-info">
                        <span className="netflix-continue-title">{item.title}</span>
                        <span className="netflix-continue-sub">
                          {item.season && item.episode ? `T${item.season}:E${item.episode}` : (item.type === 'movie' ? 'Película' : 'Continuar')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Row 1: Top 10 Kdramas con números gigantes */}
            {top10Kdramas.length > 0 && (
              <section className="netflix-row-section">
                <div className="netflix-row-header">
                  <h2 className="netflix-row-title">
                    Los 10 kdramas más populares hoy en PiruTV
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                      chevron_right
                    </span>
                  </h2>
                </div>
                <div className="netflix-top10-grid">
                  {top10Kdramas.map((item, index) => (
                    <div 
                      key={`top10-${item.id}-${index}`} 
                      className="netflix-top10-item"
                      onClick={() => handleOpenDrama(item)}
                    >
                      <span className="netflix-top-num">{index + 1}</span>
                      <div className="netflix-top-poster">
                        <img src={item.poster} alt={item.title} loading="lazy" decoding="async" />
                        <div className="netflix-card-top10-badge">TOP 10</div>
                        <div className="netflix-card-lang-strip">
                          <span className="netflix-pill-lat">LAT</span>
                          <span className="netflix-pill-cast">COR</span>
                          <span className="netflix-pill-sub">SUB</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Row 2: Doramas en Latino */}
            {homeLatinoDoramas.length > 0 && (
              <section className="netflix-row-section">
                <div className="netflix-row-header">
                  <h2 
                    className="netflix-row-title"
                    onClick={() => {
                      setActiveCategory('🍙 Doblaje Latino');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    🍙 Kdramas Populares con Doblaje Latino
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                      chevron_right
                    </span>
                  </h2>
                  <button 
                    className="netflix-explore-all"
                    onClick={() => {
                      setActiveCategory('🍙 Doblaje Latino');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Explorar todos
                  </button>
                </div>
                <div className="netflix-category-scroll">
                  {homeLatinoDoramas.map((item) => (
                    <button 
                      type="button"
                      key={`scroll-lat-${item.id}`} 
                      className="netflix-poster-card"
                      onClick={() => handleOpenDrama(item)}
                    >
                      <div className="netflix-poster-img-wrap">
                        <img src={item.poster} alt={item.title} loading="lazy" decoding="async" />
                        <div className="netflix-quality-tag">FULL HD</div>
                        <div className="netflix-card-lang-strip">
                          <span className="netflix-pill-lat">LATINO</span>
                        </div>
                      </div>
                      <span className="netflix-poster-title">{item.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Row 3: Doramas en Emisión y Nuevos Estrenos */}
            {homeRecentDoramas.length > 0 && (
              <section className="netflix-row-section">
                <div className="netflix-row-header">
                  <h2 
                    className="netflix-row-title"
                    onClick={() => {
                      setActiveCategory('💬 Nuevos Estrenos');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    💬 Doramas en Emisión y Nuevos Estrenos
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                      chevron_right
                    </span>
                  </h2>
                  <button 
                    className="netflix-explore-all"
                    onClick={() => {
                      setActiveCategory('💬 Nuevos Estrenos');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Explorar todos
                  </button>
                </div>
                <div className="netflix-category-scroll">
                  {homeRecentDoramas.map((item) => (
                    <button 
                      type="button"
                      key={`scroll-rec-${item.id}`} 
                      className="netflix-poster-card"
                      onClick={() => handleOpenDrama(item)}
                    >
                      <div className="netflix-poster-img-wrap">
                        <img src={item.poster} alt={item.title} loading="lazy" decoding="async" />
                        <div className="netflix-quality-tag">NUEVO</div>
                        <div className="netflix-card-lang-strip">
                          <span className="netflix-pill-sub">SUB / LAT</span>
                        </div>
                      </div>
                      <span className="netflix-poster-title">{item.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Row 4: Kdramas de Romance y Comedia */}
            {homeRomanceDoramas.length > 0 && (
              <section className="netflix-row-section">
                <div className="netflix-row-header">
                  <h2 
                    className="netflix-row-title"
                    onClick={() => {
                      setActiveCategory('💖 Romance & Comedia');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    💖 Kdramas de Romance y Comedia Romántica
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                      chevron_right
                    </span>
                  </h2>
                  <button 
                    className="netflix-explore-all"
                    onClick={() => {
                      setActiveCategory('💖 Romance & Comedia');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Explorar todos
                  </button>
                </div>
                <div className="netflix-category-scroll">
                  {homeRomanceDoramas.map((item) => (
                    <button 
                      type="button"
                      key={`scroll-rom-${item.id}`} 
                      className="netflix-poster-card"
                      onClick={() => handleOpenDrama(item)}
                    >
                      <div className="netflix-poster-img-wrap">
                        <img src={item.poster} alt={item.title} loading="lazy" decoding="async" />
                        <div className="netflix-quality-tag">ROMANCE</div>
                        <div className="netflix-card-lang-strip">
                          <span className="netflix-pill-lat">LATINO</span>
                        </div>
                      </div>
                      <span className="netflix-poster-title">{item.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Row 5: Kdramas de Acción y Suspenso */}
            {homeActionDoramas.length > 0 && (
              <section className="netflix-row-section">
                <div className="netflix-row-header">
                  <h2 
                    className="netflix-row-title"
                    onClick={() => {
                      setActiveCategory('⚡ Acción & Suspenso');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    ⚡ Kdramas de Acción, Suspenso y Fantasía
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                      chevron_right
                    </span>
                  </h2>
                  <button 
                    className="netflix-explore-all"
                    onClick={() => {
                      setActiveCategory('⚡ Acción & Suspenso');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Explorar todos
                  </button>
                </div>
                <div className="netflix-category-scroll">
                  {homeActionDoramas.map((item) => (
                    <button 
                      type="button"
                      key={`scroll-act-${item.id}`} 
                      className="netflix-poster-card"
                      onClick={() => handleOpenDrama(item)}
                    >
                      <div className="netflix-poster-img-wrap">
                        <img src={item.poster} alt={item.title} loading="lazy" decoding="async" />
                        <div className="netflix-quality-tag">ACCIÓN</div>
                        <div className="netflix-card-lang-strip">
                          <span className="netflix-pill-lat">LATINO</span>
                        </div>
                      </div>
                      <span className="netflix-poster-title">{item.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Row 6: Películas Asiáticas y Cine Coreano */}
            {homeAsianMovies.length > 0 && (
              <section className="netflix-row-section">
                <div className="netflix-row-header">
                  <h2 
                    className="netflix-row-title"
                    onClick={() => {
                      setActiveCategory('🎬 Películas Asiáticas');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    🎬 Películas Asiáticas y Cine Coreano
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                      chevron_right
                    </span>
                  </h2>
                  <button 
                    className="netflix-explore-all"
                    onClick={() => {
                      setActiveCategory('🎬 Películas Asiáticas');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Explorar todos
                  </button>
                </div>
                <div className="netflix-category-scroll">
                  {homeAsianMovies.map((item) => (
                    <button 
                      type="button"
                      key={`scroll-mov-${item.id}`} 
                      className="netflix-poster-card"
                      onClick={() => handleOpenDrama(item)}
                    >
                      <div className="netflix-poster-img-wrap">
                        <img src={item.poster} alt={item.title} loading="lazy" decoding="async" />
                        <div className="netflix-quality-tag">CINE</div>
                        <div className="netflix-card-lang-strip">
                          <span className="netflix-pill-lat">LATINO</span>
                        </div>
                      </div>
                      <span className="netflix-poster-title">{item.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

          </div>
        </>
      ) : (
        /* CATEGORY OR SEARCH RESULTS GRID VIEW */
        <div className="search-results-section" style={{ padding: '2rem 3rem 5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>
              {searchTerm.trim() ? `Resultados para "${searchTerm}"` : activeCategory}
            </h2>

            {isLoading && (
              <span style={{ fontSize: '0.85rem', color: '#e50914', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="pulse-dot" /> Cargando catálogo...
              </span>
            )}
          </div>

          {/* Grid of Posters */}
          <div className="media-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.25rem' }}>
            {currentRenderItems.length > 0 ? (
              currentRenderItems.map((item, idx) => (
                <button
                  type="button"
                  key={`grid-${item.id}-${idx}`}
                  className="netflix-poster-card"
                  onClick={() => handleOpenDrama(item)}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  <div className="netflix-poster-img-wrap" style={{ width: '100%', height: '260px' }}>
                    <img src={item.poster} alt={item.title} loading="lazy" decoding="async" />
                    <div className="netflix-quality-tag">{item.rating ? `★ ${item.rating}` : 'HD'}</div>
                    <div className="netflix-card-lang-strip">
                      <span className="netflix-pill-lat">{item.lang || 'LAT'}</span>
                    </div>
                  </div>
                  <span className="netflix-poster-title" style={{ marginTop: '0.5rem', fontWeight: 700, fontSize: '0.88rem' }}>
                    {item.title}
                  </span>
                </button>
              ))
            ) : (
              <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '5rem 2rem', textAlign: 'center' }}>
                <span className="empty-icon">🍙</span>
                <h3 className="empty-title">No se encontraron kdramas</h3>
                <p style={{ color: '#a3a3a3' }}>Intenta buscando con otro término o explorando otra sección.</p>
              </div>
            )}
          </div>

          {/* Dynamic Pagination Bar */}
          {!searchTerm && activeCategory !== '❤️ Mi Lista' && totalPages > 1 && (
            <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem', margin: '3.5rem 0 2rem' }}>
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || isLoading}
                style={{
                  background: page > 1 ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  color: page > 1 ? '#fff' : 'rgba(255, 255, 255, 0.25)',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '8px',
                  cursor: page > 1 && !isLoading ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  opacity: page > 1 ? 1 : 0.4,
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

                const isCurrent = p === page;
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
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || isLoading}
                style={{
                  background: page < totalPages ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  color: page < totalPages ? '#fff' : 'rgba(255, 255, 255, 0.25)',
                  padding: '0.6rem 1.25rem',
                  borderRadius: '8px',
                  cursor: page < totalPages && !isLoading ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  opacity: page < totalPages ? 1 : 0.4,
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

      {/* NETFLIX STREAMING & EPISODES MODAL */}
      {selectedDrama && (
        <div className="modal-overlay" onClick={() => { setSelectedDrama(null); setIsPlaying(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '980px' }}>
            <button className="modal-close-btn" onClick={() => { setSelectedDrama(null); setIsPlaying(false); }}>✕</button>

            {/* Video Player Container */}
            <div className="movie-player-container">
              {isPlaying ? (
                activePlayerUrl ? (
                  <iframe
                    src={activePlayerUrl}
                    className="player-iframe"
                    title={`${selectedDrama.title} - ${activeEpisode}`}
                    allowFullScreen
                    allow="autoplay; encrypted-media; picture-in-picture"
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '380px', background: '#0a0a0f', color: '#fff', gap: '1rem', padding: '2rem' }}>
                    {isDetailsLoading ? (
                      <>
                        <div className="pulse-dot" style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e50914', boxShadow: '0 0 25px rgba(229, 9, 20, 0.8)' }} />
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>
                          Cargando servidor y enlaces de reproducción...
                        </span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '2.5rem' }}>⚠️</span>
                        <strong style={{ fontSize: '1.05rem', color: '#f87171' }}>No se pudo conectar con el servidor</strong>
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', maxWidth: '400px' }}>
                          Intenta seleccionando otra opción en los servidores disponibles o cambia de episodio.
                        </span>
                      </>
                    )}
                  </div>
                )
              ) : (
                <button
                  type="button"
                  className="player-placeholder-btn"
                  style={{
                    backgroundImage: `linear-gradient(to top, rgba(11, 12, 22, 0.95) 0%, rgba(11, 12, 22, 0.45) 50%, rgba(11, 12, 22, 0.75) 100%), url(${selectedDrama.backdrop || selectedDrama.poster})`,
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
                    Haga clic para reproducir {selectedDrama.type !== 'movie' ? `Episodio ${activeEpisode}` : selectedDrama.title}
                  </strong>
                </button>
              )}
            </div>

            {/* Modal Navigation Tabs */}
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
                        {selectedDrama.title} 
                        {selectedDrama.type !== 'movie' && ` - Temp. ${activeSeason}, Ep. ${activeEpisode}`}
                      </span>
                    </div>

                    <div className="latino-notice-pill">
                      <span>🗣️</span>
                      <span><strong>Servidores Disponibles:</strong> {serversList.length} opciones en línea.</span>
                    </div>
                  </div>

                  <div className="server-selector-row">
                    {serversList.length > 0 ? (
                      serversList.map((srv, idx) => (
                        <button
                          key={`srv-${idx}-${srv.hash}`}
                          type="button"
                          className={`server-pill-btn ${activeServer?.hash === srv.hash ? 'active' : ''}`}
                          onClick={() => handleServerClick(srv)}
                        >
                          <span className="server-pill-name">{srv.name}</span>
                          <span className="server-pill-lang">{srv.langLabel}</span>
                        </button>
                      ))
                    ) : (
                      <div style={{ color: '#a3a3a3', fontSize: '0.85rem', padding: '0.4rem 0' }}>
                        {isDetailsLoading ? 'Cargando servidores...' : 'No hay servidores disponibles para este episodio.'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Zapping bar when playing */}
                {isPlaying && selectedDrama.type !== 'movie' && episodesData.length > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '8px 16px', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <button
                      onClick={handlePrevEpisode}
                      disabled={activeEpisode <= 1 || isDetailsLoading}
                      style={{ background: 'none', border: 'none', color: activeEpisode <= 1 ? '#64748b' : '#fff', cursor: activeEpisode <= 1 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                    >
                      ⏮ Episodio Anterior
                    </button>
                    <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>
                      Temporada {activeSeason} • Episodio {activeEpisode}
                    </span>
                    <button
                      onClick={handleNextEpisode}
                      disabled={activeEpisode >= episodesData.length || isDetailsLoading}
                      style={{ background: 'none', border: 'none', color: activeEpisode >= episodesData.length ? '#64748b' : '#fff', cursor: activeEpisode >= episodesData.length ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                    >
                      Siguiente Episodio ⏭
                    </button>
                  </div>
                )}

                {/* Episodes Section (ONLY FOR SERIES / DORAMAS) */}
                {selectedDrama.type !== 'movie' && (
                  <div className="episodes-container" style={{ borderRadius: '12px', padding: '1.25rem' }}>
                    <div className="episodes-top-row">
                      <span className="episodes-heading" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>
                        Seleccionar Temporada
                      </span>

                      {seasonsList.length > 1 ? (
                        <select 
                          className="season-dropdown"
                          value={activeSeason}
                          onChange={(e) => handleSeasonChange(Number(e.target.value))}
                        >
                          {seasonsList.map(s => (
                            <option key={`s-${s.season_number}`} value={s.season_number}>
                              Temporada {s.season_number} {s.episode_count ? `(${s.episode_count} eps)` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Temporada 1</span>
                      )}
                    </div>

                    {/* Quick Episode Bubbles Row */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '0.78rem', color: '#a3a3a3', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                        SALTO RÁPIDO A EPISODIO ({episodesData.length} CAPÍTULOS):
                      </span>
                      <div className="episodes-bubbles-row">
                        {episodesData.map(ep => (
                          <button
                            key={`bubble-${ep.id || ep.episode_number}`}
                            className={`episode-bubble-btn ${activeEpisode === ep.episode_number ? 'active' : ''}`}
                            onClick={() => handleEpisodeChange(ep.episode_number)}
                          >
                            {ep.episode_number}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Episodes List */}
                    <div>
                      <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 800, display: 'block', marginBottom: '0.75rem' }}>
                        LISTA DE EPISODIOS:
                      </span>
                      {isDetailsLoading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          <span className="pulse-dot" /> Cargando episodios...
                        </div>
                      ) : (
                        <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.85rem', paddingRight: '0.4rem' }}>
                          {episodesData.map(ep => {
                            const isCurrent = activeEpisode === ep.episode_number;
                            return (
                              <button
                                key={`list-${ep.id || ep.episode_number}`}
                                type="button"
                                onClick={() => handleEpisodeChange(ep.episode_number)}
                                style={{
                                  background: isCurrent ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.04)',
                                  border: `1.5px solid ${isCurrent ? '#e50914' : 'rgba(255,255,255,0.08)'}`,
                                  borderRadius: '8px',
                                  padding: '0.85rem 1rem',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '0.5rem'
                                }}
                              >
                                <div>
                                  <strong style={{ fontSize: '0.9rem', color: isCurrent ? '#f87171' : '#fff', display: 'block' }}>
                                    Episodio {ep.episode_number}
                                  </strong>
                                  <span style={{ fontSize: '0.75rem', color: '#a3a3a3' }}>
                                    {ep.name || `Capítulo ${ep.episode_number}`}
                                  </span>
                                </div>
                                <span style={{ fontSize: '0.8rem', color: isCurrent ? '#e50914' : '#64748b' }}>
                                  {isCurrent ? '▶' : '▷'}
                                </span>
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
                    <span className="modal-badge-type drama">
                      {selectedDrama.type === 'movie' ? '🎬 PELÍCULA ASIÁTICA' : '📺 KDRAMA'}
                    </span>
                    {selectedDrama.year && <span className="modal-badge-meta">{selectedDrama.year}</span>}
                    <span className="modal-badge-meta">FULL HD</span>
                    <span className="modal-badge-meta">Doblaje Latino & Sub</span>
                  </div>

                  <h2 className="modal-main-title">{selectedDrama.title}</h2>
                  <p className="modal-overview-text">
                    {selectedDrama.overview || 'Sin descripción disponible.'}
                  </p>

                  <div className="modal-actions-row">
                    <button
                      type="button"
                      className="modal-action-btn secondary"
                      onClick={() => castWithWebVideoCaster(activePlayerUrl, `${selectedDrama.title} - Ep ${activeEpisode}`)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cast</span>
                      Ver en Web Video Caster
                    </button>
                    <button
                      type="button"
                      className="modal-action-btn secondary"
                      onClick={async () => {
                        await toggleFavorite(selectedDrama);
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                        {isFavorite(selectedDrama.tmdbId || selectedDrama.id) ? 'check' : 'add'}
                      </span>
                      {isFavorite(selectedDrama.tmdbId || selectedDrama.id) ? 'En Mi Lista' : 'Añadir a Mi Lista'}
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: FICHA TÉCNICA */}
            {modalTab === 'details' && (
              <div className="modal-tab-body" style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', color: '#fff' }}>
                  Detalles del Dorama
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Título Original</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 600, color: '#f1f5f9' }}>{selectedDrama.original_title || selectedDrama.title}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Año de Estreno</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 600, color: '#f1f5f9' }}>{selectedDrama.year || '2024'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Calificación</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 700, color: '#e50914' }}>★ {selectedDrama.rating || '8.5'} / 10</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Idioma</span>
                    <p style={{ margin: '4px 0 0', fontWeight: 600, color: '#f1f5f9' }}>Español Latino / Coreano con Subtítulos</p>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#cbd5e1' }}>Sinopsis Completa</h4>
                  <p style={{ margin: 0, color: '#94a3b8', lineHeight: 1.6, fontSize: '0.92rem' }}>
                    {selectedDrama.overview || 'Sin descripción disponible.'}
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
