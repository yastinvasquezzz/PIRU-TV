import React, { useState, useMemo, useEffect, useRef } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { saveWatchProgress } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';

import tdtTvJson from '../data/tdt_tv.json';
import tdtRadioJson from '../data/tdt_radio.json';

const TDT_TV_API = 'https://www.tdtchannels.com/lists/tv.json';
const TDT_RADIO_API = 'https://www.tdtchannels.com/lists/radio.json';

const TDT_LISTS = {
  tv: [
    { format: 'JSON', url: 'https://www.tdtchannels.com/lists/tv.json', desc: 'Para usar con la app TDTChannels en iOS y Android.' },
    { format: 'M3U8', url: 'https://www.tdtchannels.com/lists/tv.m3u8', desc: 'Formato recomendado para IPTV (VLC, Kodi, Tivimate).' },
    { format: 'M3U', url: 'https://www.tdtchannels.com/lists/tv.m3u', desc: 'Alternativa si tu reproductor no admite M3U8.' },
    { format: 'Enigma2', url: 'https://www.tdtchannels.com/lists/userbouquet.tdtchannels.tv', desc: 'Lista específica para decodificadores (Dreambox, Vu+, Octagon).' }
  ],
  radio: [
    { format: 'JSON', url: 'https://www.tdtchannels.com/lists/radio.json', desc: 'Para usar con la app TDTChannels en iOS y Android.' },
    { format: 'M3U8', url: 'https://www.tdtchannels.com/lists/radio.m3u8', desc: 'Ideal para reproductores de streaming o apps compatibles.' },
    { format: 'M3U', url: 'https://www.tdtchannels.com/lists/radio.m3u', desc: 'Alternativa para reproductores antiguos.' },
    { format: 'Enigma2', url: 'https://www.tdtchannels.com/lists/userbouquet.tdtchannels_radio.tv', desc: 'Lista compatible con receptores Enigma2 para radio.' }
  ]
};

// Helper parser to convert TDTChannels JSON schema into channel cards
const parseTdtChannels = (rawJson, mediaType) => {
  if (!rawJson || !rawJson.countries) return [];
  const processed = [];
  rawJson.countries.forEach(country => {
    const ambits = country.ambits || [];
    ambits.forEach(ambit => {
      const channels = ambit.channels || [];
      channels.forEach(ch => {
        const validOptions = (ch.options || []).filter(opt => opt.url && opt.url.trim().length > 0);
        if (validOptions.length > 0) {
          processed.push({
            id: `${country.name}-${ambit.name}-${ch.name}`,
            name: ch.name,
            logo: ch.logo || 'https://via.placeholder.com/150?text=TDT',
            ambit: ambit.name || country.name,
            country: country.name,
            web: ch.web,
            options: validOptions,
            type: mediaType
          });
        }
      });
    });
  });
  return processed;
};

