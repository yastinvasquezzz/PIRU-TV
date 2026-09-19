import React, { useState, useEffect, useMemo } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { SkeletonGrid } from './SkeletonLoader';
import { saveWatchProgress, toggleFavorite, isFavorite, getWatchHistory } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';

const PROXY_URL = import.meta.env.DEV
  ? '/api/gql'
  : 'https://pirutv-proxy.skillful-part.workers.dev';

const queryFlix = async (query, variables = {}) => {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) {
    throw new Error(`GraphQL request failed: status ${res.status}`);
  }
  return await res.json();
};

const SEARCH_FLIX_QUERY = `
  query searchDorama($input: String!) {
    searchDorama(input: $input, limit: 20) {
      _id
      slug
      name
      name_es
      names
      languages
      poster_path
      backdrop_path
      first_air_date
      overview
    }
  }
`;

const LIST_DORAMAS_QUERY = `
  query listDoramas(
    $page: Int
    $perPage: Int
    $sort: SortFindManyDoramaInput
    $filter: FilterFindManyDoramaInput
  ) {
    paginationDorama(
      page: $page
      perPage: $perPage
      sort: $sort
      filter: $filter
    ) {
      count
      items {
        _id
        name
        name_es
        slug
        poster_path
        backdrop_path
        first_air_date
        overview
        languages
      }
    }
  }
`;

const DETAIL_DORAMA_EXTRA_QUERY = `
  query detailDoramaExtra($slug: String!, $season_number: Float!) {
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
        type_serie: "dorama"
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
  query GetEpisodeLinks($id: MongoID!, $app: String) {
    getEpisodeLinks(id: $id, app: $app) {
      links_online
    }
  }
`;

const LIST_MOVIES_QUERY = `
  query listMovies(
    $page: Int
    $perPage: Int
    $sort: SortFindManyMovieInput
    $filter: FilterFindManyMovieInput
  ) {
    paginationMovie(
      page: $page
      perPage: $perPage
      sort: $sort
      filter: $filter
    ) {
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
      }
    }
  }
`;

const SEARCH_MOVIES_QUERY = `
  query searchMovie($input: String!) {
    searchMovie(input: $input, limit: 20) {
      _id
      slug
      name
      name_es
      languages
      poster_path
      backdrop_path
      release_date
      overview
    }
  }
`;

const MOVIE_LINKS_QUERY = `
  query getMovieLinks($slug: String!) {
    getMovieLinks(slug: $slug) {
      links_online
    }
  }
`;

