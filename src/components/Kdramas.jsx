import React, { useState, useEffect, useMemo } from 'react';

const TMDB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiMGM4MjRjMmFkMzllODUwNmE5ZGUzOGI5ZTA2ZjJmZiIsIm5iZiI6MTc0ODI3MjY1Ni43MDMsInN1YiI6IjY4MzQ4NjEwNjFmMWZlZmI4YmViMzYxZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KUIiE74vCOP05_Y0M5CKyCBtj9m5lN1WzCfZ6bQn6Xs';
const TMDB = 'https://api.themoviedb.org/3';
const IMG  = 'https://image.tmdb.org/t/p/w500';
const HDR  = { Authorization: `Bearer ${TMDB_KEY}` };

const VIMEUS_VIEW_KEY = 'KThsRRoYzOilpZpoAf-eQMKv1cN3ULOBQxPk6QmeL-A';

const SERVERS = {
  korii: {
    name: 'Korii (VidSrc)',
    getUrl: (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}-${e}?ds_lang=es`
  },
  maru: {
    name: 'Maru (VidSrcPM)',
    getUrl: (id, s, e) => `https://vidsrc.pm/embed/tv/${id}/${s}-${e}?ds_lang=es`
  },
  okru: {
    name: 'Okru (Vimeus)',
    getUrl: (id, s, e) => `https://vimeus.com/e/serie?tmdb=${id}&se=${s}&ep=${e}&view_key=${encodeURIComponent(VIMEUS_VIEW_KEY)}&title=PIRU_TV&theme=red&font=v3&overlay=v5&selector=v3&playUI=v3&epanel=v3`
  },
  hiplay: {
    name: 'Hiplay (2Embed)',
    getUrl: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}&lang=es`
  },
  pdrive: {
    name: 'PDrive (VidSrcCC)',
    getUrl: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}-${e}?ds_lang=es`
  },
  evo: {
    name: 'Evo (VidSrcNet)',
    getUrl: (id, s, e) => `https://vidsrc.net/embed/tv/${id}/${s}-${e}?ds_lang=es`
  },
  dodo: {
    name: 'Dodo (VidSrcIn)',
    getUrl: (id, s, e) => `https://vidsrc.in/embed/tv/${id}/${s}-${e}?ds_lang=es`
  }
};

const GENRES_MAP = {
  10759: "Acción & Aventura",
  16: "Animación",
  35: "Comedia",
  80: "Crimen",
  99: "Documental",
  18: "Drama",
  10751: "Familia",
  10762: "Infantil",
  9648: "Misterio",
  10763: "Noticias",
  10764: "Reality",
  10765: "Sci-Fi & Fantasía",
  10766: "Telenovela",
  10767: "Talk Show",
  10768: "Guerra & Política",
  37: "Western"
};

