import React, { useState, useEffect, useRef, useMemo } from 'react';
import Hls from 'hls.js';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import latinAmericaChannels from '../data/latin_america_iptv.json';

const FEATURED_PLAYLISTS = [
  { id: 'latam', name: '🌎 Latin America IPTV', url: 'https://iptv-org.github.io/iptv/index.m3u' },
  { id: 'tdt-tv', name: '📺 Televisión Abierta TDT', url: 'https://www.tdtchannels.com/lists/tv.m3u8' },
  { id: 'movies', name: '🎬 Películas & Cine IPTV', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u' },
  { id: 'sports', name: '⚽ Deportes IPTV', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
  { id: 'kids', name: '🧸 Infantiles & Toons', url: 'https://iptv-org.github.io/iptv/categories/animation.m3u' },
  { id: 'tdt-radio', name: '📻 Radios TDT', url: 'https://www.tdtchannels.com/lists/radio.m3u8' }
];

export default function TvLibre() {
  const [playlistUrl, setPlaylistUrl] = useState(FEATURED_PLAYLISTS[0].url);
  const [channels, setChannels] = useState(latinAmericaChannels);
  const [selectedChannel, setSelectedChannel] = useState(latinAmericaChannels[0] || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todas');
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('pirutv_iptv_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [proxyLevel, setProxyLevel] = useState(0); // 0: CF Worker Proxy, 1: CORS Proxy, 2: Direct

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Save favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pirutv_iptv_favorites', JSON.stringify(favorites));
    } catch (e) {
      console.error(e);
    }
  }, [favorites]);

  const toggleFavorite = (channel) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.url === channel.url);
      if (exists) {
        return prev.filter(f => f.url !== channel.url);
      } else {
        return [...prev, channel];
      }
    });
  };

  // M3U Text Parser
  const parseM3UText = (text) => {
    const lines = text.split('\n');
    const list = [];
    let currentExt = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXTINF:')) {
        currentExt = line;
      } else if (line.startsWith('http://') || line.startsWith('https://')) {
        let logo = 'https://via.placeholder.com/150?text=IPTV';
        let name = 'Canal ' + (list.length + 1);
        let group = 'General';

        if (currentExt) {
          const logoMatch = currentExt.match(/tvg-logo="([^"]+)"/);
          const groupMatch = currentExt.match(/group-title="([^"]+)"/);
          const titleParts = currentExt.split(',');
          name = titleParts[titleParts.length - 1].trim() || name;
          if (logoMatch) logo = logoMatch[1];
          if (groupMatch) group = groupMatch[1];
        }

        list.push({
          id: 'ch-' + (list.length + 1) + '-' + Math.random().toString(36).substr(2, 5),
          name: name,
          logo: logo,
          group: group,
          url: line
        });

        currentExt = null;
      }
    }
    return list;
  };

  // Load Remote Playlist URL
  const loadPlaylistUrl = async (targetUrl) => {
    if (!targetUrl) return;
    setLoading(true);
    setPlaylistUrl(targetUrl);

    try {
      let text = '';
      // Try Cloudflare Worker Proxy first
      const cfProxyUrl = `https://pirutv-proxy.skillful-part.workers.dev?url=${encodeURIComponent(targetUrl)}`;
      let res = await fetch(cfProxyUrl).catch(() => null);

      if (!res || !res.ok) {
        // Fallback to CORS Proxy
        const corsProxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
        res = await fetch(corsProxyUrl).catch(() => null);
      }

      if (!res || !res.ok) {
        // Fallback to Direct Fetch
        res = await fetch(targetUrl).catch(() => null);
      }

      if (res && res.ok) {
        text = await res.text();
        const parsed = parseM3UText(text);

        // If loading iptv-org main index, prioritize Latin America channels
        let finalChannels = parsed;
        if (targetUrl.includes('iptv-org/iptv/index.m3u')) {
          const latamOnly = parsed.filter(ch => 
            ch.name.toLowerCase().includes('latin america') || 
            ch.name.toLowerCase().includes('latam') ||
            ch.name.toLowerCase().includes('(latino)') ||
            ch.group.toLowerCase().includes('latin america')
          );
          if (latamOnly.length > 0) finalChannels = latamOnly;
        }

        if (finalChannels.length > 0) {
          setChannels(finalChannels);
          setSelectedChannel(finalChannels[0]);
        }
      }
    } catch (e) {
      console.error('Error loading playlist URL:', e);
    } finally {
      setLoading(false);
    }
  };

  // Handle Local File Upload (.m3u / .m3u8)
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const parsed = parseM3UText(text);
        if (parsed.length > 0) {
          setChannels(parsed);
          setSelectedChannel(parsed[0]);
          setPlaylistUrl(`Archivo: ${file.name}`);
        }
      } catch (err) {
        console.error('Error reading M3U file:', err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // Group Categories list
  const categories = useMemo(() => {
    const cats = new Set(['Todas', '⭐ Favoritos']);
    channels.forEach(ch => {
      if (ch.group) cats.add(ch.group);
    });
    return Array.from(cats);
  }, [channels]);

  // Filtered channels list
  const filteredChannels = useMemo(() => {
    if (activeCategory === '⭐ Favoritos') {
      return favorites.filter(ch => 
        !searchTerm.trim() || ch.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return channels.filter(ch => {
      const matchCat = activeCategory === 'Todas' || ch.group === activeCategory;
      const matchSearch = !searchTerm.trim() || 
        ch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ch.group && ch.group.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [channels, activeCategory, searchTerm, favorites]);

  // Calculate stream URL with 3-tier proxy failover
  const activeStreamUrl = useMemo(() => {
    if (!selectedChannel || !selectedChannel.url) return '';
    const rawUrl = selectedChannel.url.trim();

    if (proxyLevel === 0) {
      return `https://pirutv-proxy.skillful-part.workers.dev?url=${encodeURIComponent(rawUrl)}`;
    } else if (proxyLevel === 1) {
      return `https://corsproxy.io/?url=${encodeURIComponent(rawUrl)}`;
    }
    return rawUrl;
  }, [selectedChannel, proxyLevel]);

  // Attach HLS stream to video element
  useEffect(() => {
    let hlsInstance = null;
    setStreamError(false);

    const videoElement = videoRef.current;
    if (!videoElement || !activeStreamUrl) return;

    const handleSuccess = () => {
      setStreamError(false);
    };

    const handleError = () => {
      if (proxyLevel < 2) {
        console.warn(`IPTV Proxy Level ${proxyLevel} failed, switching to level ${proxyLevel + 1}`);
        setProxyLevel(prev => prev + 1);
      } else {
        setStreamError(true);
      }
    };

    if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = activeStreamUrl;
      videoElement.play().then(handleSuccess).catch(handleError);
    } else if (Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        manifestLoadingTimeOut: 8000,
        manifestLoadingMaxRetry: 2,
        xhrSetup: function (xhr) {
          xhr.withCredentials = false;
        }
      });
      hlsInstance.loadSource(activeStreamUrl);
      hlsInstance.attachMedia(videoElement);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (data && data.levels && data.levels.length > 0) {
          hlsInstance.currentLevel = data.levels.length - 1;
        }
        handleSuccess();
        videoElement.play().catch(handleError);
      });
      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          handleError();
        }
      });
    } else {
      videoElement.src = activeStreamUrl;
      videoElement.play().then(handleSuccess).catch(handleError);
    }

    return () => {
      if (hlsInstance) hlsInstance.destroy();
    };
  }, [activeStreamUrl, proxyLevel]);

  // Reset proxy level on new channel selection
  const handleSelectChannel = (channel) => {
    setProxyLevel(0);
    setSelectedChannel(channel);
  };

  useDpadNavigation();

  return (
    <div style={{ padding: '0.5rem 0 3rem' }}>
      {/* Top Header & Playlist Toolbar */}
      <div style={{ background: '#0e0e12', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h1 className="section-title" style={{ margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              📺 Reproductor IPTV Pro (M3U / M3U8)
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Carga tu propia lista M3U, sube un archivo o selecciona una lista predeterminada
            </p>
          </div>

          {/* File Upload Button */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="file"
              accept=".m3u,.m3u8,.txt"
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn-hero-info"
              style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => fileInputRef.current?.click()}
            >
              📁 Subir Archivo M3U
            </button>
          </div>
        </div>

        {/* Featured Playlists Quick Selector */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '0.75rem', scrollbarWidth: 'none' }}>
          {FEATURED_PLAYLISTS.map((pl) => (
            <button
              key={pl.id}
              type="button"
              onClick={() => loadPlaylistUrl(pl.url)}
              style={{
                background: playlistUrl === pl.url ? 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)' : 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '0.45rem 0.95rem',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              {pl.name}
            </button>
          ))}
        </div>

        {/* URL Input Bar */}
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <input
            type="text"
            placeholder="Pegar URL de lista M3U (ej. https://.../playlist.m3u)..."
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            style={{
              flex: 1,
              background: '#18181f',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              padding: '0.65rem 1rem',
              borderRadius: '10px',
              fontSize: '0.88rem'
            }}
          />
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '0.65rem 1.4rem', fontSize: '0.88rem', borderRadius: '10px', fontWeight: 800 }}
            onClick={() => loadPlaylistUrl(playlistUrl)}
          >
            {loading ? '⏳ Cargando...' : '▶ Cargar Lista'}
          </button>
        </div>
      </div>

      {/* Main Layout: Left Sidebar + Right Video Canvas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(290px, 340px) 1fr', gap: '1.25rem', minHeight: '560px' }}>
        
        {/* Left Channels Sidebar */}
        <div style={{ background: '#0e0e12', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px', padding: '1rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
          
          {/* Search Box */}
          <div style={{ marginBottom: '0.75rem' }}>
            <input
              type="text"
              placeholder="🔍 Buscar canal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                background: '#18181f',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                padding: '0.6rem 0.85rem',
                borderRadius: '10px',
                fontSize: '0.85rem'
              }}
            />
          </div>

          {/* Categories Tab Selector */}
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.75rem', scrollbarWidth: 'none' }}>
            {categories.slice(0, 12).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                style={{
                  background: activeCategory === cat ? '#e50914' : 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '0.5rem' }}>
            {filteredChannels.length} CANALES DISPONIBLES
          </div>

          {/* Channels Scroll List */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingRight: '0.2rem' }}>
            {filteredChannels.length > 0 ? (
              filteredChannels.map(ch => {
                const isSelected = selectedChannel?.url === ch.url;
                const isFav = favorites.some(f => f.url === ch.url);

                return (
                  <div
                    key={ch.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.55rem 0.75rem',
                      background: isSelected ? 'rgba(229, 9, 20, 0.25)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isSelected ? '#e50914' : 'transparent'}`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => handleSelectChannel(ch)}
                  >
                    <img
                      src={ch.logo}
                      alt=""
                      style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}
                      onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/28?text=TV'; }}
                    />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <h4 style={{ margin: 0, fontSize: '0.83rem', fontWeight: isSelected ? 800 : 500, color: isSelected ? '#ef4444' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ch.name}
                      </h4>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {ch.group || 'IPTV'}
                      </span>
                    </div>

                    {/* Favorite Toggle Star */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(ch); }}
                      style={{ background: 'none', border: 'none', color: isFav ? '#f59e0b' : 'rgba(255,255,255,0.2)', fontSize: '0.9rem', cursor: 'pointer', padding: '2px' }}
                    >
                      ★
                    </button>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No se encontraron canales en esta categoría.
              </div>
            )}
          </div>
        </div>

        {/* Right Main Video Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Active Channel Details Bar */}
          {selectedChannel && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0e0e12', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '0.85rem 1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img src={selectedChannel.logo} alt="" style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '6px' }} />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                    {selectedChannel.name}
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    🔴 EN VIVO M3U • {selectedChannel.group || 'IPTV'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    padding: '0.65rem 1.25rem',
                    fontSize: '0.88rem',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    color: '#ffffff',
                    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.45)',
                    borderRadius: '10px'
                  }}
                  onClick={() => castWithWebVideoCaster(selectedChannel.url, selectedChannel.name)}
                >
                  📱 Transmitir a TV (Web Video Caster)
                </button>
              </div>
            </div>
          )}

          {/* Video Container Canvas */}
          <div style={{ background: '#000', borderRadius: '18px', height: 'calc(100vh - 280px)', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.9)' }}>
            {streamError ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'linear-gradient(135deg, rgba(20,20,32,0.98), rgba(10,10,18,0.99))' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>📺</div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-title)', fontSize: '1.25rem' }}>
                  Señal Restringida por Origen o Fuera de Línea
                </h3>
                <p style={{ fontSize: '0.88rem', color: '#cbd5e1', maxWidth: '440px', lineHeight: '1.5', marginBottom: '1.25rem' }}>
                  Esta señal requiere reproducción directa. Transmítela sin restricciones a tu Smart TV mediante <strong>Web Video Caster</strong>.
                </p>
                {selectedChannel && (
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800 }}
                    onClick={() => castWithWebVideoCaster(selectedChannel.url, selectedChannel.name)}
                  >
                    📱 Transmitir a TV (Web Video Caster)
                  </button>
                )}
              </div>
            ) : (
              <video
                ref={videoRef}
                controls
                autoPlay
                playsInline
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  backgroundColor: '#000',
                  zIndex: 2
                }}
              />
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
