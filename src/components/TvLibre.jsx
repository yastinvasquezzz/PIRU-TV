import React, { useState, useMemo, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { saveWatchProgress } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import customIptvChannels from '../data/custom_iptv.json';

const AMBIT_CATEGORIES = [
  'Todos',
  'Noticias',
  'Deportes',
  'Cine',
  'Música',
  'Infantil',
  'Entretenimiento',
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
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Conectando a señal IPTV...</span>
        </div>
      )}

      {error ? (
        <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'linear-gradient(135deg, rgba(20,20,32,0.98), rgba(10,10,18,0.99))' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📺</div>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontFamily: 'var(--font-title)', fontSize: '1.2rem' }}>
            Señal con Restricción de Origen (CORS / Geobloqueo)
          </h4>
          <p style={{ fontSize: '0.88rem', color: '#cbd5e1', maxWidth: '480px', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
            Este canal requiere reproductor directo o transmisión a Smart TV con <strong>Web Video Caster</strong>.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 800 }}
              onClick={() => castWithWebVideoCaster(streamUrl, channelName || 'Canal IPTV')}
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

  // Filter channels by Ambit & Search
  const filteredChannels = useMemo(() => {
    return customIptvChannels.filter(ch => {
      const matchAmbit = activeAmbit === 'Todos' || ch.ambit === activeAmbit;
      const matchSearch = !searchTerm.trim() || 
        ch.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        ch.ambit.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ch.country.toLowerCase().includes(searchTerm.toLowerCase());
      return matchAmbit && matchSearch;
    });
  }, [activeAmbit, searchTerm]);

  const handleOpenChannel = (channel) => {
    setSelectedChannel(channel);
    saveWatchProgress({
      id: channel.id,
      titulo: channel.name,
      portada: channel.logo,
      type: 'tv-iptv'
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
            📺 IPTV Libre Pro ({customIptvChannels.length} Canales)
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
            Lista de canales de televisión en abierto libres, funcionales y en alta definición
          </p>
        </div>

        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar canal de TV (ej. Noticias, Deportes)..."
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
            {ambit === 'Todos' ? `📺 Todos los Canales (${customIptvChannels.length})` : ambit}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="media-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {filteredChannels.length > 0 ? (
          filteredChannels.slice(0, 300).map((ch) => (
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
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/80?text=TV'; }}
                />
              </div>
              <div className="card-info" style={{ textAlign: 'center', padding: 0 }}>
                <span className="card-genre" style={{ fontSize: '0.72rem', color: '#ef4444', textTransform: 'uppercase', fontWeight: 800 }}>
                  {ch.ambit} • {ch.country}
                </span>
                <h3 className="card-title" style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0.2rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ch.name}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#86efac', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  🔴 EN VIVO
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
                  🔴 EN VIVO IPTV
                </span>
                <span className="modal-lang">{selectedChannel.country}</span>
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
