import React, { useState, useEffect, useMemo, useRef } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { SkeletonGrid } from './SkeletonLoader';
import { saveWatchProgress, toggleFavorite, isFavorite, getWatchHistory } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import catalogData from '../data/catalog.json';
import dramasData from '../data/dramas.json';

const TMDB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiMGM4MjRjMmFkMzllODUwNmE5ZGUzOGI5ZTA2ZjJmZiIsIm5iZiI6MTc0ODI3MjY1Ni43MDMsInN1YiI6IjY4MzQ4NjEwNjFmMWZlZmI4YmViMzYxZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KUIiE74vCOP05_Y0M5CKyCBtj9m5lN1WzCfZ6bQn6Xs';
const TMDB = 'https://api.themoviedb.org/3';
const IMG  = 'https://image.tmdb.org/t/p/w500';
const BACK = 'https://image.tmdb.org/t/p/original';
const HDR  = { Authorization: `Bearer ${TMDB_KEY}` };

const VIMEUS_VIEW_KEY = 'KThsRRoYzOilpZpoAf-eQMKv1cN3ULOBQxPk6QmeL-A';
const VIMEUS_PARAMS = '&title=PIRU_TV&theme=red&font=v3&overlay=v5&selector=v3&playUI=v3&epanel=v3';

// ── Servidores 100% Latino (UnLimPlay Activo + Vimeus Oficial + VidSrc HD + CineSrc) ──
const SERVERS = [
  {
    id: 'unlimplay',
    name: 'UnLimPlay',
    lang: '🇲🇽 LATINO',
    langGroup: 'latino',
    badge: '⭐ Activo 1080p',
    desc: 'Audio Latino nativo oficial de alta fidelidad (Directo, Streamwish, Filelions, Voe)',
    quality: '1080p'
  },
  {
    id: 'vimeus',
    name: 'Vimeus',
    lang: '🇲🇽 LATINO',
    langGroup: 'latino',
    badge: '⚠️ Error 522 Host',
    desc: 'Audio Latino oficial (Servidor temporalmente fuera de línea por su proveedor)',
    quality: 'HD'
  },
  {
    id: 'vidsrc',
    name: 'VidSrc HD',
    lang: 'MULTI / LAT',
    langGroup: 'latino',
    badge: '🚀 Multi-Audio',
    desc: 'Servidor rápido y estable con selector de subtítulos e idiomas',
    quality: '1080p'
  },
  {
    id: 'cinesrc',
    name: 'CineSrc',
    lang: 'MULTI / ESP',
    langGroup: 'latino',
    badge: '⚡ Respaldo',
    desc: 'Servidor CineSrc de alta velocidad con interfaz moderna y soporte multi-idioma',
    quality: '1080p'
  }
];

// ── Doramasflix Latino Movies (via Cloudflare Worker proxy) ──
const DFLIX_PROXY = import.meta.env.DEV
  ? '/api/gql'
  : 'https://pirutv-proxy.skillful-part.workers.dev';

const DFLIX_LIST_MOVIES = `
  query listMovies($page: Int, $perPage: Int, $sort: SortFindManyMovieInput, $filter: FilterFindManyMovieInput) {
    paginationMovie(page: $page, perPage: $perPage, sort: $sort, filter: $filter) {
      count
      items {
        _id
        name
        name_es
        slug
        poster_path
        backdrop_path
        release_date
        overview
        languages
        vote_average
      }
    }
  }
`;

const DFLIX_MOVIE_LINKS = `
  query getMovieLinks($slug: String!) {
    getMovieLinks(slug: $slug) {
      links_online
    }
  }
`;

