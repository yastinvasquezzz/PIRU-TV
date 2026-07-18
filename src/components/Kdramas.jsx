import React, { useState, useEffect, useMemo } from 'react';

const TMDB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiMGM4MjRjMmFkMzllODUwNmE5ZGUzOGI5ZTA2ZjJmZiIsIm5iZiI6MTc0ODI3MjY1Ni43MDMsInN1YiI6IjY4MzQ4NjEwNjFmMWZlZmI4YmViMzYxZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KUIiE74vCOP05_Y0M5CKyCBtj9m5lN1WzCfZ6bQn6Xs';
const TMDB = 'https://api.themoviedb.org/3';
const IMG  = 'https://image.tmdb.org/t/p/w500';
const HDR  = { Authorization: `Bearer ${TMDB_KEY}` };

const VIMEUS_VIEW_KEY = 'KThsRRoYzOilpZpoAf-eQMKv1cN3ULOBQxPk6QmeL-A';

const SERVERS_SUB = [
  { id: 'maru',   name: 'Maru',   getUrl: (id, s, e) => `https://vidsrc.pm/embed/tv/${id}/${s}-${e}` },
  { id: 'okru',   name: 'Okru',   getUrl: (id, s, e) => `https://vimeus.com/e/serie?tmdb=${id}&se=${s}&ep=${e}&view_key=${encodeURIComponent(VIMEUS_VIEW_KEY)}&title=PIRU_TV&theme=red&font=v3&overlay=v5&selector=v3&playUI=v3&epanel=v3` },
  { id: 'hiplay', name: 'Hiplay', getUrl: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}&lang=es` },
  { id: 'pdrive', name: 'PDrive', getUrl: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}-${e}?ds_lang=es` },
];