function VideoPlayer({ streamUrl, poster, isAudio, format, webUrl }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Upgrade http:// to https:// to prevent browser Mixed Content blocking on Vercel
  const cleanUrl = useMemo(() => {
    if (!streamUrl) return '';
    let url = streamUrl.trim();
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    return url;
  }, [streamUrl]);

  const isEmbed = useMemo(() => {
    if (!cleanUrl) return false;
    if (format === 'embed') return true;
    return cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be') || cleanUrl.includes('dailymotion') || cleanUrl.includes('embed');
  }, [cleanUrl, format]);

  useEffect(() => {
    let hlsInstance = null;
    setError(false);
    setIsLoading(true);

    if (isEmbed) {
      setIsLoading(false);
      return;
    }

    const videoElement = videoRef.current;
    if (!videoElement || !cleanUrl) return;

    // 6-second timeout fallback if stream hangs or CORS fails silently
    const timeoutTimer = setTimeout(() => {
      if (isLoading) {
        console.warn('TDT Stream playback timeout for URL:', cleanUrl);
        setIsLoading(false);
        setError(true);
      }
    }, 6000);

    const handleSuccess = () => {
      clearTimeout(timeoutTimer);
      setIsLoading(false);
      setError(false);
    };

    const handleError = () => {
      clearTimeout(timeoutTimer);
      setIsLoading(false);
      setError(true);
    };

    if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = cleanUrl;
      videoElement.play().then(handleSuccess).catch(handleError);
    } else if (window.Hls && window.Hls.isSupported()) {
      hlsInstance = new window.Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        manifestLoadingTimeOut: 8000,
        manifestLoadingMaxRetry: 2
      });
      hlsInstance.loadSource(cleanUrl);
      hlsInstance.attachMedia(videoElement);
      hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => {
        handleSuccess();
        videoElement.play().catch(handleError);
      });
      hlsInstance.on(window.Hls.Events.ERROR, (_event, data) => {
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
  }, [cleanUrl, isEmbed]);

  if (isEmbed) {
    return (
      <iframe
        src={cleanUrl}
        className="player-iframe"
        allowFullScreen
        allow="autoplay; encrypted-media"
        title="Canal TDT"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
      {isLoading && (
        <div style={{ position: 'absolute', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: '#fff' }}>
          <div className="player-loading-spinner" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Conectando a señal TDT...</span>
        </div>
      )}

      {error ? (
        <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'linear-gradient(135deg, rgba(20,20,32,0.98), rgba(10,10,18,0.99))' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📺</div>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontFamily: 'var(--font-title)', fontSize: '1.2rem' }}>
            Señal con Restricción de Origen (CORS / Geobloqueo)
          </h4>
          <p style={{ fontSize: '0.88rem', color: '#cbd5e1', maxWidth: '480px', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
            Este canal bloquea la reproducción directa en navegador web. Transmítelo a tu Smart TV con <strong>Web Video Caster</strong> o abre su sitio oficial.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 800 }}
              onClick={() => castWithWebVideoCaster(streamUrl, 'Canal TDT')}
            >
              📱 Transmitir a TV (Web Video Caster)
            </button>
            {webUrl && (
              <a
                href={webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-hero-info"
                style={{ padding: '0.75rem 1.25rem', borderRadius: '10px', fontSize: '0.88rem', textDecoration: 'none' }}
              >
                🌐 Abrir Sitio Oficial
              </a>
            )}
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
          poster={poster}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      )}
    </div>
  );
}

