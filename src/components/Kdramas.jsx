import React, { useState, useEffect, useMemo } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { SkeletonGrid } from './SkeletonLoader';
import { saveWatchProgress, toggleFavorite, isFavorite, getWatchHistory } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';

const TMDB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiMGM4MjRjMmFkMzllODUwNmE5ZGUzOGI5ZTA2ZjJmZiIsIm5iZiI6MTc0ODI3MjY1Ni43MDMsInN1YiI6IjY4MzQ4NjEwNjFmMWZlZmI4YmViMzYxZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KUIiE74vCOP05_Y0M5CKyCBtj9m5lN1WzCfZ6bQn6Xs';
const TMDB = 'https://api.themoviedb.org/3';
const HDR = { Authorization: `Bearer ${TMDB_KEY}` };

const VIMEUS_VIEW_KEY = 'KThsRRoYzOilpZpoAf-eQMKv1cN3ULOBQxPk6QmeL-A';
const VIMEUS_PARAMS = '&title=PIRU_TV&theme=red&font=v3&overlay=v5&selector=v3&playUI=v3&epanel=v3';

// ── Servidores 100% Funcionales para Kdramas y Películas Asiáticas ──
const KDRAMA_SERVERS = [
  {
    id: 'vimeus',
    name: 'Vimeus',
    lang: '🇲🇽 LATINO',
    badge: '⭐ Oficial',
    desc: 'Audio Latino nativo oficial de alta fidelidad (Recomendado)',
    quality: 'HD'
  },
  {
    id: 'unlimplay',
    name: 'UnLimPlay',
    lang: '🇲🇽 LATINO',
    badge: '💎 Multi-Latino',
    desc: 'Servidor con múltiples fuentes en audio Latino',
    quality: '1080p'
  },
  {
    id: 'vimeus_sala2',
    name: 'Vimeus Sala 2',
    lang: '🇲🇽 LATINO',
    badge: '🔄 Respaldo',
    desc: 'Servidor alternativo de Vimeus en Audio Latino',
    quality: 'HD'
  },
  {
    id: 'cinesrc',
    name: 'CineSrc',
    lang: 'MULTI / ESP',
    badge: '⚡ Rápido',
    desc: 'Servidor CineSrc de alta velocidad con soporte multi-idioma',
    quality: '1080p'
  }
];

