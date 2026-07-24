import React, { useState, useEffect, useMemo } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { SkeletonGrid } from './SkeletonLoader';
import { saveWatchProgress, toggleFavorite, isFavorite } from '../utils/storage';

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


// En desarrollo (npm run dev): usa el proxy de Vite /api/gql -> sv1.fluxcedene.net
// En producción: usa el Cloudflare Worker que reenvía sin header Origin
// INSTRUCCIONES: Si la app está en GitHub Pages, despliega el cloudflare-worker.js
// en https://workers.cloudflare.com/ y reemplaza la URL de abajo con la tuya.
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

const LANG_NAMES = {
  "38": "Latino 🗣️",
  "13109": "Coreano 🇰🇷",
  "13110": "Japonés 🇯🇵",
  "13111": "Chino 🇨🇳",
  "13112": "Japonés/Tailandés 🇯🇵🇹🇭",
  "13113": "Taiwanés 🇹🇼",
  "36": "Inglés 🇬🇧"
};

const getHostName = (url, server_ref) => {
  if (SERVER_NAMES[server_ref]) {
    return SERVER_NAMES[server_ref];
  }
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.replace('www.', '').split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch (e) {
    return "Servidor";
  }
};

const VideoPlayer = ({ playerUrl }) => {
  return (
    <iframe
      src={playerUrl}
      style={{ width: '100%', height: '100%', border: 'none', borderRadius: '12px 12px 0 0' }}
      allow="autoplay; encrypted-media"
      allowFullScreen
      title="Kdrama Player"
    />
  );
};

