import React, { useState, useMemo, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { saveWatchProgress } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import latinAmericaChannels from '../data/latin_america_iptv.json';

const AMBIT_CATEGORIES = [
  'Todos',
  'Cine',
  'Infantil',
  'Deportes',
  'Noticias',
  'Entretenimiento',
  'Música',
  'General'
];

function VideoPlayer({ streamUrl, poster, isAudio, channelName }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [useProxy, setUseProxy] = useState(false);

  // Upgrade http:// to https:// to prevent browser Mixed Content blocking on Vercel
  const cleanUrl = useMemo(() => {
    if (!streamUrl) return '';
    let url = streamUrl.trim();
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    if (useProxy) {
      return `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
    }
    return url;
  }, [streamUrl, useProxy]);

  useEffect(() => {
    let hlsInstance = null;
    setError(false);
    setIsLoading(true);

    const videoElement = videoRef.current;
    if (!videoElement || !cleanUrl) return;

    // 5-second timeout fallback: if direct stream blocks, try CORS proxy fallback
    const timeoutTimer = setTimeout(() => {
      if (isLoading) {
        console.warn('IPTV Stream playback timeout for URL:', cleanUrl);
        if (!useProxy && !cleanUrl.includes('corsproxy')) {
          setUseProxy(true); // Retry with CORS proxy
        } else {
          setIsLoading(false);
          setError(true);
        }
      }
    }, 5000);

    const handleSuccess = () => {
      clearTimeout(timeoutTimer);
      setIsLoading(false);
      setError(false);
    };

    const handleError = () => {
      clearTimeout(timeoutTimer);
      if (!useProxy && !cleanUrl.includes('corsproxy')) {
        setUseProxy(true); // Retry with CORS proxy
      } else {
        setIsLoading(false);
        setError(true);
      }
    };

    if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = cleanUrl;
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
      hlsInstance.loadSource(cleanUrl);
      hlsInstance.attachMedia(videoElement);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (data && data.levels && data.levels.length > 0) {
          // Force select video rendition level so video frames decode immediately
          hlsInstance.currentLevel = data.levels.length - 1;
        }
        handleSuccess();
        videoElement.play().catch(handleError);
      });
      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.warn('HLS Fatal Error:', data);
          handleError();
        }
      });
    } else {
      videoElement.src = cleanUrl;
      videoElement.play().then(handleSuccess).catch(handleError);
    }

    return () => {
      clearTimeout(timeoutTimer);
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [cleanUrl, useProxy]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', borderRadius: '16px', overflow: 'hidden' }}>
      {isLoading && (
        <div style={{ position: 'absolute', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: '#fff' }}>
          <div className="player-loading-spinner" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Conectando a señal IPTV M3U...</span>
        </div>
      )}

      {error ? (
        <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'linear-gradient(135deg, rgba(20,20,32,0.98), rgba(10,10,18,0.99))' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📺</div>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontFamily: 'var(--font-title)', fontSize: '1.2rem' }}>
            Señal M3U con Restricción de Origen (CORS / Geobloqueo)
          </h4>
          <p style={{ fontSize: '0.88rem', color: '#cbd5e1', maxWidth: '480px', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
            Transmite la señal en vivo directamente a tu Smart TV con <strong>Web Video Caster</strong>.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 800 }}
              onClick={() => castWithWebVideoCaster(streamUrl, channelName || 'Canal LATAM')}
            >
              📱 Transmitir a TV (Web Video Caster)
            </button>
          </div>
        </div>
      ) : isAudio ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
          {poster && <img src={poster} alt="Radio Logo" style={{ width: '120px', height: '120px', objectFit: 'contain', borderRadius: '16px' }} />}
          <audio ref={videoRef} controls autoPlay style={{ width: '100%', maxWidth: '400px' }} />
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
  );
}

export default function TvLibre() {
  const [activeAmbit, setActiveAmbit] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channels, setChannels] = useState(latinAmericaChannels);

  // Live M3U fetch from iptv-org index.m3u
  useEffect(() => {
    const fetchLiveM3u = async () => {
      try {
        const res = await fetch('https://iptv-org.github.io/iptv/index.m3u');
        if (res.ok) {
          const text = await res.text();
          const lines = text.split('\n');
          const parsedChannels = [];
          let currentExt = null;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#EXTINF:')) {
              currentExt = line;
            } else if (line.startsWith('http://') || line.startsWith('https://')) {
              if (currentExt) {
                const logoMatch = currentExt.match(/tvg-logo="([^"]+)"/);
                const groupMatch = currentExt.match(/group-title="([^"]+)"/);
                const titleParts = currentExt.split(',');
                const name = titleParts[titleParts.length - 1].trim();

                const isLatin = name.toLowerCase().includes('latin america') || 
                                name.toLowerCase().includes('latam') || 
                                name.toLowerCase().includes('(latino)') ||
                                (groupMatch && groupMatch[1].toLowerCase().includes('latin america'));

                if (isLatin) {
                  let ambit = 'General';
                  const lower = name.toLowerCase();
                  if (lower.includes('news') || lower.includes('noticia') || lower.includes('24')) ambit = 'Noticias';
                  else if (lower.includes('sport') || lower.includes('deporte') || lower.includes('espn')) ambit = 'Deportes';
                  else if (lower.includes('cine') || lower.includes('movie') || lower.includes('film') || lower.includes('hbo') || lower.includes('universal') || lower.includes('star') || lower.includes('studio')) ambit = 'Cine';
                  else if (lower.includes('music') || lower.includes('mtv') || lower.includes('vevo')) ambit = 'Música';
                  else if (lower.includes('disney') || lower.includes('nick') || lower.includes('cartoon') || lower.includes('kids') || lower.includes('infantil')) ambit = 'Infantil';
                  else if (lower.includes('tv') || lower.includes('channel') || lower.includes('tnt') || lower.includes('fx')) ambit = 'Entretenimiento';

                  parsedChannels.push({
                    id: 'latam-live-' + (parsedChannels.length + 1),
                    name: name,
                    logo: logoMatch ? logoMatch[1] : 'https://via.placeholder.com/150?text=LATAM',
                    ambit: ambit,
                    country: 'Latin America',
                    url: line,
                    isAudio: false
                  });
                }
              }
              currentExt = null;
            }
          }

          if (parsedChannels.length > 0) {
            setChannels(parsedChannels);
          }
        }
      } catch (e) {
        // Fallback to pre-parsed latinAmericaChannels dataset
      }
    };

    fetchLiveM3u();
  }, []);

  // Filter channels by Ambit & Search
  const filteredChannels = useMemo(() => {
    return channels.filter(ch => {
      const matchAmbit = activeAmbit === 'Todos' || ch.ambit === activeAmbit;
      const matchSearch = !searchTerm.trim() || 
        ch.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        ch.ambit.toLowerCase().includes(searchTerm.toLowerCase());
      return matchAmbit && matchSearch;
    });
  }, [channels, activeAmbit, searchTerm]);

  const handleOpenChannel = (channel) => {
    setSelectedChannel(channel);
    saveWatchProgress({
      id: channel.id,
      titulo: channel.name,
      portada: channel.logo,
      type: 'tv-iptv-m3u'
    });
  };

  // Smart TV Remote D-Pad Navigation Hook
  useDpadNavigation({
    onBack: () => {
      if (selectedChannel) {
        setSelectedChannel(null);
      }
    }
  });

  return (
    <div className="tv-libre-container" style={{ padding: '0.5rem 0 3rem' }}>
      {/* Header section */}
      <div className="category-header">
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>
            🌎 IPTV Latin America M3U ({filteredChannels.length} Canales)
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
            Lista oficial M3U IPTV de canales en vivo para Latinoamérica (Disney, Universal, Univision, USA Network, TNT, Star, etc.)
          </p>
        </div>

        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar canal Latin America (ej. Disney, Universal, Univision)..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Category Filter Badges */}
      <div className="filters-wrapper" style={{ margin: '0 0 2rem 0', display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
        {AMBIT_CATEGORIES.map(ambit => (
          <button
            key={ambit}
            type="button"
            className={`filter-badge ${activeAmbit === ambit ? 'active' : ''}`}
            onClick={() => setActiveAmbit(ambit)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {ambit === 'Todos' ? `📺 Todos (${channels.length})` : ambit}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="media-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {filteredChannels.length > 0 ? (
          filteredChannels.map((ch) => (
            <button
              type="button"
              key={ch.id}
              className="media-card"
              onClick={() => handleOpenChannel(ch)}
              style={{ textAlign: 'center', padding: '1.25rem 0.75rem', background: 'rgba(20, 20, 32, 0.6)', border: '1px solid var(--border-color)', borderRadius: '18px', cursor: 'pointer', transition: 'var(--transition-smooth)' }}
            >
              <div style={{ width: '80px', height: '80px', margin: '0 auto 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '0.5rem' }}>
                <img
                  src={ch.logo}
                  alt={ch.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/80?text=LATAM'; }}
                />
              </div>
              <div className="card-info" style={{ textAlign: 'center', padding: 0 }}>
                <span className="card-genre" style={{ fontSize: '0.72rem', color: '#ef4444', textTransform: 'uppercase', fontWeight: 800 }}>
                  {ch.ambit} • LATAM
                </span>
                <h3 className="card-title" style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0.2rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ch.name}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#86efac', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  🔴 EN VIVO M3U
                </span>
              </div>
            </button>
          ))
        ) : (
          <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '4rem 2rem' }}>
            <span className="empty-icon">📺</span>
            <h3 className="empty-title">No se encontraron canales</h3>
            <p>Intenta buscando con otro término o seleccionando la categoría "Todos".</p>
          </div>
        )}
      </div>

      {/* Streaming Player Modal */}
      {selectedChannel && (
        <div className="modal-overlay" onClick={() => setSelectedChannel(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '820px' }}>
            <button className="modal-close-btn" onClick={() => setSelectedChannel(null)}>✕</button>

            <div className="movie-player-container" style={{ height: '420px' }}>
              <VideoPlayer 
                streamUrl={selectedChannel.url} 
                poster={selectedChannel.logo} 
                isAudio={selectedChannel.isAudio}
                channelName={selectedChannel.name}
              />
            </div>

            <div className="modal-body">
              <div className="modal-meta">
                <span className="modal-genre">{selectedChannel.ambit}</span>
                <span className="modal-lang" style={{ background: 'rgba(239, 68, 68, 0.18)', color: '#fca5a5', border: '1px solid #ef4444' }}>
                  🔴 EN VIVO M3U
                </span>
                <span className="modal-lang">Latin America</span>
              </div>

              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img src={selectedChannel.logo} alt="" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                {selectedChannel.name}
              </h2>

              {/* Action Buttons: Web Video Caster */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', margin: '1.25rem 0' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.92rem',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    color: '#ffffff',
                    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.45)',
                    borderRadius: '12px'
                  }}
                  onClick={() => castWithWebVideoCaster(selectedChannel.url, selectedChannel.name)}
                >
                  📱 Transmitir a TV (Web Video Caster)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
