import React, { useState, useEffect, useMemo } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { saveWatchProgress, toggleFavorite, isFavorite } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import localSportsData from '../data/sports_events.json';

const SPORTS_CATEGORIES = [
  '🔥 Todos los Eventos',
  '🔴 En Vivo Ahora',
  '⚽ Fútbol',
  '🎾 Tenis',
  '🏀 Básquet',
  '🏎️ Motor'
];

export default function TvLibre() {
  const [events, setEvents] = useState(localSportsData);
  const [activeCategory, setActiveCategory] = useState('🔥 Todos los Eventos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedServer, setSelectedServer] = useState('global1'); // 'global1', 'global2'
  const [isLoadingLive, setIsLoadingLive] = useState(false);

  // Fetch live sports agenda from streamx488.sbs on mount
  useEffect(() => {
    async function fetchLiveAgenda() {
      setIsLoadingLive(true);
      try {
        const res = await fetch(`https://streamx488.sbs/json/agenda550.json?nocache=${Date.now()}`);
        if (res.ok) {
          const liveData = await res.json();
          const formatted = liveData.map((e, idx) => {
            let channelName = 'deportes1';
            if (e.link) {
              const match = e.link.match(/channel=([^"&' >]+)/);
              if (match) channelName = match[1];
            }
            const isLive = e.status?.toLowerCase().includes('vivo') || e.status === 'En vivo';
            return {
              id: `sport-${idx + 1}`,
              title: e.title,
              time: e.time || '12:00',
              date: e.date || 'Hoy',
              category: e.category || 'Fútbol',
              status: isLive ? 'En vivo' : (e.status || 'Pronto'),
              isLive: isLive,
              channel: channelName,
              global1: `https://streamx488.sbs/global1.php?channel=${channelName}`,
              global2: `https://streamx488.sbs/global2.php?channel=${channelName}`
            };
          });

          // Sort: En vivo first
          formatted.sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0));
          setEvents(formatted);

          // Auto-select first live event if available
          if (formatted.length > 0) {
            const firstLive = formatted.find(e => e.isLive) || formatted[0];
            setSelectedEvent(firstLive);
          }
        }
      } catch (e) {
        console.log('Using cached sports dataset due to CORS/Network:', e.message);
      } finally {
        setIsLoadingLive(false);
      }
    }

    fetchLiveAgenda();
  }, []);

  // Filter events by category and search
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      let matchCat = true;
      if (activeCategory === '🔴 En Vivo Ahora') {
        matchCat = e.isLive;
      } else if (activeCategory === '⚽ Fútbol') {
        matchCat = e.category === 'Fútbol';
      } else if (activeCategory === '🎾 Tenis') {
        matchCat = e.category === 'Tenis';
      } else if (activeCategory === '🏀 Básquet') {
        matchCat = e.category === 'Básquetbol';
      } else if (activeCategory === '🏎️ Motor') {
        matchCat = e.category === 'Motor';
      }

      const matchSearch = !searchTerm.trim() ||
        e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.channel.toLowerCase().includes(searchTerm.toLowerCase());

      return matchCat && matchSearch;
    });
  }, [events, activeCategory, searchTerm]);

  // Main featured live event for top Hero banner
  const featuredLiveEvent = useMemo(() => {
    return events.find(e => e.isLive) || events[0];
  }, [events]);

  const handleOpenEvent = (eventItem) => {
    setSelectedEvent(eventItem);
    setIsPlaying(true);
    saveWatchProgress({
      id: eventItem.id,
      titulo: eventItem.title,
      portada: 'https://cdn-icons-png.flaticon.com/512/747/747965.png',
      type: 'live_sports'
    });
  };

  // Embed stream URL
  const embedUrl = useMemo(() => {
    if (!selectedEvent) return '';
    if (selectedServer === 'global1') {
      return `https://streamx488.sbs/global1.php?channel=${selectedEvent.channel}`;
    }
    return `https://streamx488.sbs/global2.php?channel=${selectedEvent.channel}`;
  }, [selectedEvent, selectedServer]);

  useDpadNavigation({
    onBack: () => {
      if (isPlaying) {
        setIsPlaying(false);
      }
    }
  });

  return (
    <div className="sports-hub-container" style={{ padding: '0.5rem 0 3rem' }}>
      
      {/* Header section with search */}
      <div className="category-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="section-title" style={{ margin: 0, fontSize: '1.75rem', color: '#ffffff', letterSpacing: '-0.5px' }}>
            ⚽ PIRU-TV DEPORTES EN VIVO ({events.length} Transmisiones)
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.3rem' }}>
            Eventos deportivos en vivo integrados directamente desde streamx488.sbs
          </p>
        </div>

        <div className="search-container" style={{ width: '340px' }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar evento (ej. Tottenham, Barracas, ESPN)..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="filters-wrapper" style={{ margin: '0 0 1.75rem 0', display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
        {SPORTS_CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            className={`filter-badge ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
            style={{
              background: activeCategory === cat ? 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)' : 'rgba(255,255,255,0.06)',
              borderColor: activeCategory === cat ? '#e50914' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              whiteSpace: 'nowrap'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Featured Live Event Banner */}
      {!searchTerm.trim() && featuredLiveEvent && (
        <div 
          className="hero-banner"
          style={{
            position: 'relative',
            height: '360px',
            borderRadius: '24px',
            overflow: 'hidden',
            marginBottom: '2.5rem',
            background: 'linear-gradient(135deg, #0e1117 0%, #161b22 100%)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.85)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            padding: '3rem'
          }}
        >
          <div style={{ maxWidth: '650px', zIndex: 5 }}>
            <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.8rem', alignItems: 'center' }}>
              <span style={{ background: '#ef4444', color: '#ffffff', fontSize: '0.75rem', fontWeight: 900, padding: '4px 12px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 0 15px rgba(239, 68, 68, 0.6)' }}>
                <span className="pulse-dot" style={{ background: '#fff' }} /> 🔴 EN VIVO AHORA
              </span>
              <span style={{ background: 'rgba(255,255,255,0.12)', color: '#86efac', fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '8px' }}>
                {featuredLiveEvent.category} • {featuredLiveEvent.time}
              </span>
            </div>

            <h2 style={{ fontSize: '2.3rem', fontWeight: 900, color: '#ffffff', margin: '0 0 0.8rem 0', lineHeight: 1.15, textShadow: '0 4px 20px rgba(0,0,0,0.9)' }}>
              {featuredLiveEvent.title}
            </h2>

            <p style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 1.5rem 0' }}>
              Canal Oficial: <strong style={{ color: '#f87171' }}>{featuredLiveEvent.channel.toUpperCase()}</strong>. Disfruta de la transmisión deportiva en vivo directamente en PIRU-TV sin anuncios molestos.
            </p>

            <button
              type="button"
              className="btn-primary"
              style={{
                padding: '0.85rem 1.8rem',
                fontSize: '1rem',
                fontWeight: 900,
                background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)',
                border: 'none',
                color: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 6px 25px rgba(229, 9, 20, 0.55)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem'
              }}
              onClick={() => handleOpenEvent(featuredLiveEvent)}
            >
              <span>▶</span> VER TRANSMISIÓN EN VIVO
            </button>
          </div>
        </div>
      )}

      {/* Main Grid Events Cards */}
      <div className="section-header" style={{ marginBottom: '1.25rem' }}>
        <h2 className="section-title" style={{ fontSize: '1.3rem', color: '#ffffff', margin: 0 }}>
          ⚽ Transmisiones Disponibles ({filteredEvents.length})
        </h2>
      </div>

      <div className="media-grid">
        {filteredEvents.length > 0 ? (
          filteredEvents.map(eventItem => (
            <div
              key={eventItem.id}
              className="media-card"
              onClick={() => handleOpenEvent(eventItem)}
              style={{
                position: 'relative',
                textAlign: 'left',
                cursor: 'pointer',
                background: 'rgba(20, 20, 32, 0.7)',
                borderRadius: '18px',
                border: `1px solid ${eventItem.isLive ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.08)'}`,
                padding: '1rem',
                transition: 'transform 0.25s ease, border-color 0.25s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.8rem',
                boxShadow: eventItem.isLive ? '0 4px 20px rgba(239, 68, 68, 0.2)' : 'none'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span style={{
                    background: eventItem.isLive ? '#ef4444' : 'rgba(59, 130, 246, 0.25)',
                    border: `1px solid ${eventItem.isLive ? '#ef4444' : 'rgba(59, 130, 246, 0.5)'}`,
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {eventItem.isLive ? '🔴 En vivo' : '🕒 Pronto'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>
                    ⏰ {eventItem.time}
                  </span>
                </div>

                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.4rem 0', color: '#ffffff', lineHeight: '1.35', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {eventItem.title}
                </h3>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: '0.75rem', color: '#86efac', fontWeight: 700 }}>
                  📺 {eventItem.channel.toUpperCase()}
                </span>
                <span style={{ background: 'linear-gradient(135deg, #e50914 0%, #b91c1c 100%)', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '4px 10px', borderRadius: '8px' }}>
                  ▶ REPRODUCIR
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '4rem 2rem', textAlign: 'center' }}>
            <span className="empty-icon">⚽</span>
            <h3 className="empty-title">No se encontraron eventos deportivos</h3>
            <p>Prueba buscando con otro término de búsqueda.</p>
          </div>
        )}
      </div>

      {/* Modal Detail & Video Streaming Player */}
      {selectedEvent && isPlaying && (
        <div className="modal-overlay" onClick={() => setIsPlaying(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '960px' }}>
            <button className="modal-close-btn" onClick={() => setIsPlaying(false)}>✕</button>

            {/* Movie Player Container with EXACT Peliculas.jsx CSS classes */}
            <div className="movie-player-container">
              <iframe
                src={embedUrl}
                className="player-iframe"
                title={selectedEvent.title}
                allowFullScreen
                allow="autoplay; encrypted-media"
              />
            </div>

            {/* Server Selector Bar when Playing */}
            <div className="player-header">
              <div className="player-title-info">
                <span className="pulse-dot" style={{ background: '#ef4444' }}></span>
                <span>
                  TRANSMISIÓN EN VIVO: {selectedEvent.title} ({selectedEvent.channel.toUpperCase()})
                </span>
              </div>
              <div className="server-selector">
                <button 
                  className={`server-btn ${selectedServer === 'global1' ? 'active' : ''}`}
                  onClick={() => setSelectedServer('global1')}
                >
                  Global 1 (Manual)
                </button>
                <button 
                  className={`server-btn ${selectedServer === 'global2' ? 'active' : ''}`}
                  onClick={() => setSelectedServer('global2')}
                >
                  Global 2 (Auto)
                </button>
              </div>
            </div>

            {/* Modal Body & Action Buttons */}
            <div className="modal-body">
              <div className="modal-meta">
                <span className="modal-genre" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                  🔴 EN VIVO • {selectedEvent.category}
                </span>
                <span className="modal-lang">⏰ Hora: {selectedEvent.time}</span>
                <span className="modal-lang">📺 Canal: {selectedEvent.channel.toUpperCase()}</span>
              </div>
              <h2 className="modal-title">{selectedEvent.title}</h2>
              <p className="modal-summary">
                Transmisión deportiva en vivo HD integrada de streamx488.sbs. Disfruta del partido directamente en PIRU-TV.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', margin: '1.25rem 0' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    flex: 'none',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem',
                    background: isFavorite(selectedEvent.id) ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    border: `1px solid ${isFavorite(selectedEvent.id) ? '#ef4444' : 'rgba(255, 255, 255, 0.2)'}`,
                    color: isFavorite(selectedEvent.id) ? '#fca5a5' : '#fff'
                  }}
                  onClick={async () => {
                    await toggleFavorite(selectedEvent);
                    setSelectedEvent({ ...selectedEvent });
                  }}
                >
                  {isFavorite(selectedEvent.id) ? '❤️ En Mi Lista' : '🤍 Agregar a Mi Lista'}
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    flex: 'none',
                    padding: '0.75rem 1.5rem',
                    fontSize: '0.95rem',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    color: '#ffffff',
                    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.45)'
                  }}
                  onClick={() => {
                    castWithWebVideoCaster(embedUrl, selectedEvent.title);
                  }}
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