const SERVERS_LAT = [
  { id: 'korii',  name: 'Maru',   getUrl: (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}-${e}?ds_lang=es` },
  { id: 'evo',    name: 'Okru',   getUrl: (id, s, e) => `https://vidsrc.net/embed/tv/${id}/${s}-${e}?ds_lang=es` },
  { id: 'dodo',   name: 'Hiplay', getUrl: (id, s, e) => `https://vidsrc.in/embed/tv/${id}/${s}-${e}?ds_lang=es` },
];


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

export default function Kdramas() {
  const [dramas, setDramas] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [langCode, setLangCode] = useState('ko');
  const [langFilter, setLangFilter] = useState('sub');

  const [selectedDrama, setSelectedDrama] = useState(null);
  const [chaptersList, setChaptersList] = useState([]);
  const [activeEpisode, setActiveEpisode] = useState(1);
  const [activeSeason, setActiveSeason] = useState(1);
  const [activeServerId, setActiveServerId] = useState('maru');

  const [isTheater, setIsTheater] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  const currentServers = langFilter === 'sub' ? SERVERS_SUB : SERVERS_LAT;
  const activeServer = currentServers.find(s => s.id === activeServerId) || currentServers[0];

  const activePlayerUrl = selectedDrama
    ? activeServer.getUrl(selectedDrama.id, activeSeason, activeEpisode)
    : '';

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

  const searchDoramaOnSite = async (title) => {
    try {
      const res = await fetch(`https://corsproxy.io/?https://www.doramas.org/ajax/search.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `title=${encodeURIComponent(title)}`
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fichas && data.fichas.length > 0) return data.fichas[0].slug.replace(/\/$/, '');
      }
    } catch (e) { console.error(e); }
    return null;
  };

  const loadChaptersFromSite = async (slug) => {
    try {
      const res = await fetch(`https://corsproxy.io/?https://www.doramas.org/${slug}/`);
      if (res.ok) {
        const html = await res.text();
        const chapRegex = new RegExp(`href="https:\\/\\/www\\.doramas\\.org\\/${slug}-c(\\d+)\\/`, 'g');
        const chaps = [];
        let match;
        while ((match = chapRegex.exec(html)) !== null) chaps.push(parseInt(match[1]));
        return Array.from(new Set(chaps)).sort((a, b) => a - b);
      }
    } catch (e) { console.error(e); }
    return [];
  };

  const handleOpenDrama = async (drama) => {
    setIsDetailsLoading(true);
    setSelectedDrama(drama);
    setChaptersList([]);
    setActiveEpisode(1);
    setActiveSeason(1);
    setActiveServerId(langFilter === 'sub' ? 'maru' : 'korii');

    try {
      const slug = await searchDoramaOnSite(drama.titulo);
      if (slug) {
        const chaps = await loadChaptersFromSite(slug);
        if (chaps.length > 0) {
          setChaptersList(chaps);
          setActiveEpisode(chaps[0]);
          setIsDetailsLoading(false);
          return;
        }
      }

      const res = await fetch(`${TMDB}/tv/${drama.id}?language=es-ES`, { headers: HDR });
      if (res.ok) {
        const details = await res.json();
        if (!details.overview) {
          const enRes = await fetch(`${TMDB}/tv/${drama.id}?language=en-US`, { headers: HDR });
          if (enRes.ok) {
            const enDetails = await enRes.json();
            details.overview = enDetails.overview;
          }
        }
        setSelectedDrama(prev => ({ ...prev, description: details.overview || prev.description }));
        const firstSeason = details.seasons?.find(s => s.season_number === 1) || details.seasons?.[0];
        if (firstSeason) {
          const epRes = await fetch(`${TMDB}/tv/${drama.id}/season/${firstSeason.season_number}?language=es-ES`, { headers: HDR });
          if (epRes.ok) {
            const epData = await epRes.json();
            setChaptersList((epData.episodes || []).map(ep => ep.episode_number));
            setActiveSeason(firstSeason.season_number);
            setActiveEpisode(1);
          }
        }
      }
    } catch (e) { console.error(e); }
    finally { setIsDetailsLoading(false); }
  };

  const handleEpisodeChange = (epNum) => {
    setActiveEpisode(epNum);
  };

  const handleLangFilterChange = (newFilter) => {
    setLangFilter(newFilter);
    setActiveServerId(newFilter === 'sub' ? 'maru' : 'korii');
  };

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
        .control-dropdown {
          position: relative;
          display: inline-block;
        }
        .dropdown-content {
          display: none;
          position: absolute;
          bottom: 100%;
          left: 0;
          background-color: #0b0b14;
          min-width: 160px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.6);
          z-index: 10;
          margin-bottom: 5px;
          overflow: hidden;
        }
        .dropdown-content button {
          color: #ccc;
          padding: 0.6rem 1rem;
          text-decoration: none;
          display: block;
          width: 100%;
          border: none;
          background: transparent;
          text-align: left;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s ease;
        }
        .dropdown-content button:hover {
          background-color: var(--primary);
          color: white;
        }
        .control-dropdown:hover .dropdown-content {
          display: block;
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
              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1.5rem', padding: '1rem' }}>
                <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column' }}>
                  <div className="player-container" style={{ height: '380px', background: '#020205', borderRadius: '12px 12px 0 0' }}>
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
                      <div className="control-dropdown">
                        <button className="control-btn">
                          💬 {langFilter === 'sub' ? 'Sub Español' : 'Español Latino'}
                        </button>
                        <div className="dropdown-content">
                          <button onClick={() => handleLangFilterChange('sub')}>Sub Español</button>
                          <button onClick={() => handleLangFilterChange('lat')}>Español Latino</button>
                        </div>
                      </div>

                      <div className="control-dropdown">
                        <button className="control-btn">
                          🎛️ {activeServer.name}
                        </button>
                        <div className="dropdown-content">
                          {currentServers.map(srv => (
                            <button
                              key={srv.id}
                              onClick={() => setActiveServerId(srv.id)}
                              style={{ fontWeight: activeServerId === srv.id ? '700' : '400', color: activeServerId === srv.id ? '#a78bfa' : undefined }}
                            >
                              {activeServerId === srv.id ? '✓ ' : ''}{srv.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="control-right">
                      <button className="control-btn" onClick={() => setIsTheater(true)}>
                        📺 Cine
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '260px' }}>
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
                  <div className="control-dropdown">
                    <button className="control-btn">
                      💬 {langFilter === 'sub' ? 'Sub Español' : 'Español Latino'}
                    </button>
                    <div className="dropdown-content">
                      <button onClick={() => handleLangFilterChange('sub')}>Sub Español</button>
                      <button onClick={() => handleLangFilterChange('lat')}>Español Latino</button>
                    </div>
                  </div>

                  <div className="control-dropdown">
                    <button className="control-btn">
                      🎛️ {activeServer.name}
                    </button>
                    <div className="dropdown-content">
                      {currentServers.map(srv => (
                        <button
                          key={srv.id}
                          onClick={() => setActiveServerId(srv.id)}
                          style={{ fontWeight: activeServerId === srv.id ? '700' : '400', color: activeServerId === srv.id ? '#a78bfa' : undefined }}
                        >
                          {activeServerId === srv.id ? '✓ ' : ''}{srv.name}
                        </button>
                      ))}
                    </div>
                  </div>
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
