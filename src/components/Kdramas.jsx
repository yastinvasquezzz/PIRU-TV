import React, { useState, useEffect, useMemo } from 'react';

const TMDB_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiMGM4MjRjMmFkMzllODUwNmE5ZGUzOGI5ZTA2ZjJmZiIsIm5iZiI6MTc0ODI3MjY1Ni43MDMsInN1YiI6IjY4MzQ4NjEwNjFmMWZlZmI4YmViMzYxZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KUIiE74vCOP05_Y0M5CKyCBtj9m5lN1WzCfZ6bQn6Xs';
const TMDB = 'https://api.themoviedb.org/3';
const IMG  = 'https://image.tmdb.org/t/p/w500';
const HDR  = { Authorization: `Bearer ${TMDB_KEY}` };

const VIMEUS_VIEW_KEY = 'KThsRRoYzOilpZpoAf-eQMKv1cN3ULOBQxPk6QmeL-A';

const GENRES_MAP = {
  10759: 'Acción & Aventura', 16: 'Animación', 35: 'Comedia', 80: 'Crimen',
  99: 'Documental', 18: 'Drama', 10751: 'Familia', 10762: 'Infantil',
  9648: 'Misterio', 10763: 'Noticias', 10764: 'Reality', 10765: 'Sci-Fi & Fantasía',
  10766: 'Telenovela', 10767: 'Talk Show', 10768: 'Guerra & Política', 37: 'Western'
};

const COUNTRY_MAP = {
  KR: 'Corea del Sur', CN: 'China', JP: 'Japón', TW: 'Taiwán', TH: 'Tailandia'
};

