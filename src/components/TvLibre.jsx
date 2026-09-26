import React, { useState, useEffect, useMemo, useRef } from 'react';
import Hls from 'hls.js';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { saveWatchProgress, toggleFavorite, isFavorite, getWatchHistory } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import { isLgTv } from '../utils/deviceDetect';
import localChannelsData from '../data/iptv_spa.json';

const CATEGORIES = [
  { id: 'all', label: '🔥 Todos' },
  { id: 'movies', label: '🎬 Películas y Series' },
  { id: 'sports', label: '⚽ Deportes' },
  { id: 'entertainment', label: '🎭 Entretenimiento' },
  { id: 'news', label: '📰 Noticias' },
  { id: 'music', label: '🎵 Música' },
  { id: 'kids', label: '👶 Infantil' },
  { id: 'culture', label: '📚 Cultura y Docs' },
  { id: 'religious', label: '⛪ Religión' },
  { id: 'general', label: '🌐 General' },
  { id: 'favs', label: '❤️ Mis Favoritos' }
];

const COUNTRIES = [
  { code: 'all', label: '🌐 Todos los países' },
  { code: 'mx', label: '🇲🇽 México' },
  { code: 'es', label: '🇪🇸 España' },
  { code: 'ar', label: '🇦🇷 Argentina' },
  { code: 'co', label: '🇨🇴 Colombia' },
  { code: 'cl', label: '🇨🇱 Chile' },
  { code: 'pe', label: '🇵🇪 Perú' },
  { code: 'do', label: '🇩🇴 Rep. Dominicana' },
  { code: 'ec', label: '🇪🇨 Ecuador' },
  { code: 've', label: '🇻🇪 Venezuela' },
  { code: 'gt', label: '🇬🇹 Guatemala' },
  { code: 'cr', label: '🇨🇷 Costa Rica' },
  { code: 'hn', label: '🇭🇳 Honduras' },
  { code: 'bo', label: '🇧🇴 Bolivia' },
  { code: 'py', label: '🇵🇾 Paraguay' },
  { code: 'pa', label: '🇵🇦 Panamá' },
  { code: 'sv', label: '🇸🇻 El Salvador' },
  { code: 'uy', label: '🇺🇾 Uruguay' },
  { code: 'us', label: '🇺🇸 EE.UU. (Hispano)' },
  { code: 'pr', label: '🇵🇷 Puerto Rico' },
  { code: 'cu', label: '🇨🇺 Cuba' }
];

const PAGE_SIZE = 32;
const M3U_URL = 'https://iptv-org.github.io/iptv/languages/spa.m3u';

