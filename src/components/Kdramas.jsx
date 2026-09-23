import React, { useState, useEffect, useMemo } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { SkeletonGrid } from './SkeletonLoader';
import { saveWatchProgress, toggleFavorite, isFavorite, getWatchHistory } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';

// ── GraphQL Proxy Configuration ──
const PROXY_WORKER = 'https://pirutv-proxy.skillful-part.workers.dev';

const queryFlix = async (query, variables = {}) => {
  const endpoints = ['/api/gql', PROXY_WORKER];
  let lastError = null;

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('GraphQL request failed');
};

// ── Doramasflix Live GraphQL Queries ──
const TRENDS_DORAMAS_QUERY = `
  query TrendsDoramas($platform: String, $days: Int, $limit: Int) {
    trendsDoramas(platform: $platform, days: $days, limit: $limit) {
      _id
      name
      name_es
      slug
      poster_path
      backdrop_path
      views_count
    }
  }
`;

const SEARCH_FLIX_QUERY = `
  query searchDorama($input: String!) {
    searchDorama(input: $input, limit: 24) {
      _id
      slug
      name
      name_es
      poster_path
      backdrop_path
      first_air_date
      overview
    }
  }
`;

const LIST_DORAMAS_QUERY = `
  query listDoramas($page: Int, $perPage: Int, $sort: SortDorama, $filter: FilterDoramasInput) {
    paginationDorama(page: $page, limit: $perPage, sort: $sort, filter: $filter) {
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
      }
    }
  }
`;

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
        serie_slug: $slug
        season_number: $season_number
      }
    ) {
      _id
      name
      name_es
      slug
      episode_number
    }
  }
`;

const LINKS_FLIX_QUERY = `
  query EpisodeLinksOnline($id: ID!, $app: String) {
    getEpisodeLinks(id: $id, app: $app) {
      links_online {
        server
        lang
        link
        _id
        is_recommended
      }
    }
  }
`;

const LIST_MOVIES_QUERY = `
  query listMovies($page: Int, $perPage: Int, $sort: SortMovie, $filter: FilterMoviesInput) {
    paginationMovie(page: $page, limit: $perPage, sort: $sort, filter: $filter) {
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
      poster_path
      backdrop_path
      release_date
      overview
    }
  }
`;

const MOVIE_LINKS_QUERY = `
  query GetMovieLinks($id: ID!, $app: String) {
    getMovieLinks(id: $id, app: $app) {
      links_online {
        server
        lang
        link
        is_recommended
      }
    }
  }