const queryDflix = async (query, variables = {}) => {
  const res = await fetch(DFLIX_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error(`Dflix proxy error: ${res.status}`);
  return res.json();
};

const DFLIX_SERVER_NAMES = {
  '60ac0eb8ac46a43f59a5b21f': 'Streamtape',
  '60ac0d08ac46a43f59a5b21d': 'Mixdrop',
  '60ac0f2eac46a43f59a5b221': 'Uqload',
  '60ac0f52ac46a43f59a5b222': 'Mp4Upload',
  '60ac0abeac46a43f59a5b21b': 'Okru',
  '60ac0f0eac46a43f59a5b220': 'Voe',
  '60ac0e7eac46a43f59a5b21e': 'Dood',
  '64b19a4035461c5d64ef5b84': 'Filemoon',
  '64b18fdc35461c5d64ef5b59': 'Streamwish',
  '65c6b7f9149d4675d1547a5c': 'VidHide',
  '61707703fa461256758155c5': 'Mega'
};

const getDflixServerName = (url, ref) => {
  if (DFLIX_SERVER_NAMES[ref]) return DFLIX_SERVER_NAMES[ref];
  try {
    const h = new URL(url).hostname.replace('www.', '').split('.');
    return h[0].charAt(0).toUpperCase() + h[0].slice(1);
  } catch { return 'Servidor'; }
};

const LATINO_MOVIES_CAT = '🗣️ Películas Latino';

const DISCOVER_MAP = {
  'Acción': '/discover/movie?with_genres=28',
  'Animación': '/discover/movie?with_genres=16',
  'Ciencia Ficción': '/discover/movie?with_genres=878',
  'Comedia': '/discover/movie?with_genres=35',
  'Drama': '/discover/movie?with_genres=18',
  'Marvel y DC': '/discover/movie?with_genres=28,878&with_companies=420|7505',
  'Suspenso / Thriller': '/discover/movie?with_genres=53',
  'Series': '/discover/tv?sort_by=popularity.desc',
  'Anime': '/discover/tv?with_genres=16&with_original_language=ja'
};

// Fallback Curated Continue Watching Items (Stitch Netflix Spec)
const CURATED_CONTINUE = [
  {
    id: 634649,
    title: 'Spider-Man: Brand New Day',
    poster: 'https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/14QbnygCuTO0vl7CAFmPf1fgZfV.jpg',
    type: 'movie',
    progress: 75,
    remaining: 'Quedan 32 min'
  },
  {
    id: 61664,
    title: 'Colony',
    poster: 'https://image.tmdb.org/t/p/w500/2yvh1JzNf9FshZ1d86uBvU6a24v.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/8Y43POKjjKDGI9MH89NW0NAAc8U.jpg',
    type: 'tv',
    progress: 50,
    remaining: 'T1:E4'
  },
  {
    id: 30984,
    title: 'Bleach: Thousand-Year Blood War',
    poster: 'https://image.tmdb.org/t/p/w500/2Eewgp7o5AU1xCjrXY9ehasBA7P.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/mDFNs9a51m4nffD2kLgAOx8m8mB.jpg',
    type: 'tv',
    progress: 80,
    remaining: 'E18'
  },
  {
    id: 1184918,
    title: 'The Mongoose',
    poster: 'https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/m4TUa6Y3rU4YvK91A39bLp0j7Xg.jpg',
    type: 'movie',
    progress: 35,
    remaining: 'Quedan 54 min'
  },
  {
    id: 634649,
    title: 'Spider-Man: No Way Home',
    poster: 'https://image.tmdb.org/t/p/w500/uJYY4RAA1jhMbf3ZzQWuhpE86b.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/iQFcwSGbZXMkeyKrxbPnwnRo5fl.jpg',
    type: 'movie',
    progress: 70,
    remaining: 'Quedan 21 min'
  }
];

const CATEGORY_DISPLAY_TITLES = {
  'Acción': 'Acción trepidante',
  'Animación': 'Anime y Animación destacada',
  'Comedia': 'Comedias recomendadas',
  'Ciencia Ficción': 'Ciencia ficción y Fantasía',
  'Suspenso / Thriller': 'Thrillers de suspenso',
  'Drama': 'Dramas y Emociones profundas',
  'Marvel y DC': 'Universo Marvel & DC',
  'Series': 'Series populares',
  'Anime': 'Anime de temporada',
  '🗣️ Películas Latino': 'Películas en Audio Latino'
};

// Hero and Top 5 items from cinroom1
const HERO_REF = { id: 1273221, type: 'movie' }; // Mortal Kombat II
const TOP5_REFS = [
  { id: 1273221, type: 'movie' }, // Mortal Kombat II
  { id: 1339713, type: 'movie' }, // Inside Out 2
  { id: 931285, type: 'movie' },  // Deadpool & Wolverine
  { id: 936075, type: 'movie' },  // The Substance
  { id: 1327819, type: 'movie' }  // Venom: The Last Dance
];

export default function Peliculas() {
  const [activeCategory, setActiveCategory] = useState('Home'); // Home state dashboard by default
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [watchHistory, setWatchHistory] = useState(() => getWatchHistory('peliculas'));
  const searchInputRef = React.useRef(null);
  
  const [tmdbCache, setTmdbCache] = useState(() => {
    try {
      const saved = sessionStorage.getItem('piru_tmdb_cache');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [discoverCache, setDiscoverCache] = useState(() => {
    try {
      const saved = sessionStorage.getItem('piru_discover_cache');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [categoryPages, setCategoryPages] = useState({}); // Current loaded page for each category
  const [categoryTotalPages, setCategoryTotalPages] = useState({}); // Total pages for each category
  const [selectedItem, setSelectedItem] = useState(null);

  // Combine real user watch history with curated items (filtered strictly to peliculas/series)
  const continueWatchingItems = useMemo(() => {
    const list = (watchHistory || []).filter(item => 
      item.section === 'peliculas' || 
      item.type === 'movie' || 
      item.type === 'pelicula' || 
      item.type === 'tv' || 
      item.type === 'latino-movie' || 
      (!item.section && !item.type && !item.url)
    );
    for (const c of CURATED_CONTINUE) {
      if (list.length >= 6) break;
      if (!list.some(item => String(item.id) === String(c.id))) {
        list.push(c);
      }
    }
    return list.slice(0, 6);
  }, [watchHistory]);

  // Listen to header events (Search, Home, Category, Focus)
  useEffect(() => {
    const handleReset = () => {
      setActiveCategory('Home');
      setSearchTerm('');
      setSelectedItem(null);
      setIsPlaying(false);
    };
    const handleSearch = () => {
      setActiveCategory('Search');
      setSelectedItem(null);
      setIsPlaying(false);
      searchInputRef.current?.focus();
    };
    const handleCategory = (e) => {
      if (e.detail) {
        setActiveCategory(e.detail);
        setSelectedItem(null);
        setIsPlaying(false);
      }
    };
    const handleFocusSearch = (e) => {
      if (e.detail === 'peliculas') {
        searchInputRef.current?.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('reset-piru-home', handleReset);
    window.addEventListener('open-piru-search', handleSearch);
    window.addEventListener('open-piru-category', handleCategory);
    window.addEventListener('focus-section-search', handleFocusSearch);
    return () => {
      window.removeEventListener('reset-piru-home', handleReset);
      window.removeEventListener('open-piru-search', handleSearch);
      window.removeEventListener('open-piru-category', handleCategory);
      window.removeEventListener('focus-section-search', handleFocusSearch);
    };
  }, []);

  // Persist caches to sessionStorage for 0ms instant category switches
  useEffect(() => {
    try {
      if (Object.keys(tmdbCache).length > 0) {
        sessionStorage.setItem('piru_tmdb_cache', JSON.stringify(tmdbCache));
      }
    } catch (e) {}
  }, [tmdbCache]);

  useEffect(() => {
    try {
      if (Object.keys(discoverCache).length > 0) {
        sessionStorage.setItem('piru_discover_cache', JSON.stringify(discoverCache));
      }
    } catch (e) {}
  }, [discoverCache]);
  
  // Dashboard special items
  const [heroItem, setHeroItem] = useState(null);
  const [heroList, setHeroList] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [top5Items, setTop5Items] = useState([]);
  const [homeCategoriesData, setHomeCategoriesData] = useState({});

  // Player state inside modal
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedServer, setSelectedServer] = useState('unlimplay');
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Doramasflix Latino Movies state
  const [latinoMovies, setLatinoMovies] = useState([]);
  const [latinoMoviePage, setLatinoMoviePage] = useState(1);
  const [latinoMovieTotalPages, setLatinoMovieTotalPages] = useState(1);
  const [latinoMovieLinks, setLatinoMovieLinks] = useState([]);
  const [activeLatinoServer, setActiveLatinoServer] = useState(null);

  // Modal navigation tabs & server language filter
  const [modalTab, setModalTab] = useState('player'); // 'player', 'cast', 'trailer', 'details'
  const [serverLangFilter, setServerLangFilter] = useState('all'); // 'all', 'latino', 'multi', 'sub'

  // Filter servers according to selected audio language tab
  const filteredServers = useMemo(() => {
    if (serverLangFilter === 'all') return SERVERS;
    return SERVERS.filter(s => s.langGroup === serverLangFilter);
  }, [serverLangFilter]);

  // Handle Smart TV D-Pad Remote Back button
  useDpadNavigation({
    onBack: () => {
      if (selectedItem) {
        setSelectedItem(null);
        setIsPlaying(false);
      }
    }
  });

  // Persist watch progress
  useEffect(() => {
    if (selectedItem && isPlaying) {
      saveWatchProgress({
        id: selectedItem.id,
        title: selectedItem.title,
        poster: selectedItem.poster,
        backdrop: selectedItem.backdrop,
        type: selectedItem.type || 'movie',
        section: 'peliculas',
        season: selectedSeason,
        episode: selectedEpisode
      }, 'peliculas');
      setWatchHistory(getWatchHistory('peliculas'));
    }
  }, [selectedItem, isPlaying, selectedSeason, selectedEpisode]);

  // Combine categories: Home + catalog genres + Dramas Chinos
  const categories = useMemo(() => {
    return ['Home', ...Object.keys(catalogData), 'Dramas Chinos', LATINO_MOVIES_CAT];
  }, []);

  // Fetch TMDB helper function (con reparto, directores, trailer y ficha técnica completa)
  const fetchItemDetails = async (id, type, terabox = null) => {
    try {
      const res = await fetch(`${TMDB}/${type}/${id}?language=es-ES&append_to_response=credits,videos`, { headers: HDR });
      if (res.ok) {
        const data = await res.json();

        // Extraer elenco de actores (hasta 15 actores principales con foto y personaje)
        const cast = (data.credits?.cast || []).slice(0, 15).map(actor => ({
          id: actor.id,
          name: actor.name,
          character: actor.character,
          photo: actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : null
        }));

        // Extraer directores
        const directors = (data.credits?.crew || [])
          .filter(c => c.job === 'Director')
          .map(d => ({
            id: d.id,
            name: d.name,
            photo: d.profile_path ? `https://image.tmdb.org/t/p/w185${d.profile_path}` : null
          }));

        // Extraer trailer oficial de YouTube
        const videos = data.videos?.results || [];
        const trailerObj = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer') 
          || videos.find(v => v.site === 'YouTube' && v.type === 'Teaser')
          || videos.find(v => v.site === 'YouTube');
        const trailerKey = trailerObj?.key || null;

        return {
          id,
          type,
          terabox,
          title: data.title || data.name || '—',
          originalTitle: data.original_title || data.original_name || null,
          tagline: data.tagline || null,
          poster: data.poster_path ? `${IMG}${data.poster_path}` : 'https://via.placeholder.com/160x240?text=?',
          backdrop: data.backdrop_path ? `${BACK}${data.backdrop_path}` : null,
          overview: data.overview || 'Sin descripción disponible.',
          year: (data.release_date || data.first_air_date || '').slice(0, 4) || '—',
          releaseDateFull: data.release_date || data.first_air_date || null,
          rating: data.vote_average ? Math.round(data.vote_average * 10) / 10 : null,
          voteCount: data.vote_count || 0,
          genres: (data.genres || []).map(g => g.name),
          runtime: data.runtime ? `${data.runtime} min` : (data.episode_run_time?.[0] ? `~${data.episode_run_time[0]} min/ep` : ''),
          country: (data.production_countries || []).map(c => c.name || c.iso_3166_1).join(', ') || null,
          status: data.status || null,
          cast,
          directors,
          trailerKey,
          seasons: data.seasons || null
        };
      }
    } catch (e) {
      console.error(`Error fetching TMDB details for ${type} ${id}:`, e);
    }
    return null;
  };

  // Fetch dashboard items on mount (con actualización automática en tiempo real de estrenos y tendencias)
  useEffect(() => {
    const loadDashboard = async () => {
      // 1. Cargar dinámicamente las películas en tendencia mundial y estrenos (TMDb Trending en tiempo real)
      let heroesLoaded = false;
      try {
        const trendRes = await fetch(`${TMDB}/trending/movie/day?language=es-ES`, { headers: HDR });
        if (trendRes.ok) {
          const trendData = await trendRes.json();
          const trendingMovies = (trendData.results || []).slice(0, 10);
          if (trendingMovies.length > 0) {
            const dynamicDetails = await Promise.all(
              trendingMovies.map(m => fetchItemDetails(m.id, 'movie'))
            );
            const cleanDynamic = dynamicDetails.filter(Boolean);
            if (cleanDynamic.length > 0) {
              setHeroItem(cleanDynamic[0]);
              setHeroList(cleanDynamic);
              setTop5Items(cleanDynamic.slice(0, 10));
              heroesLoaded = true;
            }
          }
        }
      } catch (err) {
        console.error('Error al obtener tendencias dinámicas de TMDb:', err);
      }

      // Fallback de respaldo en caso de desconexión o fallo en TMDb
      if (!heroesLoaded) {
        let hero = await fetchItemDetails(HERO_REF.id, HERO_REF.type);
        const top5 = await Promise.all(
          TOP5_REFS.map(ref => fetchItemDetails(ref.id, ref.type))
        );
        const cleanTop5 = top5.filter(Boolean);
        setTop5Items(cleanTop5);

        const heroes = [hero, ...cleanTop5].filter(Boolean);
        setHeroList(heroes);
        if (heroes.length > 0) setHeroItem(heroes[0]);
      }

      // 3. Fetch all category rows via TMDB Discover (12 items per category) to prevent rate limits
      const dataMap = {};
      const keys = Object.keys(catalogData);
      
      await Promise.all(
        keys.map(async (category) => {
          try {
            const discoverPath = DISCOVER_MAP[category];
            const type = category === 'Series' || category === 'Anime' ? 'tv' : 'movie';
            const res = await fetch(`${TMDB}${discoverPath}&language=es-ES&sort_by=popularity.desc&page=1`, { headers: HDR });
            if (res.ok) {
              const data = await res.json();
              const discoverItems = (data.results || []).slice(0, 12).map(x => ({
                id: x.id,
                type: type,
                title: x.title || x.name || '—',
                poster: x.poster_path ? `${IMG}${x.poster_path}` : 'https://via.placeholder.com/160x240?text=?',
                backdrop: x.backdrop_path ? `${BACK}${x.backdrop_path}` : null,
                overview: x.overview || 'Sin descripción disponible.',
                year: (x.release_date || x.first_air_date || '').slice(0, 4) || '—',
                rating: x.vote_average ? Math.round(x.vote_average * 10) / 10 : null,
                category: category,
                terabox: null
              }));

              // Merge local curated items at the beginning
              const curatedRefs = catalogData[category] || [];
              const merged = discoverItems.map(item => {
                const match = curatedRefs.find(ref => ref.id === item.id && ref.type === item.type);
                if (match) {
                  return { ...item, terabox: match.terabox };
                }
                return item;
              });

              dataMap[category] = merged;
            }
          } catch (e) {
            console.error(`Home category load error for ${category}:`, e);
          }
        })
      );
      
      setHomeCategoriesData(dataMap);
    };

    loadDashboard();
  }, []);

  // Auto-rotate Hero Spotlight every 6.5s
  useEffect(() => {
    if (heroList.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => {
        const next = (prev + 1) % heroList.length;
        setHeroItem(heroList[next]);
        return next;
      });
    }, 6500);
    return () => clearInterval(timer);
  }, [heroList]);

  // Load Doramasflix Latino Movies when that category is selected
  useEffect(() => {
    if (activeCategory !== LATINO_MOVIES_CAT) return;
    setSelectedItem(null);
    setIsPlaying(false);

    const load = async () => {
      setIsLoading(true);
      try {
        const res = await queryDflix(DFLIX_LIST_MOVIES, {
          page: latinoMoviePage,
          perPage: 20,
          sort: 'POPULARITY_DESC',
          filter: { languages: '38' }
        });
        const data = res.data?.paginationMovie;
        if (data) {
          const total = data.count || 0;
          setLatinoMovieTotalPages(Math.ceil(total / 20));
          const items = (data.items || []).map(x => ({
            id: x._id,
            type: 'latino-movie',
            slug: x.slug,
            title: x.name_es || x.name || '—',
            poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://via.placeholder.com/160x240?text=?',
            backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
            overview: x.overview || 'Sin descripción disponible.',
            year: (x.release_date || '').slice(0, 4) || '—',
            rating: x.vote_average ? Math.round(x.vote_average * 10) / 10 : null,
            category: LATINO_MOVIES_CAT
          }));
          setLatinoMovies(items);
        }
      } catch (e) {
        console.error('Dflix movies error:', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [activeCategory, latinoMoviePage]);

  // Fetch TMDB data for catalog items and discover items when category is active
  useEffect(() => {
    if (activeCategory === 'Home' || activeCategory === 'Dramas Chinos' || activeCategory === LATINO_MOVIES_CAT || activeCategory === 'Search') {
      setSelectedItem(null);
      setIsPlaying(false);
      return;
    }

    setSelectedItem(null);
    setIsPlaying(false);

    const curatedRefs = catalogData[activeCategory] || [];
    const activePage = categoryPages[activeCategory] || 1;

    const fetchCategoryContent = async () => {
      setIsLoading(true);

      // 1. Fetch curated items details if not already in tmdbCache
      const missingCurated = curatedRefs.filter(ref => !tmdbCache[`${ref.type}-${ref.id}`]);
      const newCache = { ...tmdbCache };
      let updated = false;

      if (missingCurated.length > 0) {
        await Promise.all(
          missingCurated.map(async (item) => {
            const data = await fetchItemDetails(item.id, item.type, item.terabox);
            if (data) {
              newCache[`${item.type}-${item.id}`] = {
                ...data,
                category: activeCategory
              };
              updated = true;
            }
          })
        );
        if (updated) {
          setTmdbCache(newCache);
        }
      }

      // 2. Fetch TMDB discover page results for this category if needed
      const cacheKey = `${activeCategory}_page_${activePage}`;
      const cachedResults = discoverCache[cacheKey];

      if (!cachedResults && DISCOVER_MAP[activeCategory]) {
        try {
          const type = activeCategory === 'Series' || activeCategory === 'Anime' ? 'tv' : 'movie';
          const discoverPath = DISCOVER_MAP[activeCategory];
          
          const res = await fetch(`${TMDB}${discoverPath}&language=es-ES&sort_by=popularity.desc&page=${activePage}`, { headers: HDR });
          if (res.ok) {
            const data = await res.json();
            if (data.total_pages) {
              setCategoryTotalPages(prev => ({
                ...prev,
                [activeCategory]: Math.min(data.total_pages, 500)
              }));
            }
            const results = (data.results || []).map(x => ({
              id: x.id,
              type: type,
              title: x.title || x.name || '—',
              poster: x.poster_path ? `${IMG}${x.poster_path}` : 'https://via.placeholder.com/160x240?text=?',
              overview: x.overview || 'Sin descripción disponible.',
              year: (x.release_date || x.first_air_date || '').slice(0, 4) || '—',
              rating: x.vote_average ? Math.round(x.vote_average * 10) / 10 : null,
              category: activeCategory,
              terabox: null
            }));

            setDiscoverCache(prev => ({
              ...prev,
              [cacheKey]: results
            }));
          }
        } catch (e) {
          console.error('TMDB Discover error:', e);
        }
      }

      setIsLoading(false);
    };

    fetchCategoryContent();
  }, [activeCategory, tmdbCache, discoverCache, categoryPages]);

  // Real-time Global Search on TMDB
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${TMDB}/search/multi?query=${encodeURIComponent(searchTerm)}&language=es-ES&page=1`, { headers: HDR });
        if (res.ok) {
          const data = await res.json();
          const results = (data.results || [])
            .filter(x => x.media_type === 'movie' || x.media_type === 'tv')
            .map(x => ({
              id: x.id,
              type: x.media_type,
              title: x.title || x.name || '—',
              poster: x.poster_path ? `${IMG}${x.poster_path}` : 'https://via.placeholder.com/160x240?text=?',
              overview: x.overview || 'Sin descripción disponible.',
              year: (x.release_date || x.first_air_date || '').slice(0, 4) || '—',
              rating: x.vote_average ? Math.round(x.vote_average * 10) / 10 : null,
              category: x.media_type === 'tv' ? 'Series' : 'Películas',
              // Try to find if this item has a Terabox link in our local catalog
              terabox: (() => {
                for (const cat of Object.values(catalogData)) {
                  const match = cat.find(it => it.id === x.id && it.type === x.media_type);
                  if (match) return match.terabox;
                }
                return null;
              })()
            }));
          setSearchResults(results);
        }
      } catch (e) {
        console.error('TMDB Search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 450); // 450ms debounce time

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Resolve current active items list for standard categories
  const currentItems = useMemo(() => {
    if (activeCategory === 'Home') return [];
    if (activeCategory === LATINO_MOVIES_CAT) return latinoMovies;
    if (activeCategory === 'Dramas Chinos') {
      return dramasData.map((d, index) => ({
        id: `drama-${index}`,
        type: 'drama',
        title: d.title,
        poster: d.poster,
        overview: `Drama Chino: ${d.ep || 'Completo'}`,
        embedUrl: d.embedUrl,
        ep: d.ep
      }));
    }

    const activePage = categoryPages[activeCategory] || 1;
    const cacheKey = `${activeCategory}_page_${activePage}`;
    const pageItems = Array.isArray(discoverCache[cacheKey])
      ? discoverCache[cacheKey]
      : (activePage === 1 && Array.isArray(discoverCache[activeCategory]) ? discoverCache[activeCategory].slice(0, 20) : []);

    if (activePage === 1) {
      const curatedRefs = catalogData[activeCategory] || [];
      const curated = curatedRefs.map(item => tmdbCache[`${item.type}-${item.id}`]).filter(Boolean);
      const curatedIds = new Set(curated.map(c => c.id));
      const filteredDiscovered = pageItems.filter(d => !curatedIds.has(d.id));
      return [...curated, ...filteredDiscovered];
    }

    return pageItems;
  }, [activeCategory, tmdbCache, discoverCache, latinoMovies, categoryPages]);

  // Open modal handler
  const handleOpenItem = async (item) => {
    // Record watch progress
    if (item && item.id) {
      saveWatchProgress({
        ...item,
        title: item.title,
        poster: item.poster,
        backdrop: item.backdrop,
        type: item.type || 'movie',
        section: 'peliculas'
      }, 'peliculas');
      setWatchHistory(getWatchHistory('peliculas'));
    }

    // Latino movie: load doramasflix links
    if (item.type === 'latino-movie') {
      setSelectedItem(item);
      setIsPlaying(false);
      setLatinoMovieLinks([]);
      setActiveLatinoServer(null);
      setIsLoading(true);
      try {
        const res = await queryDflix(DFLIX_MOVIE_LINKS, { slug: item.slug });
        const links = res.data?.getMovieLinks?.links_online || [];
        // Prefer Latino (lang=38), fallback to any available
        const latino = links.filter(l => String(l.lang) === '38');
        const servers = (latino.length > 0 ? latino : links)
          .filter(l => l.embed && l.is_active !== false)
          .map(l => ({
            id: l._id,
            name: getDflixServerName(l.embed, l.server_ref),
            embed: l.embed,
            lang: String(l.lang) === '38' ? 'LAT' : 'SUB'
          }));
        setLatinoMovieLinks(servers);
        if (servers.length > 0) setActiveLatinoServer(servers[0]);
      } catch (e) {
        console.error('Dflix links error:', e);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setModalTab('player');
    setServerLangFilter('all');
    setSelectedItem(item);
    setIsPlaying(false);
    setSelectedSeason(1);
    setSelectedEpisode(1);
    setSelectedServer('unlimplay'); // UnLimPlay is 100% active Spanish Latino by default

    // If the item doesn't have cast or full details loaded yet, fetch them!
    if (!item.cast || (item.type === 'tv' && !item.seasons)) {
      setIsLoading(true);
      const fullDetails = await fetchItemDetails(item.id, item.type, item.terabox);
      if (fullDetails) {
        setSelectedItem(prev => (prev && prev.id === item.id ? { ...prev, ...fullDetails } : prev));
      }
      setIsLoading(false);
    }

  };

  // Get total episodes in selected season
  const episodesInSelectedSeason = useMemo(() => {
    if (!selectedItem || !selectedItem.seasons) return [];
    const seasonData = selectedItem.seasons.find(s => s.season_number === selectedSeason);
    if (!seasonData) return [];
    
    const count = seasonData.episode_count || 0;
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [selectedItem, selectedSeason]);

  // Build embed url for the movie or episode
  const embedUrl = useMemo(() => {
    if (!selectedItem) return '';
    if (selectedItem.type === 'drama') return selectedItem.embedUrl;
    if (selectedItem.type === 'latino-movie') {
      const embed = activeLatinoServer?.embed || '';
      if (embed.includes('primeload.co')) {
        return import.meta.env.DEV
          ? embed.replace('https://primeload.co', '/primeload-proxy')
          : embed.replace('https://primeload.co', DFLIX_PROXY);
      }
      return embed;
    }

    const id = selectedItem.id;

    // ── 1. UNLIMPLAY (Multi-Servidor exclusivo en Audio Latino - 100% Funcional) ──
    if (selectedServer === 'unlimplay') {
      if (selectedItem.type === 'movie') {
        return `https://unlimplay.com/f/embed/movie/${id}`;
      }
      return `https://unlimplay.com/f/embed/tv/${id}/${selectedSeason}/${selectedEpisode}`;
    }

    // ── 2. VIMEUS OFICIAL (Audio Latino / Castellano) ──
    if (selectedServer === 'vimeus' || selectedServer === 'vimeus_sala2') {
      const vk = VIMEUS_VIEW_KEY ? `&view_key=${encodeURIComponent(VIMEUS_VIEW_KEY)}` : '';
      if (selectedItem.type === 'movie') {
        return `https://vimeus.com/e/movie?tmdb=${id}${vk}${VIMEUS_PARAMS}`;
      }
      const kind = selectedItem.category === 'Anime' ? 'anime' : 'serie';
      return `https://vimeus.com/e/${kind}?tmdb=${id}&se=${selectedSeason}&ep=${selectedEpisode}${vk}${VIMEUS_PARAMS}`;
    }

    // ── 3. VIDSRC (Multi-Audio y Subtítulos) ──
    if (selectedServer === 'vidsrc') {
      if (selectedItem.type === 'movie') {
        return `https://vidsrc.me/embed/movie?tmdb=${id}`;
      }
      return `https://vidsrc.me/embed/tv?tmdb=${id}&season=${selectedSeason}&episode=${selectedEpisode}`;
    }

    // ── 4. CINESRC (Streaming Rápido Multi-Idioma / HD) ──
    if (selectedServer === 'cinesrc') {
      if (selectedItem.type === 'movie') {
        return `https://cinesrc.st/embed/movie/${id}?color=%23e50914`;
      }
      return `https://cinesrc.st/embed/tv/${id}?s=${selectedSeason}&e=${selectedEpisode}&color=%23e50914`;
    }

    return '';
  }, [selectedItem, selectedServer, selectedSeason, selectedEpisode, activeLatinoServer]);

  return (
    <div className="peliculas-container netflix-view" style={{ minHeight: '100vh', background: '#141414', color: '#fff' }}>
      
      {/* Netflix Subnav & Category Pills & Search */}
      <div style={{
        padding: '1.25rem 3.5rem 0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        position: 'relative',
        zIndex: 30
      }}>
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              className={`filter-badge ${(activeCategory === cat && !searchTerm) ? 'active' : ''}`}
              onClick={() => {
                setSelectedItem(null);
                setIsPlaying(false);
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
              {cat === 'Home' ? '🏠 Inicio' : cat}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{ width: '320px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}>🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar película o serie..."
            value={searchTerm}
            onChange={(e) => {
              setSelectedItem(null);
              setIsPlaying(false);
              setSearchTerm(e.target.value);
            }}
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
              onClick={() => {
                setSearchTerm('');
                if (activeCategory === 'Search') setActiveCategory('Home');
              }}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {activeCategory === 'Home' && !searchTerm ? (
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
                  <span className="netflix-rank-text">N.º {heroIndex + 1} en películas hoy</span>
                </div>

                <h1 className="netflix-hero-title">{heroItem.title}</h1>

                <div className="netflix-meta-row">
                  <span className="netflix-match">
                    {heroItem.rating ? `${Math.round(heroItem.rating * 10)}% de coincidencia` : '98% de coincidencia'}
                  </span>
                  <span>{heroItem.year || '2026'}</span>
                  <span className="netflix-badge-age">16+</span>
                  <span>{heroItem.runtime || '1 h 48 min'}</span>
                  <span className="netflix-badge-tech">4K ULTRA HD</span>
                  <span className="netflix-badge-tech">5.1</span>
                </div>

                <p className="netflix-hero-synopsis">{heroItem.overview}</p>

                <div className="netflix-hero-actions">
                  <button 
                    className="btn-netflix-play" 
                    onClick={() => {
                      handleOpenItem(heroItem);
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
                      handleOpenItem(heroItem);
                      setModalTab('details');
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
                      setHeroItem({ ...heroItem });
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
                      {isFavorite(heroItem.id) ? 'check' : 'add'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Right Billboard Controls: Sound & Maturity Rating */}
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

          {/* Netflix Content Rows Section */}
          <div className="netflix-rows-container">
            {/* Row 0: Continuar viendo para Ti (16:9 Landscape with Progress Bar) */}
            {continueWatchingItems.length > 0 && (
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
                  {continueWatchingItems.map((item) => (
                    <div 
                      key={`continue-${item.id}`} 
                      className="netflix-continue-card"
                      onClick={() => handleOpenItem(item)}
                    >
                      <div className="netflix-continue-thumb">
                        <img src={item.backdrop || item.poster} alt={item.title} />
                        <div className="netflix-continue-overlay">
                          <div className="netflix-center-play">
                            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '24px' }}>
                              play_arrow
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="netflix-progress-bar">
                        <div className="netflix-progress-fill" style={{ width: `${item.progress || 65}%` }} />
                      </div>
                      <div className="netflix-continue-info">
                        <span className="netflix-continue-title">{item.title}</span>
                        <span className="netflix-continue-sub">
                          {item.remaining || (item.type === 'tv' ? `T${selectedSeason}:E${selectedEpisode}` : 'Quedan 35 min')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Row 1: Las 10 películas más populares hoy en PiruTV (Billboard 1..10) */}
            {top5Items.length > 0 && (
              <section className="netflix-row-section">
                <div className="netflix-row-header">
                  <h2 className="netflix-row-title">
                    Las 10 películas más populares hoy en PiruTV
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                      chevron_right
                    </span>
                  </h2>
                </div>
                <div className="netflix-top10-grid">
                  {top5Items.map((item, index) => (
                    <div 
                      key={`top10-${item.type}-${item.id}`} 
                      className="netflix-top10-item"
                      onClick={() => handleOpenItem(item)}
                    >
                      <span className="netflix-top-num">{index + 1}</span>
                      <div className="netflix-top-poster">
                        <img src={item.poster} alt={item.title} />
                        <div className="netflix-card-top10-badge">TOP 10</div>
                        <div className="netflix-card-lang-strip">
                          <span className="netflix-pill-lat">LAT</span>
                          <span className="netflix-pill-cast">CAST</span>
                          <span className="netflix-pill-sub">SUB</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Curated Category Content Rows */}
            {Object.keys(catalogData).map((category) => {
              const items = homeCategoriesData[category] || [];
              if (items.length === 0) return null;
              const displayTitle = CATEGORY_DISPLAY_TITLES[category] || category;
              return (
                <section key={category} className="netflix-row-section">
                  <div className="netflix-row-header">
                    <h2 
                      className="netflix-row-title"
                      onClick={() => {
                        setSelectedItem(null);
                        setIsPlaying(false);
                        setActiveCategory(category);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      {displayTitle}
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                        chevron_right
                      </span>
                    </h2>
                    <button 
                      className="netflix-explore-all"
                      onClick={() => {
                        setSelectedItem(null);
                        setIsPlaying(false);
                        setActiveCategory(category);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Explorar todos
                    </button>
                  </div>
                  <div className="netflix-category-scroll">
                    {items.map((item) => (
                      <button 
                        type="button"
                        key={`${item.type}-${item.id}`} 
                        className="netflix-poster-card"
                        onClick={() => handleOpenItem(item)}
                      >
                        <div className="netflix-poster-img-wrap">
                          <img src={item.poster} alt={item.title} loading="lazy" />
                          <div className="netflix-quality-tag">4K</div>
                          <div className="netflix-card-lang-strip">
                            <span className="netflix-pill-lat">LAT</span>
                            <span className="netflix-pill-cast">CAST</span>
                            <span className="netflix-pill-sub">SUB</span>
                          </div>
                        </div>
                        <span className="netflix-poster-title">{item.title}</span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Netflix Footer */}
          <footer className="netflix-footer">
            <div className="netflix-footer-inner">
              <div className="netflix-social-links">
                <a href="#" title="Facebook"><span className="material-symbols-outlined">public</span></a>
                <a href="#" title="Instagram"><span className="material-symbols-outlined">photo_camera</span></a>
                <a href="#" title="Twitter / X"><span className="material-symbols-outlined">alternate_email</span></a>
                <a href="#" title="YouTube"><span className="material-symbols-outlined">smart_display</span></a>
              </div>

              <div className="netflix-footer-grid">
                <div className="netflix-footer-col">
                  <a href="#">Audio descriptivo</a>
                  <a href="#">Relaciones con inversionistas</a>
                  <a href="#">Avisos legales</a>
                  <a href="#">Preferencias de cookies</a>
                </div>
                <div className="netflix-footer-col">
                  <a href="#">Centro de ayuda</a>
                  <a href="#">Empleo</a>
                  <a href="#">Términos de uso</a>
                  <a href="#">Información corporativa</a>
                </div>
                <div className="netflix-footer-col">
                  <a href="#">Tarjetas de regalo</a>
                  <a href="#">Tienda PiruTV</a>
                  <a href="#">Privacidad</a>
                  <a href="#">Contáctanos</a>
                </div>
                <div className="netflix-footer-col">
                  <a href="#">Prensa de medios</a>
                  <a href="#">Dispositivos compatibles</a>
                  <a href="#">Prueba de velocidad</a>
                  <a href="#">Garantía legal</a>
                </div>
              </div>

              <div className="netflix-footer-bottom">
                <div className="netflix-lang-btn">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>language</span>
                  <span>Español</span>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>expand_more</span>
                </div>
                <button className="netflix-service-code-btn">Código de servicio</button>
              </div>

              <p className="netflix-copyright">
                © 1997-2026 PiruTV Streaming Entertainment Inc. Todos los derechos reservados.
              </p>
            </div>
          </footer>
        </>
      ) : (searchTerm.trim() || activeCategory === 'Search') ? (
        <div className="search-results-section" style={{ padding: '2rem 3.5rem 3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <button
              onClick={() => {
                setActiveCategory('Home');
                setSearchTerm('');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                padding: '0.6rem 1.2rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
              Volver al Inicio
            </button>

            <h2 className="dashboard-section-title" style={{ margin: 0 }}>
              {searchTerm ? `Resultados para "${searchTerm}"` : 'Resultados de búsqueda'}
            </h2>
          </div>

          <h2 className="dashboard-section-title" style={{ display: 'none' }}>Resultados de búsqueda</h2>
          {isSearching ? (
            <div className="empty-state">
              <div className="player-loading-spinner" style={{ position: 'relative', margin: '0 auto 1.5rem' }}></div>
              <h3 className="empty-title">Buscando en la base de datos global...</h3>
            </div>
          ) : (
            <div className="media-grid">
              {searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <button 
                    type="button"
                    key={`${item.type}-${item.id}`} 
                    className="media-card" 
                    onClick={() => handleOpenItem(item)}
                    style={{ textAlign: 'left', font: 'inherit', color: 'inherit', padding: 0 }}
                  >
                    <div className="card-thumbnail-wrapper" style={{ aspectRatio: '2/3' }}>
                      <div className="card-thumbnail-glow"></div>
                      <img src={item.poster} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.src = 'https://via.placeholder.com/160x240?text=?'; }} />
                      <button
                        type="button"
                        className="play-hover-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenItem(item);
                        }}
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                      >
                        <div className="play-icon">▶</div>
                      </button>
                      <span className="card-quality-badge">HD</span>
                      <div className="card-lang-badges">
                        <span className="badge-lang badge-lat">LAT</span>
                        <span className="badge-lang badge-cast">CAST</span>
                        <span className="badge-lang badge-sub">SUB</span>
                      </div>
                      {item.year && <span className="card-badge">{item.year}</span>}
                    </div>
                    <div className="card-info">
                      <span className="card-genre">{item.type === 'tv' ? '📺 Serie' : '🎬 Película'}</span>
                      <h3 className="card-title">{item.title}</h3>
                      <p className="card-summary">{item.overview}</p>
                      <div className="card-footer">
                        <span>{item.rating ? `⭐ ${item.rating}` : 'FAST Stream'}</span>
                        <span className="card-lang">ES</span>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">🔍</span>
                  <h3 className="empty-title">No se encontraron resultados</h3>
                  <p>Prueba buscando otro título en español o inglés.</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        // CATEGORY VIEW GRID
        <div className="category-results" style={{ padding: '2rem 3.5rem 3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <button
              onClick={() => {
                setActiveCategory('Home');
                setSearchTerm('');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                padding: '0.6rem 1.2rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
              Volver al Inicio
            </button>

            <h2 className="dashboard-section-title" style={{ margin: 0 }}>
              {activeCategory}
            </h2>
          </div>

          {isLoading && currentItems.length === 0 ? (
            <SkeletonGrid count={12} />
          ) : (
            <>
              <div className="media-grid">
                {currentItems.length > 0 ? (
                  currentItems.map((item) => (
                    <button 
                      type="button"
                      key={item.id} 
                      className="media-card"
                      onClick={() => handleOpenItem(item)}
                      style={{ textAlign: 'left', font: 'inherit', color: 'inherit', padding: 0 }}
                    >
                      <div className="card-thumbnail-wrapper" style={{ aspectRatio: '2/3' }}>
                        <div className="card-thumbnail-glow"></div>
                        <img 
                          src={item.poster} 
                          alt={item.title} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/160x240?text=?';
                          }}
                        />
                        <button
                          type="button"
                          className="play-hover-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenItem(item);
                          }}
                          style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                        >
                          <div className="play-icon">▶</div>
                        </button>
                        <span className="card-quality-badge">HD</span>
                        <div className="card-lang-badges">
                          <span className="badge-lang badge-lat">LAT</span>
                          <span className="badge-lang badge-cast">CAST</span>
                          <span className="badge-lang badge-sub">SUB</span>
                        </div>
                        {item.year && <span className="card-badge">{item.year}</span>}
                      </div>
                      <div className="card-info">
                        <span className="card-genre">
                          {item.type === 'tv' ? '📺 Serie' : item.type === 'drama' ? '🎭 Chino' : '🎬 Película'}
                        </span>
                        <h3 className="card-title">{item.title}</h3>
                        <p className="card-summary">{item.overview}</p>
                        <div className="card-footer">
                          <span>{item.rating ? `⭐ ${item.rating}` : 'FAST Server'}</span>
                          <span className="card-lang">ES</span>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">🎬</span>
                    <h3 className="empty-title">No hay contenidos en esta sección</h3>
                  </div>
                )}
              </div>
              {activeCategory !== 'Dramas Chinos' && (() => {
                const isLatino = activeCategory === LATINO_MOVIES_CAT;
                const currentPage = isLatino ? latinoMoviePage : (categoryPages[activeCategory] || 1);
                const totalPages = isLatino ? (latinoMovieTotalPages || 50) : (categoryTotalPages[activeCategory] || 50);

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
                  setSelectedItem(null);
                  setIsPlaying(false);
                  if (isLatino) {
                    setLatinoMoviePage(newPage);
                  } else {
                    setCategoryPages(prev => ({
                      ...prev,
                      [activeCategory]: newPage
                    }));
                  }
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                };

                return (
                  <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem', margin: '3rem 0 2rem' }}>
                    {/* Botón Anterior / Regresar */}
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

                    {/* Botones de Páginas Dinámicas */}
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

                      const isActive = p === currentPage;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => goToPage(p)}
                          disabled={isLoading}
                          style={{
                            background: isActive
                              ? 'linear-gradient(135deg, #e50914, #9333ea)'
                              : 'rgba(255, 255, 255, 0.05)',
                            border: isActive ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid var(--border-color)',
                            color: '#fff',
                            minWidth: '42px',
                            height: '42px',
                            padding: '0 0.75rem',
                            borderRadius: '10px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: '700',
                            boxShadow: isActive ? '0 4px 15px rgba(229, 9, 20, 0.45)' : 'none',
                            transition: 'all 0.2s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {p}
                        </button>
                      );
                    })}

                    {/* Botón Siguiente */}
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
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Video Streaming / Details Modal */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedItem(null)}>
              ✕
            </button>

            {/* Video player section or Preview */}
            <div className="movie-player-container">
              {isPlaying ? (
                <iframe
                  src={embedUrl}
                  className="player-iframe"
                  allowFullScreen
                  allow="autoplay; encrypted-media; picture-in-picture"
                  title={selectedItem.title}
                />
              ) : (
                <button 
                  type="button"
                  className="player-placeholder-btn" 
                  style={{ 
                    backgroundImage: `linear-gradient(to top, rgba(11, 12, 22, 0.95) 0%, rgba(11, 12, 22, 0.45) 50%, rgba(11, 12, 22, 0.75) 100%), url(${selectedItem.backdrop || selectedItem.poster})`,
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
                    Haga clic para reproducir
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
                <span>📺</span> Reproductor y Servidores
              </button>
              <button 
                type="button" 
                className={`modal-tab-btn ${modalTab === 'cast' ? 'active' : ''}`}
                onClick={() => setModalTab('cast')}
              >
                <span>👥</span> Reparto y Dirección {selectedItem.cast?.length ? `(${selectedItem.cast.length})` : ''}
              </button>
              {selectedItem.trailerKey && (
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

            {/* TAB 1: REPRODUCTOR Y SERVIDORES */}
            {modalTab === 'player' && (
              <div className="modal-tab-body">
                {/* Server Selector con filtro de Idioma */}
                {selectedItem.type !== 'drama' && selectedItem.type !== 'latino-movie' && (
                  <div className="player-servers-block">
                    <div className="player-subbar">
                      <div className="player-title-info">
                        <span className="bullet-dot">•</span>
                        <span className="player-title-text">
                          {selectedItem.title} 
                          {selectedItem.type === 'tv' && ` - Temp. ${selectedSeason}, Ep. ${selectedEpisode}`}
                        </span>
                      </div>
                      {/* Informacion de Servidores y Audio */}
                      <div className="latino-notice-pill">
                        <span>🇲🇽</span>
                        <span><strong>Audio Latino:</strong> UnLimPlay reproduce en Español Latino 1080p. Vimeus temporalmente con caída de servidor (Error 522).</span>
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
                      {SERVERS.map(srv => (
                        <button 
                          key={srv.id}
                          type="button"
                          className={`server-pill-btn ${selectedServer === srv.id ? 'active' : ''}`}
                          onClick={() => { 
                            setSelectedServer(srv.id); 
                            setIsPlaying(true); 
                          }}
                          title={srv.desc}
                        >
                          <span className="server-pill-name">{srv.name}</span>
                          <span className="server-pill-lang">{srv.lang}</span>
                          {srv.badge && <span className="server-pill-badge">{srv.badge}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Latino Movie: server selector from doramasflix */}
                {selectedItem.type === 'latino-movie' && latinoMovieLinks.length > 0 && (
                  <div className="player-servers-block">
                    <div className="player-subbar">
                      <div className="player-title-info">
                        <span className="bullet-dot">•</span>
                        <span className="player-title-text">🗣️ {selectedItem.title}</span>
                      </div>
                    </div>
                    <div className="server-selector-row">
                      {latinoMovieLinks.map(srv => (
                        <button
                          key={srv.id}
                          type="button"
                          className={`server-pill-btn ${activeLatinoServer?.id === srv.id ? 'active' : ''}`}
                          onClick={() => { setActiveLatinoServer(srv); setIsPlaying(true); }}
                        >
                          <span className="server-pill-name">{srv.name}</span>
                          <span className="server-pill-lang">{srv.lang}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading indicator for latino movie links */}
                {selectedItem.type === 'latino-movie' && isLoading && (
                  <div className="player-header" style={{ justifyContent: 'center', padding: '1rem' }}>
                    <div className="player-loading-spinner" style={{ position: 'relative', margin: '0' }}></div>
                    <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)' }}>Cargando servidores...</span>
                  </div>
                )}

                {/* No servers available for latino movie */}
                {selectedItem.type === 'latino-movie' && !isLoading && latinoMovieLinks.length === 0 && (
                  <div className="player-header" style={{ justifyContent: 'center', padding: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>⚠️ No hay servidores disponibles para esta película.</span>
                  </div>
                )}

                {/* Episodes grid selection ONLY FOR TV SERIES / ANIME */}
                {selectedItem.type === 'tv' && selectedItem.seasons && (
                  <div className="episodes-container">
                    <div className="episodes-top-row">
                      <span className="episodes-heading">Seleccionar Episodio</span>
                      <select 
                        className="season-dropdown"
                        value={selectedSeason}
                        onChange={(e) => {
                          setSelectedSeason(Number(e.target.value));
                          setSelectedEpisode(1);
                        }}
                      >
                        {selectedItem.seasons
                          .filter(s => s.season_number > 0)
                          .map(s => (
                            <option key={s.season_number} value={s.season_number}>
                              {s.name || `Temporada ${s.season_number}`} ({s.episode_count} eps)
                            </option>
                          ))
                        }
                      </select>
                    </div>
                    <div className="episodes-bubbles-row">
                      {episodesInSelectedSeason.map(epNum => (
                        <button
                          key={epNum}
                          className={`episode-bubble-btn ${selectedEpisode === epNum ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedEpisode(epNum);
                            setIsPlaying(true);
                          }}
                        >
                          {epNum}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content details body info (Title, Badges, Tagline, Overview, Actions, Terabox) */}
                <div className="modal-info-section">
                  <div className="modal-badges-row">
                    {selectedItem.type === 'tv' ? (
                      <span className="modal-badge-type tv">📺 SERIE</span>
                    ) : selectedItem.type === 'drama' ? (
                      <span className="modal-badge-type drama">🎭 CHINO</span>
                    ) : selectedItem.type === 'latino-movie' ? (
                      <span className="modal-badge-type movie">🎬 PELÍCULA LATINO</span>
                    ) : (
                      <span className="modal-badge-type movie">🎬 PELÍCULA</span>
                    )}
                    {selectedItem.year && <span className="modal-badge-meta">{selectedItem.year}</span>}
                    {selectedItem.rating && <span className="modal-badge-meta">⭐ {selectedItem.rating}</span>}
                    {selectedItem.runtime && <span className="modal-badge-meta">⏱️ {selectedItem.runtime}</span>}
                  </div>

                  <h2 className="modal-main-title">{selectedItem.title}</h2>
                  {selectedItem.tagline && (
                    <p className="modal-tagline">
                      "{selectedItem.tagline}"
                    </p>
                  )}
                  <p className="modal-overview-text">{selectedItem.overview}</p>

                  <div className="modal-actions-row">
                    <button
                      type="button"
                      className="btn-modal-list"
                      onClick={async () => {
                        await toggleFavorite(selectedItem);
                        setSelectedItem({ ...selectedItem });
                      }}
                    >
                      {isFavorite(selectedItem.id) ? '❤️ En Mi Lista' : '🤍 Agregar a Mi Lista'}
                    </button>

                    <button
                      type="button"
                      className="btn-modal-cast"
                      onClick={() => {
                        const urlToCast = embedUrl || window.location.href;
                        castWithWebVideoCaster(urlToCast, selectedItem.title);
                      }}
                    >
                      📱 Transmitir a TV (Web Video Caster)
                    </button>
                  </div>
                  
                  {/* Actions box with Terabox downloads or info */}
                  <div className="modal-download-box">
                    <div className="modal-download-content">
                      <strong className="modal-download-title">
                        {selectedItem.type === 'drama' ? 'Dramas Chinos FAST Stream' : 'Servidor de Descarga Rápida'}
                      </strong>
                      <span className="modal-download-sub">
                        {selectedItem.type === 'drama' 
                          ? 'Este drama se transmite en vivo a través de servidores externos integrados.' 
                          : 'Puedes descargar este contenido directamente en alta calidad a tu cuenta de Terabox.'}
                      </span>
                    </div>
                    {selectedItem.terabox && selectedItem.terabox !== '#' && (
                      <a 
                        href={selectedItem.terabox}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-terabox-download"
                      >
                        📥 Descargar en Terabox
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: REPARTO Y DIRECCIÓN (DONDEVER STYLE) */}
            {modalTab === 'cast' && (
              <div className="modal-cast-section">
                {selectedItem.directors && selectedItem.directors.length > 0 && (
                  <div className="directors-container">
                    <h3 className="section-subtitle">🎬 Dirección</h3>
                    <div className="directors-list">
                      {selectedItem.directors.map(dir => (
                        <div key={dir.id} className="director-item">
                          <div className="cast-photo-wrapper">
                            {dir.photo ? (
                              <img src={dir.photo} alt={dir.name} className="cast-photo" />
                            ) : (
                              <div className="cast-photo-placeholder">🎬</div>
                            )}
                          </div>
                          <div className="director-name">{dir.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <h3 className="section-subtitle">👥 Reparto Principal</h3>
                {isLoading && !selectedItem.cast ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '2rem 0' }}>
                    <div className="player-loading-spinner" style={{ position: 'relative', margin: 0 }}></div>
                    <span style={{ color: 'var(--text-secondary)' }}>Cargando información del elenco...</span>
                  </div>
                ) : selectedItem.cast && selectedItem.cast.length > 0 ? (
                  <div className="cast-grid">
                    {selectedItem.cast.map(actor => (
                      <div key={actor.id} className="cast-card">
                        <div className="cast-photo-wrapper">
                          {actor.photo ? (
                            <img src={actor.photo} alt={actor.name} className="cast-photo" loading="lazy" />
                          ) : (
                            <div className="cast-photo-placeholder">👤</div>
                          )}
                        </div>
                        <div className="cast-details">
                          <span className="cast-name" title={actor.name}>{actor.name}</span>
                          {actor.character && <span className="cast-character" title={actor.character}>{actor.character}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-data-msg">No hay información de elenco disponible para este título.</p>
                )}
              </div>
            )}

            {/* TAB 3: TRÁILER OFICIAL (DONDEVER STYLE) */}
            {modalTab === 'trailer' && (
              <div className="modal-trailer-section">
                {selectedItem.trailerKey ? (
                  <div className="trailer-player-container">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${selectedItem.trailerKey}?autoplay=1`}
                      title={`Tráiler de ${selectedItem.title}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="trailer-iframe"
                    />
                  </div>
                ) : (
                  <p className="no-data-msg">No hay tráiler oficial disponible en este momento.</p>
                )}
              </div>
            )}

            {/* TAB 4: FICHA TÉCNICA Y DETALLES */}
            {modalTab === 'details' && (
              <div className="modal-details-section">
                <div className="details-grid">
                  {selectedItem.originalTitle && (
                    <div className="detail-row">
                      <span className="detail-label">Título Original</span>
                      <span className="detail-value">{selectedItem.originalTitle}</span>
                    </div>
                  )}
                  {selectedItem.tagline && (
                    <div className="detail-row">
                      <span className="detail-label">Lema</span>
                      <span className="detail-value italic">"{selectedItem.tagline}"</span>
                    </div>
                  )}
                  {selectedItem.releaseDateFull && (
                    <div className="detail-row">
                      <span className="detail-label">Fecha de Estreno</span>
                      <span className="detail-value">{selectedItem.releaseDateFull}</span>
                    </div>
                  )}
                  {selectedItem.runtime && (
                    <div className="detail-row">
                      <span className="detail-label">Duración</span>
                      <span className="detail-value">{selectedItem.runtime}</span>
                    </div>
                  )}
                  {selectedItem.country && (
                    <div className="detail-row">
                      <span className="detail-label">País de Origen</span>
                      <span className="detail-value">{selectedItem.country}</span>
                    </div>
                  )}
                  {selectedItem.genres && selectedItem.genres.length > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">Géneros</span>
                      <span className="detail-value">{selectedItem.genres.join(', ')}</span>
                    </div>
                  )}
                  {selectedItem.rating && (
                    <div className="detail-row">
                      <span className="detail-label">Calificación TMDb</span>
                      <span className="detail-value">⭐ {selectedItem.rating} / 10 {selectedItem.voteCount ? `(${selectedItem.voteCount} votos)` : ''}</span>
                    </div>
                  )}
                  {selectedItem.status && (
                    <div className="detail-row">
                      <span className="detail-label">Estado</span>
                      <span className="detail-value">{selectedItem.status}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