export default function TvLibre() {
  const [channels, setChannels] = useState(localChannelsData || []);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [isLoadingLiveM3U, setIsLoadingLiveM3U] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [favMap, setFavMap] = useState({});
  const [watchHistory, setWatchHistory] = useState(() => getWatchHistory('tv-libre'));

  const searchInputRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playerContainerRef = useRef(null);

  // Focus search when triggered from global header
  useEffect(() => {
    const handleFocusSearch = (e) => {
      if (e.detail === 'tv-libre' || e.detail === 'tv') {
        searchInputRef.current?.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('focus-section-search', handleFocusSearch);
    return () => window.removeEventListener('focus-section-search', handleFocusSearch);
  }, []);

  // Filtered recent channels for continue watching
  const recentChannels = useMemo(() => {
    return (watchHistory || []).filter(item => 
      item.section === 'tv-libre' || item.type === 'iptv' || Boolean(item.url && item.group)
    ).slice(0, 10);
  }, [watchHistory]);

  // Sync favorites on mount
  useEffect(() => {
    const map = {};
    (channels || []).forEach(ch => {
      const key = ch.id || ch.url;
      if (isFavorite(key)) {
        map[key] = true;
      }
    });
    setFavMap(map);
  }, [channels]);

  // Fetch updated live M3U in the background
  useEffect(() => {
    let isCancelled = false;
    async function fetchLiveM3U() {
      try {
        setIsLoadingLiveM3U(true);
        const res = await fetch(M3U_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (isCancelled) return;

        const lines = text.split(/\r?\n/);
        const parsed = [];
        let current = null;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          if (line.startsWith('#EXTINF:')) {
            const tvgId = (line.match(/tvg-id="([^"]*)"/i) || [])[1] || '';
            const tvgName = (line.match(/tvg-name="([^"]*)"/i) || [])[1] || '';
            const tvgLogo = (line.match(/tvg-logo="([^"]*)"/i) || [])[1] || '';
            const groupTitle = (line.match(/group-title="([^"]*)"/i) || [])[1] || 'General';
            const commaIdx = line.lastIndexOf(',');
            const rawName = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : (tvgName || 'Canal');

            let country = 'es';
            if (tvgId) {
              const m = tvgId.match(/\.([a-z]{2})@/i);
              if (m) country = m[1].toLowerCase();
            }

            let quality = 'HD';
            if (/\b(1080p|fhd|1080)\b/i.test(rawName)) quality = '1080p';
            else if (/\b(720p|hd)\b/i.test(rawName)) quality = '720p';
            else if (/\b(4k|uhd)\b/i.test(rawName)) quality = '4K';
            else if (/\b(sd|480p|360p)\b/i.test(rawName)) quality = 'SD';

            const cleanName = rawName.replace(/\[.*?\]|\(.*?\)/g, '').trim() || rawName;

            current = {
              id: tvgId || `chan_${parsed.length}`,
              name: cleanName,
              rawName: rawName,
              logo: tvgLogo,
              group: groupTitle,
              country: country,
              quality: quality
            };
          } else if (!line.startsWith('#')) {
            if (current) {
              current.url = line;
              parsed.push(current);
              current = null;
            }
          }
        }

        if (parsed.length > 500 && !isCancelled) {
          setChannels(parsed);
        }
      } catch (err) {
        console.warn('IPTV M3U live fetch error (using local bundle):', err);
      } finally {
        if (!isCancelled) setIsLoadingLiveM3U(false);
      }
    }

    fetchLiveM3U();
    return () => { isCancelled = true; };
  }, []);

  // Filter channels
  const filteredChannels = useMemo(() => {
    return channels.filter(ch => {
      // Favorites filter
      if (activeCategory === 'favs') {
        const isFav = favMap[ch.id || ch.url];
        if (!isFav) return false;
      } else if (activeCategory === 'movies') {
        const g = (ch.group || '').toLowerCase();
        if (!g.includes('movie') && !g.includes('series') && !g.includes('cine') && !g.includes('film')) return false;
      } else if (activeCategory === 'sports') {
        const g = (ch.group || '').toLowerCase();
        if (!g.includes('sport') && !g.includes('deporte')) return false;
      } else if (activeCategory === 'entertainment') {
        const g = (ch.group || '').toLowerCase();
        if (!g.includes('entertain') && !g.includes('variedades') && !g.includes('show')) return false;
      } else if (activeCategory === 'news') {
        const g = (ch.group || '').toLowerCase();
        if (!g.includes('news') && !g.includes('noticia')) return false;
      } else if (activeCategory === 'music') {
        const g = (ch.group || '').toLowerCase();
        if (!g.includes('music') && !g.includes('música')) return false;
      } else if (activeCategory === 'kids') {
        const g = (ch.group || '').toLowerCase();
        if (!g.includes('kid') && !g.includes('infantil') && !g.includes('animac') && !g.includes('toon')) return false;
      } else if (activeCategory === 'culture') {
        const g = (ch.group || '').toLowerCase();
        if (!g.includes('doc') && !g.includes('culture') && !g.includes('educat') && !g.includes('cultura')) return false;
      } else if (activeCategory === 'religious') {
        const g = (ch.group || '').toLowerCase();
        if (!g.includes('religio') && !g.includes('iglesia') && !g.includes('cristian')) return false;
      } else if (activeCategory === 'general') {
        const g = (ch.group || '').toLowerCase();
        if (!g.includes('general') && !g.includes('public') && !g.includes('legislative') && !g.includes('undefined')) return false;
      }

      // Country filter
      if (selectedCountry !== 'all') {
        if (ch.country !== selectedCountry) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const n = (ch.name || '').toLowerCase();
        const rn = (ch.rawName || '').toLowerCase();
        const g = (ch.group || '').toLowerCase();
        if (!n.includes(term) && !rn.includes(term) && !g.includes(term)) return false;
      }

      return true;
    });
  }, [channels, activeCategory, selectedCountry, searchTerm, favMap]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(filteredChannels.length / PAGE_SIZE));

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, selectedCountry, searchTerm]);

  // Paginated slice
  const paginatedChannels = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredChannels.slice(start, start + PAGE_SIZE);
  }, [filteredChannels, currentPage]);

  // Handle channel selection & HLS initialization
  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    setPlayerError(null);
    setPlayerLoading(true);

    // Save to watch history
    saveWatchProgress({
      id: channel.id || channel.url,
      title: channel.name,
      poster: channel.logo,
      logo: channel.logo,
      type: 'iptv',
      section: 'tv-libre',
      group: channel.group,
      url: channel.url
    }, 'tv-libre');
    setWatchHistory(getWatchHistory('tv-libre'));

    // Smooth scroll to player on mobile / desktop
    setTimeout(() => {
      if (playerContainerRef.current) {
        playerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Handle external open event (e.g. from Mi Lista or Mi Cuenta)
  useEffect(() => {
    const handleRemoteOpen = (e) => {
      if (e.detail?.tab === 'tv-libre' && e.detail?.item) {
        const item = e.detail.item;
        handleSelectChannel({
          id: item.id || item.url,
          name: item.title || item.name,
          logo: item.logo || item.poster,
          url: item.url,
          group: item.group || 'General'
        });
      }
    };
    window.addEventListener('open-piru-item', handleRemoteOpen);
    return () => {
      window.removeEventListener('open-piru-item', handleRemoteOpen);
    };
  }, []);

  // Setup Hls.js or native player
  useEffect(() => {
    if (!selectedChannel || !selectedChannel.url) return;

    const video = videoRef.current;
    if (!video) return;

    // Destroy existing instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setPlayerError(null);
    setPlayerLoading(true);

    const streamUrl = selectedChannel.url;

    if (Hls.isSupported()) {
      const isTV = isLgTv();
      const hls = new Hls({
        enableWorker: !isTV,
        lowLatencyMode: !isTV,
        backBufferLength: isTV ? 10 : 60,
        maxBufferLength: isTV ? 20 : 60,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 15000,
        levelLoadingMaxRetry: 3
      });

      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setPlayerLoading(false);
        video.play().catch(e => {
          console.log('Autoplay prevented or paused:', e);
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn('Hls error:', data.type, data.details, data.fatal);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Fatal network error encountered, attempting recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Fatal media error encountered, recovering...');
              hls.recoverMediaError();
              break;
            default:
              setPlayerLoading(false);
              setPlayerError('Este canal no responde en este momento o tiene bloqueo de región. Puedes intentar el siguiente canal o abrir con Web Video Caster / VLC.');
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari / iOS / Smart TV HLS support
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setPlayerLoading(false);
        video.play().catch(e => console.log('Autoplay prevented:', e));
      });
      video.addEventListener('error', () => {
        setPlayerLoading(false);
        setPlayerError('Error al reproducir el canal nativo. Intenta con otro canal o transmite mediante Web Video Caster.');
      });
    } else {
      setPlayerLoading(false);
      setPlayerError('Tu navegador no soporta reproducción directa de streams HLS (.m3u8).');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedChannel]);

  // Zapping: Next / Previous channel
  const handlePrevChannel = () => {
    if (!selectedChannel) return;
    const idx = filteredChannels.findIndex(c => (c.id === selectedChannel.id && c.url === selectedChannel.url));
    if (idx > 0) {
      handleSelectChannel(filteredChannels[idx - 1]);
    } else if (filteredChannels.length > 0) {
      handleSelectChannel(filteredChannels[filteredChannels.length - 1]);
    }
  };

  const handleNextChannel = () => {
    if (!selectedChannel) return;
    const idx = filteredChannels.findIndex(c => (c.id === selectedChannel.id && c.url === selectedChannel.url));
    if (idx !== -1 && idx < filteredChannels.length - 1) {
      handleSelectChannel(filteredChannels[idx + 1]);
    } else if (filteredChannels.length > 0) {
      handleSelectChannel(filteredChannels[0]);
    }
  };

  // Toggle favorite
  const handleToggleFav = async (channel, e) => {
    if (e) e.stopPropagation();
    const key = channel.id || channel.url;
    const isNowFav = await toggleFavorite({
      id: key,
      title: channel.name,
      name: channel.name,
      poster_path: channel.logo,
      logo: channel.logo,
      type: 'iptv',
      group: channel.group,
      url: channel.url,
      country: channel.country,
      quality: channel.quality
    });
    setFavMap(prev => ({ ...prev, [key]: isNowFav }));
  };

  // Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Smart TV Remote Back Button / Escape
  useDpadNavigation({
    onBack: () => {
      if (selectedChannel) {
        setSelectedChannel(null);
      }
    }
  });

  return (
    <div className="tvlibre-container" style={{ minHeight: '100vh', padding: '1.5rem', background: '#0a0a0f', color: '#f3f4f6' }}>
      
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem',
        padding: '1.25rem 1.5rem',
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)'
          }}>
            📺
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
              TV Libre <span style={{ fontSize: '0.85rem', color: '#ec4899', fontWeight: '600', marginLeft: '6px', padding: '2px 8px', background: 'rgba(236,72,153,0.15)', borderRadius: '6px', border: '1px solid rgba(236,72,153,0.3)' }}>IPTV EN ESPAÑOL</span>
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Más de 2,200 canales en vivo en español • Transmisión oficial IPTV HLS sin interrupciones
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            padding: '6px 12px',
            borderRadius: '20px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontWeight: '600'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
            {channels.length} Canales Disponibles
          </span>

          {isLoadingLiveM3U && (
            <span style={{ fontSize: '0.75rem', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🔄 Actualizando lista...
            </span>
          )}
        </div>
      </div>

      {/* Embedded Player Section (When channel is selected) */}
      {selectedChannel && (
        <div 
          ref={playerContainerRef}
          style={{
            marginBottom: '2rem',
            background: 'rgba(15, 15, 25, 0.95)',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1px solid rgba(139, 92, 246, 0.35)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
            position: 'relative',
            backdropFilter: 'blur(10px)'
          }}
        >
          {/* Player Header Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            background: 'rgba(20, 20, 35, 0.8)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {selectedChannel.logo ? (
                <img 
                  src={selectedChannel.logo} 
                  alt={selectedChannel.name}
                  style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', padding: '2px' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  📺
                </div>
              )}
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedChannel.name}
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: '#ef4444',
                    color: '#fff',
                    fontWeight: '800'
                  }}>
                    LIVE
                  </span>
                </h2>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', gap: '10px', marginTop: '2px' }}>
                  <span>🏷️ {selectedChannel.group}</span>
                  <span>🌍 {selectedChannel.country.toUpperCase()}</span>
                  <span>⚡ {selectedChannel.quality}</span>
                </div>
              </div>
            </div>

            {/* Quick Action Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={handlePrevChannel}
                title="Canal anterior"
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.85rem'
                }}
              >
                ⏮ Anterior
              </button>

              <button
                onClick={handleNextChannel}
                title="Canal siguiente"
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.85rem'
                }}
              >
                Siguiente ⏭
              </button>

              <button
                onClick={() => handleToggleFav(selectedChannel)}
                title="Marcar como favorito"
                style={{
                  padding: '6px 12px',
                  background: favMap[selectedChannel.id || selectedChannel.url] ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  border: favMap[selectedChannel.id || selectedChannel.url] ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  color: favMap[selectedChannel.id || selectedChannel.url] ? '#f87171' : '#fff',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                {favMap[selectedChannel.id || selectedChannel.url] ? '❤️ Guardado' : '🤍 Favorito'}
              </button>

              <button
                onClick={() => castWithWebVideoCaster(selectedChannel.url, selectedChannel.name)}
                title="Transmitir con Web Video Caster a Smart TV"
                style={{
                  padding: '6px 12px',
                  background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(139, 92, 246, 0.25))',
                  border: '1px solid rgba(236, 72, 153, 0.5)',
                  borderRadius: '8px',
                  color: '#f472b6',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '600'
                }}
              >
                📡 Transmitir (WVC)
              </button>

              <button
                onClick={handleToggleFullscreen}
                title="Pantalla completa"
                style={{
                  padding: '6px 10px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                ⛶
              </button>

              <button
                onClick={() => setSelectedChannel(null)}
                title="Cerrar reproductor"
                style={{
                  padding: '6px 10px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '0.85rem'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Video Container */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video
              ref={videoRef}
              controls
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />

            {/* Spinner Overlay */}
            {playerLoading && !playerError && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                zIndex: 10
              }}>
                <div style={{
                  width: '45px',
                  height: '45px',
                  borderRadius: '50%',
                  border: '4px solid rgba(255,255,255,0.15)',
                  borderTopColor: '#ec4899',
                  animation: 'spin 1s linear infinite'
                }} />
                <span style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: '500' }}>
                  Conectando a {selectedChannel.name}...
                </span>
              </div>
            )}

            {/* Error Overlay */}
            {playerError && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(15, 10, 20, 0.9)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                textAlign: 'center',
                zIndex: 11
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⚠️</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#f87171' }}>
                  Señal temporalmente no disponible
                </h3>
                <p style={{ margin: '0 0 1.5rem 0', maxWidth: '500px', fontSize: '0.85rem', color: '#cbd5e1' }}>
                  {playerError}
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    onClick={() => handleSelectChannel(selectedChannel)}
                    style={{
                      padding: '8px 16px',
                      background: '#ec4899',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Reintentar
                  </button>
                  <button
                    onClick={handleNextChannel}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      borderRadius: '8px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Siguiente canal ⏭
                  </button>
                  <button
                    onClick={() => castWithWebVideoCaster(selectedChannel.url, selectedChannel.name)}
                    style={{
                      padding: '8px 16px',
                      background: 'rgba(139, 92, 246, 0.3)',
                      border: '1px solid #8b5cf6',
                      color: '#c4b5fd',
                      borderRadius: '8px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    📡 Abrir en WVC / VLC
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '1.5rem',
        background: 'rgba(20, 20, 35, 0.6)',
        padding: '1.25rem',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        {/* Top Controls: Search + Country Select */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 300px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
              🔍
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar canal por nombre o temática..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px 12px 42px',
                background: 'rgba(10, 10, 20, 0.8)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '0.95rem',
                outline: 'none'
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Country Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
              País:
            </label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              style={{
                padding: '10px 14px',
                background: 'rgba(10, 10, 20, 0.85)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '0.9rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code} style={{ background: '#111827', color: '#fff' }}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'thin'
        }}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  background: isActive ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'rgba(255, 255, 255, 0.05)',
                  border: isActive ? '1px solid rgba(236, 72, 153, 0.6)' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: isActive ? '#fff' : '#cbd5e1',
                  fontWeight: isActive ? '700' : '500',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 4px 15px rgba(236, 72, 153, 0.35)' : 'none'
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Continuar viendo / Canales Recientes */}
      {!searchTerm && recentChannels.length > 0 && activeCategory === 'all' && (
        <section className="netflix-row-section" style={{ marginBottom: '2.5rem' }}>
          <div className="netflix-row-header">
            <h2 className="netflix-row-title" style={{ fontSize: '1.25rem' }}>
              Continuar viendo / Canales recientes
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#a3a3a3' }}>
                chevron_right
              </span>
            </h2>
          </div>
          <div className="netflix-continue-grid">
            {recentChannels.map((item) => (
              <div 
                key={`continue-${item.id || item.url}`} 
                className="netflix-continue-card"
                onClick={() => {
                  const full = channels.find(c => c.url === item.url || (item.id && c.id === item.id)) || item;
                  handleSelectChannel(full);
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="netflix-continue-thumb" style={{ background: '#161622', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.poster || item.logo || item.poster_path ? (
                    <img 
                      src={item.poster || item.logo || item.poster_path} 
                      alt={item.title || item.name} 
                      loading="lazy"
                      decoding="async"
                      style={{ objectFit: 'contain', padding: '1.2rem', width: '100%', height: '100%' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <span style={{ fontSize: '2.5rem' }}>📺</span>
                  )}
                  <div className="netflix-continue-overlay">
                    <div className="netflix-center-play">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '24px' }}>
                        play_arrow
                      </span>
                    </div>
                  </div>
                </div>
                <div className="netflix-progress-bar">
                  <div className="netflix-progress-fill" style={{ width: '100%', background: '#e50914' }} />
                </div>
                <div className="netflix-continue-info">
                  <span className="netflix-continue-title">{item.title || item.name}</span>
                  <span className="netflix-continue-sub" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                    EN VIVO {item.group ? `• ${item.group}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Channel Count & Current Results info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 4px' }}>
        <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
          Mostrando <strong style={{ color: '#fff' }}>{filteredChannels.length}</strong> canales
          {activeCategory !== 'all' && ` en ${CATEGORIES.find(c => c.id === activeCategory)?.label}`}
          {selectedCountry !== 'all' && ` (${COUNTRIES.find(c => c.code === selectedCountry)?.label})`}
        </span>

        {totalPages > 1 && (
          <span style={{ fontSize: '0.85rem', color: '#a78bfa' }}>
            Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
          </span>
        )}
      </div>

      {/* Channel Grid */}
      {paginatedChannels.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          background: 'rgba(20, 20, 35, 0.4)',
          borderRadius: '16px',
          border: '1px dashed rgba(255, 255, 255, 0.15)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📺</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: '#fff' }}>No se encontraron canales</h3>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
            Intenta cambiar el país, la categoría o borrar el término de búsqueda.
          </p>
          <button
            onClick={() => { setActiveCategory('all'); setSelectedCountry('all'); setSearchTerm(''); }}
            style={{
              marginTop: '1rem',
              padding: '8px 16px',
              background: '#ec4899',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Ver todos los canales
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem'
        }}>
          {paginatedChannels.map((channel, index) => {
            const isSelected = selectedChannel && (selectedChannel.id === channel.id && selectedChannel.url === channel.url);
            const isFav = favMap[channel.id || channel.url];

            return (
              <div
                key={channel.id ? `${channel.id}_${index}` : `chan_${index}`}
                onClick={() => handleSelectChannel(channel)}
                style={{
                  background: isSelected 
                    ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.25), rgba(139, 92, 246, 0.25))' 
                    : 'rgba(25, 25, 40, 0.7)',
                  borderRadius: '14px',
                  padding: '1rem',
                  border: isSelected ? '2px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isSelected ? '0 8px 25px rgba(236, 72, 153, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.2)',
                  position: 'relative'
                }}
              >
                {/* Top badges: Country, Quality & Favorite */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: '#e2e8f0',
                      textTransform: 'uppercase'
                    }}>
                      {channel.country}
                    </span>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: channel.quality === '1080p' || channel.quality === '4K' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                      color: channel.quality === '1080p' || channel.quality === '4K' ? '#34d399' : '#60a5fa'
                    }}>
                      {channel.quality}
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleToggleFav(channel, e)}
                    title={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '1.1rem',
                      cursor: 'pointer',
                      padding: '2px',
                      color: isFav ? '#ef4444' : '#94a3b8'
                    }}
                  >
                    {isFav ? '❤️' : '🤍'}
                  </button>
                </div>

                {/* Channel Logo and Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    flexShrink: 0,
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    {channel.logo ? (
                      <img
                        src={channel.logo}
                        alt={channel.name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.parentElement) e.target.parentElement.innerHTML = '📺';
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '1.5rem' }}>📺</span>
                    )}
                  </div>

                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <h3 style={{
                      margin: '0 0 4px 0',
                      fontSize: '0.95rem',
                      fontWeight: '700',
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {channel.name}
                    </h3>
                    <p style={{
                      margin: 0,
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {channel.group || 'General'}
                    </p>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    color: '#10b981',
                    fontWeight: '600'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                    En Vivo
                  </span>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        castWithWebVideoCaster(channel.url, channel.name);
                      }}
                      title="Transmitir a TV con Web Video Caster"
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(236, 72, 153, 0.15)',
                        border: '1px solid rgba(236, 72, 153, 0.3)',
                        borderRadius: '6px',
                        color: '#f472b6',
                        fontSize: '0.72rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      📡 WVC
                    </button>
                    <button
                      style={{
                        padding: '4px 10px',
                        background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Ver ▶
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          marginTop: '2rem',
          marginBottom: '3rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => {
              setCurrentPage(1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={currentPage === 1}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: currentPage === 1 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: currentPage === 1 ? '#4b5563' : '#fff',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem'
            }}
          >
            ⏮ Primera
          </button>

          <button
            onClick={() => {
              setCurrentPage(p => Math.max(1, p - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={currentPage === 1}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: currentPage === 1 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: currentPage === 1 ? '#4b5563' : '#fff',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              fontWeight: '600'
            }}
          >
            ← Anterior
          </button>

          {/* Page Indicator */}
          <span style={{
            padding: '8px 16px',
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2))',
            borderRadius: '8px',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            color: '#fff',
            fontSize: '0.85rem',
            fontWeight: '700'
          }}>
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => {
              setCurrentPage(p => Math.min(totalPages, p + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: currentPage === totalPages ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: currentPage === totalPages ? '#4b5563' : '#fff',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              fontWeight: '600'
            }}
          >
            Siguiente →
          </button>

          <button
            onClick={() => {
              setCurrentPage(totalPages);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: currentPage === totalPages ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: currentPage === totalPages ? '#4b5563' : '#fff',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem'
            }}
          >
            Última ⏭
          </button>
        </div>
      )}
    </div>
  );
}