const SERVER_NAMES = {
  "60ac0eb8ac46a43f59a5b21f": "Streamtape",
  "60ac0d08ac46a43f59a5b21d": "Mixdrop",
  "60ac0f2eac46a43f59a5b221": "Uqload",
  "60ac0f52ac46a43f59a5b222": "Mp4Upload",
  "60ac0abeac46a43f59a5b21b": "Okru",
  "60ac0f0eac46a43f59a5b220": "Voe",
  "60ac0e7eac46a43f59a5b21e": "Dood",
  "64b19a4035461c5d64ef5b84": "Filemoon",
  "64b18fdc35461c5d64ef5b59": "Streamwish",
  "65c6b7f9149d4675d1547a5c": "VidHide",
  "61707703fa461256758155c5": "Mega"
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

const KDRAMA_CATEGORIES = [
  'Inicio',
  '🍙 Doramas Latino',
  '💬 Doramas Sub Español',
  '🎬 Películas Asiáticas',
  '❤️ Mi Lista'
];

export default function Kdramas() {
  const [activeCategory, setActiveCategory] = useState('Inicio');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMuted, setIsMuted] = useState(true);

  // Home curated rows data
  const [homeLatinoDoramas, setHomeLatinoDoramas] = useState([]);
  const [homeSubDoramas, setHomeSubDoramas] = useState([]);
  const [homeAsianMovies, setHomeAsianMovies] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);

  // Category grid data & pagination
  const [gridItems, setGridItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // Watch history
  const [watchHistory, setWatchHistory] = useState(getWatchHistory());

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

  // Load initial home datasets on mount (Doramas Latino, Sub, Movies)
  useEffect(() => {
    const loadHomeData = async () => {
      try {
        // 1. Latino Doramas
        const resLatino = await queryFlix(LIST_DORAMAS_QUERY, {
          page: 1,
          perPage: 20,
          sort: 'POPULARITY_DESC',
          filter: { languages: "38" }
        });
        const latinoItems = (resLatino.data?.paginationDorama?.items || []).map(x => ({
          id: x._id,
          type: 'dorama',
          title: x.name_es || x.name || 'Kdrama',
          poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://via.placeholder.com/200x300?text=Kdrama',
          backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
          overview: x.overview || 'Sin descripción disponible.',
          slug: x.slug,
          year: (x.first_air_date || '').slice(0, 4) || '2026',
          lang: 'LAT'
        }));
        setHomeLatinoDoramas(latinoItems);

        // 2. Subtitled Doramas
        const resSub = await queryFlix(LIST_DORAMAS_QUERY, {
          page: 1,
          perPage: 20,
          sort: 'POPULARITY_DESC',
          filter: {}
        });
        const subItems = (resSub.data?.paginationDorama?.items || []).map(x => ({
          id: x._id,
          type: 'dorama',
          title: x.name_es || x.name || 'Kdrama',
          poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://via.placeholder.com/200x300?text=Kdrama',
          backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
          overview: x.overview || 'Sin descripción disponible.',
          slug: x.slug,
          year: (x.first_air_date || '').slice(0, 4) || '2026',
          lang: 'SUB'
        }));
        setHomeSubDoramas(subItems);

        // 3. Asian Movies
        const resMovies = await queryFlix(LIST_MOVIES_QUERY, {
          page: 1,
          perPage: 20,
          sort: 'POPULARITY_DESC',
          filter: {}
        });
        const movieItems = (resMovies.data?.paginationMovie?.items || []).map(x => ({
          id: x._id,
          type: 'movie',
          title: x.name_es || x.name || 'Película',
          poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://via.placeholder.com/200x300?text=Película',
          backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
          overview: x.overview || 'Sin descripción disponible.',
          slug: x.slug,
          year: (x.release_date || '').slice(0, 4) || '2026',
          lang: 'LAT'
        }));
        setHomeAsianMovies(movieItems);
      } catch (err) {
        console.error('Error loading Kdramas home data:', err);
      }
    };

    loadHomeData();
  }, []);

  // Hero billboard item & rotation
  const heroList = useMemo(() => {
    return homeLatinoDoramas.length > 0 ? homeLatinoDoramas.slice(0, 8) : [];
  }, [homeLatinoDoramas]);
  const heroItem = heroList[heroIndex] || heroList[0];

  useEffect(() => {
    if (heroList.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroList.length);
    }, 7500);
    return () => clearInterval(timer);
  }, [heroList]);

  // Top 10 items for giant ranking row
  const top10Kdramas = useMemo(() => {
    return homeLatinoDoramas.slice(0, 10);
  }, [homeLatinoDoramas]);

  // Filtered continue watching for kdrama
  const continueWatchingKdramas = useMemo(() => {
    return (watchHistory || []).filter(item => item.type === 'kdrama' || item.type === 'dorama').slice(0, 10);
  }, [watchHistory]);

  // Load category grid when not in 'Inicio'
  useEffect(() => {
    if (activeCategory === 'Inicio' || activeCategory === '❤️ Mi Lista' || searchTerm.trim()) {
      return;
    }

    const loadCategory = async () => {
      setIsLoading(true);
      try {
        const isMovies = activeCategory === '🎬 Películas Asiáticas';
        const isSub = activeCategory === '💬 Doramas Sub Español';
        const query = isMovies ? LIST_MOVIES_QUERY : LIST_DORAMAS_QUERY;
        const filter = isSub ? {} : (isMovies ? {} : { languages: "38" });

        const res = await queryFlix(query, {
          page: page,
          perPage: 24,
          sort: 'POPULARITY_DESC',
          filter: filter
        });

        if (isMovies) {
          const data = res.data?.paginationMovie;
          if (data) {
            setTotalPages(Math.ceil((data.count || 0) / 24));
            setGridItems((data.items || []).map(x => ({
              id: x._id,
              type: 'movie',
              title: x.name_es || x.name || 'Película',
              poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://via.placeholder.com/200x300?text=Película',
              backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
              overview: x.overview || 'Sin descripción disponible.',
              slug: x.slug,
              year: (x.release_date || '').slice(0, 4) || '—',
              lang: 'LAT'
            })));
          }
        } else {
          const data = res.data?.paginationDorama;
          if (data) {
            setTotalPages(Math.ceil((data.count || 0) / 24));
            setGridItems((data.items || []).map(x => ({
              id: x._id,
              type: 'dorama',
              title: x.name_es || x.name || 'Kdrama',
              poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://via.placeholder.com/200x300?text=Kdrama',
              backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
              overview: x.overview || 'Sin descripción disponible.',
              slug: x.slug,
              year: (x.first_air_date || '').slice(0, 4) || '—',
              lang: isSub ? 'SUB' : 'LAT'
            })));
          }
        }
      } catch (err) {
        console.error('Error fetching category kdramas:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCategory();
  }, [activeCategory, page, searchTerm]);

  // Live Search with Debounce
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const [resDoramas, resMovies] = await Promise.all([
          queryFlix(SEARCH_FLIX_QUERY, { input: searchTerm.trim() }),
          queryFlix(SEARCH_MOVIES_QUERY, { input: searchTerm.trim() })
        ]);

        const doramaItems = (resDoramas.data?.searchDorama || []).map(x => ({
          id: x._id,
          type: 'dorama',
          title: x.name_es || x.name || 'Kdrama',
          poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://via.placeholder.com/200x300?text=Kdrama',
          backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
          overview: x.overview || 'Sin descripción disponible.',
          slug: x.slug,
          year: (x.first_air_date || '').slice(0, 4) || '—',
          lang: (x.languages && x.languages.includes('38')) ? 'LAT' : 'SUB'
        }));

        const movieItems = (resMovies.data?.searchMovie || []).map(x => ({
          id: x._id,
          type: 'movie',
          title: x.name_es || x.name || 'Película',
          poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://via.placeholder.com/200x300?text=Película',
          backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
          overview: x.overview || 'Sin descripción disponible.',
          slug: x.slug,
          year: (x.release_date || '').slice(0, 4) || '—',
          lang: 'LAT'
        }));

        setSearchResults([...doramaItems, ...movieItems]);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Current items for active view
  const currentRenderItems = useMemo(() => {
    if (searchTerm.trim()) return searchResults;
    if (activeCategory === '❤️ Mi Lista') {
      return homeLatinoDoramas.filter(d => isFavorite(d.id));
    }
    return gridItems;
  }, [searchTerm, searchResults, activeCategory, homeLatinoDoramas, gridItems]);

  // Handle open drama modal and load seasons & episodes
  const handleOpenDrama = async (drama) => {
    setIsDetailsLoading(true);
    setSelectedDrama(drama);
    setSeasonsList([]);
    setActiveSeason(1);
    setEpisodesData([]);
    setActiveEpisode(1);
    setAllEpisodeLinks([]);
    setServersList([]);
    setActiveServer(null);
    setActivePlayerUrl('');
    setIsPlaying(false);
    setModalTab('player');

    saveWatchProgress({
      id: drama.id,
      title: drama.title,
      poster: drama.poster,
      backdrop: drama.backdrop,
      type: 'kdrama'
    });
    setWatchHistory(getWatchHistory());

    try {
      if (drama.type === 'movie') {
        // Asian Movie: get movie links directly
        const res = await queryFlix(MOVIE_LINKS_QUERY, { slug: drama.slug });
        const links = (res.data?.getMovieLinks?.links_online) || [];
        setAllEpisodeLinks(links);
      } else {
        // Kdrama Serie: get seasons and initial season episodes
        const res = await queryFlix(DETAIL_DORAMA_EXTRA_QUERY, {
          slug: drama.slug,
          season_number: 1
        });

        if (res.data) {
          const seasons = res.data.listSeasons || [];
          setSeasonsList(seasons);

          const episodes = res.data.listEpisodes || [];
          setEpisodesData(episodes);

          if (episodes.length > 0) {
            setActiveEpisode(episodes[0].episode_number);
            const linksRes = await queryFlix(LINKS_FLIX_QUERY, {
              id: episodes[0]._id,
              app: 'com.asiapp.doramasgo'
            });
            const links = (linksRes.data?.getEpisodeLinks?.links_online) || [];
            setAllEpisodeLinks(links);
          }
        }
      }
    } catch (err) {
      console.error('Error opening drama details:', err);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  // Change season
  const handleSeasonChange = async (seasonNum) => {
    if (!selectedDrama || selectedDrama.type === 'movie') return;
    setIsDetailsLoading(true);
    setActiveSeason(seasonNum);
    setActiveEpisode(1);
    setAllEpisodeLinks([]);
    setServersList([]);
    setActiveServer(null);
    setActivePlayerUrl('');

    try {
      const res = await queryFlix(DETAIL_DORAMA_EXTRA_QUERY, {
        slug: selectedDrama.slug,
        season_number: Number(seasonNum)
      });
      if (res.data) {
        const episodes = res.data.listEpisodes || [];
        setEpisodesData(episodes);

        if (episodes.length > 0) {
          setActiveEpisode(episodes[0].episode_number);
          const linksRes = await queryFlix(LINKS_FLIX_QUERY, {
            id: episodes[0]._id,
            app: 'com.asiapp.doramasgo'
          });
          const links = (linksRes.data?.getEpisodeLinks?.links_online) || [];
          setAllEpisodeLinks(links);
        }
      }
    } catch (err) {
      console.error('Error loading season:', err);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  // Change episode
  const handleEpisodeChange = async (epNum) => {
    setIsDetailsLoading(true);
    setActiveEpisode(epNum);
    setAllEpisodeLinks([]);
    setServersList([]);
    setActiveServer(null);
    setActivePlayerUrl('');

    const epObj = episodesData.find(e => e.episode_number === epNum);
    if (epObj) {
      try {
        const linksRes = await queryFlix(LINKS_FLIX_QUERY, {
          id: epObj._id,
          app: 'com.asiapp.doramasgo'
        });
        const links = (linksRes.data?.getEpisodeLinks?.links_online) || [];
        setAllEpisodeLinks(links);
      } catch (err) {
        console.error('Error loading episode links:', err);
      }
    }
    setIsDetailsLoading(false);
  };

  // Zapping: Next / Previous episode
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

  // Format streaming servers from episode links
  useEffect(() => {
    if (allEpisodeLinks && allEpisodeLinks.length > 0) {
      const servers = allEpisodeLinks
        .filter(l => l.embed && l.is_active !== false)
        .map(l => ({
          hash: l._id,
          name: getHostName(l.embed, l.server_ref),
          embed: l.embed,
          lang: String(l.lang) === '38' ? 'LAT' : 'SUB'
        }));

      setServersList(servers);
      if (servers.length > 0) {
        // Prioritize Latino server if available
        const latinoServer = servers.find(s => s.lang === 'LAT') || servers[0];
        setActiveServer(latinoServer);
        setActivePlayerUrl(latinoServer.embed);
      }
    } else {
      setServersList([]);
      setActiveServer(null);
      setActivePlayerUrl('');
    }
  }, [allEpisodeLinks]);

  // Pagination helper
  const getPaginationList = (curr, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (curr <= 3) return [1, 2, 3, 4, 5, '...', total];
    if (curr >= total - 2) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', curr - 1, curr, curr + 1, '...', total];
  };

  const pagesToRender = getPaginationList(page, totalPages);

  const goToPage = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === page || isLoading) return;
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useDpadNavigation({
    onBack: () => {
      if (selectedDrama) {
        setSelectedDrama(null);
        setIsPlaying(false);
      }
    }
  });

  return (
    <div className="peliculas-container netflix-view" style={{ minHeight: '100vh', background: '#141414', color: '#fff' }}>
      
      {/* Netflix Subnav & Category Pills */}
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
          {KDRAMA_CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              className={`filter-badge ${activeCategory === cat && !searchTerm ? 'active' : ''}`}
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

        {/* Search Bar */}
        <div style={{ width: '320px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar kdrama o película asiática..."
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
                  <span className="netflix-match">98% de coincidencia</span>
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

          {/* Netflix Content Rows Section */}
          <div className="netflix-rows-container">
            
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
                        <div className="netflix-progress-fill" style={{ width: '65%' }} />
                      </div>
                      <div className="netflix-continue-info">
                        <span className="netflix-continue-title">{item.title}</span>
                        <span className="netflix-continue-sub">Continuar</span>
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
                        <img src={item.poster} alt={item.title} />
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
                      setActiveCategory('🍙 Doramas Latino');
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
                      setActiveCategory('🍙 Doramas Latino');
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
                        <img src={item.poster} alt={item.title} loading="lazy" />
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

            {/* Row 3: Doramas Sub Español */}
            {homeSubDoramas.length > 0 && (
              <section className="netflix-row-section">
                <div className="netflix-row-header">
                  <h2 
                    className="netflix-row-title"
                    onClick={() => {
                      setActiveCategory('💬 Doramas Sub Español');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    💬 Doramas en Emisión con Subtítulos
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                      chevron_right
                    </span>
                  </h2>
                  <button 
                    className="netflix-explore-all"
                    onClick={() => {
                      setActiveCategory('💬 Doramas Sub Español');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Explorar todos
                  </button>
                </div>
                <div className="netflix-category-scroll">
                  {homeSubDoramas.map((item) => (
                    <button 
                      type="button"
                      key={`scroll-sub-${item.id}`} 
                      className="netflix-poster-card"
                      onClick={() => handleOpenDrama(item)}
                    >
                      <div className="netflix-poster-img-wrap">
                        <img src={item.poster} alt={item.title} loading="lazy" />
                        <div className="netflix-quality-tag">HD</div>
                        <div className="netflix-card-lang-strip">
                          <span className="netflix-pill-sub">SUBTITULADO</span>
                        </div>
                      </div>
                      <span className="netflix-poster-title">{item.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Row 4: Películas Asiáticas */}
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
                        <img src={item.poster} alt={item.title} loading="lazy" />
                        <div className="netflix-quality-tag">FULL HD</div>
                        <div className="netflix-card-lang-strip">
                          <span className="netflix-pill-lat">PELÍCULA</span>
                        </div>
                      </div>
                      <span className="netflix-poster-title">{item.title}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* Netflix Footer */}
          <footer className="netflix-footer">
            <div className="netflix-footer-inner">
              <div className="netflix-copyright">
                © 2026 PIRU TV • Los Mejores Doramas y Kdramas en Español Latino
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
                {searchTerm ? `Resultados para: "${searchTerm}" (${currentRenderItems.length})` : `${activeCategory} (${totalPages > 1 ? `Página ${page} de ${totalPages}` : `${currentRenderItems.length} títulos`})`}
              </h2>
              {activeCategory !== 'Inicio' && !searchTerm && (
                <p style={{ margin: '4px 0 0', color: '#a3a3a3', fontSize: '0.85rem' }}>
                  Catálogo completo en alta definición con servidores rápidos en español latino y subtítulos
                </p>
              )}
            </div>

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
                    <img src={item.poster} alt={item.title} loading="lazy" />
                    <div className="netflix-quality-tag">HD</div>
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
              {isPlaying && activePlayerUrl ? (
                <iframe
                  src={activePlayerUrl}
                  className="player-iframe"
                  title={`${selectedDrama.title} - ${activeEpisode}`}
                  allowFullScreen
                  allow="autoplay; encrypted-media; picture-in-picture"
                />
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
                          key={`srv-${idx}`}
                          type="button"
                          className={`server-pill-btn ${activeServer?.hash === srv.hash ? 'active' : ''}`}
                          onClick={() => {
                            setActiveServer(srv);
                            setActivePlayerUrl(srv.embed);
                            setIsPlaying(true);
                          }}
                        >
                          <span className="server-pill-name">{srv.name}</span>
                          <span className="server-pill-lang">{srv.lang === 'LAT' ? '🇲🇽 LAT' : '💬 SUB'}</span>
                        </button>
                      ))
                    ) : (
                      <div style={{ color: '#a3a3a3', fontSize: '0.85rem', padding: '0.4rem 0' }}>
                        {isDetailsLoading ? 'Cargando servidores...' : 'Cargando enlaces del reproductor...'}
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
                              Temporada {s.season_number}
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
                            key={`bubble-${ep._id || ep.episode_number}`}
                            className={`episode-bubble-btn ${activeEpisode === ep.episode_number ? 'active' : ''}`}
                            onClick={() => {
                              handleEpisodeChange(ep.episode_number);
                              setIsPlaying(true);
                            }}
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
                                key={`list-${ep._id || ep.episode_number}`}
                                type="button"
                                onClick={() => {
                                  handleEpisodeChange(ep.episode_number);
                                  setIsPlaying(true);
                                }}
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
                                    {ep.name_es || ep.name || `Capítulo ${ep.episode_number}`}
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
                      className="btn-modal-list"
                      onClick={async () => {
                        await toggleFavorite(selectedDrama);
                        setSelectedDrama({ ...selectedDrama });
                      }}
                    >
                      {isFavorite(selectedDrama.id) ? '❤️ En Mi Lista' : '🤍 Agregar a Mi Lista'}
                    </button>

                    <button
                      type="button"
                      className="btn-modal-cast"
                      onClick={() => {
                        const urlToCast = activePlayerUrl || window.location.href;
                        castWithWebVideoCaster(urlToCast, selectedDrama.title);
                      }}
                    >
                      📱 Transmitir a TV (Web Video Caster)
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: FICHA TÉCNICA */}
            {modalTab === 'details' && (
              <div className="modal-tab-body" style={{ padding: '1.5rem 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Título Original / Slug</span>
                    <h4 style={{ margin: '4px 0 0', color: '#fff', fontSize: '0.95rem' }}>{selectedDrama.slug || selectedDrama.title}</h4>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Tipo</span>
                    <h4 style={{ margin: '4px 0 0', color: '#ec4899', fontSize: '0.95rem' }}>{selectedDrama.type === 'movie' ? 'Película' : 'Serie / Dorama'}</h4>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Año de Estreno</span>
                    <h4 style={{ margin: '4px 0 0', color: '#fff', fontSize: '0.95rem' }}>{selectedDrama.year}</h4>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Idiomas Disponibles</span>
                    <h4 style={{ margin: '4px 0 0', color: '#34d399', fontSize: '0.95rem' }}>Español Latino & Subtitulado</h4>
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