const VideoPlayer = ({ playerUrl }) => (
  <iframe
    src={playerUrl}
    style={{ width: '100%', height: '100%', border: 'none', borderRadius: '12px 12px 0 0' }}
    allow="autoplay; encrypted-media"
    allowFullScreen
    title="Kdrama Player"
  />
);

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
  const [showSubtitleInfo, setShowSubtitleInfo] = useState(false);

  const [isTheater, setIsTheater] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  useEffect(() => {
    const loadDramas = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `${TMDB}/discover/tv?with_original_language=${langCode}&sort_by=popularity.desc&page=${page}&language=es-ES`,
          { headers: HDR }
        );
        if (res.ok) {
          const data = await res.json();
          setDramas((data.results || []).map(x => ({
            id: x.id,
            titulo: x.name || x.original_name || '—',
            portada: x.poster_path ? `${IMG}${x.poster_path}` : 'https://via.placeholder.com/160x240?text=?',
            description: x.overview || 'Sin descripción disponible.',
            rating: x.vote_average ? Math.round(x.vote_average * 10) / 10 : null,
            year: (x.first_air_date || '').slice(0, 4) || '—',
            genres: (x.genre_ids || []).map(id => GENRES_MAP[id]).filter(Boolean).join(', '),
            country: x.origin_country?.[0] ? COUNTRY_MAP[x.origin_country[0]] || x.origin_country[0] : 'Corea del Sur'
          })));
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
    if (!searchTerm.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${TMDB}/search/tv?query=${encodeURIComponent(searchTerm)}&language=es-ES&page=1`,
          { headers: HDR }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults((data.results || [])
            .filter(x => ['ko','zh','ja'].includes(x.original_language))
            .map(x => ({
              id: x.id,
              titulo: x.name || x.original_name || '—',
              portada: x.poster_path ? `${IMG}${x.poster_path}` : 'https://via.placeholder.com/160x240?text=?',
              description: x.overview || 'Sin descripción disponible.',
              rating: x.vote_average ? Math.round(x.vote_average * 10) / 10 : null,
              year: (x.first_air_date || '').slice(0, 4) || '—',
              genres: (x.genre_ids || []).map(id => GENRES_MAP[id]).filter(Boolean).join(', '),
              country: x.origin_country?.[0] ? COUNTRY_MAP[x.origin_country[0]] || x.origin_country[0] : 'Corea del Sur'
            })));
        }
      } catch (e) { console.error(e); }
    }, 450);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const searchDoramaOnSite = async (title) => {
    try {
      const res = await fetch('https://corsproxy.io/?https://www.doramas.org/ajax/search.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `title=${encodeURIComponent(title)}`
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fichas && data.fichas.length > 0) {
          return data.fichas[0].slug.replace(/\/$/, '');
        }
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
        while ((match = chapRegex.exec(html)) !== null) {
          chaps.push(parseInt(match[1]));
        }
        return Array.from(new Set(chaps)).sort((a, b) => a - b);
      }
    } catch (e) { console.error(e); }
    return [];
  };

  const loadChapterDetails = async (slug, epNum) => {
    try {
      const res = await fetch(`https://corsproxy.io/?https://www.doramas.org/${slug}-c${epNum}/`);
      if (res.ok) {
        const html = await res.text();
        const iframeMatch = html.match(/<iframe[^>]*src="([^"]+)"/i);
        const defaultUrl = iframeMatch ? iframeMatch[1] : '';
        const serverRegex = /<li\s+data-lang="([^"]+)"\s+data-langname="([^"]+)"[^>]*>\s*<a[^>]*>\s*(.*?)\s*<\/a>/gi;
        const parsedServers = [];
        let sMatch;
        while ((sMatch = serverRegex.exec(html)) !== null) {
          parsedServers.push({
            hash: sMatch[1],
            langId: sMatch[2],
            name: sMatch[3].replace(/<[^>]*>/g, '').trim()
          });
        }
        return { defaultUrl, servers: parsedServers };
      }
    } catch (e) { console.error(e); }
    return { defaultUrl: '', servers: [] };
  };

  const getServerUrl = async (hash) => {
    try {
      const res = await fetch('https://corsproxy.io/?https://www.doramas.org/ajax/play.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `id=${hash}`
      });
      if (res.ok) {
        const text = await res.text();
        const iframeMatch = text.match(/src="([^"]+)"/i);
        if (iframeMatch) return iframeMatch[1];
      }
    } catch (e) { console.error(e); }
    return null;
  };

  const pickBestServer = (servers, filter) => {
    if (!servers || servers.length === 0) return null;
    const keyword = filter === 'lat' ? 'latino' : 'sub';
    const match = servers.find(s =>
      s.langId?.toLowerCase().includes(keyword) ||
      s.name?.toLowerCase().includes(keyword)
    );
    return match || servers[0];
  };

  const handleOpenDrama = async (drama) => {
    setIsDetailsLoading(true);
    setSelectedDrama(drama);
    setHasResolvedOnSite(false);
    setDoramaSlug('');
    setChaptersList([]);
    setServersList([]);
    setActiveServer(null);
    setActivePlayerUrl('');
    setShowSubtitleInfo(false);

    try {
      const slug = await searchDoramaOnSite(drama.titulo);
      if (slug) {
        setDoramaSlug(slug);
        const chaps = await loadChaptersFromSite(slug);
        if (chaps.length > 0) {
          setChaptersList(chaps);
          setHasResolvedOnSite(true);
          const { defaultUrl, servers } = await loadChapterDetails(slug, chaps[0]);
          setActiveEpisode(chaps[0]);
          setServersList(servers);
          const best = pickBestServer(servers, langFilter);
          if (best) {
            setActiveServer(best);
            const url = await getServerUrl(best.hash);
            setActivePlayerUrl(url || defaultUrl);
          } else {
            setActivePlayerUrl(defaultUrl);
          }
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

        const firstSeason = details.seasons?.find(s => s.season_number === 1) || details.seasons?.[0];
        if (firstSeason) {
          const epRes = await fetch(`${TMDB}/tv/${drama.id}/season/${firstSeason.season_number}?language=es-ES`, { headers: HDR });
          if (epRes.ok) {
            const epData = await epRes.json();
            const eps = (epData.episodes || []).map(ep => ep.episode_number);
            setChaptersList(eps);
            setActiveEpisode(1);
            setActiveSeason(firstSeason.season_number);
            const fallbackUrl = langFilter === 'lat'
              ? `https://vidsrc.xyz/embed/tv/${drama.id}/${firstSeason.season_number}-1?ds_lang=es`
              : `https://vimeus.com/e/serie?tmdb=${drama.id}&se=${firstSeason.season_number}&ep=1&view_key=${encodeURIComponent(VIMEUS_VIEW_KEY)}&title=PIRU_TV&theme=red&font=v3&overlay=v5&selector=v3&playUI=v3&epanel=v3`;
            setActivePlayerUrl(fallbackUrl);
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

    if (hasResolvedOnSite && doramaSlug) {
      const { defaultUrl, servers } = await loadChapterDetails(doramaSlug, epNum);
      setServersList(servers);
      const best = pickBestServer(servers, langFilter);
      if (best) {
        setActiveServer(best);
        const url = await getServerUrl(best.hash);
        setActivePlayerUrl(url || defaultUrl);
      } else {
        setActivePlayerUrl(defaultUrl);
      }
    } else if (selectedDrama) {
      const url = langFilter === 'lat'
        ? `https://vidsrc.xyz/embed/tv/${selectedDrama.id}/${activeSeason}-${epNum}?ds_lang=es`
        : `https://vimeus.com/e/serie?tmdb=${selectedDrama.id}&se=${activeSeason}&ep=${epNum}&view_key=${encodeURIComponent(VIMEUS_VIEW_KEY)}&title=PIRU_TV&theme=red&font=v3&overlay=v5&selector=v3&playUI=v3&epanel=v3`;
      setActivePlayerUrl(url);
    }

    setIsDetailsLoading(false);
  };

  const handleServerClick = async (server) => {
    setIsDetailsLoading(true);
    setActiveServer(server);
    const url = await getServerUrl(server.hash);
    if (url) setActivePlayerUrl(url);
    setIsDetailsLoading(false);
  };

  const handleLangFilterChange = async (newFilter) => {
    setLangFilter(newFilter);
    if (hasResolvedOnSite && serversList.length > 0) {
      const best = pickBestServer(serversList, newFilter);
      if (best) {
        setIsDetailsLoading(true);
        setActiveServer(best);
        const url = await getServerUrl(best.hash);
        if (url) setActivePlayerUrl(url);
        setIsDetailsLoading(false);
      }
    } else if (selectedDrama) {
      const url = newFilter === 'lat'
        ? `https://vidsrc.xyz/embed/tv/${selectedDrama.id}/${activeSeason}-${activeEpisode}?ds_lang=es`
        : `https://vimeus.com/e/serie?tmdb=${selectedDrama.id}&se=${activeSeason}&ep=${activeEpisode}&view_key=${encodeURIComponent(VIMEUS_VIEW_KEY)}&title=PIRU_TV&theme=red&font=v3&overlay=v5&selector=v3&playUI=v3&epanel=v3`;
      setActivePlayerUrl(url);
    }
  };

  const filteredServers = useMemo(() => {
    if (!serversList.length) return [];
    const keyword = langFilter === 'lat' ? 'latino' : 'sub';
    const filtered = serversList.filter(s =>
      s.langId?.toLowerCase().includes(keyword) ||
      s.name?.toLowerCase().includes(keyword)
    );
    return filtered.length > 0 ? filtered : serversList;
  }, [serversList, langFilter]);

  const itemsToRender = searchTerm.trim() ? searchResults : dramas;

  return (
    <div className="kdramas-container">
      <style>{`
        .kdramas-container { width: 100%; box-sizing: border-box; }
        .filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.8rem;
          margin-bottom: 2rem;
          justify-content: space-between;
          align-items: center;
        }
        .filter-group { display: flex; gap: 0.6rem; flex-wrap: wrap; }
        .lang-label { font-size: 0.75rem; color: var(--text-secondary); align-self: center; white-space: nowrap; }
        .player-control-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #090910;
          border: 1px solid var(--border-color);
          border-top: none;
          padding: 0.8rem 1.2rem;
          border-radius: 0 0 12px 12px;
          color: #fff;
          flex-wrap: wrap;
          gap: 0.6rem;
        }
        .control-left, .control-center, .control-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .control-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border-color);
          color: #fff;
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
          white-space: nowrap;
        }
        .control-btn:hover:not(:disabled) { background: var(--primary); border-color: var(--primary); }
        .control-btn.active-filter { background: linear-gradient(135deg,#6c63ff,#9b59b6); border-color: #6c63ff; }
        .control-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .control-title { font-size: 0.82rem; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; }
        .control-dropdown { position: relative; display: inline-block; }
        .dropdown-content {
          display: none;
          position: absolute;
          bottom: 100%;
          left: 0;
          background: #0b0b14;
          min-width: 180px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 8px 16px rgba(0,0,0,0.6);
          z-index: 100;
          margin-bottom: 5px;
          overflow: hidden;
        }
        .dropdown-content button {
          color: #ccc;
          padding: 0.55rem 1rem;
          display: block;
          width: 100%;
          border: none;
          background: transparent;
          text-align: left;
          cursor: pointer;
          font-size: 0.82rem;
          transition: all 0.2s;
        }
        .dropdown-content button:hover { background: var(--primary); color: #fff; }
        .control-dropdown:hover .dropdown-content { display: block; }
        .theater-mode-layout {
          position: fixed;
          top: 0; left: 0;
          width: 100vw; height: 100vh;
          z-index: 99999;
          background: #000;
          display: flex;
          flex-direction: column;
        }
        .media-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 1rem;
        }
        .pagination { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4rem; margin: 2rem 0; }
        .modal-content { overflow-y: auto; max-height: 95vh; }
        .kdrama-modal-body {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          gap: 1.5rem;
          padding: 1rem;
        }
        .kdrama-player-col { flex: 1 1 480px; display: flex; flex-direction: column; }
        .kdrama-info-col { flex: 1 1 260px; display: flex; flex-direction: column; gap: 1rem; min-width: 200px; }
        .subtitle-info-box {
          background: rgba(108,99,255,0.12);
          border: 1px solid rgba(108,99,255,0.4);
          border-radius: 8px;
          padding: 0.8rem 1rem;
          font-size: 0.8rem;
          color: #ccc;
          line-height: 1.5;
          margin-top: 0.5rem;
        }
        .media-card { position: relative; }
        .card-thumbnail-wrapper { position: relative; }
        .card-hover-popup {
          display: none;
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(9,9,16,0.96);
          border: 1.5px solid var(--primary);
          border-radius: 12px;
          padding: 1rem;
          box-shadow: 0 10px 25px rgba(0,0,0,0.85);
          z-index: 20;
          pointer-events: none;
          box-sizing: border-box;
          overflow-y: auto;
        }
        .card-thumbnail-wrapper:hover .card-hover-popup { display: flex; flex-direction: column; }
        .hover-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-size: 0.75rem; }
        .hover-year { font-weight: 600; color: #fff; background: rgba(255,255,255,0.08); padding: 0.15rem 0.4rem; border-radius: 4px; }
        .hover-rating { color: #fbbf24; font-weight: bold; }
        .hover-title { font-size: 0.9rem; font-weight: 700; color: #fff; margin: 0 0 0.5rem 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hover-overview { font-size: 0.75rem; color: #ddd; line-height: 1.4; margin-bottom: 0.6rem; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
        .hover-meta, .hover-country { font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; }
        .hover-meta strong, .hover-country strong { color: #fff; }

        @media (max-width: 600px) {
          .media-grid { grid-template-columns: repeat(2, 1fr); }
          .filter-row { flex-direction: column; align-items: flex-start; }
          .kdrama-modal-body { flex-direction: column; padding: 0.6rem; gap: 0.8rem; }
          .kdrama-player-col, .kdrama-info-col { flex: unset; width: 100%; min-width: unset; }
          .player-container { height: 200px !important; }
          .player-control-bar { flex-direction: column; align-items: flex-start; padding: 0.6rem 0.8rem; }
          .control-title { max-width: 100%; }
          .modal-content { width: 98vw !important; max-width: 98vw !important; border-radius: 12px; }
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
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      <div className="filter-row">
        <div className="filter-group">
          <button className={`filter-badge ${langCode === 'ko' ? 'active' : ''}`} onClick={() => { setLangCode('ko'); setPage(1); setSearchTerm(''); }}>
            Coreanos (K-Dramas) 🇰🇷
          </button>
          <button className={`filter-badge ${langCode === 'zh' ? 'active' : ''}`} onClick={() => { setLangCode('zh'); setPage(1); setSearchTerm(''); }}>
            Chinos (C-Dramas) 🇨🇳
          </button>
          <button className={`filter-badge ${langCode === 'ja' ? 'active' : ''}`} onClick={() => { setLangCode('ja'); setPage(1); setSearchTerm(''); }}>
            Japoneses (J-Dramas) 🇯🇵
          </button>
        </div>
        <div className="filter-group">
          <span className="lang-label">Preferencia:</span>
          <button
            className={`filter-badge ${langFilter === 'sub' ? 'active' : ''}`}
            style={{ border: '1px solid rgba(139,92,246,0.4)' }}
            onClick={() => handleLangFilterChange('sub')}
          >
            💬 Sub Español
          </button>
          <button
            className={`filter-badge ${langFilter === 'lat' ? 'active' : ''}`}
            style={{ border: '1px solid rgba(139,92,246,0.4)' }}
            onClick={() => handleLangFilterChange('lat')}
          >
            🗣️ Español Latino
          </button>
        </div>
      </div>

      <div className="media-grid">
        {itemsToRender.length > 0 ? (
          itemsToRender.map((drama) => (
            <div key={drama.id} className="media-card" onClick={() => handleOpenDrama(drama)}>
              <div className="card-thumbnail-wrapper" style={{ aspectRatio: '2/3' }}>
                <div className="card-thumbnail-glow"></div>
                <img
                  src={drama.portada}
                  alt={drama.titulo}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/160x240?text=?'; }}
                />
                <div className="card-hover-popup">
                  <div className="hover-header">
                    <span className="hover-year">{drama.year}</span>
                    <span className="hover-rating">👍 {Math.round((drama.rating || 5) * 60)}</span>
                  </div>
                  <h4 className="hover-title">{drama.titulo}</h4>
                  <p className="hover-overview">{drama.description}</p>
                  <div className="hover-meta"><strong>Géneros:</strong> {drama.genres || 'Drama'}</div>
                  <div className="hover-country"><strong>País:</strong> {drama.country}</div>
                </div>
                <div className="play-hover-btn"><div className="play-icon">▶</div></div>
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
        <div className="pagination">
          <button className="control-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || isLoading}>◀</button>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              className="control-btn"
              style={{
                background: p === page ? 'var(--primary)' : undefined,
                borderColor: p === page ? 'var(--primary)' : undefined,
                fontWeight: p === page ? '700' : '400'
              }}
              onClick={() => setPage(p)}
              disabled={isLoading}
            >
              {p}
            </button>
          ))}
          <button className="control-btn" onClick={() => setPage(p => p + 1)} disabled={isLoading}>▶</button>
        </div>
      )}

      {selectedDrama && (
        <div className="modal-overlay" onClick={() => { setSelectedDrama(null); setIsTheater(false); }}>
          <div
            className={isTheater ? 'theater-mode-layout' : 'modal-content'}
            onClick={(e) => e.stopPropagation()}
            style={isTheater ? {} : { maxWidth: '960px' }}
          >
            {!isTheater && (
              <button className="modal-close-btn" onClick={() => setSelectedDrama(null)}>✕</button>
            )}

            {isTheater ? (
              <div style={{ flex: 1, background: '#000', position: 'relative' }}>
                {activePlayerUrl ? <VideoPlayer playerUrl={activePlayerUrl} /> : <div className="player-loading-spinner" />}
              </div>
            ) : (
              <div className="kdrama-modal-body">
                <div className="kdrama-player-col">
                  <div className="player-container" style={{ height: '360px', background: '#020205', borderRadius: '12px 12px 0 0' }}>
                    {isDetailsLoading
                      ? <div className="player-loading-spinner" />
                      : activePlayerUrl
                        ? <VideoPlayer playerUrl={activePlayerUrl} />
                        : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                            <span style={{ fontSize: '2rem' }}>🌸</span>
                            <span style={{ fontSize: '0.85rem' }}>Cargando reproductor...</span>
                          </div>
                    }
                  </div>

                  <div className="player-control-bar">
                    <div className="control-left">
                      <button
                        className="control-btn"
                        onClick={() => handleEpisodeChange(Math.max(1, activeEpisode - 1))}
                        disabled={activeEpisode <= 1 || isDetailsLoading}
                      >◀</button>
                      <span className="control-title">Cap. {activeEpisode}</span>
                      <button
                        className="control-btn"
                        onClick={() => handleEpisodeChange(Math.min(chaptersList.length, activeEpisode + 1))}
                        disabled={activeEpisode >= chaptersList.length || isDetailsLoading}
                      >▶</button>
                    </div>

                    <div className="control-center">
                      <button
                        className={`control-btn ${langFilter === 'sub' ? 'active-filter' : ''}`}
                        onClick={() => handleLangFilterChange('sub')}
                      >💬 Sub ES</button>
                      <button
                        className={`control-btn ${langFilter === 'lat' ? 'active-filter' : ''}`}
                        onClick={() => handleLangFilterChange('lat')}
                      >🗣️ Latino</button>

                      {hasResolvedOnSite && filteredServers.length > 0 && (
                        <div className="control-dropdown">
                          <button className="control-btn">
                            🎛️ {activeServer ? activeServer.name : 'Servidor'}
                          </button>
                          <div className="dropdown-content">
                            {filteredServers.map((server, idx) => (
                              <button key={`${server.hash}-${idx}`} onClick={() => handleServerClick(server)}>
                                {server.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        className="control-btn"
                        onClick={() => setShowSubtitleInfo(v => !v)}
                        title="Ayuda para activar subtítulos"
                      >CC ℹ️</button>
                    </div>

                    <div className="control-right">
                      <button className="control-btn" onClick={() => setIsTheater(true)}>📺 Cine</button>
                    </div>
                  </div>

                  {showSubtitleInfo && (
                    <div className="subtitle-info-box">
                      <strong style={{ color: '#a78bfa' }}>💡 Cómo activar subtítulos:</strong><br />
                      Dentro del reproductor busca el ícono <strong>CC</strong> o el engranaje ⚙️ para activar subtítulos en Español.<br />
                      Usa el botón <strong>💬 Sub ES</strong> para cambiar al servidor con subtítulos en español.<br />
                      Si no aparecen subtítulos, cambia de servidor con el selector <strong>🎛️ Servidor</strong>.
                    </div>
                  )}
                </div>

                <div className="kdrama-info-col">
                  <div className="modal-meta">
                    <span className="modal-genre" style={{ background: '#a855f7', color: '#fff' }}>
                      {langCode === 'ko' ? 'K-DRAMA' : langCode === 'zh' ? 'C-DRAMA' : 'J-DRAMA'}
                    </span>
                    <span className="modal-lang">★ {selectedDrama.rating || 'N/A'}</span>
                    <span className="modal-lang">{langFilter === 'sub' ? '💬 Sub ES' : '🗣️ Latino'}</span>
                  </div>
                  <h2 className="modal-title" style={{ margin: 0, fontSize: '1.3rem' }}>{selectedDrama.titulo}</h2>
                  <p className="modal-summary" style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.85rem' }}>
                    {selectedDrama.description}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Seleccionar Capítulo:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '0.4rem' }}>
                      {isDetailsLoading ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '0.5rem' }}>Cargando capítulos...</div>
                      ) : chaptersList.length > 0 ? (
                        chaptersList.map((epNum) => (
                          <button
                            key={epNum}
                            onClick={() => handleEpisodeChange(epNum)}
                            style={{
                              flex: '1 0 60px',
                              background: activeEpisode === epNum ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                              border: '1px solid',
                              borderColor: activeEpisode === epNum ? 'var(--primary)' : 'var(--border-color)',
                              color: '#fff',
                              padding: '0.45rem',
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
                  <button className="control-btn" onClick={() => handleEpisodeChange(Math.max(1, activeEpisode - 1))} disabled={activeEpisode <= 1}>◀</button>
                  <span className="control-title">{selectedDrama.titulo} - Cap. {activeEpisode}</span>
                  <button className="control-btn" onClick={() => handleEpisodeChange(Math.min(chaptersList.length, activeEpisode + 1))} disabled={activeEpisode >= chaptersList.length}>▶</button>
                </div>
                <div className="control-center">
                  <button className={`control-btn ${langFilter === 'sub' ? 'active-filter' : ''}`} onClick={() => handleLangFilterChange('sub')}>💬 Sub ES</button>
                  <button className={`control-btn ${langFilter === 'lat' ? 'active-filter' : ''}`} onClick={() => handleLangFilterChange('lat')}>🗣️ Latino</button>
                  {hasResolvedOnSite && filteredServers.length > 0 && (
                    <div className="control-dropdown">
                      <button className="control-btn">🎛️ {activeServer ? activeServer.name : 'Servidor'}</button>
                      <div className="dropdown-content">
                        {filteredServers.map((server, idx) => (
                          <button key={`${server.hash}-${idx}`} onClick={() => handleServerClick(server)}>
                            {server.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="control-right">
                  <button className="control-btn" onClick={() => setIsTheater(false)}>✕ Salir Modo Cine</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
