import React, { useState, useEffect, useRef, useMemo } from 'react';
import Hls from 'hls.js';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import latinAmericaChannels from '../data/latin_america_iptv.json';

export default function TvLibre() {
  const [channels] = useState(latinAmericaChannels);
  const [selectedChannel, setSelectedChannel] = useState(latinAmericaChannels[0] || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeGroup, setActiveGroup] = useState('All');
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [useProxy, setUseProxy] = useState(false);

  const videoRef = useRef(null);

  // Group channels by Category
  const groupedChannels = useMemo(() => {
    const groups = {};
    channels.forEach(ch => {
      const g = ch.ambit || 'General';
      if (!groups[g]) groups[g] = [];
      groups[g].push(ch);
    });
    return groups;
  }, [channels]);

  // Filter channels by search and active group
  const filteredChannels = useMemo(() => {
    return channels.filter(ch => {
      const matchGroup = activeGroup === 'All' || ch.ambit === activeGroup;
      const matchSearch = !searchTerm.trim() || 
        ch.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        ch.ambit.toLowerCase().includes(searchTerm.toLowerCase());
      return matchGroup && matchSearch;
    });
  }, [channels, activeGroup, searchTerm]);

  // Stream URL processing (routes through Cloudflare Worker proxy for 100% CORS bypass)
  const cleanUrl = useMemo(() => {
    if (!selectedChannel || !selectedChannel.url) return '';
    let url = selectedChannel.url.trim();
    const cfProxy = 'https://pirutv-proxy.skillful-part.workers.dev';
    return `${cfProxy}?url=${encodeURIComponent(url)}`;
  }, [selectedChannel]);

  // Attach HLS stream to video player
  useEffect(() => {
    let hlsInstance = null;
    setHasError(false);
    setIsPlaying(false);

    const videoElement = videoRef.current;
    if (!videoElement || !cleanUrl) return;

    const handleSuccess = () => {
      setHasError(false);
      setIsPlaying(true);
    };

    const handleError = () => {
      if (!useProxy && !cleanUrl.includes('corsproxy')) {
        setUseProxy(true); // Retry with proxy
      } else {
        setHasError(true);
        setIsPlaying(false);
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
        manifestLoadingTimeOut: 6000,
        manifestLoadingMaxRetry: 2,
        xhrSetup: function (xhr) {
          xhr.withCredentials = false;
        }
      });
      hlsInstance.loadSource(cleanUrl);
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
      videoElement.src = cleanUrl;
      videoElement.play().then(handleSuccess).catch(handleError);
    }

    return () => {
      if (hlsInstance) hlsInstance.destroy();
    };
  }, [cleanUrl, useProxy]);

  useDpadNavigation();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '1rem', minHeight: 'calc(100vh - 120px)', padding: '0.5rem 0 2rem' }}>
      
      {/* Sidebar matching Chrome Extension IPTV Player */}
      <div style={{ background: '#0e0e12', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
        
        {/* Search Input */}
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="🔍 Search channels..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              background: '#18181f',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              padding: '0.65rem 0.9rem',
              borderRadius: '10px',
              fontSize: '0.88rem'
            }}
          />
        </div>

        {/* Channels Count & Category Badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
          <span>{filteredChannels.length} CHANNELS</span>
          <button
            type="button"
            onClick={() => setActiveGroup('All')}
            style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.78rem' }}
          >
            Show All
          </button>
        </div>

        {/* Group Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.75rem', scrollbarWidth: 'none' }}>
          {['All', ...Object.keys(groupedChannels)].map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveGroup(cat)}
              style={{
                background: activeGroup === cat ? '#e50914' : 'rgba(255,255,255,0.06)',
                border: 'none',
                color: '#fff',
                padding: '0.3rem 0.7rem',
                borderRadius: '12px',
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

        {/* Channel Items List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingRight: '0.2rem' }}>
          {filteredChannels.map(ch => {
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
                  padding: '0.6rem 0.8rem',
                  background: isSelected ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? '#e50914' : 'transparent'}`,
                  borderRadius: '10px',
                  color: isSelected ? '#fff' : '#cbd5e1',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
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
                    {ch.ambit}
                  </span>
                </div>
                {isSelected && <span style={{ fontSize: '0.65rem', background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>LIVE</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main IPTV Video Canvas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Active Title Overlay */}
        {selectedChannel && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0e0e12', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '0.85rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img src={selectedChannel.logo} alt="" style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '6px' }} />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                  {selectedChannel.name}
                </h2>
                <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  🔴 LIVE • {selectedChannel.country}
                </span>
              </div>
            </div>

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
        )}

        {/* Video Canvas Container */}
        <div style={{ background: '#000', borderRadius: '18px', height: 'calc(100vh - 240px)', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.9)' }}>
          {hasError ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'linear-gradient(135deg, rgba(20,20,32,0.98), rgba(10,10,18,0.99))' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>📺</div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-title)', fontSize: '1.25rem' }}>
                Señal Restringida por Navegador
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#cbd5e1', maxWidth: '420px', lineHeight: '1.5', marginBottom: '1.25rem' }}>
                Este enlace de streaming requiere reproductor directo. Transmítelo sin restricciones a tu Smart TV mediante <strong>Web Video Caster</strong>.
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
  );
}
