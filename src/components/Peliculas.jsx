import React, { useState, useEffect, useMemo } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { SkeletonGrid } from './SkeletonLoader';
import { saveWatchProgress, toggleFavorite, isFavorite } from '../utils/storage';
import catalogData from '../data/catalog.json';
import dramasData from '../data/dramas.json';

const TMDB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiMGM4MjRjMmFkMzllODUwNmE5ZGUzOGI5ZTA2ZjJmZiIsIm5iZiI6MTc0ODI3MjY1Ni43MDMsInN1YiI6IjY4MzQ4NjEwNjFmMWZlZmI4YmViMzYxZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KUIiE74vCOP05_Y0M5CKyCBtj9m5lN1WzCfZ6bQn6Xs';
const TMDB = 'https://api.themoviedb.org/3';
const IMG  = 'https://image.tmdb.org/t/p/w500';
const BACK = 'https://image.tmdb.org/t/p/original';
const HDR  = { Authorization: `Bearer ${TMDB_KEY}` };

const VIMEUS_VIEW_KEY = 'KThsRRoYzOilpZpoAf-eQMKv1cN3ULOBQxPk6QmeL-A';
const VIMEUS_PARAMS = '&title=PIRU_TV&theme=red&font=v3&overlay=v5&selector=v3&playUI=v3&epanel=v3';

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
  
  const [tmdbCache, setTmdbCache] = useState({});
  const [discoverCache, setDiscoverCache] = useState({}); // Cache for TMDB discover results
  const [categoryPages, setCategoryPages] = useState({}); // Current loaded page for each category
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Dashboard special items
  const [heroItem, setHeroItem] = useState(null);
  const [heroList, setHeroList] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [top5Items, setTop5Items] = useState([]);
  const [homeCategoriesData, setHomeCategoriesData] = useState({});

  // Player state inside modal
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedServer, setSelectedServer] = useState('vimeus');
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Doramasflix Latino Movies state
  const [latinoMovies, setLatinoMovies] = useState([]);
  const [latinoMoviePage, setLatinoMoviePage] = useState(1);
  const [latinoMovieTotalPages, setLatinoMovieTotalPages] = useState(1);
  const [latinoMovieLinks, setLatinoMovieLinks] = useState([]);
  const [activeLatinoServer, setActiveLatinoServer] = useState(null);

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
        titulo: selectedItem.title,
        portada: selectedItem.poster,
        type: selectedItem.type,
        season: selectedSeason,
        episode: selectedEpisode
      });
    }
  }, [selectedItem, isPlaying, selectedSeason, selectedEpisode]);

  // Combine categories: Home + catalog genres + Dramas Chinos
  const categories = useMemo(() => {
    return ['Home', ...Object.keys(catalogData), 'Dramas Chinos', LATINO_MOVIES_CAT];
  }, []);

  // Fetch TMDB helper function
  const fetchItemDetails = async (id, type, terabox = null) => {
    try {
      const res = await fetch(`${TMDB}/${type}/${id}?language=es-ES`, { headers: HDR });
      if (res.ok) {
        const data = await res.json();
        return {
          id,
          type,
          terabox,
          title: data.title || data.name || '—',
          poster: data.poster_path ? `${IMG}${data.poster_path}` : 'https://via.placeholder.com/160x240?text=?',
          backdrop: data.backdrop_path ? `${BACK}${data.backdrop_path}` : null,
          overview: data.overview || 'Sin descripción disponible.',
          year: (data.release_date || data.first_air_date || '').slice(0, 4) || '—',
          rating: data.vote_average ? Math.round(data.vote_average * 10) / 10 : null,
          genres: (data.genres || []).map(g => g.name),
          runtime: data.runtime ? `${data.runtime} min` : (data.episode_run_time?.[0] ? `~${data.episode_run_time[0]} min/ep` : ''),
          seasons: data.seasons || null
        };
      }
    } catch (e) {
      console.error(`Error fetching TMDB details for ${type} ${id}:`, e);
    }
    return null;
  };

  // Fetch dashboard items on mount
  useEffect(() => {
    const loadDashboard = async () => {
      // 1. Fetch Hero item
      let hero = await fetchItemDetails(HERO_REF.id, HERO_REF.type);

      // 2. Fetch Top 5 items
      const top5 = await Promise.all(
        TOP5_REFS.map(ref => fetchItemDetails(ref.id, ref.type))
      );
      const cleanTop5 = top5.filter(Boolean);
      setTop5Items(cleanTop5);

      const heroes = [hero, ...cleanTop5].filter(Boolean);
      setHeroList(heroes);
      if (heroes.length > 0) setHeroItem(heroes[0]);

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
      const loadedDiscover = discoverCache[activeCategory] || [];
      const requiredLength = activePage * 20;

      if (loadedDiscover.length < requiredLength && DISCOVER_MAP[activeCategory]) {
        try {
          const type = activeCategory === 'Series' || activeCategory === 'Anime' ? 'tv' : 'movie';
          const discoverPath = DISCOVER_MAP[activeCategory];
          
          const res = await fetch(`${TMDB}${discoverPath}&language=es-ES&sort_by=popularity.desc&page=${activePage}`, { headers: HDR });
          if (res.ok) {
            const data = await res.json();
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

            setDiscoverCache(prev => {
              const existing = prev[activeCategory] || [];
              const existingIds = new Set(existing.map(e => e.id));
              const filteredNew = results.filter(r => !existingIds.has(r.id));
              return {
                ...prev,
                [activeCategory]: [...existing, ...filteredNew]
              };
            });
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

    // Curated items first
    const curatedRefs = catalogData[activeCategory] || [];
    const curated = curatedRefs.map(item => tmdbCache[`${item.type}-${item.id}`]).filter(Boolean);

    // Discover results second
    const discovered = discoverCache[activeCategory] || [];

    // Filter out duplicates (curated items shouldn't appear in discover)
    const curatedIds = new Set(curated.map(c => c.id));
    const filteredDiscovered = discovered.filter(d => !curatedIds.has(d.id));

    return [...curated, ...filteredDiscovered];
  }, [activeCategory, tmdbCache, discoverCache, latinoMovies]);

  // Open modal handler
  const handleOpenItem = async (item) => {
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

    // If the item doesn't have seasons loaded yet (e.g. from search results of type TV show),
    // we fetch full details to load the seasons array!
    let fullItem = item;
    if (item.type === 'tv' && !item.seasons) {
      setIsLoading(true);
      const fullDetails = await fetchItemDetails(item.id, item.type, item.terabox);
      if (fullDetails) {
        fullItem = { ...item, ...fullDetails };
      }
      setIsLoading(false);
    }

    setSelectedItem(fullItem);
    setIsPlaying(false);
    setSelectedSeason(1);
    setSelectedEpisode(1);
    setSelectedServer('vimeus'); // Vimeus is Spanish-first by default
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
    if (selectedServer === 'vimeus') {
      const vk = VIMEUS_VIEW_KEY ? `&view_key=${encodeURIComponent(VIMEUS_VIEW_KEY)}` : '';
      if (selectedItem.type === 'movie') {
        return `https://vimeus.com/e/movie?tmdb=${id}${vk}${VIMEUS_PARAMS}`;
      }
      const kind = selectedItem.category === 'Anime' ? 'anime' : 'serie';
      return `https://vimeus.com/e/${kind}?tmdb=${id}&se=${selectedSeason}&ep=${selectedEpisode}${vk}${VIMEUS_PARAMS}`;
    }

    if (selectedServer === 'vidsrc') {
      if (selectedItem.type === 'movie') {
        return `https://vidsrc.xyz/embed/movie/${id}?ds_lang=es`;
      }
      return `https://vidsrc.xyz/embed/tv/${id}/${selectedSeason}-${selectedEpisode}?ds_lang=es`;
    }

    if (selectedServer === '2embed') {
      if (selectedItem.type === 'movie') {
        return `https://www.2embed.cc/embed/${id}?lang=es`;
      }
      return `https://www.2embed.cc/embedtv/${id}&s=${selectedSeason}&e=${selectedEpisode}&lang=es`;
    }

    return '';
  }, [selectedItem, selectedServer, selectedSeason, selectedEpisode, activeLatinoServer]);

  return (
    <div className="peliculas-container">
      <div className="section-header">
        <h1 className="section-title">Películas y Series</h1>
        <div className="controls-group">
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar cualquier peli o serie del mundo..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => {
                setSelectedItem(null);
                setIsPlaying(false);
                setSearchTerm(e.target.value);
                if (e.target.value.trim() !== '') {
                  setActiveCategory('Search');
                } else {
                  setActiveCategory('Home');
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Categories badges */}
      <div className="filters-wrapper">
        {categories.map(cat => (
          <button
            key={cat}
            className={`filter-badge ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => {
              setSelectedItem(null);
              setIsPlaying(false);
              setActiveCategory(cat);
              setSearchTerm('');
            }}
          >
            {cat === 'Home' ? '🏠 Inicio' : cat}
          </button>
        ))}
      </div>

      {/* Render based on mode (Search vs Category vs Home Dashboard) */}
      {activeCategory === 'Search' ? (
        <div className="search-results-section">
          <h2 className="dashboard-section-title">Resultados globales en PIRU TV</h2>
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
                  <h3 className="empty-title">No se encontraron películas o series</h3>
                  <p>Prueba buscando otro título en español o inglés.</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeCategory === 'Home' ? (
        // DASHBOARD HOME STATE (PREMIUM DIRECTORY)
        <div className="dashboard-home">
          {/* Hero Banner with Dynamic Auto-Rotation */}
          {heroItem && (
            <div 
              className="hero-banner"
              style={{ backgroundImage: `url(${heroItem.backdrop || heroItem.poster})` }}
            >
              <div className="hero-content">
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span className="hero-tag">🔥 Trending #{heroIndex + 1}</span>
                  {heroItem.rating && (
                    <span className="hero-tag" style={{ background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                      ⭐ {heroItem.rating}
                    </span>
                  )}
                  {heroItem.year && (
                    <span className="hero-tag" style={{ background: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                      {heroItem.year}
                    </span>
                  )}
                </div>
                <h2 className="hero-title">{heroItem.title}</h2>
                <p className="hero-overview">{heroItem.overview}</p>
                <div className="hero-buttons">
                  <button className="btn-hero-play" onClick={() => handleOpenItem(heroItem)}>
                    <span>▶ Ver ahora</span>
                  </button>
                  <button className="btn-hero-info" onClick={() => handleOpenItem(heroItem)}>
                    <span>ℹ️ Más info</span>
                  </button>
                </div>
              </div>

              {/* Slide Dots Controls */}
              {heroList.length > 1 && (
                <div style={{
                  position: 'absolute',
                  bottom: '1.5rem',
                  right: '2rem',
                  zIndex: 10,
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center'
                }}>
                  {heroList.map((h, i) => (
                    <button
                      key={h.id || i}
                      onClick={() => {
                        setHeroIndex(i);
                        setHeroItem(heroList[i]);
                      }}
                      style={{
                        width: heroIndex === i ? '24px' : '10px',
                        height: '10px',
                        borderRadius: '5px',
                        border: 'none',
                        background: heroIndex === i ? '#e50914' : 'rgba(255, 255, 255, 0.4)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                      title={h.title}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Top 5 Películas de Hoy (Giant Numbers) */}
          {top5Items.length > 0 && (
            <div className="dashboard-section">
              <h2 className="dashboard-section-title">Top 5 Películas de Hoy</h2>
              <div className="top5-row">
                {top5Items.map((item, index) => (
                  <button 
                    type="button"
                    key={`${item.type}-${item.id}`} 
                    className="top5-card"
                    onClick={() => handleOpenItem(item)}
                    style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                  >
                    <div className="top5-number-container">{index + 1}</div>
                    <div className="top5-poster-container">
                      <img 
                        src={item.poster} 
                        alt={item.title} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category Horizontal Lists with Ver más → button */}
          {Object.keys(catalogData).map((category) => {
            const items = homeCategoriesData[category] || [];
            if (items.length === 0) return null;
            return (
              <div key={category} className="dashboard-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h2 className="dashboard-section-title" style={{ margin: 0, border: 'none' }}>
                    {category}
                  </h2>
                  <button
                    className="server-btn active"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedItem(null);
                      setIsPlaying(false);
                      setActiveCategory(category);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Ver más →
                  </button>
                </div>
                <div className="carousel-row">
                  <div className="carousel-scroll">
                    {items.map((item) => (
                      <button 
                        type="button"
                        key={`${item.type}-${item.id}`} 
                        className="carousel-item-card media-card"
                        onClick={() => handleOpenItem(item)}
                        style={{ textAlign: 'left', font: 'inherit', color: 'inherit', padding: 0 }}
                      >
                        <div className="card-thumbnail-wrapper" style={{ aspectRatio: '2/3', width: '150px' }}>
                          <img 
                            src={item.poster} 
                            alt={item.title} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
                        </div>
                        <div className="card-info" style={{ width: '150px', padding: '0.5rem 0 0' }}>
                          <h4 className="card-title" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // CATEGORY VIEW GRID
        <div className="category-results">
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
              {activeCategory !== 'Dramas Chinos' && currentItems.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.4rem', margin: '2.5rem 0 1rem' }}>
                  {Array.from({ length: (categoryPages[activeCategory] || 1) + 1 }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => {
                        setSelectedItem(null);
                        setIsPlaying(false);
                        setCategoryPages(prev => ({
                          ...prev,
                          [activeCategory]: pageNum
                        }));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={isLoading}
                      style={{
                        background: (categoryPages[activeCategory] || 1) === pageNum
                          ? 'linear-gradient(135deg, #6c63ff, #9b59b6)'
                          : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        color: '#fff',
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: (categoryPages[activeCategory] || 1) === pageNum ? '700' : '400',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {pageNum}
                    </button>
                  ))}
                  {!isLoading && (
                    <button
                      onClick={() => {
                        setSelectedItem(null);
                        setIsPlaying(false);
                        setCategoryPages(prev => ({
                          ...prev,
                          [activeCategory]: (prev[activeCategory] || 1) + 1
                        }));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        color: '#aaa',
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Siguiente →
                    </button>
                  )}
                </div>
              )}
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
                  allow="autoplay; encrypted-media"
                  title={selectedItem.title}
                />
              ) : (
                <button 
                  type="button"
                  className="player-placeholder-btn" 
                  style={{ 
                    backgroundImage: `linear-gradient(to top, rgba(15,15,28,0.95), rgba(15,15,28,0.4)), url(${selectedItem.poster})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center 30%',
                    flexDirection: 'column', 
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

            {/* Server and Episode selectors if playing and item is TV Series */}
            {isPlaying && selectedItem.type !== 'drama' && selectedItem.type !== 'latino-movie' && (
              <div className="player-header">
                <div className="player-title-info">
                  <span className="pulse-dot"></span>
                  <span>
                    Reproduciendo: {selectedItem.title} 
                    {selectedItem.type === 'tv' && ` - Temp. ${selectedSeason}, Ep. ${selectedEpisode}`}
                  </span>
                </div>
                <div className="server-selector">
                  <button 
                    className={`server-btn ${selectedServer === 'vimeus' ? 'active' : ''}`}
                    onClick={() => setSelectedServer('vimeus')}
                  >
                    Vimeus
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

            {/* Latino Movie: server selector from doramasflix */}
            {selectedItem.type === 'latino-movie' && latinoMovieLinks.length > 0 && (
              <div className="player-header">
                <div className="player-title-info">
                  <span className="pulse-dot"></span>
                  <span>🗣️ {selectedItem.title}</span>
                </div>
                <div className="server-selector">
                  {latinoMovieLinks.map(srv => (
                    <button
                      key={srv.id}
                      className={`server-btn ${activeLatinoServer?.id === srv.id ? 'active' : ''}`}
                      onClick={() => { setActiveLatinoServer(srv); setIsPlaying(true); }}
                    >
                      {srv.name} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>[{srv.lang}]</span>
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

            {/* Episodes grid selection for TV Series / Anime */}
            {selectedItem.type === 'tv' && selectedItem.seasons && (
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
                <div className="episodes-grid">
                  {episodesInSelectedSeason.map(epNum => (
                    <button
                      key={epNum}
                      className={`episode-btn ${selectedEpisode === epNum ? 'active' : ''}`}
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

            {/* Modal details body info */}
            <div className="modal-body">
              <div className="modal-meta">
                <span className="modal-genre">
                  {selectedItem.type === 'tv' ? '📺 Serie' : selectedItem.type === 'drama' ? '🎭 Chino' : selectedItem.type === 'latino-movie' ? '🗣️ Latino' : '🎬 Película'}
                </span>
                {selectedItem.year && <span className="modal-lang">{selectedItem.year}</span>}
                {selectedItem.rating && <span className="modal-lang">⭐ {selectedItem.rating}</span>}
                {selectedItem.runtime && <span className="modal-lang">⏱️ {selectedItem.runtime}</span>}
              </div>
              <h2 className="modal-title">{selectedItem.title}</h2>
              <p className="modal-summary">{selectedItem.overview}</p>

              <div style={{ display: 'flex', gap: '1rem', margin: '1.25rem 0' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    flex: 'none',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem',
                    background: isFavorite(selectedItem.id) ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    border: `1px solid ${isFavorite(selectedItem.id) ? '#ef4444' : 'rgba(255, 255, 255, 0.2)'}`,
                    color: isFavorite(selectedItem.id) ? '#fca5a5' : '#fff',
                    boxShadow: isFavorite(selectedItem.id) ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none'
                  }}
                  onClick={async () => {
                    await toggleFavorite(selectedItem);
                    setSelectedItem({ ...selectedItem });
                  }}
                >
                  {isFavorite(selectedItem.id) ? '❤️ En Mi Lista' : '🤍 Agregar a Mi Lista'}
                </button>
              </div>
              
              {/* Actions box with Terabox downloads or info */}
              <div className="fallback-box">
                <div>
                  <strong style={{ color: '#fff', display: 'block', marginBottom: '0.2rem' }}>
                    {selectedItem.type === 'drama' ? 'Dramas Chinos FAST Stream' : 'Servidor de Descarga Rápida'}
                  </strong>
                  <span>
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
                    className="btn-primary"
                    style={{ flex: 'none', padding: '0.6rem 1.2rem', fontSize: '0.9rem', width: 'auto', alignSelf: 'center', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}
                  >
                    📥 Descargar en Terabox
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