`;

// ── Known Server Names for Doramasflix ──
const SERVER_NAMES = {
  '4721': 'PrimeLoad ⚡',
  '1230': 'Voe',
  '38585': 'Streamwish',
  '69c690a20bef0992e5c91fa1': 'PrimeLoad ⚡',
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

const LANG_NAMES = {
  '38': 'Latino 🗣️',
  '13109': 'Coreano 🇰🇷',
  '13110': 'Japonés 🇯🇵',
  '13111': 'Chino 🇨🇳',
  '13112': 'Tailandés 🇹🇭',
  '13113': 'Taiwanés 🇹🇼',
  '36': 'Inglés 🇬🇧'
};

// Decode shortened JWT URLs (e.g. embedshortener.co/e/<jwt>) into the actual direct player URL
const decodeEmbedUrl = (link) => {
  if (!link) return '';
  if (link.includes('embedshortener.co/e/')) {
    try {
      const parts = link.split('/e/')[1].split('.');
      if (parts[1]) {
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const payload = JSON.parse(atob(base64));
        if (payload && payload.link) {
          let innerBase64 = payload.link.replace(/-/g, '+').replace(/_/g, '/');
          while (innerBase64.length % 4) innerBase64 += '=';
          return atob(innerBase64);
        }
      }
    } catch (e) {
      console.warn('Error decoding shortener JWT:', e);
    }
  }
  return link;
};

// Route PrimeLoad through proxy to bypass Content-Security-Policy & frame blocking
const getPlayerUrl = (embed) => {
  if (!embed) return '';
  const decoded = decodeEmbedUrl(embed);
  if (decoded.includes('primeload.co')) {
    if (import.meta.env.DEV) {
      return decoded.replace('https://primeload.co', '/primeload-proxy');
    } else {
      return decoded.replace('https://primeload.co', PROXY_WORKER);
    }
  }
  return decoded;
};

// Detect human-readable server name based on host domain or server reference
const getHostName = (url, serverRef) => {
  const decoded = decodeEmbedUrl(url);
  if (decoded.includes('primeload.co')) return 'PrimeLoad ⚡';
  if (decoded.includes('streamwish') || decoded.includes('flaswish')) return 'Streamwish';
  if (decoded.includes('filemoon')) return 'Filemoon';
  if (decoded.includes('voe.sx') || decoded.includes('voe.')) return 'Voe';
  if (decoded.includes('streamtape')) return 'Streamtape';
  if (decoded.includes('mixdrop')) return 'Mixdrop';
  if (decoded.includes('ok.ru') || decoded.includes('okru')) return 'Okru';
  if (decoded.includes('uqload')) return 'Uqload';
  if (decoded.includes('mp4upload')) return 'Mp4Upload';
  if (decoded.includes('dood')) return 'Dood';
  if (decoded.includes('vidhide')) return 'VidHide';
  if (decoded.includes('mega.nz') || decoded.includes('mega.')) return 'Mega';

  if (serverRef && SERVER_NAMES[serverRef]) return SERVER_NAMES[serverRef];
  try {
    const hostname = new URL(decoded || url).hostname;
    const parts = hostname.replace('www.', '').split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch {
    return 'Servidor HD';
  }
};

const KDRAMA_CATEGORIES = [
  'Inicio',
  '🍙 Doramas Latino',
  '💬 Doramas Sub Español',
  '🎬 Películas Asiáticas',
  '❤️ Mi Lista'
];

// Fallback initial dataset of top Doramasflix dramas so the page NEVER renders blank or collapsed
const INITIAL_TOP_DORAMAS = [
  {
    id: '6a8e442472e6043f632a13a3',
    type: 'dorama',
    title: 'The Early Spring',
    name_es: 'Primavera Temprana',
    slug: 'the-early-spring',
    poster: 'https://image.tmdb.org/t/p/w500/lGFngmJWMO4HTPcI0sUGKBAFqMe.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/9Z2VLmjRJGvjnzWXFzM9MPUQbbC.jpg',
    overview: 'Una historia cautivadora sobre el renacer de emociones profundas y secretos del pasado en una pintoresca ciudad costera.',
    year: '2026',
    lang: 'SUB/LAT',
    match: '99%'
  },
  {
    id: '6a90af448bb053076c412a15',
    type: 'dorama',
    title: 'Summertime',
    name_es: 'Verano',
    slug: 'summertime',
    poster: 'https://image.tmdb.org/t/p/w500/uZLTSPocZHlezHcfqEYgW4JhcCR.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/mcwzXqLswl7gjmJTXG2Z0JcuhfE.jpg',
    overview: 'Dos vidas totalmente distintas convergen durante las vacaciones de verano, desatando una serie de eventos inesperados.',
    year: '2026',
    lang: 'SUB',
    match: '98%'
  },
  {
    id: '6a446bb925dd378319c3e60d',
    type: 'dorama',
    title: 'Knot',
    name_es: 'Nudo',
    slug: 'knot',
    poster: 'https://image.tmdb.org/t/p/w500/8z62pp4K602d1y6079oU1GBeiAG.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/zq22918LdWTkBstphgUfxDZUO7i.jpg',
    overview: 'Un apasionante drama de misterio psicológico donde una red de engaños familiares amenaza con destruir todo lo construido.',
    year: '2025',
    lang: 'SUB/LAT',
    match: '97%'
  },
  {
    id: '6aa36763d5181060190d61c7',
    type: 'dorama',
    title: 'Against the Current',
    name_es: 'Contra la Corriente',
    slug: 'against-the-current',
    poster: 'https://image.tmdb.org/t/p/w500/kMj4j1ejPRJCOR3JIJLqku6rEPe.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/lKsZNWBsKYJysXQsbtC2GbJS8E2.jpg',
    overview: 'Luchando contra las normas sociales y las expectativas corporativas, una joven ejecutiva desafía el destino para encontrar su propia verdad.',
    year: '2026',
    lang: 'SUB',
    match: '96%'
  },
  {
    id: '6aab6f358a55c366bc0e987a',
    type: 'dorama',
    title: 'Spring of the Blade',
    name_es: 'La Primavera de la Espada',
    slug: 'spring-of-the-blade',
    poster: 'https://image.tmdb.org/t/p/w500/uRWqHI4R4nOSPpRnbr8JjnpCmgx.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/g4gMgBm59j25eGKQFrME2NluDy7.jpg',
    overview: 'Artes marciales, lealtad y amor prohibido en la era de los reinos guerreros. Un maestro de la espada emprende un viaje para salvar a su clan.',
    year: '2026',
    lang: 'SUB',
    match: '98%'
  },
  {
    id: '6a93ced024356d46eff3b74c',
    type: 'dorama',
    title: 'Blossom Through the Cloud',
    name_es: 'Florecer entre las Nubes',
    slug: 'blossom-through-the-cloud',
    poster: 'https://image.tmdb.org/t/p/w500/ecUJK58QyF1uBuDzJwxTItWg2WK.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/pzVQamYApSGKqA4hWFTw5955wH6.jpg',
    overview: 'A través de las dificultades más oscuras, el amor florece entre dos personas marcadas por el dolor del pasado.',
    year: '2026',
    lang: 'SUB/LAT',
    match: '95%'
  },
  {
    id: '6aab6f508a55c366bc0e98f0',
    type: 'dorama',
    title: 'Revenge from a Wife',
    name_es: 'La Venganza de la Esposa',
    slug: 'revenge-from-a-wife',
    poster: 'https://image.tmdb.org/t/p/w500/hABseMRLlM8tOSJTcyJku7VmxsZ.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/hABseMRLlM8tOSJTcyJku7VmxsZ.jpg',
    overview: 'Tras ser traicionada por quien más amaba, renace con una nueva identidad para cobrar venganza contra todos los que conspiraron contra ella.',
    year: '2026',
    lang: 'SUB',
    match: '97%'
  },
  {
    id: '6aab6f508a55c366bc0e98f2',
    type: 'dorama',
    title: 'As Promised',
    name_es: 'Como se Prometió',
    slug: 'as-promised',
    poster: 'https://image.tmdb.org/t/p/w500/ewaAPeYaAbSfKKQJ5g4VAdikh8J.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/ewaAPeYaAbSfKKQJ5g4VAdikh8J.jpg',
    overview: 'Una promesa hecha en la infancia reúne a dos amantes diez años después, desafiando todos los obstáculos.',
    year: '2026',
    lang: 'SUB',
    match: '94%'
  },
  {
    id: '6aab6f508a55c366bc0e98f4',
    type: 'dorama',
    title: "Our Yesterday's Escape",
    name_es: 'Nuestra Huida de Ayer',
    slug: 'our-yesterdays-escape',
    poster: 'https://image.tmdb.org/t/p/w500/sIHdJBPyJ3FMeLuMl6kmyKfwlDv.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/sIHdJBPyJ3FMeLuMl6kmyKfwlDv.jpg',
    overview: 'Dos fugitivos del destino se encuentran en una travesía llena de adrenalina, redención y romance.',
    year: '2026',
    lang: 'SUB',
    match: '95%'
  },
  {
    id: '6aab6f508a55c366bc0e98f6',
    type: 'dorama',
    title: 'Plastic Beauty',
    name_es: 'Belleza Plástica',
    slug: 'plastic-beauty',
    poster: 'https://image.tmdb.org/t/p/w500/zUp3F7qtpJIUMsf31DDLNx1xOdS.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/zUp3F7qtpJIUMsf31DDLNx1xOdS.jpg',
    overview: 'Una ácida mirada al mundo de la estética moderna y el verdadero significado de la identidad y la belleza personal.',
    year: '2026',
    lang: 'SUB',
    match: '93%'
  }
];

export default function Kdramas() {
  const [activeCategory, setActiveCategory] = useState('Inicio');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMuted, setIsMuted] = useState(true);

  // Home rows data (initialized with curated list for instant rendering)
  const [topKdramas, setTopKdramas] = useState(INITIAL_TOP_DORAMAS);
  const [homeLatinoDoramas, setHomeLatinoDoramas] = useState(INITIAL_TOP_DORAMAS.slice(0, 6));
  const [homeSubDoramas, setHomeSubDoramas] = useState(INITIAL_TOP_DORAMAS);
  const [homeAsianMovies, setHomeAsianMovies] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);

  // Grid & Pagination for specific tabs
  const [gridItems, setGridItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // Watch history
  const [watchHistory, setWatchHistory] = useState(getWatchHistory());

  // Modal & Player State
  const [selectedDrama, setSelectedDrama] = useState(null);
  const [seasonsList, setSeasonsList] = useState([]);
  const [activeSeason, setActiveSeason] = useState(1);
  const [episodesData, setEpisodesData] = useState([]);
  const [activeEpisode, setActiveEpisode] = useState(1);
  const [activeEpisodeId, setActiveEpisodeId] = useState(null);
  const [serversList, setServersList] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [activePlayerUrl, setActivePlayerUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [isLinksLoading, setIsLinksLoading] = useState(false);
  const [modalTab, setModalTab] = useState('player'); // 'player' | 'details'

  // Load live home datasets on mount
  useEffect(() => {
    let isMounted = true;

    const loadHomeData = async () => {
      try {
        // 1. Fetch Trending Doramas
        const resTrends = await queryFlix(TRENDS_DORAMAS_QUERY, {
          platform: 'doramasgo',
          days: 7,
          limit: 15
        });

        const rawTrends = resTrends?.data?.trendsDoramas || [];
        if (rawTrends.length > 0 && isMounted) {
          const formattedTrends = rawTrends.map((x, idx) => ({
            id: x._id,
            type: 'dorama',
            title: x.name_es || x.name || 'Kdrama',
            name_es: x.name_es,
            slug: x.slug,
            poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80',
            backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
            overview: `Dorama asiático muy popular con más de ${(x.views_count || 1200).toLocaleString()} reproducciones.`,
            year: '2026',
            lang: 'SUB/LAT',
            match: `${99 - idx}%`
          }));
          setTopKdramas(formattedTrends);
          setHomeLatinoDoramas(formattedTrends.slice(0, 8));
        }

        // 2. Fetch Catalog Doramas
        const resSub = await queryFlix(LIST_DORAMAS_QUERY, {
          page: 1,
          perPage: 20
        });

        const rawSub = resSub?.data?.paginationDorama?.items || [];
        if (rawSub.length > 0 && isMounted) {
          const formattedSub = rawSub.map((x, idx) => ({
            id: x._id,
            type: 'dorama',
            title: x.name_es || x.name || 'Kdrama',
            name_es: x.name_es,
            slug: x.slug,
            poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80',
            backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
            overview: x.overview || 'Sin descripción disponible.',
            year: (x.first_air_date || '').slice(0, 4) || '2026',
            lang: 'SUB',
            match: `${98 - (idx % 8)}%`
          }));
          setHomeSubDoramas(formattedSub);
        }

        // 3. Fetch Asian Movies
        const resMovies = await queryFlix(LIST_MOVIES_QUERY, {
          page: 1,
          perPage: 20
        });

        const rawMovies = resMovies?.data?.paginationMovie?.items || [];
        if (rawMovies.length > 0 && isMounted) {
          const formattedMovies = rawMovies.map((x, idx) => ({
            id: x._id,
            type: 'movie',
            title: x.name_es || x.name || 'Película Asiática',
            slug: x.slug,
            poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80',
            backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
            overview: x.overview || 'Película asiática disponible para ver online.',
            year: (x.release_date || '').slice(0, 4) || '2026',
            lang: 'MULTI',
            match: `${97 - (idx % 6)}%`
          }));
          setHomeAsianMovies(formattedMovies);
        }
      } catch (err) {
        console.warn('Live Doramasflix query failed, using preloaded catalog fallback:', err);
      }
    };

    loadHomeData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Category Grid pagination
  useEffect(() => {
    if (activeCategory === 'Inicio' || activeCategory === '❤️ Mi Lista') return;

    let isMounted = true;
    const fetchGrid = async () => {
      setIsLoading(true);
      try {
        if (activeCategory === '🎬 Películas Asiáticas') {
          const res = await queryFlix(LIST_MOVIES_QUERY, { page, perPage: 24 });
          const items = (res.data?.paginationMovie?.items || []).map(x => ({
            id: x._id,
            type: 'movie',
            title: x.name_es || x.name || 'Película',
            poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80',
            backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
            overview: x.overview || '',
            slug: x.slug,
            year: (x.release_date || '').slice(0, 4) || '2026',
            lang: 'MULTI'
          }));
          if (isMounted) {
            setGridItems(items);
            setTotalPages(Math.ceil((res.data?.paginationMovie?.count || 100) / 24));
          }
        } else {
          // Doramas Sub or Latino
          const res = await queryFlix(LIST_DORAMAS_QUERY, { page, perPage: 24 });
          const items = (res.data?.paginationDorama?.items || []).map(x => ({
            id: x._id,
            type: 'dorama',
            title: x.name_es || x.name || 'Kdrama',
            poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80',
            backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
            overview: x.overview || '',
            slug: x.slug,
            year: (x.first_air_date || '').slice(0, 4) || '2026',
            lang: activeCategory.includes('Latino') ? 'LAT' : 'SUB'
          }));
          if (isMounted) {
            setGridItems(items);
            setTotalPages(Math.ceil((res.data?.paginationDorama?.count || 200) / 24));
          }
        }
      } catch (err) {
        console.error('Error fetching grid items:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchGrid();
    return () => {
      isMounted = false;
    };
  }, [activeCategory, page]);

  // Search Debounce
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [doramaRes, movieRes] = await Promise.all([
          queryFlix(SEARCH_FLIX_QUERY, { input: searchTerm.trim() }),
          queryFlix(SEARCH_MOVIES_QUERY, { input: searchTerm.trim() }).catch(() => ({ data: { searchMovie: [] } }))
        ]);

        const doramas = (doramaRes.data?.searchDorama || []).map(x => ({
          id: x._id,
          type: 'dorama',
          title: x.name_es || x.name,
          poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80',
          backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
          overview: x.overview,
          slug: x.slug,
          year: (x.first_air_date || '').slice(0, 4) || '2026',
          lang: 'SUB/LAT'
        }));

        const movies = (movieRes.data?.searchMovie || []).map(x => ({
          id: x._id,
          type: 'movie',
          title: x.name_es || x.name,
          poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80',
          backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : null,
          overview: x.overview,
          slug: x.slug,
          year: (x.release_date || '').slice(0, 4) || '2026',
          lang: 'MULTI'
        }));

        setSearchResults([...doramas, ...movies]);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Open Drama / Movie Modal
  const openDramaModal = async (drama, autoplay = false) => {
    setSelectedDrama(drama);
    setIsPlaying(autoplay);
    setIsDetailsLoading(true);
    setModalTab('player');
    setActiveServer(null);
    setActivePlayerUrl('');
    setServersList([]);
    setEpisodesData([]);

    // Check if it's a Movie or a Series
    if (drama.type === 'movie') {
      try {
        const linksRes = await queryFlix(MOVIE_LINKS_QUERY, {
          id: drama.id,
          app: 'com.asiapp.doramasgo'
        });
        const onlineLinks = linksRes.data?.getMovieLinks?.links_online || [];

        const servers = onlineLinks.map(l => {
          const directUrl = decodeEmbedUrl(l.link);
          return {
            id: l._id || l.server,
            serverRef: l.server,
            name: getHostName(directUrl, l.server),
            url: directUrl,
            rawUrl: l.link,
            lang: LANG_NAMES[l.lang] || 'Audio Original',
            isRecommended: l.is_recommended || false
          };
        });

        // Sort so PrimeLoad is always first
        servers.sort((a, b) => {
          if (a.name.includes('PrimeLoad')) return -1;
          if (b.name.includes('PrimeLoad')) return 1;
          if (a.isRecommended && !b.isRecommended) return -1;
          if (!a.isRecommended && b.isRecommended) return 1;
          return 0;
        });

        setServersList(servers);
        if (servers.length > 0) {
          setActiveServer(servers[0]);
          setActivePlayerUrl(getPlayerUrl(servers[0].url));
        }
      } catch (err) {
        console.error('Error fetching movie links:', err);
      } finally {
        setIsDetailsLoading(false);
      }
      return;
    }

    // It is a Dorama series
    try {
      const slug = drama.slug || drama.title?.toLowerCase().replace(/\s+/g, '-');
      const res = await queryFlix(DETAIL_DORAMA_EXTRA_QUERY, {
        slug,
        season_number: 1
      });

      const seasons = res.data?.listSeasons || [];
      const episodes = res.data?.listEpisodes || [];

      // Sort episodes ascending
      episodes.sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));

      setSeasonsList(seasons.length > 0 ? seasons : [{ season_number: 1, name: 'Temporada 1' }]);
      setActiveSeason(1);
      setEpisodesData(episodes);

      if (episodes.length > 0) {
        setActiveEpisode(episodes[0].episode_number || 1);
        setActiveEpisodeId(episodes[0]._id);
        await loadEpisodeServers(episodes[0]._id);
      }
    } catch (err) {
      console.error('Error fetching dorama details:', err);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  // Load servers for a specific episode
  const loadEpisodeServers = async (episodeId) => {
    if (!episodeId) return;
    setIsLinksLoading(true);
    try {
      const res = await queryFlix(LINKS_FLIX_QUERY, {
        id: episodeId,
        app: 'com.asiapp.doramasgo'
      });

      const onlineLinks = res.data?.getEpisodeLinks?.links_online || [];
      const servers = onlineLinks.map(l => {
        const directUrl = decodeEmbedUrl(l.link);
        return {
          id: l._id || l.server,
          serverRef: l.server,
          name: getHostName(directUrl, l.server),
          url: directUrl,
          rawUrl: l.link,
          lang: LANG_NAMES[l.lang] || 'Sub Español',
          isRecommended: l.is_recommended || false
        };
      });

      // Sort so PrimeLoad is always first
      servers.sort((a, b) => {
        if (a.name.includes('PrimeLoad')) return -1;
        if (b.name.includes('PrimeLoad')) return 1;
        if (a.isRecommended && !b.isRecommended) return -1;
        if (!a.isRecommended && b.isRecommended) return 1;
        return 0;
      });

      setServersList(servers);
      if (servers.length > 0) {
        setActiveServer(servers[0]);
        setActivePlayerUrl(getPlayerUrl(servers[0].url));
      } else {
        setActiveServer(null);
        setActivePlayerUrl('');
      }
    } catch (err) {
      console.error('Error fetching episode links:', err);
    } finally {
      setIsLinksLoading(false);
    }
  };

  // Change season in modal
  const handleSeasonChange = async (seasonNum) => {
    setActiveSeason(seasonNum);
    setIsDetailsLoading(true);
    try {
      const slug = selectedDrama.slug || selectedDrama.title?.toLowerCase().replace(/\s+/g, '-');
      const res = await queryFlix(DETAIL_DORAMA_EXTRA_QUERY, {
        slug,
        season_number: seasonNum
      });
      const episodes = res.data?.listEpisodes || [];
      episodes.sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
      setEpisodesData(episodes);

      if (episodes.length > 0) {
        setActiveEpisode(episodes[0].episode_number || 1);
        setActiveEpisodeId(episodes[0]._id);
        await loadEpisodeServers(episodes[0]._id);
      }
    } catch (err) {
      console.error('Error changing season:', err);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  // Select episode in modal
  const handleSelectEpisode = async (ep) => {
    setActiveEpisode(ep.episode_number);
    setActiveEpisodeId(ep._id);
    setIsPlaying(true);
    setModalTab('player');
    await loadEpisodeServers(ep._id);

    // Save watch progress
    if (selectedDrama) {
      saveWatchProgress(selectedDrama.id, {
        id: selectedDrama.id,
        type: 'dorama',
        title: selectedDrama.title,
        poster: selectedDrama.poster,
        season: activeSeason,
        episode: ep.episode_number,
        progress: 10,
        timestamp: Date.now()
      });
      setWatchHistory(getWatchHistory());
    }
  };

  // Change server tab
  const handleServerChange = (server) => {
    setActiveServer(server);
    setActivePlayerUrl(getPlayerUrl(server.url));
  };

  // Cast with Web Video Caster
  const handleCast = () => {
    if (!activePlayerUrl) return;
    castWithWebVideoCaster(
      activePlayerUrl,
      `${selectedDrama?.title || 'Kdrama'} - S${activeSeason} E${activeEpisode}`,
      selectedDrama?.poster
    );
  };

  // Filter Continue Watching to only Kdramas
  const continueWatchingKdramas = useMemo(() => {
    const history = getWatchHistory();
    return Object.values(history)
      .filter(item => item.type === 'dorama' || item.type === 'serie')
      .slice(0, 8);
  }, [watchHistory]);

  // Current Billboard Hero item
  const heroItem = useMemo(() => {
    if (topKdramas.length === 0) return INITIAL_TOP_DORAMAS[0];
    return topKdramas[heroIndex % topKdramas.length];
  }, [topKdramas, heroIndex]);

  // D-Pad Navigation for Smart TV
  useDpadNavigation({
    onBack: () => {
      if (selectedDrama) {
        setSelectedDrama(null);
        setIsPlaying(false);
      }
    }
  });

  return (
    <div className="netflix-browse min-h-screen bg-[#141414] text-white">
      {/* Category Pills Header */}
      <div className="netflix-category-nav flex items-center justify-between px-6 md:px-14 pt-20 pb-4 border-b border-white/5 bg-[#141414]/95 sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {KDRAMA_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setPage(1);
                setSearchTerm('');
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap focus:outline-none ${
                activeCategory === cat
                  ? 'bg-white text-black shadow-lg font-bold scale-105'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative ml-4">
          <input
            type="text"
            placeholder="Buscar doramas, películas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-44 md:w-64 bg-black/60 border border-white/20 rounded-full px-4 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-red-600 focus:w-72 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2 text-white/50 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {searchTerm.trim().length > 0 ? (
        // Search Results Grid
        <div className="px-6 md:px-14 pt-8 pb-16">
          <h2 className="text-xl font-bold mb-6 text-white/90">
            Resultados de búsqueda para: <span className="text-red-500">"{searchTerm}"</span>
          </h2>
          {isSearching ? (
            <SkeletonGrid count={12} />
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {searchResults.map(item => (
                <div
                  key={item.id}
                  onClick={() => openDramaModal(item, true)}
                  className="group relative rounded-md overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-105 hover:z-20 shadow-lg"
                >
                  <img
                    src={item.poster}
                    alt={item.title}
                    className="w-full h-64 object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                    <span className="text-xs bg-red-600 px-1.5 py-0.5 rounded w-max mb-1 font-bold">
                      {item.type === 'movie' ? 'Película' : 'Kdrama'}
                    </span>
                    <h3 className="text-sm font-bold text-white line-clamp-2">{item.title}</h3>
                    <p className="text-[11px] text-white/70">{item.year} · {item.lang}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-white/40">
              <span className="text-4xl block mb-2">🔍</span>
              No se encontraron resultados para "{searchTerm}"
            </div>
          )}
        </div>
      ) : activeCategory === 'Inicio' ? (
        // Netflix Home Feed: Hero Billboard + Curated Rows
        <>
          {/* Hero Billboard */}
          {heroItem && (
            <div className="netflix-billboard relative w-full h-[65vh] md:h-[80vh] overflow-hidden select-none">
              <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-1000 scale-105 filter brightness-90"
                style={{
                  backgroundImage: `url(${heroItem.backdrop || heroItem.poster})`
                }}
              />
              {/* Vignette Gradients */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/60 to-transparent w-full md:w-3/5" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent h-full" />

              {/* Billboard Details */}
              <div className="absolute left-6 md:left-14 bottom-24 md:bottom-32 max-w-xl z-20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-red-600 text-white text-[10px] md:text-xs font-black px-2 py-0.5 rounded tracking-widest uppercase">
                    SERIE ASIÁTICA
                  </span>
                  <span className="text-emerald-400 font-bold text-xs md:text-sm">
                    {heroItem.match || '98% de coincidencia'}
                  </span>
                  <span className="text-white/60 text-xs">{heroItem.year || '2026'}</span>
                </div>

                <h1 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight drop-shadow-md">
                  {heroItem.title}
                </h1>

                <p className="text-xs md:text-sm text-white/80 line-clamp-3 mb-6 font-normal drop-shadow">
                  {heroItem.overview}
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openDramaModal(heroItem, true)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white text-black font-bold text-sm md:text-base rounded hover:bg-white/80 transition-transform active:scale-95 shadow-md"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Ver Ahora
                  </button>

                  <button
                    onClick={() => openDramaModal(heroItem, false)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/20 text-white font-bold text-sm md:text-base rounded backdrop-blur-sm hover:bg-white/30 transition-transform active:scale-95"
                  >
                    <svg className="w-5 h-5 stroke-current" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="2" />
                      <line x1="12" y1="16" x2="12" y2="12" strokeWidth="2" />
                      <circle cx="12" cy="8" r="1" fill="currentColor" />
                    </svg>
                    Más Información
                  </button>

                  <button
                    onClick={() => setHeroIndex(prev => (prev + 1) % topKdramas.length)}
                    className="p-2.5 rounded-full bg-black/40 border border-white/20 text-white hover:bg-white/20 transition-colors ml-auto"
                    title="Siguiente recomendación"
                  >
                    <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rows Container */}
          <div className="netflix-rows-container relative z-20 -mt-14 md:-mt-24 space-y-10 px-6 md:px-14 pb-20">
            {/* 1. Continuar Viendo */}
            {continueWatchingKdramas.length > 0 && (
              <div className="netflix-row">
                <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-red-600 rounded-sm inline-block" />
                  Continuar viendo
                </h2>
                <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
                  {continueWatchingKdramas.map(item => (
                    <div
                      key={item.id}
                      onClick={() => openDramaModal(item, true)}
                      className="flex-shrink-0 w-48 md:w-56 bg-zinc-900 rounded-md overflow-hidden cursor-pointer group hover:scale-105 transition-transform duration-300 shadow-md border border-white/5"
                    >
                      <div className="relative h-28 md:h-32 bg-zinc-800">
                        <img
                          src={item.poster}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-red-600/90 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                            <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                          <div
                            className="h-full bg-red-600"
                            style={{ width: `${item.progress || 35}%` }}
                          />
                        </div>
                      </div>
                      <div className="p-3">
                        <h4 className="text-xs md:text-sm font-bold truncate text-white">{item.title}</h4>
                        <p className="text-[11px] text-white/50 mt-0.5">
                          T{item.season || 1} · Ep {item.episode || 1}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Top 10 Kdramas Hoy (Numbered Big Cards) */}
            <div className="netflix-row">
              <h2 className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-red-600 rounded-sm inline-block" />
                Los 10 Kdramas más populares hoy
              </h2>
              <div className="flex gap-6 overflow-x-auto no-scrollbar py-4 px-2">
                {topKdramas.slice(0, 10).map((drama, idx) => (
                  <div
                    key={drama.id}
                    onClick={() => openDramaModal(drama, false)}
                    className="flex-shrink-0 flex items-end cursor-pointer group hover:scale-105 transition-transform duration-300"
                  >
                    {/* Big stylized number */}
                    <span
                      className="text-7xl md:text-8xl font-black -mr-4 select-none leading-none z-10"
                      style={{
                        WebkitTextStroke: '2.5px #595959',
                        color: '#141414',
                        textShadow: '0 4px 10px rgba(0,0,0,0.8)'
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div className="w-32 md:w-40 h-48 md:h-60 rounded-md overflow-hidden shadow-xl relative z-0 bg-zinc-900 border border-white/10">
                      <img
                        src={drama.poster}
                        alt={drama.title}
                        className="w-full h-full object-cover group-hover:brightness-110 transition-all"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80';
                        }}
                      />
                      <div className="absolute top-2 right-2 bg-red-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded shadow">
                        TOP {idx + 1}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Doramas Latino Row */}
            <div className="netflix-row">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-red-600 rounded-sm inline-block" />
                  🍙 Doramas en Audio Latino
                </h2>
                <button
                  onClick={() => setActiveCategory('🍙 Doramas Latino')}
                  className="text-xs text-white/50 hover:text-white transition-colors"
                >
                  Explorar todos ›
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
                {homeLatinoDoramas.map(drama => (
                  <div
                    key={drama.id}
                    onClick={() => openDramaModal(drama, false)}
                    className="flex-shrink-0 w-36 md:w-44 rounded-md overflow-hidden cursor-pointer group hover:scale-105 transition-transform duration-300 shadow-md bg-zinc-900 border border-white/5"
                  >
                    <div className="h-52 md:h-64 relative">
                      <img
                        src={drama.poster}
                        alt={drama.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80';
                        }}
                      />
                      <span className="absolute top-2 left-2 bg-black/70 text-emerald-400 font-bold text-[10px] px-1.5 py-0.5 rounded">
                        LATINO
                      </span>
                    </div>
                    <div className="p-2">
                      <h4 className="text-xs font-bold text-white truncate">{drama.title}</h4>
                      <p className="text-[10px] text-white/50">{drama.year || '2026'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Doramas Sub Español Row */}
            <div className="netflix-row">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-red-600 rounded-sm inline-block" />
                  💬 Doramas Sub Español
                </h2>
                <button
                  onClick={() => setActiveCategory('💬 Doramas Sub Español')}
                  className="text-xs text-white/50 hover:text-white transition-colors"
                >
                  Explorar todos ›
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
                {homeSubDoramas.map(drama => (
                  <div
                    key={drama.id}
                    onClick={() => openDramaModal(drama, false)}
                    className="flex-shrink-0 w-36 md:w-44 rounded-md overflow-hidden cursor-pointer group hover:scale-105 transition-transform duration-300 shadow-md bg-zinc-900 border border-white/5"
                  >
                    <div className="h-52 md:h-64 relative">
                      <img
                        src={drama.poster}
                        alt={drama.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80';
                        }}
                      />
                      <span className="absolute top-2 left-2 bg-black/70 text-amber-400 font-bold text-[10px] px-1.5 py-0.5 rounded">
                        SUB
                      </span>
                    </div>
                    <div className="p-2">
                      <h4 className="text-xs font-bold text-white truncate">{drama.title}</h4>
                      <p className="text-[10px] text-white/50">{drama.year || '2026'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Películas Asiáticas Row */}
            {homeAsianMovies.length > 0 && (
              <div className="netflix-row">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-red-600 rounded-sm inline-block" />
                    🎬 Películas Asiáticas Destacadas
                  </h2>
                  <button
                    onClick={() => setActiveCategory('🎬 Películas Asiáticas')}
                    className="text-xs text-white/50 hover:text-white transition-colors"
                  >
                    Explorar todas ›
                  </button>
                </div>
                <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
                  {homeAsianMovies.map(movie => (
                    <div
                      key={movie.id}
                      onClick={() => openDramaModal(movie, true)}
                      className="flex-shrink-0 w-36 md:w-44 rounded-md overflow-hidden cursor-pointer group hover:scale-105 transition-transform duration-300 shadow-md bg-zinc-900 border border-white/5"
                    >
                      <div className="h-52 md:h-64 relative">
                        <img
                          src={movie.poster}
                          alt={movie.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80';
                          }}
                        />
                        <span className="absolute top-2 left-2 bg-red-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded">
                          PELÍCULA
                        </span>
                      </div>
                      <div className="p-2">
                        <h4 className="text-xs font-bold text-white truncate">{movie.title}</h4>
                        <p className="text-[10px] text-white/50">{movie.year || '2026'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : activeCategory === '❤️ Mi Lista' ? (
        // My List
        <div className="px-6 md:px-14 pt-8 pb-16">
          <h2 className="text-xl font-bold mb-6">Mi Lista de Kdramas</h2>
          <div className="text-center py-20 text-white/40">
            <span className="text-4xl block mb-2">⭐</span>
            Agrega doramas a tus favoritos para verlos aquí
          </div>
        </div>
      ) : (
        // Category Grid View (Latino, Sub, Películas)
        <div className="px-6 md:px-14 pt-8 pb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-white">
              {activeCategory}
            </h2>
            <div className="text-xs text-white/50">
              Página {page} de {totalPages}
            </div>
          </div>

          {isLoading ? (
            <SkeletonGrid count={18} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {gridItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => openDramaModal(item, item.type === 'movie')}
                  className="group relative rounded-md overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-105 hover:z-20 shadow-lg bg-zinc-900 border border-white/5"
                >
                  <img
                    src={item.poster}
                    alt={item.title}
                    className="w-full h-64 object-cover"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500&auto=format&fit=crop&q=80';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                    <span className="text-xs bg-red-600 px-1.5 py-0.5 rounded w-max mb-1 font-bold">
                      {item.type === 'movie' ? 'Película' : 'Kdrama'}
                    </span>
                    <h3 className="text-sm font-bold text-white line-clamp-2">{item.title}</h3>
                    <p className="text-[11px] text-white/70">{item.year} · {item.lang}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex items-center justify-center gap-4 mt-12">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="px-5 py-2 rounded-full bg-white/10 text-white font-semibold text-xs hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ‹ Anterior
            </button>
            <span className="text-xs text-white/60">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="px-5 py-2 rounded-full bg-white/10 text-white font-semibold text-xs hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Siguiente ›
            </button>
          </div>
        </div>
      )}

      {/* Netflix Detail & Player Modal */}
      {selectedDrama && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-[#181818] rounded-none md:rounded-lg overflow-hidden shadow-2xl border border-white/10 my-auto">
            {/* Close Button */}
            <button
              onClick={() => {
                setSelectedDrama(null);
                setIsPlaying(false);
              }}
              className="absolute top-4 right-4 z-40 w-10 h-10 rounded-full bg-black/70 text-white hover:bg-white/20 flex items-center justify-center font-bold text-lg transition-colors border border-white/20"
            >
              ✕
            </button>

            {/* Video Player or Billboard Banner */}
            {isPlaying && activePlayerUrl ? (
              <div className="relative w-full aspect-video bg-black">
                <iframe
                  src={activePlayerUrl}
                  title="Reproductor Kdrama"
                  className="w-full h-full border-0"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            ) : (
              <div className="relative w-full h-72 md:h-96 bg-zinc-900 overflow-hidden">
                <img
                  src={selectedDrama.backdrop || selectedDrama.poster}
                  alt={selectedDrama.title}
                  className="w-full h-full object-cover filter brightness-75"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent" />

                <div className="absolute left-6 md:left-10 bottom-6 max-w-xl z-20">
                  <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded mb-2 inline-block">
                    {selectedDrama.type === 'movie' ? 'PELÍCULA ASIÁTICA' : 'KDRAMA'}
                  </span>
                  <h2 className="text-2xl md:text-4xl font-black text-white drop-shadow mb-2">
                    {selectedDrama.title}
                  </h2>
                  <p className="text-xs text-white/70 line-clamp-2 mb-4">
                    {selectedDrama.overview}
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPlaying(true)}
                      disabled={!activePlayerUrl && serversList.length === 0}
                      className="flex items-center gap-2 px-6 py-2.5 bg-white text-black font-bold text-sm rounded hover:bg-white/80 active:scale-95 transition-all shadow"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      {activePlayerUrl ? 'Reproducir' : 'Cargando...'}
                    </button>

                    <button
                      onClick={handleCast}
                      disabled={!activePlayerUrl}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/20 text-white font-bold text-sm rounded hover:bg-white/30 active:scale-95 transition-all border border-white/10"
                      title="Transmitir con Web Video Caster"
                    >
                      <svg className="w-4 h-4 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="2">
                        <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                        <line x1="2" y1="20" x2="2.01" y2="20" />
                      </svg>
                      Transmitir TV
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-6 md:p-8 space-y-6">
              {/* Server Selector Bar */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Servidores Disponibles
                  </h3>
                  {isLinksLoading && (
                    <span className="text-xs text-white/40">Cargando servidores...</span>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                  {serversList.length > 0 ? (
                    serversList.map(srv => {
                      const isActive = activeServer?.id === srv.id;
                      return (
                        <button
                          key={srv.id}
                          onClick={() => handleServerChange(srv)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                            isActive
                              ? 'bg-red-600 text-white border-red-500 shadow-md scale-105'
                              : 'bg-zinc-800 text-white/70 border-white/5 hover:bg-zinc-700 hover:text-white'
                          }`}
                        >
                          <span>{srv.name}</span>
                          <span className="text-[10px] opacity-75 font-normal">({srv.lang})</span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-xs text-white/40 py-2">
                      {isLinksLoading ? 'Buscando servidores de reproducción...' : 'No hay servidores disponibles para este episodio.'}
                    </div>
                  )}
                </div>
              </div>

              {/* Season & Episode Selector (Series Only) */}
              {selectedDrama.type !== 'movie' && (
                <div className="border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Episodios
                    </h3>

                    {/* Season Dropdown */}
                    {seasonsList.length > 1 && (
                      <div className="relative">
                        <select
                          value={activeSeason}
                          onChange={(e) => handleSeasonChange(Number(e.target.value))}
                          className="bg-zinc-800 border border-white/20 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-600"
                        >
                          {seasonsList.map(s => (
                            <option key={s.season_number} value={s.season_number}>
                              Temporada {s.season_number}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Episodes List Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-60 overflow-y-auto pr-2 no-scrollbar">
                    {episodesData.map(ep => {
                      const isCurrent = activeEpisode === ep.episode_number;
                      return (
                        <button
                          key={ep._id || ep.episode_number}
                          onClick={() => handleSelectEpisode(ep)}
                          className={`flex flex-col p-3 rounded-md text-left transition-all border ${
                            isCurrent
                              ? 'bg-red-600/20 border-red-600 text-white shadow'
                              : 'bg-zinc-800/60 border-white/5 text-white/70 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          <span className="text-xs font-bold truncate">
                            Episodio {ep.episode_number}
                          </span>
                          <span className="text-[10px] text-white/40 truncate mt-0.5">
                            {ep.name_es || ep.name || `Capítulo ${ep.episode_number}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