const COUNTRY_MAP = {
  KR: "Corea del Sur",
  CN: "China",
  JP: "Japón",
  TW: "Taiwán",
  TH: "Tailandia"
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

const SEARCH_FLIX_QUERY = `
  query searchDorama($input: String!) {
    searchDorama(input: $input, limit: 10) {
      _id
      slug
      name
      name_es
      names
    }
  }
`;

const EPISODES_FLIX_QUERY = `
  query listEpisodes($slug: String!, $season: Float!) {
    listEpisodes(
      sort: NUMBER_ASC
      filter: {
        type_serie: "dorama"
        serie_slug: $slug
        season_number: $season
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

const queryFlix = async (query, variables = {}) => {
  const res = await fetch('https://sv1.fluxcedene.net/api/gql', {
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

export default function Kdramas() {
  const [dramas, setDramas] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [langCode, setLangCode] = useState('ko');
  const [langFilter, setLangFilter] = useState('sub');
  
  const [selectedDrama, setSelectedDrama] = useState(null);
  
  const [hasResolvedOnSite, setHasResolvedOnSite] = useState(false);
  const [doramaSlug, setDoramaSlug] = useState('');
  const [chaptersList, setChaptersList] = useState([]);
  const [activeEpisode, setActiveEpisode] = useState(1);
  const [activeSeason, setActiveSeason] = useState(1);
  const [serversList, setServersList] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [activePlayerUrl, setActivePlayerUrl] = useState('');
  
  const [isTheater, setIsTheater] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  const [allEpisodeLinks, setAllEpisodeLinks] = useState([]);
  const [episodesData, setEpisodesData] = useState([]);

  const { hasLatino, hasSubbed } = useMemo(() => {
    if (!hasResolvedOnSite || !allEpisodeLinks || allEpisodeLinks.length === 0) {
      return { hasLatino: true, hasSubbed: true };
    }
    const lat = allEpisodeLinks.some(l => l.lang === '38' || l.language_code === 'es');
    const sub = allEpisodeLinks.some(l => l.lang !== '38' && l.language_code !== 'es');
    return { hasLatino: lat, hasSubbed: sub };
  }, [allEpisodeLinks, hasResolvedOnSite]);

  useEffect(() => {
    const loadDramas = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${TMDB}/discover/tv?with_original_language=${langCode}&sort_by=popularity.desc&page=${page}&language=es-ES`, { headers: HDR });
        if (res.ok) {
          const data = await res.json();
          const results = (data.results || []).map(x => ({
            id: x.id,
            titulo: x.name || x.original_name || '—',
            portada: x.poster_path ? `${IMG}${x.poster_path}` : 'https://via.placeholder.com/160x240?text=?',
            description: x.overview || 'Sin descripción disponible.',
            rating: x.vote_average ? Math.round(x.vote_average * 10) / 10 : null,
            year: (x.first_air_date || '').slice(0, 4) || '—',
            genres: (x.genre_ids || []).map(id => GENRES_MAP[id]).filter(Boolean).join(', '),
            country: x.origin_country && x.origin_country[0] ? COUNTRY_MAP[x.origin_country[0]] || x.origin_country[0] : 'Corea del Sur'
          }));
          setDramas(prev => page === 1 ? results : [...prev, ...results]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadDramas();
  }, [langCode, page]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`${TMDB}/search/tv?query=${encodeURIComponent(searchTerm)}&language=es-ES&page=1`, { headers: HDR });
        if (res.ok) {
          const data = await res.json();
          const results = (data.results || [])
            .filter(x => x.original_language === 'ko' || x.original_language === 'zh' || x.original_language === 'ja')
            .map(x => ({
              id: x.id,
              titulo: x.name || x.original_name || '—',
              portada: x.poster_path ? `${IMG}${x.poster_path}` : 'https://via.placeholder.com/160x240?text=?',
              description: x.overview || 'Sin descripción disponible.',
              rating: x.vote_average ? Math.round(x.vote_average * 10) / 10 : null,
              year: (x.first_air_date || '').slice(0, 4) || '—',
              genres: (x.genre_ids || []).map(id => GENRES_MAP[id]).filter(Boolean).join(', '),
              country: x.origin_country && x.origin_country[0] ? COUNTRY_MAP[x.origin_country[0]] || x.origin_country[0] : 'Corea del Sur'
            }));
          setSearchResults(results);
        }
      } catch (e) {
        console.error(e);
      }
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleOpenDrama = async (drama) => {
    setIsDetailsLoading(true);
    setSelectedDrama(drama);
    setHasResolvedOnSite(false);
    setDoramaSlug('');
    setChaptersList([]);
    setServersList([]);
    setAllEpisodeLinks([]);
    setEpisodesData([]);
    setActiveServer(null);
    setActivePlayerUrl('');
    
    try {
      const searchRes = await queryFlix(SEARCH_FLIX_QUERY, { input: drama.titulo });
      let matchedDorama = null;
      if (searchRes.data && searchRes.data.searchDorama && searchRes.data.searchDorama.length > 0) {
        const matches = searchRes.data.searchDorama;
        matchedDorama = matches.find(m => 
          m.name.toLowerCase() === drama.titulo.toLowerCase() || 
          (m.name_es && m.name_es.toLowerCase() === drama.titulo.toLowerCase())
        ) || matches[0];
      }

      if (matchedDorama) {
        setDoramaSlug(matchedDorama.slug);
        const epRes = await queryFlix(EPISODES_FLIX_QUERY, { slug: matchedDorama.slug, season: 1 });
        const episodes = (epRes.data && epRes.data.listEpisodes) || [];
        if (episodes.length > 0) {
          setEpisodesData(episodes);
          const chaps = episodes.map(ep => ep.episode_number);
          setChaptersList(chaps);
          setHasResolvedOnSite(true);
          
          const firstEp = episodes[0];
          setActiveEpisode(firstEp.episode_number);
          const linksRes = await queryFlix(LINKS_FLIX_QUERY, { id: firstEp._id, app: 'com.asiapp.doramasgo' });
          const links = (linksRes.data && linksRes.data.getEpisodeLinks && linksRes.data.getEpisodeLinks.links_online) || [];
          setAllEpisodeLinks(links);
          
          const hasLat = links.some(l => l.lang === '38' || l.language_code === 'es');
          setLangFilter(hasLat ? 'lat' : 'sub');
          
          setIsDetailsLoading(false);
          return;
        }
      }
      
      const res = await fetch(`${TMDB}/tv/${drama.id}?language=es-ES`, { headers: HDR });
      if (res.ok) {
        let details = await res.json();
        if (!details.overview) {
          const enRes = await fetch(`${TMDB}/tv/${drama.id}?language=en-US`, { headers: HDR });
          if (enRes.ok) {
            const enDetails = await enRes.json();
            details.overview = enDetails.overview;
          }
        }
        setSelectedDrama(prev => ({ ...prev, description: details.overview || prev.description }));
        
        const firstSeason = details.seasons ? details.seasons.find(s => s.season_number === 1) || details.seasons[0] : null;
        if (firstSeason) {
          const epRes = await fetch(`${TMDB}/tv/${drama.id}/season/${firstSeason.season_number}?language=es-ES`, { headers: HDR });
          if (epRes.ok) {
            const epData = await epRes.json();
            const tmdbChaps = (epData.episodes || []).map(ep => ep.episode_number);
            setChaptersList(tmdbChaps);
            setActiveEpisode(1);
            setActiveSeason(firstSeason.season_number);
            setActivePlayerUrl(`https://multiembed.mov/?video_id=${drama.id}&tmdb=1&s=${firstSeason.season_number}&e=1`);
          }
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
    
    if (hasResolvedOnSite && episodesData.length > 0) {
      const activeEp = episodesData.find(ep => ep.episode_number === epNum);
      if (activeEp) {
        try {
          const linksRes = await queryFlix(LINKS_FLIX_QUERY, { id: activeEp._id, app: 'com.asiapp.doramasgo' });
          const links = (linksRes.data && linksRes.data.getEpisodeLinks && linksRes.data.getEpisodeLinks.links_online) || [];
          setAllEpisodeLinks(links);
          
          const hasLat = links.some(l => l.lang === '38' || l.language_code === 'es');
          const hasSub = links.some(l => l.lang !== '38' && l.language_code !== 'es');
          
          if (langFilter === 'lat' && !hasLat) {
            setLangFilter('sub');
          } else if (langFilter === 'sub' && !hasSub && hasLat) {
            setLangFilter('lat');
          }
        } catch (e) {
          console.error(e);
          setAllEpisodeLinks([]);
        }
      } else {
        setAllEpisodeLinks([]);
      }
    } else if (selectedDrama) {
      setActivePlayerUrl(`https://multiembed.mov/?video_id=${selectedDrama.id}&tmdb=1&s=${activeSeason}&e=${epNum}`);
    }
    
    setIsDetailsLoading(false);
  };

  const handleServerClick = (server) => {
    setActiveServer(server);
    if (server && server.embed) {
      setActivePlayerUrl(server.embed);
    }
  };

  useEffect(() => {
    if (hasResolvedOnSite && allEpisodeLinks && allEpisodeLinks.length > 0) {
      const isLatino = langFilter === 'lat';
      const filtered = allEpisodeLinks
        .filter(link => {
          const isLinkLatino = link.lang === '38' || link.language_code === 'es';
          return isLatino ? isLinkLatino : !isLinkLatino;
        })
        .map(link => ({
          hash: link._id,
          name: getHostName(link.embed, link.server_ref),
          embed: link.embed,
          lang: link.lang
        }));
      setServersList(filtered);
      if (filtered.length > 0) {
        setActiveServer(filtered[0]);
        setActivePlayerUrl(filtered[0].embed);
      } else {
        setActiveServer(null);
        setActivePlayerUrl('');
      }
    }
  }, [langFilter, allEpisodeLinks, hasResolvedOnSite]);

  const itemsToRender = searchTerm.trim() ? searchResults : dramas;

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

      <div className="section-header">
        <h1 className="section-title">Kdramas</h1>
        <div className="controls-group">
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar Kdrama, Cdrama, Jdrama..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          <button
            className={`filter-badge ${langCode === 'ko' ? 'active' : ''}`}
            onClick={() => {
              setLangCode('ko');
              setPage(1);
              setSearchTerm('');
            }}
          >
            Coreanos (K-Dramas) 🇰🇷
          </button>
          <button
            className={`filter-badge ${langCode === 'zh' ? 'active' : ''}`}
            onClick={() => {
              setLangCode('zh');
              setPage(1);
              setSearchTerm('');
            }}
          >
            Chinos (C-Dramas) 🇨🇳
          </button>
          <button
            className={`filter-badge ${langCode === 'ja' ? 'active' : ''}`}
            onClick={() => {
              setLangCode('ja');
              setPage(1);
              setSearchTerm('');
            }}
          >
            Japoneses (J-Dramas) 🇯🇵
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <button
            className={`filter-badge ${langFilter === 'sub' ? 'active' : ''}`}
            style={{ border: '1px solid rgba(139, 92, 246, 0.4)' }}
            onClick={() => setLangFilter('sub')}
          >
            Sub Español 💬
          </button>
          <button
            className={`filter-badge ${langFilter === 'lat' ? 'active' : ''}`}
            style={{ border: '1px solid rgba(139, 92, 246, 0.4)' }}
            onClick={() => setLangFilter('lat')}
          >
            Español Latino 🗣️
          </button>
        </div>
      </div>

      <div className="media-grid">
        {itemsToRender.length > 0 ? (
          itemsToRender.map((drama) => (
            <div
              key={drama.id}
              className="media-card"
              onClick={() => handleOpenDrama(drama)}
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
                    <span className="hover-rating">👍 {Math.round(drama.rating * 60) || 500}</span>
                  </div>
                  <h4 className="hover-title">{drama.titulo}</h4>
                  <p className="hover-overview">{drama.description}</p>
                  <div className="hover-meta">
                    <strong>Géneros:</strong> {drama.genres || 'Drama'}
                  </div>
                  <div className="hover-country">
                    <strong>País:</strong> {drama.country}
                  </div>
                </div>

                <div className="play-hover-btn">
                  <div className="play-icon">▶</div>
                </div>
                {drama.year && <span className="card-badge">{drama.year}</span>}
              </div>

              <div className="card-info">
                <span className="card-genre" style={{ color: '#c084fc' }}>
                  {langCode === 'ko' ? '🇰🇷 K-Drama' : langCode === 'zh' ? '🇨🇳 C-Drama' : '🇯🇵 J-Drama'}
                </span>
                <h3 className="card-title">{drama.titulo}</h3>
                <p className="card-summary">{drama.description}</p>
                <div className="card-footer">
                  <span>⭐ {drama.rating || 'N/A'}</span>
                  <span className="card-lang">{langFilter === 'sub' ? 'SUB' : 'LAT'}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <span className="empty-icon">🌸</span>
            <h3 className="empty-title">No se encontraron dramas</h3>
            <p>Prueba buscando con palabras clave diferentes.</p>
          </div>
        )}
      </div>

      {!searchTerm.trim() && dramas.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '2.5rem 0 1rem' }}>
          <button
            className="btn-hero-play"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              color: '#fff',
              padding: '0.8rem 2.5rem',
              borderRadius: '30px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
            onClick={() => setPage(prev => prev + 1)}
            disabled={isLoading}
          >
            {isLoading ? 'Cargando...' : 'Cargar más dramas ➕'}
          </button>
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

                    <div className="control-center">
                      <select 
                        className="control-select" 
                        value={langFilter} 
                        onChange={(e) => setLangFilter(e.target.value)}
                      >
                        {(!hasResolvedOnSite || hasSubbed) && (
                          <option value="sub" style={{ background: '#0b0b14', color: '#fff' }}>💬 Sub Español</option>
                        )}
                        {(!hasResolvedOnSite || hasLatino) && (
                          <option value="lat" style={{ background: '#0b0b14', color: '#fff' }}>🗣️ Español Latino</option>
                        )}
                      </select>

                      {hasResolvedOnSite && serversList.length > 0 && (
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
                      <button className="control-btn" onClick={() => setIsTheater(true)}>
                        📺 Cine
                      </button>
                    </div>
                  </div>
                </div>

                <div className="kdrama-info-col">
                  <div className="modal-meta">
                    <span className="modal-genre" style={{ background: '#a855f7', color: '#fff' }}>
                      {langCode === 'ko' ? 'K-DRAMA' : langCode === 'zh' ? 'C-DRAMA' : 'J-DRAMA'}
                    </span>
                    <span className="modal-lang">★ {selectedDrama.rating || 'N/A'}</span>
                  </div>
                  <h2 className="modal-title" style={{ margin: 0, fontSize: '1.4rem' }}>{selectedDrama.titulo}</h2>
                  <p className="modal-summary" style={{ maxHeight: '110px', overflowY: 'auto', fontSize: '0.85rem' }}>
                    {selectedDrama.description}
                  </p>

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
                </div>
              </div>
            )}

            {isTheater && (
              <div className="player-control-bar" style={{ borderRadius: 0, padding: '0.8rem 2rem' }}>
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

                <div className="control-center">
                  <select 
                    className="control-select" 
                    value={langFilter} 
                    onChange={(e) => setLangFilter(e.target.value)}
                  >
                    {(!hasResolvedOnSite || hasSubbed) && (
                      <option value="sub" style={{ background: '#0b0b14', color: '#fff' }}>💬 Sub Español</option>
                    )}
                    {(!hasResolvedOnSite || hasLatino) && (
                      <option value="lat" style={{ background: '#0b0b14', color: '#fff' }}>🗣️ Latino</option>
                    )}
                  </select>

                  {hasResolvedOnSite && serversList.length > 0 && (
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