export default function Kdramas() {
  const [activeSubTab, setActiveSubTab] = useState('doramas'); // 'doramas' or 'movies'
  const [dramas, setDramas] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [selectedDrama, setSelectedDrama] = useState(null);
  const [seasonsList, setSeasonsList] = useState([]);
  const [activeSeason, setActiveSeason] = useState(1);
  const [chaptersList, setChaptersList] = useState([]);
  const [episodesData, setEpisodesData] = useState([]);
  const [activeEpisode, setActiveEpisode] = useState(1);
  
  const [allEpisodeLinks, setAllEpisodeLinks] = useState([]);
  const [serversList, setServersList] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [activePlayerUrl, setActivePlayerUrl] = useState('');
  
  const [isTheater, setIsTheater] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  // Handle Smart TV D-Pad Remote Back button
  useDpadNavigation({
    onBack: () => {
      if (isTheater) {
        setIsTheater(false);
      } else if (selectedDrama) {
        setSelectedDrama(null);
      }
    }
  });

  // Track & persist watch history
  useEffect(() => {
    if (selectedDrama && activePlayerUrl) {
      saveWatchProgress({
        id: selectedDrama.id,
        titulo: selectedDrama.titulo,
        portada: selectedDrama.portada,
        type: 'kdrama',
        season: activeSeason,
        episode: activeEpisode
      });
    }
  }, [selectedDrama, activePlayerUrl, activeSeason, activeEpisode]);

  // Load catalog doramas or movies (Latino only or Subtitled)
  useEffect(() => {
    const loadCatalog = async () => {
      setIsLoading(true);
      try {
        const query = activeSubTab === 'movies' ? LIST_MOVIES_QUERY : LIST_DORAMAS_QUERY;
        const filter = activeSubTab === 'sub' ? {} : { languages: "38" };
        const res = await queryFlix(query, {
          page: page,
          perPage: 20,
          sort: 'POPULARITY_DESC',
          filter: filter
        });
        
        if (activeSubTab === 'movies') {
          if (res.data && res.data.paginationMovie) {
            const items = res.data.paginationMovie.items || [];
            const count = res.data.paginationMovie.count || 0;
            setTotalPages(Math.ceil(count / 20));
            
            const formatted = items.map(x => ({
              id: x._id,
              type: 'movie',
              titulo: x.name_es || x.name || '—',
              portada: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://via.placeholder.com/160x240?text=?',
              backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
              description: x.overview || 'Sin descripción disponible.',
              slug: x.slug,
              year: (x.release_date || '').slice(0, 4) || '—'
            }));
            setDramas(formatted);
          }
        } else {
          if (res.data && res.data.paginationDorama) {
            const items = res.data.paginationDorama.items || [];
            const count = res.data.paginationDorama.count || 0;
            setTotalPages(Math.ceil(count / 20));
            
            const formatted = items.map(x => ({
              id: x._id,
              type: 'dorama',
              titulo: x.name_es || x.name || '—',
              portada: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://via.placeholder.com/160x240?text=?',
              backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
              description: x.overview || 'Sin descripción disponible.',
              slug: x.slug,
              year: (x.first_air_date || '').slice(0, 4) || '—'
            }));
            setDramas(formatted);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    if (!searchTerm.trim()) {
      loadCatalog();
    }
  }, [page, searchTerm, activeSubTab]);

  // Search doramas or movies (Latino only or Subtitled)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);
      try {
        const query = activeSubTab === 'movies' ? SEARCH_MOVIES_QUERY : SEARCH_FLIX_QUERY;
        const res = await queryFlix(query, { input: searchTerm });
        
        if (activeSubTab === 'movies') {
          if (res.data && res.data.searchMovie) {
            const items = res.data.searchMovie || [];
            // For sub/movies tab, do we filter languages?
            // Latino tab: languages: "38". Sub tab: no language filter since all are sub.
            const filtered = activeSubTab === 'sub' 
              ? items 
              : items.filter(x => x.languages && x.languages.includes("38"));
            const formatted = filtered.map(x => ({
              id: x._id,
              type: 'movie',
              titulo: x.name_es || x.name || '—',
              portada: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://via.placeholder.com/160x240?text=?',
              backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
              description: x.overview || 'Sin descripción disponible.',
              slug: x.slug,
              year: (x.release_date || '').slice(0, 4) || '—'
            }));
            setSearchResults(formatted);
          }
        } else {
          if (res.data && res.data.searchDorama) {
            const items = res.data.searchDorama || [];
            // For sub/doramas tab: no language filter. For Latino: filter: "38".
            const filtered = activeSubTab === 'sub' 
              ? items 
              : items.filter(x => x.languages && x.languages.includes("38"));
            const formatted = filtered.map(x => ({
              id: x._id,
              type: 'dorama',
              titulo: x.name_es || x.name || '—',
              portada: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://via.placeholder.com/160x240?text=?',
              backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
              description: x.overview || 'Sin descripción disponible.',
              slug: x.slug,
              year: (x.first_air_date || '').slice(0, 4) || '—'
            }));
            setSearchResults(formatted);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, activeSubTab]);

  const handleOpenDrama = async (drama) => {
    setIsDetailsLoading(true);
    setSelectedDrama(drama);
    setSeasonsList([]);
    setActiveSeason(1);
    setChaptersList([]);
    setEpisodesData([]);
    setAllEpisodeLinks([]);
    setServersList([]);
    setActiveServer(null);
    setActivePlayerUrl('');
    setIsTheater(false);
    
    if (drama.type === 'movie') {
      try {
        const linksRes = await queryFlix(MOVIE_LINKS_QUERY, {
          slug: drama.slug
        });
        const links = (linksRes.data && linksRes.data.getMovieLinks && linksRes.data.getMovieLinks.links_online) || [];
        setAllEpisodeLinks(links);
      } catch (e) {
        console.error(e);
      } finally {
        setIsDetailsLoading(false);
      }
      return;
    }

    try {
      const res = await queryFlix(DETAIL_DORAMA_EXTRA_QUERY, {
        slug: drama.slug,
        season_number: 1
      });
      
      if (res.data) {
        const seasons = res.data.listSeasons || [];
        setSeasonsList(seasons);
        
        const episodes = res.data.listEpisodes || [];
        setEpisodesData(episodes);
        
        const chaps = episodes.map(ep => ep.episode_number);
        setChaptersList(chaps);
        
        if (episodes.length > 0) {
          const firstEp = episodes[0];
          setActiveEpisode(firstEp.episode_number);
          
          const linksRes = await queryFlix(LINKS_FLIX_QUERY, {
            id: firstEp._id,
            app: 'com.asiapp.doramasgo'
          });
          const links = (linksRes.data && linksRes.data.getEpisodeLinks && linksRes.data.getEpisodeLinks.links_online) || [];
          setAllEpisodeLinks(links);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const handleSeasonChange = async (seasonNum) => {
    setIsDetailsLoading(true);
    setActiveSeason(seasonNum);
    setChaptersList([]);
    setEpisodesData([]);
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
        
        const chaps = episodes.map(ep => ep.episode_number);
        setChaptersList(chaps);
        
        if (episodes.length > 0) {
          const firstEp = episodes[0];
          setActiveEpisode(firstEp.episode_number);
          
          const linksRes = await queryFlix(LINKS_FLIX_QUERY, {
            id: firstEp._id,
            app: 'com.asiapp.doramasgo'
          });
          const links = (linksRes.data && linksRes.data.getEpisodeLinks && linksRes.data.getEpisodeLinks.links_online) || [];
          setAllEpisodeLinks(links);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const handleEpisodeChange = async (epNum) => {
    setIsDetailsLoading(true);
    setActiveEpisode(epNum);
    setAllEpisodeLinks([]);
    setServersList([]);
    setActiveServer(null);
    setActivePlayerUrl('');
    
    if (episodesData.length > 0) {
      const activeEp = episodesData.find(ep => ep.episode_number === epNum);
      if (activeEp) {
        try {
          const linksRes = await queryFlix(LINKS_FLIX_QUERY, {
            id: activeEp._id,
            app: 'com.asiapp.doramasgo'
          });
          const links = (linksRes.data && linksRes.data.getEpisodeLinks && linksRes.data.getEpisodeLinks.links_online) || [];
          setAllEpisodeLinks(links);
        } catch (e) {
          console.error(e);
        }
      }
    }
    setIsDetailsLoading(false);
  };

  const getPlayerUrl = (embed) => {
    if (!embed) return '';
    if (embed.includes('primeload.co')) {
      if (import.meta.env.DEV) {
        return embed.replace('https://primeload.co', '/primeload-proxy');
      } else {
        return embed.replace('https://primeload.co', PROXY_URL);
      }
    }
    return embed;
  };

  const handleServerClick = (server) => {
    setActiveServer(server);
    if (server && server.embed) {
      setActivePlayerUrl(getPlayerUrl(server.embed));
    }
  };

  // Select default server based on activeSubTab
  useEffect(() => {
    if (allEpisodeLinks && allEpisodeLinks.length > 0) {
      const isSubTab = activeSubTab === 'sub';

      const primaryFilter = (link) => {
        if (isSubTab) {
          // Sub tab: prefer subtitled (not 38)
          return link.lang !== '38' && link.language_code !== 'es';
        } else {
          // Latino tab: prefer latino (38)
          return link.lang === '38' || link.language_code === 'es';
        }
      };

      const secondaryFilter = (link) => {
        if (isSubTab) {
          // Sub tab fallback: latino
          return link.lang === '38' || link.language_code === 'es';
        } else {
          // Latino tab fallback: subtitled
          return link.lang !== '38' && link.language_code !== 'es';
        }
      };

      const filtered = allEpisodeLinks
        .filter(primaryFilter)
        .map(link => ({
          hash: link._id,
          name: getHostName(link.embed, link.server_ref),
          embed: link.embed,
          lang: link.lang
        }));
      
      setServersList(filtered);
      if (filtered.length > 0) {
        setActiveServer(filtered[0]);
        setActivePlayerUrl(getPlayerUrl(filtered[0].embed));
      } else {
        // Fallback if no primary language server exists
        const subbed = allEpisodeLinks
          .filter(secondaryFilter)
          .map(link => ({
            hash: link._id,
            name: getHostName(link.embed, link.server_ref) + (isSubTab ? " (Latino)" : " (Sub)"),
            embed: link.embed,
            lang: link.lang
          }));
        setServersList(subbed);
        if (subbed.length > 0) {
          setActiveServer(subbed[0]);
          setActivePlayerUrl(getPlayerUrl(subbed[0].embed));
        } else {
          setActiveServer(null);
          setActivePlayerUrl('');
        }
      }
    } else {
      setServersList([]);
      setActiveServer(null);
      setActivePlayerUrl('');
    }
  }, [allEpisodeLinks, activeSubTab]);

  const handlePageChange = (pageNum) => {
    setSelectedDrama(null);
    setAllEpisodeLinks([]);
    setServersList([]);
    setActiveServer(null);
    setActivePlayerUrl('');
    setPage(pageNum);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchChange = (val) => {
    setSelectedDrama(null);
    setAllEpisodeLinks([]);
    setServersList([]);
    setActiveServer(null);
    setActivePlayerUrl('');
    setSearchTerm(val);
    setPage(1);
  };

  const itemsToRender = searchTerm.trim() ? searchResults : dramas;

  const activeLangName = useMemo(() => {
    if (activeServer && LANG_NAMES[activeServer.lang]) {
      return LANG_NAMES[activeServer.lang];
    }
    return activeSubTab === 'sub' ? 'Sub Español 💬' : 'Latino 🗣️';
  }, [activeServer, activeSubTab]);

  return (
    <div className="kdramas-container">
      <style>{`
        .player-control-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #090910;
          border: 1px solid var(--border-color);
          border-top: none;
          padding: 0.8rem 1.5rem;
          border-radius: 0 0 12px 12px;
          color: #fff;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .control-left, .control-center, .control-right {
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }
        .control-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color);
          color: #fff;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
        }
        .control-btn:hover:not(:disabled) {
          background: var(--primary);
          border-color: var(--primary);
        }
        .control-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .control-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: #fff;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
          max-width: 200px;
        }
        .control-select {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color);
          color: #fff;
          padding: 0.5rem 2rem 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.85rem;
          cursor: pointer;
          font-weight: 500;
          outline: none;
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 0.8rem center;
          background-size: 0.8em;
          transition: all 0.2s ease;
        }
        .control-select:hover {
          background-color: var(--primary);
          border-color: var(--primary);
        }
        .kdrama-modal-body {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          gap: 1.5rem;
          padding: 1.25rem;
        }
        .kdrama-player-col {
          flex: 1 1 500px;
          display: flex;
          flex-direction: column;
        }
        .player-container {
          height: 380px;
          background: #020205;
          border-radius: 12px 12px 0 0;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .kdrama-info-col {
          flex: 1 1 300px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-width: 260px;
        }
        .theater-mode-layout {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 99999;
          background: #000;
          display: flex;
          flex-direction: column;
        }
        @media (max-width: 768px) {
          .kdrama-modal-body {
            flex-direction: column;
            padding: 0.5rem;
            gap: 1rem;
          }
          .kdrama-player-col {
            flex: unset;
            width: 100%;
          }
          .player-container {
            height: 220px !important;
          }
          .kdrama-info-col {
            flex: unset;
            width: 100%;
            min-width: unset;
          }
        }
        .media-card {
          position: relative;
          overflow: visible !important;
        }
        .card-thumbnail-wrapper {
          position: relative;
        }
        .card-hover-popup {
          display: none;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(9, 9, 16, 0.96);
          border: 1.5px solid var(--primary);
          border-radius: 12px;
          padding: 1rem;
          box-shadow: 0 10px 25px rgba(0,0,0,0.85);
          z-index: 20;
          pointer-events: none;
          box-sizing: border-box;
          overflow-y: auto;
        }
        .card-thumbnail-wrapper:hover .card-hover-popup {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }
        .hover-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
        }
        .hover-year {
          font-weight: 600;
          color: #fff;
          background: rgba(255,255,255,0.08);
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
        }
        .hover-rating {
          color: #fbbf24;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 0.15rem;
        }
        .hover-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: #fff;
          margin: 0 0 0.5rem 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .hover-overview {
          font-size: 0.75rem;
          color: #ddd;
          line-height: 1.4;
          margin-bottom: 0.6rem;
          display: -webkit-box;
          -webkit-line-clamp: 5;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .hover-meta, .hover-country {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
          line-height: 1.3;
        }
        .hover-meta strong, .hover-country strong {
          color: #fff;
        }
      `}</style>

      <div className="section-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 className="section-title" style={{ margin: 0 }}>Kdramas en Latino 🗣️</h1>
          <div className="controls-group">
            <div className="search-container">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder={activeSubTab === 'movies' ? "Buscar película en español latino..." : "Buscar dorama en español latino..."}
                className="search-input"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="filters-wrapper" style={{ margin: 0, padding: 0, display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`filter-badge ${activeSubTab === 'doramas' ? 'active' : ''}`}
            onClick={() => {
              setActiveSubTab('doramas');
              setPage(1);
              setSearchTerm('');
              setSearchResults([]);
              setSelectedDrama(null);
            }}
          >
            🌸 Doramas Latino
          </button>
          <button
            type="button"
            className={`filter-badge ${activeSubTab === 'sub' ? 'active' : ''}`}
            onClick={() => {
              setActiveSubTab('sub');
              setPage(1);
              setSearchTerm('');
              setSearchResults([]);
              setSelectedDrama(null);
            }}
          >
            💬 Doramas Sub Español
          </button>
          <button
            type="button"
            className={`filter-badge ${activeSubTab === 'movies' ? 'active' : ''}`}
            onClick={() => {
              setActiveSubTab('movies');
              setPage(1);
              setSearchTerm('');
              setSearchResults([]);
              setSelectedDrama(null);
            }}
          >
            🎬 Películas Latino
          </button>
        </div>
      </div>

      {isLoading && itemsToRender.length === 0 ? (
        <SkeletonGrid count={12} />
      ) : (
        <div className="media-grid">
          {itemsToRender.length > 0 ? (
            itemsToRender.map((drama) => (
              <button
                type="button"
                key={drama.id}
                className="media-card"
                onClick={() => handleOpenDrama(drama)}
                style={{ textAlign: 'left', font: 'inherit', color: 'inherit', padding: 0 }}
              >
                <div className="card-thumbnail-wrapper" style={{ aspectRatio: '2/3' }}>
                  <div className="card-thumbnail-glow"></div>
                  <img
                    src={drama.portada}
                    alt={drama.titulo}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/160x240?text=?';
                    }}
                  />
                  
                  <div className="card-hover-popup">
                    <div className="hover-header">
                      <span className="hover-year">{drama.year}</span>
                      <span className="hover-rating">👍 95%</span>
                    </div>
                    <h4 className="hover-title">{drama.titulo}</h4>
                    <p className="hover-overview">{drama.description}</p>
                    <div className="hover-meta">
                      <strong>Audio:</strong> Español Latino
                    </div>
                  </div>

                  <button
                    type="button"
                    className="play-hover-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDrama(drama);
                    }}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    <div className="play-icon">▶</div>
                  </button>
                  {drama.year && <span className="card-badge">{drama.year}</span>}
                </div>

                <div className="card-info">
                  <span className="card-genre" style={{ color: '#c084fc' }}>
                    {activeSubTab === 'movies' 
                      ? '🎬 Película' 
                      : activeSubTab === 'sub' 
                      ? '💬 Sub Español' 
                      : '🌸 Latino'}
                  </span>
                  <h3 className="card-title">{drama.titulo}</h3>
                  <p className="card-summary">{drama.description}</p>
                  <div className="card-footer">
                    <span>⭐ 8.5</span>
                    <span className="card-lang">
                      {activeSubTab === 'movies' ? 'LAT' : activeSubTab === 'sub' ? 'SUB' : 'LAT'}
                    </span>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="empty-state">
              <span className="empty-icon">
                {activeSubTab === 'movies' ? '🎬' : activeSubTab === 'sub' ? '💬' : '🌸'}
              </span>
              <h3 className="empty-title">
                {activeSubTab === 'movies' 
                  ? 'No se encontraron películas en latino' 
                  : activeSubTab === 'sub'
                  ? 'No se encontraron doramas sub español'
                  : 'No se encontraron doramas en latino'}
              </h3>
              <p>Prueba buscando con palabras clave diferentes.</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination Catalog */}
      {!searchTerm.trim() && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.4rem', margin: '2.5rem 0 1rem' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
            <button
              key={pageNum}
              onClick={() => handlePageChange(pageNum)}
              disabled={isLoading}
              style={{
                background: page === pageNum
                  ? 'linear-gradient(135deg, #6c63ff, #9b59b6)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: '#fff',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: page === pageNum ? '700' : '400',
                transition: 'all 0.2s ease'
              }}
            >
              {pageNum}
            </button>
          ))}
        </div>
      )}

      {selectedDrama && (
        <div className="modal-overlay" onClick={() => { setSelectedDrama(null); setIsTheater(false); }}>
          <div 
            className={isTheater ? "theater-mode-layout" : "modal-content"} 
            onClick={(e) => e.stopPropagation()} 
            style={isTheater ? {} : { maxWidth: '950px' }}
          >
            {!isTheater && (
              <button className="modal-close-btn" onClick={() => setSelectedDrama(null)}>
                ✕
              </button>
            )}

            {isTheater ? (
              <div style={{ flex: 1, background: '#000', position: 'relative' }}>
                {activePlayerUrl ? <VideoPlayer playerUrl={activePlayerUrl} /> : <div className="player-loading-spinner" />}
              </div>
            ) : (
              <div className="kdrama-modal-body">
                <div className="kdrama-player-col">
                  <div className="player-container">
                    {activePlayerUrl ? <VideoPlayer playerUrl={activePlayerUrl} /> : <div className="player-loading-spinner" />}
                  </div>
                  
                  <div className="player-control-bar">
                    {selectedDrama.type === 'movie' ? (
                      <div className="control-left">
                        <span className="control-title" style={{ fontSize: '0.85rem' }}>
                          🎥 Película Latino
                        </span>
                      </div>
                    ) : (
                      <div className="control-left">
                        <button className="control-btn" onClick={() => handleEpisodeChange(Math.max(1, activeEpisode - 1))} disabled={activeEpisode <= 1}>
                          ◀
                        </button>
                        <span className="control-title" style={{ fontSize: '0.8rem' }}>
                          Cap. {activeEpisode}
                        </span>
                        <button className="control-btn" onClick={() => handleEpisodeChange(Math.min(chaptersList.length, activeEpisode + 1))} disabled={activeEpisode >= chaptersList.length}>
                          ▶
                        </button>
                      </div>
                    )}

                    <div className="control-center">
                      <select className="control-select" value="active" disabled>
                        <option value="active" style={{ background: '#0b0b14', color: '#fff' }}>{activeLangName}</option>
                      </select>

                      {serversList.length > 0 && (
                        <select 
                          className="control-select"
                          value={activeServer ? activeServer.hash : ''}
                          onChange={(e) => {
                            const match = serversList.find(s => s.hash === e.target.value);
                            if (match) handleServerClick(match);
                          }}
                        >
                          {serversList.map((server) => (
                            <option 
                              key={server.hash} 
                              value={server.hash}
                              style={{ background: '#0b0b14', color: '#fff' }}
                            >
                              🎛️ {server.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="control-right">
                      <button
                        className="control-btn"
                        style={{
                          background: isFavorite(selectedDrama.id) ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                          borderColor: isFavorite(selectedDrama.id) ? '#ef4444' : 'var(--border-color)',
                          color: isFavorite(selectedDrama.id) ? '#fca5a5' : '#fff'
                        }}
                        onClick={async () => {
                          await toggleFavorite(selectedDrama);
                          setSelectedDrama({ ...selectedDrama });
                        }}
                      >
                        {isFavorite(selectedDrama.id) ? '❤️ En Mi Lista' : '🤍 Mi Lista'}
                      </button>
                      <button className="control-btn" onClick={() => setIsTheater(true)}>
                        📺 Cine
                      </button>
                    </div>
                  </div>
                </div>

                <div className="kdrama-info-col">
                  <div className="modal-meta">
                    <span className="modal-genre" style={{ background: '#a855f7', color: '#fff' }}>
                      🗣️ {selectedDrama.type === 'movie' ? 'PELÍCULA LATINO' : activeSubTab === 'sub' ? 'DORAMA SUB ESPAÑOL' : 'DORAMA LATINO'}
                    </span>
                    <span className="modal-lang">★ 8.5</span>
                  </div>
                  <h2 className="modal-title" style={{ margin: 0, fontSize: '1.4rem' }}>{selectedDrama.titulo}</h2>
                  <p className="modal-summary" style={{ maxHeight: '110px', overflowY: 'auto', fontSize: '0.85rem' }}>
                    {selectedDrama.description}
                  </p>

                  {selectedDrama.type !== 'movie' && (
                    <>
                      {/* Seasons selection dropdown if multiple seasons exist */}
                      {seasonsList.length > 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Seleccionar Temporada:</span>
                          <select 
                            className="control-select"
                            value={activeSeason}
                            onChange={(e) => handleSeasonChange(Number(e.target.value))}
                            style={{ width: '100%' }}
                          >
                            {seasonsList.map(s => (
                              <option key={s.season_number} value={s.season_number} style={{ background: '#0b0b14', color: '#fff' }}>
                                Temporada {s.season_number}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Seleccionar Capítulo:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '140px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                          {isDetailsLoading ? (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '0.5rem' }}>Cargando capítulos...</div>
                          ) : chaptersList.length > 0 ? (
                            chaptersList.map((epNum) => (
                              <button
                                key={epNum}
                                onClick={() => handleEpisodeChange(epNum)}
                                style={{
                                  flex: '1 0 70px',
                                  background: activeEpisode === epNum ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                  border: '1px solid',
                                  borderColor: activeEpisode === epNum ? 'var(--primary)' : 'var(--border-color)',
                                  color: '#fff',
                                  padding: '0.5rem',
                                  borderRadius: '8px',
                                  fontSize: '0.8rem',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  textAlign: 'center'
                                }}
                              >
                                Cap. {epNum}
                              </button>
                            ))
                          ) : (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No hay capítulos disponibles.</div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {isTheater && (
              <div className="player-control-bar" style={{ borderRadius: 0, padding: '0.8rem 2rem' }}>
                {selectedDrama.type === 'movie' ? (
                  <div className="control-left">
                    <span className="control-title">
                      {selectedDrama.titulo}
                    </span>
                  </div>
                ) : (
                  <div className="control-left">
                    <button className="control-btn" onClick={() => handleEpisodeChange(Math.max(1, activeEpisode - 1))} disabled={activeEpisode <= 1}>
                      ◀
                    </button>
                    <span className="control-title">
                      {selectedDrama.titulo} - Cap. {activeEpisode}
                    </span>
                    <button className="control-btn" onClick={() => handleEpisodeChange(Math.min(chaptersList.length, activeEpisode + 1))} disabled={activeEpisode >= chaptersList.length}>
                      ▶
                    </button>
                  </div>
                )}

                <div className="control-center">
                  <select className="control-select" value="active" disabled>
                    <option value="active" style={{ background: '#0b0b14', color: '#fff' }}>{activeLangName}</option>
                  </select>

                  {serversList.length > 0 && (
                    <select 
                      className="control-select"
                      value={activeServer ? activeServer.hash : ''}
                      onChange={(e) => {
                        const match = serversList.find(s => s.hash === e.target.value);
                        if (match) handleServerClick(match);
                      }}
                    >
                      {serversList.map((server) => (
                        <option 
                          key={server.hash} 
                          value={server.hash}
                          style={{ background: '#0b0b14', color: '#fff' }}
                        >
                          🎛️ {server.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="control-right">
                  <button className="control-btn" onClick={() => setIsTheater(false)}>
                    ✕ Salir Modo Cine
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