export default function TvLibre() {
  const [mediaType, setMediaType] = useState('tv'); // 'tv' or 'radio'
  
  // Pre-populate with official TDTChannels dataset for 0ms load & 0 CORS errors
  const [tvChannels, setTvChannels] = useState(() => parseTdtChannels(tdtTvJson, 'tv'));
  const [radioChannels, setRadioChannels] = useState(() => parseTdtChannels(tdtRadioJson, 'radio'));
  const [showListsInfo, setShowListsInfo] = useState(false);

  const [activeAmbit, setActiveAmbit] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);

  // Load HLS.js library dynamically if not present
  useEffect(() => {
    if (!window.Hls) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Background fetch to update TDTChannels dataset if CORS permits or via proxy
  useEffect(() => {
    const fetchLiveTdtData = async () => {
      try {
        const apiUrl = mediaType === 'tv' ? TDT_TV_API : TDT_RADIO_API;
        const res = await fetch(apiUrl);
        if (res.ok) {
          const data = await res.json();
          const parsed = parseTdtChannels(data, mediaType);
          if (parsed.length > 0) {
            if (mediaType === 'tv') setTvChannels(parsed);
            else setRadioChannels(parsed);
          }
        }
      } catch (e) {
        // Silent catch: pre-loaded dataset ensures 100% availability
      }
    };

    fetchLiveTdtData();
  }, [mediaType]);

  const currentList = mediaType === 'tv' ? tvChannels : radioChannels;

  // Extract unique Ambits/Categories
  const ambitsList = useMemo(() => {
    const set = new Set();
    currentList.forEach(ch => {
      if (ch.ambit) set.add(ch.ambit);
    });
    return ['Todos', ...Array.from(set)];
  }, [currentList]);

  // Filter channels by Ambit & Search
  const filteredChannels = useMemo(() => {
    return currentList.filter(ch => {
      const matchAmbit = activeAmbit === 'Todos' || ch.ambit === activeAmbit;
      const matchSearch = !searchTerm.trim() || ch.name.toLowerCase().includes(searchTerm.toLowerCase()) || ch.ambit.toLowerCase().includes(searchTerm.toLowerCase());
      return matchAmbit && matchSearch;
    });
  }, [currentList, activeAmbit, searchTerm]);

  const handleOpenChannel = (channel) => {
    setSelectedChannel(channel);
    setSelectedOptionIndex(0);
    saveWatchProgress({
      id: channel.id,
      titulo: channel.name,
      portada: channel.logo,
      type: mediaType === 'tv' ? 'tv-live' : 'radio-live'
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

  const activeOption = selectedChannel?.options?.[selectedOptionIndex] || selectedChannel?.options?.[0];
  const activeStreamUrl = activeOption?.url || '';

  return (
    <div className="tv-libre-container" style={{ padding: '0.5rem 0 2rem' }}>
      {/* Header section with TDTChannels branding */}
      <div className="category-header">
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>
            {mediaType === 'tv' ? '📺 Televisión TDTChannels' : '📻 Emisoras de Radio TDTChannels'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
            Disfruta de {currentList.length} canales en abierto de forma gratuita con la API oficial de TDTChannels
          </p>
        </div>

        <div className="controls-group" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          {/* Toggle Lists Box */}
          <button
            type="button"
            onClick={() => setShowListsInfo(!showListsInfo)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-color)',
              color: '#fff',
              padding: '0.65rem 1.1rem',
              borderRadius: '12px',
              fontFamily: 'var(--font-title)',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer'
            }}
          >
            📋 {showListsInfo ? 'Ocultar Listas M3U8/JSON' : 'Ver Listas M3U8 / JSON / IPTV'}
          </button>

          {/* Mode Switcher: TV vs Radio */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.06)', padding: '0.3rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => { setMediaType('tv'); setActiveAmbit('Todos'); setSearchTerm(''); }}
              style={{
                padding: '0.55rem 1.1rem',
                border: 'none',
                borderRadius: '10px',
                fontFamily: 'var(--font-title)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                background: mediaType === 'tv' ? 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)' : 'transparent',
                color: '#fff',
                boxShadow: mediaType === 'tv' ? '0 4px 15px rgba(229, 9, 20, 0.4)' : 'none',
                transition: 'all 0.25s ease'
              }}
            >
              📺 Televisión ({tvChannels.length})
            </button>
            <button
              type="button"
              onClick={() => { setMediaType('radio'); setActiveAmbit('Todos'); setSearchTerm(''); }}
              style={{
                padding: '0.55rem 1.1rem',
                border: 'none',
                borderRadius: '10px',
                fontFamily: 'var(--font-title)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                background: mediaType === 'radio' ? 'linear-gradient(135deg, #9333ea 0%, #6b21a8 100%)' : 'transparent',
                color: '#fff',
                boxShadow: mediaType === 'radio' ? '0 4px 15px rgba(147, 51, 234, 0.4)' : 'none',
                transition: 'all 0.25s ease'
              }}
            >
              📻 Radio ({radioChannels.length})
            </button>
          </div>

          {/* Search container */}
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder={mediaType === 'tv' ? "Buscar canal de televisión..." : "Buscar emisora de radio..."}
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* TDTChannels Official Playlists Info Box */}
      {showListsInfo && (
        <div 
          style={{
            background: 'linear-gradient(145deg, rgba(20, 20, 32, 0.95) 0%, rgba(10, 10, 18, 0.98) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            padding: '1.75rem',
            marginBottom: '2rem',
            boxShadow: '0 15px 35px rgba(0, 0, 0, 0.8)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', color: '#fff', margin: 0 }}>
              📡 Listas Oficiales de TDTChannels ({mediaType === 'tv' ? 'Televisión' : 'Radio'})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Fuente abierta GitHub / TDTChannels</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {TDT_LISTS[mediaType].map((item, idx) => (
              <div 
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '14px',
                  padding: '1rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 800, color: '#e50914', fontSize: '0.9rem' }}>{item.format}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(item.url);
                      alert(`¡Enlace ${item.format} copiado al portapapeles!`);
                    }}
                    style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: '6px', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    📋 Copiar
                  </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: '0 0 0.6rem 0', lineHeight: '1.4' }}>
                  {item.desc}
                </p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.78rem', color: '#60a5fa', wordBreak: 'break-all', textDecoration: 'none' }}
                >
                  {item.url}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ambits / Category Filter Badges */}
      <div className="filters-wrapper" style={{ margin: '0 0 2rem 0', display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
        {ambitsList.map(ambit => (
          <button
            key={ambit}
            type="button"
            className={`filter-badge ${activeAmbit === ambit ? 'active' : ''}`}
            onClick={() => setActiveAmbit(ambit)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {ambit === 'Todos' ? (mediaType === 'tv' ? `📺 Todos los Canales (${tvChannels.length})` : `📻 Todas las Emisoras (${radioChannels.length})`) : ambit}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="media-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
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
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/80?text=TDT'; }}
                />
              </div>
              <div className="card-info" style={{ textAlign: 'center', padding: 0 }}>
                <span className="card-genre" style={{ fontSize: '0.72rem', color: mediaType === 'tv' ? '#ef4444' : '#c084fc', textTransform: 'uppercase', fontWeight: 800 }}>
                  {ch.ambit}
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

            <div className="movie-player-container" style={{ height: mediaType === 'radio' ? '240px' : '420px' }}>
              <VideoPlayer 
                streamUrl={activeStreamUrl} 
                poster={selectedChannel.logo} 
                isAudio={mediaType === 'radio'} 
                format={activeOption?.format}
                webUrl={selectedChannel.web}
              />
            </div>

            <div className="modal-body">
              <div className="modal-meta">
                <span className="modal-genre">{selectedChannel.ambit}</span>
                <span className="modal-lang" style={{ background: 'rgba(239, 68, 68, 0.18)', color: '#fca5a5', border: '1px solid #ef4444' }}>
                  🔴 SEÑAL EN VIVO TDT
                </span>
                <span className="modal-lang">{selectedChannel.country}</span>
              </div>

              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img src={selectedChannel.logo} alt="" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                {selectedChannel.name}
              </h2>

              {/* Stream Option Badges if channel has multiple stream servers */}
              {selectedChannel.options && selectedChannel.options.length > 1 && (
                <div style={{ margin: '1rem 0' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', fontWeight: 700 }}>
                    🎛️ Seleccionar Opción de Señal:
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {selectedChannel.options.map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedOptionIndex(idx)}
                        style={{
                          background: selectedOptionIndex === idx ? 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)' : 'rgba(255,255,255,0.08)',
                          border: '1px solid var(--border-color)',
                          color: '#fff',
                          padding: '0.45rem 0.9rem',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          fontWeight: selectedOptionIndex === idx ? '700' : '400'
                        }}
                      >
                        Opción {idx + 1} ({opt.format || 'HLS'})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons: Web Video Caster & Web Direct */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', margin: '1.25rem 0' }}>
                {activeStreamUrl && (
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
                    onClick={() => castWithWebVideoCaster(activeStreamUrl, selectedChannel.name)}
                  >
                    📱 Transmitir a TV (Web Video Caster)
                  </button>
                )}

                {selectedChannel.web && (
                  <a
                    href={selectedChannel.web}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-hero-info"
                    style={{ padding: '0.75rem 1.25rem', borderRadius: '12px', fontSize: '0.9rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    🌐 Sitio Oficial del Canal
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