// Fallback robusto con los Kdramas más aclamados para carga instantánea
const CURATED_TOP_KDRAMAS = [
  {
    id: 93405,
    tmdbId: 93405,
    title: 'El juego del calamar',
    type: 'dorama',
    poster: 'https://image.tmdb.org/t/p/w500/xx3Zurg2mVep7UhXAjeYuetOvsB.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/2meX1nMdScFOoV4370rqHWKmXhY.jpg',
    overview: 'Cientos de jugadores cortos de dinero aceptan una extraña invitación a competir en juegos infantiles. Adentro les espera un premio irresistible... con un riesgo mortal.',
    year: '2021',
    lang: 'LAT',
    match: '99%'
  },
  {
    id: 94796,
    tmdbId: 94796,
    title: 'Aterrizaje de emergencia en tu corazón',
    type: 'dorama',
    poster: 'https://image.tmdb.org/t/p/w500/a6Z73Ou52jHSrelffGK04GyVhtd.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/3yEHM2HT2vrUtO93YzTJNgEfiZG.jpg',
    overview: 'Una heredera surcoreana sufre un accidente de parapente en cielos norcoreanos y debe ocultarse en tierra hostil con la ayuda de un oficial del ejército.',
    year: '2019',
    lang: 'LAT',
    match: '98%'
  },
  {
    id: 154825,
    tmdbId: 154825,
    title: 'Propuesta Laboral',
    type: 'dorama',
    poster: 'https://image.tmdb.org/t/p/w500/3Z8nacEGgQMNGHNi0IQPHOycsXz.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/lq0YqJuffMuZhoKTiC5xDqvtCSn.jpg',
    overview: 'Una mujer se hace pasar por su amiga en una cita a ciegas para alejar al pretendiente. Pero el plan se complica cuando él resulta ser su jefe y le hace una propuesta.',
    year: '2022',
    lang: 'LAT',
    match: '98%'
  },
  {
    id: 215720,
    tmdbId: 215720,
    title: 'La Reina de las Lágrimas',
    type: 'dorama',
    poster: 'https://image.tmdb.org/t/p/w500/yfJ2erY2SJiov0LaRhlSMhSPqYx.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/wcP3FsRLog4GNEs9PFrDKKQdcof.jpg',
    overview: 'La reina de los grandes almacenes y su esposo de pueblo afrontan una crisis matrimonial hasta que el amor comienza a renacer milagrosamente.',
    year: '2024',
    lang: 'LAT',
    match: '98%'
  },
  {
    id: 112888,
    tmdbId: 112888,
    title: 'Belleza verdadera',
    type: 'dorama',
    poster: 'https://image.tmdb.org/t/p/w500/mNzfhBMtuRSayDNiIad2xDCHjvM.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/3E1GroTJCRdIYHa5n62GqjmqxQR.jpg',
    overview: 'Una estudiante insegura domina el arte del maquillaje y se convierte en la chica más popular de su escuela mientras guarda su verdadera identidad.',
    year: '2020',
    lang: 'LAT',
    match: '97%'
  },
  {
    id: 99966,
    tmdbId: 99966,
    title: 'Estamos Muertos',
    type: 'dorama',
    poster: 'https://image.tmdb.org/t/p/w500/8jClvC5U756Uhd8zDYek50ihO49.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/8hp2CuGnw1iP5dLBVMAPUv23swx.jpg',
    overview: 'Luego de que un virus zombi se propaga por su escuela, un grupo de jóvenes atrapados debe encontrar una salida o acabar infectado.',
    year: '2022',
    lang: 'LAT',
    match: '98%'
  },
  {
    id: 117376,
    tmdbId: 117376,
    title: 'Vincenzo',
    type: 'dorama',
    poster: 'https://image.tmdb.org/t/p/w500/mWYW3xNeV2IM06aUl2xMUdLicpa.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/sf7NCqyVUNoyjYuwW5oJke1T1lH.jpg',
    overview: 'Un abogado coreano-italiano de la mafia visita su país natal para recuperar un alijo de oro oculto y luchar contra un conglomerado corrupto.',
    year: '2021',
    lang: 'LAT',
    match: '98%'
  },
  {
    id: 197067,
    tmdbId: 197067,
    title: 'Woo, Una Abogada Extraordinaria',
    type: 'dorama',
    poster: 'https://image.tmdb.org/t/p/w500/buYslA0HzhOK0LnUYdWLv7Z3uot.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/39owosjolYd3gKufgM9jMdSSk9t.jpg',
    overview: 'Woo Young-woo, una brillante abogada con trastorno del espectro autista, desafía las expectativas en un prestigioso bufete de abogados.',
    year: '2022',
    lang: 'LAT',
    match: '99%'
  },
  {
    id: 90447,
    tmdbId: 90447,
    title: 'Hotel del Luna',
    type: 'dorama',
    poster: 'https://image.tmdb.org/t/p/w500/uuQvLgr3xWuW5bb4LeR1jwa0G82.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/epq6I0AwVaHldCrQ6xJ5ZsAyHCF.jpg',
    overview: 'Un misterioso hotel en el corazón de Seúl solo atiende a almas de difuntos antes de partir al más allá.',
    year: '2019',
    lang: 'LAT',
    match: '97%'
  },
  {
    id: 68349,
    tmdbId: 68349,
    title: 'El Hada del Levantamiento de Pesas, Kim Bok-joo',
    type: 'dorama',
    poster: 'https://image.tmdb.org/t/p/w500/8SW0FS3U4nJQVIQj1hecU2Fon8Z.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/ktlhFbvJaOvsQJCBtVLMaGDZKjW.jpg',
    overview: 'Una joven levantadora de pesas universitaria se enamora por primera vez mientras persigue sus sueños atléticos.',
    year: '2016',
    lang: 'LAT',
    match: '96%'
  }
];

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

  // Home curated datasets with immediate fallback data so UI never disappears
  const [homeLatinoDoramas, setHomeLatinoDoramas] = useState(CURATED_TOP_KDRAMAS);
  const [homeSubDoramas, setHomeSubDoramas] = useState(CURATED_TOP_KDRAMAS.slice(4));
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
  const [selectedServer, setSelectedServer] = useState('vimeus');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [modalTab, setModalTab] = useState('player'); // 'player', 'details'

  // Map TMDB item into standard format
  const formatTmdbItem = (x, type = 'dorama', lang = 'LAT') => ({
    id: x.id,
    tmdbId: x.id,
    type: type,
    title: x.name || x.title || 'Kdrama',
    poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=500&q=80',
    backdrop: x.backdrop_path ? `https://image.tmdb.org/t/p/original${x.backdrop_path}` : (x.poster_path ? `https://image.tmdb.org/t/p/original${x.poster_path}` : null),
    overview: x.overview || 'Sin descripción disponible.',
    year: (x.first_air_date || x.release_date || '').slice(0, 4) || '2024',
    lang: lang,
    voteAverage: x.vote_average ? x.vote_average.toFixed(1) : '8.5'
  });

  // Load fresh home datasets from TMDB
  useEffect(() => {
    let isMounted = true;
    const loadHomeData = async () => {
      try {
        const [resLatino, resSub, resMovies] = await Promise.all([
          fetch(`${TMDB}/discover/tv?with_origin_country=KR&with_genres=18,35,10759,10765&sort_by=popularity.desc&language=es-MX&page=1`, { headers: HDR }).then(r => r.json()),
          fetch(`${TMDB}/discover/tv?with_origin_country=KR&sort_by=vote_count.desc&language=es-MX&page=1`, { headers: HDR }).then(r => r.json()),
          fetch(`${TMDB}/discover/movie?with_origin_country=KR&sort_by=popularity.desc&language=es-MX&page=1`, { headers: HDR }).then(r => r.json())
        ]);

        if (!isMounted) return;

        if (resLatino?.results?.length > 0) {
          const latItems = resLatino.results.map(x => formatTmdbItem(x, 'dorama', 'LAT'));
          setHomeLatinoDoramas(latItems);
        }

        if (resSub?.results?.length > 0) {
          const subItems = resSub.results.map(x => formatTmdbItem(x, 'dorama', 'SUB'));
          setHomeSubDoramas(subItems);
        }

        if (resMovies?.results?.length > 0) {
          const movItems = resMovies.results.map(x => formatTmdbItem(x, 'movie', 'LAT'));
          setHomeAsianMovies(movItems);
        }
      } catch (err) {
        console.error('Error fetching TMDB home kdramas:', err);
      }
    };

    loadHomeData();
    return () => { isMounted = false; };
  }, []);

  // Hero billboard rotation
  const heroList = useMemo(() => {
    return homeLatinoDoramas.length > 0 ? homeLatinoDoramas.slice(0, 8) : CURATED_TOP_KDRAMAS.slice(0, 8);
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
    const list = homeLatinoDoramas.length >= 10 ? homeLatinoDoramas : CURATED_TOP_KDRAMAS;
    return list.slice(0, 10);
  }, [homeLatinoDoramas]);

  // Filtered continue watching for kdramas
  const continueWatchingKdramas = useMemo(() => {
    return (watchHistory || []).filter(item => item.type === 'kdrama' || item.type === 'dorama').slice(0, 10);
  }, [watchHistory]);

  // Load category grid when not in 'Inicio'
  useEffect(() => {
    if (activeCategory === 'Inicio' || activeCategory === '❤️ Mi Lista' || searchTerm.trim()) {
      return;
    }

    let isMounted = true;
    const loadCategory = async () => {
      setIsLoading(true);
      try {
        const isMovies = activeCategory === '🎬 Películas Asiáticas';
        const isSub = activeCategory === '💬 Doramas Sub Español';

        let url = `${TMDB}/discover/tv?with_origin_country=KR&with_genres=18,35,10759,10765&sort_by=popularity.desc&language=es-MX&page=${page}`;
        if (isMovies) {
          url = `${TMDB}/discover/movie?with_origin_country=KR&sort_by=popularity.desc&language=es-MX&page=${page}`;
        } else if (isSub) {
          url = `${TMDB}/discover/tv?with_origin_country=KR&sort_by=vote_count.desc&language=es-MX&page=${page}`;
        }

        const res = await fetch(url, { headers: HDR }).then(r => r.json());
        if (!isMounted) return;

        if (res && res.results) {
          setTotalPages(Math.min(res.total_pages || 1, 50));
          const items = res.results.map(x => formatTmdbItem(x, isMovies ? 'movie' : 'dorama', isSub ? 'SUB' : 'LAT'));
          setGridItems(items);
        }
      } catch (err) {
        console.error('Error fetching category kdramas:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadCategory();
    return () => { isMounted = false; };
  }, [activeCategory, page, searchTerm]);

  // Real-time Global Search on TMDB
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const [tvRes, movRes] = await Promise.all([
          fetch(`${TMDB}/search/tv?query=${encodeURIComponent(searchTerm.trim())}&language=es-MX&page=1`, { headers: HDR }).then(r => r.json()),
          fetch(`${TMDB}/search/movie?query=${encodeURIComponent(searchTerm.trim())}&language=es-MX&page=1`, { headers: HDR }).then(r => r.json())
        ]);

        if (!isMounted) return;

        const tvItems = (tvRes.results || []).map(x => formatTmdbItem(x, 'dorama', 'LAT'));
        const movItems = (movRes.results || []).map(x => formatTmdbItem(x, 'movie', 'LAT'));

        setSearchResults([...tvItems, ...movItems]);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        if (isMounted) setIsSearching(false);
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  // Compute active render items
  const currentRenderItems = useMemo(() => {
    if (searchTerm.trim()) return searchResults;
    if (activeCategory === '❤️ Mi Lista') {
      return homeLatinoDoramas.filter(d => isFavorite(d.id));
    }
    return gridItems;
  }, [searchTerm, searchResults, activeCategory, homeLatinoDoramas, gridItems]);

  // Calculate dynamic embed URL for active selection
  const activePlayerUrl = useMemo(() => {
    if (!selectedDrama) return '';
    const id = selectedDrama.tmdbId || selectedDrama.id;
    const isMovie = selectedDrama.type === 'movie';

    if (selectedServer === 'vimeus') {
      const vk = VIMEUS_VIEW_KEY ? `&view_key=${encodeURIComponent(VIMEUS_VIEW_KEY)}` : '';
      if (isMovie) {
        return `https://vimeus.com/e/movie?tmdb=${id}${vk}${VIMEUS_PARAMS}`;
      }
      return `https://vimeus.com/e/serie?tmdb=${id}&se=${activeSeason}&ep=${activeEpisode}${vk}${VIMEUS_PARAMS}`;
    }

    if (selectedServer === 'unlimplay') {
      if (isMovie) {
        return `https://unlimplay.com/f/embed/movie/${id}`;
      }
      return `https://unlimplay.com/f/embed/tv/${id}/${activeSeason}/${activeEpisode}`;
    }

    if (selectedServer === 'vimeus_sala2') {
      const vk = VIMEUS_VIEW_KEY ? `&view_key=${encodeURIComponent(VIMEUS_VIEW_KEY)}` : '';
      const params = '&title=PIRU_TV&theme=dark&font=v2&overlay=v3&selector=v2&playUI=v2&epanel=v2';
      if (isMovie) {
        return `https://vimeus.com/e/movie?tmdb=${id}${vk}${params}`;
      }
      return `https://vimeus.com/e/serie?tmdb=${id}&se=${activeSeason}&ep=${activeEpisode}${vk}${params}`;
    }

    if (selectedServer === 'cinesrc') {
      if (isMovie) {
        return `https://cinesrc.st/embed/movie/${id}?color=%23e50914`;
      }
      return `https://cinesrc.st/embed/tv/${id}?s=${activeSeason}&e=${activeEpisode}&color=%23e50914`;
    }

    return '';
  }, [selectedDrama, selectedServer, activeSeason, activeEpisode]);

  // Open drama modal and fetch seasons & episode list from TMDB
  const handleOpenDrama = async (drama, autoPlay = true) => {
    setIsDetailsLoading(true);
    setSelectedDrama(drama);
    setSeasonsList([]);
    setActiveSeason(1);
    setEpisodesData([]);
    setActiveEpisode(1);
    setSelectedServer('vimeus');
    setIsPlaying(autoPlay);
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
      if (drama.type !== 'movie') {
        const id = drama.tmdbId || drama.id;
        const res = await fetch(`${TMDB}/tv/${id}?language=es-MX`, { headers: HDR }).then(r => r.json());
        if (res && res.seasons) {
          const validSeasons = res.seasons.filter(s => s.season_number > 0);
          const initialSeasons = validSeasons.length > 0 ? validSeasons : [{ season_number: 1, episode_count: 16 }];
          setSeasonsList(initialSeasons);

          // Fetch first season episodes
          const firstSeasonNum = initialSeasons[0].season_number;
          const epRes = await fetch(`${TMDB}/tv/${id}/season/${firstSeasonNum}?language=es-MX`, { headers: HDR }).then(r => r.json());
          if (epRes && epRes.episodes && epRes.episodes.length > 0) {
            setEpisodesData(epRes.episodes);
            setActiveEpisode(epRes.episodes[0].episode_number || 1);
          } else {
            // Generate fallback episode list based on count
            const count = initialSeasons[0].episode_count || 16;
            const fakeEpisodes = Array.from({ length: count }, (_, i) => ({
              episode_number: i + 1,
              name: `Episodio ${i + 1}`
            }));
            setEpisodesData(fakeEpisodes);
            setActiveEpisode(1);
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
    setIsPlaying(true);

    try {
      const id = selectedDrama.tmdbId || selectedDrama.id;
      const epRes = await fetch(`${TMDB}/tv/${id}/season/${seasonNum}?language=es-MX`, { headers: HDR }).then(r => r.json());
      if (epRes && epRes.episodes && epRes.episodes.length > 0) {
        setEpisodesData(epRes.episodes);
        setActiveEpisode(epRes.episodes[0].episode_number || 1);
      } else {
        const seasonObj = seasonsList.find(s => s.season_number === seasonNum);
        const count = seasonObj?.episode_count || 16;
        const fakeEpisodes = Array.from({ length: count }, (_, i) => ({
          episode_number: i + 1,
          name: `Episodio ${i + 1}`
        }));
        setEpisodesData(fakeEpisodes);
        setActiveEpisode(1);
      }
    } catch (err) {
      console.error('Error changing season:', err);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  // Change episode
  const handleEpisodeChange = (epNum) => {
    setActiveEpisode(epNum);
    setIsPlaying(true);
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

  // Persist watch progress
  useEffect(() => {
    if (selectedDrama && activePlayerUrl) {
      saveWatchProgress({
        id: selectedDrama.id,
        title: selectedDrama.title,
        poster: selectedDrama.poster,
        backdrop: selectedDrama.backdrop,
        type: 'kdrama',
        season: activeSeason,
        episode: activeEpisode
      });
      setWatchHistory(getWatchHistory());
    }
  }, [selectedDrama, activePlayerUrl, activeSeason, activeEpisode]);

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
    <div className="peliculas-container netflix-view" style={{ minHeight: '100vh', background: '#141414', color: '#fff', position: 'relative' }}>
      
      {/* Netflix Subnav & Category Pills */}
      <div style={{
        padding: '1.25rem 3.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        position: 'relative',
        zIndex: 30,
        marginBottom: '0.5rem'
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
          {heroItem ? (
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
                    onClick={() => handleOpenDrama(heroItem, true)}
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '26px' }}>
                      play_arrow
                    </span>
                    Reproducir
                  </button>

                  <button 
                    className="btn-netflix-info" 
                    onClick={() => {
                      handleOpenDrama(heroItem, false);
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
          ) : (
            <div style={{ height: '50vh', background: 'linear-gradient(180deg, #1f1f2e 0%, #141414 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="pulse-dot" style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e50914' }} />
            </div>
          )}

          {/* Netflix Content Rows Section */}
          <div className="netflix-rows-container" style={{ marginTop: heroItem ? '-3.5rem' : '1rem' }}>
            
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
                      onClick={() => handleOpenDrama(item, true)}
                    >
                      <div className="netflix-continue-thumb" style={{ background: '#1f1f2e', position: 'relative' }}>
                        <img 
                          src={item.backdrop || item.poster || 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=500&q=80'} 
                          alt={item.title}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=500&q=80';
                          }}
                        />
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
                        <span className="netflix-continue-sub">Continuar episodio</span>
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
                      onClick={() => handleOpenDrama(item, true)}
                    >
                      <span className="netflix-top-num">{index + 1}</span>
                      <div className="netflix-top-poster">
                        <img 
                          src={item.poster} 
                          alt={item.title} 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=500&q=80';
                          }}
                        />
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

            {/* Row 2: Kdramas con Doblaje Latino */}
            {homeLatinoDoramas.length > 0 && (
              <section className="netflix-row-section">
                <div className="netflix-row-header">
                  <h2 className="netflix-row-title">
                    🍙 Kdramas Populares con Doblaje Latino
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                      chevron_right
                    </span>
                  </h2>
                  <button 
                    className="netflix-see-all-btn"
                    onClick={() => {
                      setActiveCategory('🍙 Doramas Latino');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Explorar todos →
                  </button>
                </div>
                <div className="netflix-cards-row">
                  {homeLatinoDoramas.slice(0, 16).map((item) => (
                    <div 
                      key={`latino-${item.id}`} 
                      className="netflix-card"
                      onClick={() => handleOpenDrama(item, true)}
                    >
                      <div className="netflix-poster-wrapper">
                        <img 
                          src={item.poster} 
                          alt={item.title} 
                          loading="lazy" 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=500&q=80';
                          }}
                        />
                        <div className="netflix-card-lang-strip">
                          <span className="netflix-pill-lat">LATINO</span>
                        </div>
                      </div>
                      <div className="netflix-card-body">
                        <span className="netflix-card-title">{item.title}</span>
                        <div className="netflix-card-meta">
                          <span className="netflix-match-sub">98% match</span>
                          <span className="netflix-year-tag">{item.year}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Row 3: Kdramas Sub Español */}
            {homeSubDoramas.length > 0 && (
              <section className="netflix-row-section">
                <div className="netflix-row-header">
                  <h2 className="netflix-row-title">
                    💬 Doramas Más Aclamados (Sub Español)
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                      chevron_right
                    </span>
                  </h2>
                  <button 
                    className="netflix-see-all-btn"
                    onClick={() => {
                      setActiveCategory('💬 Doramas Sub Español');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Explorar todos →
                  </button>
                </div>
                <div className="netflix-cards-row">
                  {homeSubDoramas.slice(0, 16).map((item) => (
                    <div 
                      key={`sub-${item.id}`} 
                      className="netflix-card"
                      onClick={() => handleOpenDrama(item, true)}
                    >
                      <div className="netflix-poster-wrapper">
                        <img 
                          src={item.poster} 
                          alt={item.title} 
                          loading="lazy" 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=500&q=80';
                          }}
                        />
                        <div className="netflix-card-lang-strip">
                          <span className="netflix-pill-sub">SUBTITULADO</span>
                        </div>
                      </div>
                      <div className="netflix-card-body">
                        <span className="netflix-card-title">{item.title}</span>
                        <div className="netflix-card-meta">
                          <span className="netflix-match-sub">99% match</span>
                          <span className="netflix-year-tag">{item.year}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Row 4: Películas Asiáticas */}
            {homeAsianMovies.length > 0 && (
              <section className="netflix-row-section">
                <div className="netflix-row-header">
                  <h2 className="netflix-row-title">
                    🎬 Películas y Cine Asiático
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                      chevron_right
                    </span>
                  </h2>
                  <button 
                    className="netflix-see-all-btn"
                    onClick={() => {
                      setActiveCategory('🎬 Películas Asiáticas');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Explorar todos →
                  </button>
                </div>
                <div className="netflix-cards-row">
                  {homeAsianMovies.slice(0, 16).map((item) => (
                    <div 
                      key={`movie-${item.id}`} 
                      className="netflix-card"
                      onClick={() => handleOpenDrama(item, true)}
                    >
                      <div className="netflix-poster-wrapper">
                        <img 
                          src={item.poster} 
                          alt={item.title} 
                          loading="lazy" 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=500&q=80';
                          }}
                        />
                        <div className="netflix-card-lang-strip">
                          <span className="netflix-pill-lat">PELÍCULA</span>
                        </div>
                      </div>
                      <div className="netflix-card-body">
                        <span className="netflix-card-title">{item.title}</span>
                        <div className="netflix-card-meta">
                          <span className="netflix-match-sub">Full HD</span>
                          <span className="netflix-year-tag">{item.year}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        </>
      ) : (
        /* CATEGORY GRID VIEW & LIVE SEARCH RESULTS */
        <div style={{ padding: '0 3.5rem 5rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '1.5rem 0' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: 0 }}>
              {searchTerm ? `Resultados para "${searchTerm}"` : activeCategory}
            </h2>
            <span style={{ fontSize: '0.9rem', color: '#a3a3a3' }}>
              {currentRenderItems.length} títulos encontrados
            </span>
          </div>

          {isLoading || isSearching ? (
            <SkeletonGrid count={18} />
          ) : currentRenderItems.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.25rem' }}>
              {currentRenderItems.map(item => (
                <div 
                  key={`grid-${item.id}`}
                  className="netflix-card"
                  onClick={() => handleOpenDrama(item, true)}
                  style={{ width: '100%' }}
                >
                  <div className="netflix-poster-wrapper">
                    <img 
                      src={item.poster} 
                      alt={item.title} 
                      loading="lazy" 
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=500&q=80';
                      }}
                    />
                    <div className="netflix-card-lang-strip">
                      <span className={item.lang === 'SUB' ? 'netflix-pill-sub' : 'netflix-pill-lat'}>
                        {item.type === 'movie' ? 'PELÍCULA' : (item.lang === 'SUB' ? 'SUB' : 'LATINO')}
                      </span>
                    </div>
                  </div>
                  <div className="netflix-card-body">
                    <span className="netflix-card-title">{item.title}</span>
                    <div className="netflix-card-meta">
                      <span className="netflix-match-sub">⭐ {item.voteAverage || '8.5'}</span>
                      <span className="netflix-year-tag">{item.year}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '4rem 0', textAlign: 'center', color: '#a3a3a3' }}>
              <h3>No se encontraron resultados</h3>
              <p>Prueba con otro término de búsqueda o selecciona una categoría diferente.</p>
            </div>
          )}

          {/* Pagination for Categories */}
          {!searchTerm && activeCategory !== '❤️ Mi Lista' && totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', marginTop: '3rem', flexWrap: 'wrap' }}>
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ← Anterior
              </button>

              {pagesToRender.map((p, idx) => {
                if (p === '...') {
                  return <span key={`dots-${idx}`} style={{ padding: '0.6rem 0.5rem', color: '#666', fontWeight: 'bold' }}>...</span>;
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
                      border: isCurrent ? '1px solid #e50914' : '1px solid var(--border-color)',
                      color: '#fff',
                      minWidth: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      cursor: 'pointer',
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
                      <span><strong>Servidores Disponibles:</strong> {KDRAMA_SERVERS.length} opciones en línea.</span>
                    </div>
                  </div>

                  <div className="server-selector-row">
                    {KDRAMA_SERVERS.map(srv => (
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
                      </button>
                    ))}
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
                            key={`bubble-${ep.episode_number}`}
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
                                key={`list-${ep.episode_number}`}
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
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Título Original</span>
                    <h4 style={{ margin: '4px 0 0', color: '#fff', fontSize: '0.95rem' }}>{selectedDrama.title}</h4>
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

      {/* Footer Branding */}
      <footer style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
        © 2026 PIRU TV • Los Mejores Doramas y Kdramas en Español Latino
      </footer>

    </div>
  );
}
