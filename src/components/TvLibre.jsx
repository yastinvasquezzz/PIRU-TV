import React, { useState, useEffect, useRef, useMemo } from 'react';
import Hls from 'hls.js';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import latinAmericaChannels from '../data/latin_america_iptv.json';

const PRESET_PLAYLISTS = [
  { name: '🌎 Latin America IPTV', url: 'https://iptv-org.github.io/iptv/index.m3u' },
  { name: '📺 Televisión Abierta TDT', url: 'https://www.tdtchannels.com/lists/tv.m3u8' },
  { name: '📻 Radios TDT', url: 'https://www.tdtchannels.com/lists/radio.m3u8' }
];

export default function TvLibre() {
  const [playlistUrl, setPlaylistUrl] = useState(PRESET_PLAYLISTS[0].url);
  const [channels, setChannels] = useState(latinAmericaChannels);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChannel, setSelectedChannel] = useState(latinAmericaChannels[0] || null);
  const [useProxy, setUseProxy] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRef = useRef(null);

  // Parse M3U text into channel objects
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
          id: 'ch-' + (list.length + 1),
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

  // Load Playlist URL
  const loadPlaylist = async (urlToLoad) => {
    if (!urlToLoad) return;
    setLoading(true);
    setPlaylistUrl(urlToLoad);

    try {
      // Try direct fetch or CORS proxy fallback
      let fetchUrl = urlToLoad;
      let res = await fetch(fetchUrl).catch(() => null);

      if (!res || !res.ok) {
        fetchUrl = `https://corsproxy.io/?url=${encodeURIComponent(urlToLoad)}`;
        res = await fetch(fetchUrl).catch(() => null);
      }

      if (res && res.ok) {
        const text = await res.text();
        const parsed = parseM3UText(text);

        // Filter for Latin America if loading default index.m3u
        let finalChannels = parsed;
        if (urlToLoad.includes('iptv-org')) {
          const filteredLatam = parsed.filter(ch => 
            ch.name.toLowerCase().includes('latin america') || 
            ch.name.toLowerCase().includes('latam') ||
            ch.name.toLowerCase().includes('(latino)') ||
            ch.group.toLowerCase().includes('latin america')
          );
          if (filteredLatam.length > 0) finalChannels = filteredLatam;
        }

        if (finalChannels.length > 0) {
          setChannels(finalChannels);
          setSelectedChannel(finalChannels[0]);
        }
      }
    } catch (e) {
      console.error('Error loading playlist:', e);
    } finally {
      setLoading(false);
    }
  };

  // Filter channels by search
  const filteredChannels = useMemo(() => {
    if (!searchTerm.trim()) return channels;
    return channels.filter(ch => 
      ch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ch.group.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [channels, searchTerm]);

  // Clean stream URL (HTTP upgrade + Proxy fallback)
  const activeStreamUrl = useMemo(() => {
    if (!selectedChannel || !selectedChannel.url) return '';
    let url = selectedChannel.url.trim();
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    if (useProxy) {
      return `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
    }
    return url;
  }, [selectedChannel, useProxy]);

  // Attach HLS stream to video player
  useEffect(() => {
    let hlsInstance = null;
    setPlayerError(false);
    setIsPlaying(false);
    setUseProxy(false);

    const videoElement = videoRef.current;
    if (!videoElement || !activeStreamUrl) return;

    const handleSuccess = () => {
      setPlayerError(false);
      setIsPlaying(true);
    };

    const handleError = () => {
      if (!useProxy && !activeStreamUrl.includes('corsproxy')) {
        setUseProxy(true); // Retry with proxy
      } else {
        setPlayerError(true);
        setIsPlaying(false);
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
  }, [activeStreamUrl]);

  useDpadNavigation();

  return (
    <div className="iptv-player-page" style={{ padding: '0.5rem 0 3rem' }}>
      {/* Header */}
      <div className="category-header">
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>
            📺 Reproductor IPTV M3U
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.3rem' }}>
            Reproduce cualquier lista M3U / M3U8 en vivo o elige una lista predeterminada
          </p>
        </div>
      </div>

      {/* Preset Playlist Selector & Custom URL Box */}
      <div style={{ background: 'rgba(20, 20, 32, 0.7)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '1.25rem', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {PRESET_PLAYLISTS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => loadPlaylist(preset.url)}
              style={{
                background: playlistUrl === preset.url ? 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)' : 'rgba(255,255,255,0.08)',
                border: '1px solid var(--border-color)',
                color: '#fff',
                padding: '0.55rem 1.1rem',
                borderRadius: '12px',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Custom M3U URL Input */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            placeholder="Pegar enlace de lista M3U (ej. https://.../playlist.m3u)"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid var(--border-color)',
              color: '#fff',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              fontSize: '0.9rem'
            }}
          />
          <button
            type="button"
            onClick={() => loadPlaylist(playlistUrl)}
            style={{
              background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
              border: 'none',
              color: '#fff',
              padding: '0.75rem 1.5rem',
              borderRadius: '12px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {loading ? 'Cargando...' : '▶ Cargar M3U'}
          </button>
        </div>
      </div>

      {/* Main Layout: Left Channel Sidebar + Right Main Player */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '1.5rem', minHeight: '520px' }}>
        
        {/* Sidebar Channel List */}
        <div style={{ background: 'rgba(20, 20, 32, 0.7)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '1rem', display: 'flex', flexDirection: 'column', height: '560px' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
              📋 Canales ({filteredChannels.length}):
            </span>
            <input
              type="text"
              placeholder="🔍 Filtrar canal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-color)',
                color: '#fff',
                padding: '0.5rem 0.8rem',
                borderRadius: '10px',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '0.2rem' }}>
            {filteredChannels.map((ch) => {
              const isSelected = selectedChannel?.id === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedChannel(ch)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    background: isSelected ? 'linear-gradient(135deg, rgba(229,9,20,0.3) 0%, rgba(185,28,28,0.2) 100%)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isSelected ? '#e50914' : 'transparent'}`,
                    borderRadius: '12px',
                    color: '#fff',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <img
                    src={ch.logo}
                    alt=""
                    style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', padding: '2px' }}
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/32?text=TV'; }}
                  />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: isSelected ? 800 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ch.name}
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: isSelected ? '#fca5a5' : 'var(--text-secondary)' }}>
                      {ch.group || 'IPTV'}
                    </span>
                  </div>
                  {isSelected && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>🔴</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Video Display Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: '#000', borderRadius: '20px', height: '440px', position: 'relative', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}>
            {playerError ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📺</div>
                <h3 style={{ margin: '0 0 0.5rem 0' }}>Señal con Restricción de Origen</h3>
                <p style={{ fontSize: '0.88rem', color: '#aaa', maxWidth: '400px', marginBottom: '1.25rem' }}>
                  Este canal requiere reproductor directo o transmisión a Smart TV con Web Video Caster.
                </p>
                {selectedChannel && (
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 800 }}
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

          {/* Active Channel Details & WVC Cast Bar */}
          {selectedChannel && (
            <div style={{ background: 'rgba(20, 20, 32, 0.7)', border: '1px solid var(--border-color)', borderRadius: '18px', padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <img src={selectedChannel.logo} alt="" style={{ width: '42px', height: '42px', objectFit: 'contain', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', padding: '3px' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                    {selectedChannel.name}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#86efac', fontWeight: 600 }}>
                    🔴 EN VIVO M3U • {selectedChannel.group || 'Latin America'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="btn-primary"
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
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
          )}
        </div>

      </div>
    </div>
  );
}
