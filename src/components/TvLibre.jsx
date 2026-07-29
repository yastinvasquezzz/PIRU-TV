import React, { useState, useEffect, useMemo } from 'react';
import useDpadNavigation from '../hooks/useDpadNavigation';
import { saveWatchProgress, toggleFavorite, isFavorite } from '../utils/storage';
import { castWithWebVideoCaster } from '../utils/wvcCast';
import localSportsData from '../data/sports_events.json';

const SPORTS_CATEGORIES = [
  '🔥 TODOS',
  '⚽ FOOTBALL',
  '⚾ BASEBALL',
  '🥊 BOXING',
  '🏀 BASKETBALL',
  '🎾 TENNIS',
  '🚴 CYCLING',
  '🏎️ MOTOR',
  '🥋 MMA / UFC'
];

export default function TvLibre() {
  const [events, setEvents] = useState(localSportsData);
  const [activeCategory, setActiveCategory] = useState('🔥 TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedServerIndex, setSelectedServerIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState('live1'); // 'live1' (manual), 'live2' (auto)

  // Fetch live sports agenda from streamx-hd.com on mount
  useEffect(() => {
    async function fetchLiveAgenda() {
      try {
        const res = await fetch(`https://streamx-hd.com/eventos.json?nocache=${Date.now()}`);
        if (res.ok) {
          const raw = await res.json();
          const parsed = [];

          if (raw.sports && Array.isArray(raw.sports)) {
            raw.sports.forEach(sport => {
              const sportName = sport.name || 'Football';
              const sportIcon = sport.icon || '⚽';

              if (sport.leagues && Array.isArray(sport.leagues)) {
                sport.leagues.forEach(league => {
                  const leagueName = league.name || 'Liga';

                  if (league.events && Array.isArray(league.events)) {
                    league.events.forEach(ev => {
                      const home = ev.homeTeam || ev.title || 'Equipo A';
                      const away = ev.awayTeam || '';
                      const homeLogo = ev.homeLogo || '';
                      const awayLogo = ev.awayLogo || '';

                      const servers = (ev.servers || []).map(s => {
                        let streamParam = 'claro1';
                        if (s.url) {
                          const match = s.url.match(/stream=([^&]+)/);
                          if (match) streamParam = match[1];
                        }
                        return {
                          name: s.name || 'Servidor HD',
                          stream: streamParam,
                          live1Url: `https://streamx-hd.com/live1.php?stream=${streamParam}`,
                          live2Url: `https://streamx-hd.com/live2.php?stream=${streamParam}`
                        };
                      });

                      if (servers.length === 0) {
                        servers.push({
                          name: 'Servidor Principal',
                          stream: 'claro1',
                          live1Url: 'https://streamx-hd.com/live1.php?stream=claro1',
                          live2Url: 'https://streamx-hd.com/live2.php?stream=claro1'
                        });
                      }

                      const isLive = ev.status?.toUpperCase() === 'EN VIVO' || !ev.status;

                      parsed.push({
                        id: `hd-${parsed.length + 1}`,
                        title: ev.title || `${home} vs ${away}`,
                        homeTeam: home,
                        awayTeam: away,
                        homeLogo: homeLogo,
                        awayLogo: awayLogo,
                        league: leagueName,
                        category: sportName.toUpperCase(),
                        icon: sportIcon,
                        time: ev.time ? ev.time.split(' ')[1] || ev.time : '04:45',
                        date: ev.time ? ev.time.split(' ')[0] || 'Hoy' : 'Hoy',
                        isLive: isLive,
                        status: isLive ? '🔴 EN VIVO' : '🕒 PRONTO',
                        servers: servers
                      });
                    });
                  }
                });
              }
            });
          }

          if (parsed.length > 0) {
            setEvents(parsed);
          }
        }
      } catch (e) {
        console.log('Using cached streamx-hd dataset:', e.message);
      }
    }

    fetchLiveAgenda();
  }, []);

  // Filter events by category and search
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      let matchCat = true;
      if (activeCategory !== '🔥 TODOS') {
        const catClean = activeCategory.replace(/[^A-Z]/g, '').trim();
        matchCat = e.category.includes(catClean) || activeCategory.toLowerCase().includes(e.category.toLowerCase());
      }

      const matchSearch = !searchTerm.trim() ||
        e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.homeTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.awayTeam.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.league.toLowerCase().includes(searchTerm.toLowerCase());

      return matchCat && matchSearch;
    });
  }, [events, activeCategory, searchTerm]);

  // Featured live event for top Hero banner
  const featuredLiveEvent = useMemo(() => {
    return events.find(e => e.isLive) || events[0];
  }, [events]);

  const handleOpenEvent = (eventItem, serverIdx = 0) => {
    setSelectedEvent(eventItem);
    setSelectedServerIndex(serverIdx);
    setIsPlaying(true);
    saveWatchProgress({
      id: eventItem.id,
      titulo: eventItem.title,
      portada: eventItem.homeLogo || 'https://cdn-icons-png.flaticon.com/512/747/747965.png',
      type: 'live_sports'
    });
  };

  // Embed Stream URL
  const embedUrl = useMemo(() => {
    if (!selectedEvent || !selectedEvent.servers || selectedEvent.servers.length === 0) return '';
    const activeServer = selectedEvent.servers[selectedServerIndex] || selectedEvent.servers[0];
    const streamParam = activeServer.stream || 'claro1';

    if (playbackMode === 'live2') {
      return `https://streamx-hd.com/live2.php?stream=${streamParam}`;
    }
    return `https://streamx-hd.com/live1.php?stream=${streamParam}`;
  }, [selectedEvent, selectedServerIndex, playbackMode]);

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
            ⚽ PIRU-TV DEPORTES EN VIVO (streamx-hd.com)
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.3rem' }}>
            Centro de eventos deportivos con escudos de equipos, señales HD y reproductores iframe integrados
          </p>
        </div>

        <div className="search-container" style={{ width: '340px' }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar partido, equipo o liga (ej. Tottenham, Dortmund)..."
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

      {/* Featured Live Event Banner with Team Logos */}
      {!searchTerm.trim() && featuredLiveEvent && (
        <div 
          className="hero-banner"
          style={{
            position: 'relative',
            minHeight: '340px',
            borderRadius: '24px',
            overflow: 'hidden',
            marginBottom: '2.5rem',
            background: 'linear-gradient(135deg, #0e1117 0%, #161b22 100%)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.85)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2.5rem 3.5rem',
            flexWrap: 'wrap',
            gap: '2rem'
          }}
        >
          {/* Left Text & Details */}
          <div style={{ maxWidth: '560px', zIndex: 5 }}>
            <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ background: '#ef4444', color: '#ffffff', fontSize: '0.75rem', fontWeight: 900, padding: '4px 12px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 0 15px rgba(239, 68, 68, 0.6)' }}>
                <span className="pulse-dot" style={{ background: '#fff' }} /> 🔴 EN VIVO AHORA
              </span>
              <span style={{ background: 'rgba(255,255,255,0.12)', color: '#86efac', fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '8px' }}>
                {featuredLiveEvent.league} • {featuredLiveEvent.time}
              </span>
            </div>

            <h2 style={{ fontSize: '2.4rem', fontWeight: 900, color: '#ffffff', margin: '0 0 0.8rem 0', lineHeight: 1.15, textShadow: '0 4px 20px rgba(0,0,0,0.9)' }}>
              {featuredLiveEvent.title}
            </h2>

            <p style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 1.5rem 0' }}>
              Servidores disponibles: <strong style={{ color: '#f87171' }}>{featuredLiveEvent.servers.map(s => s.name).join(' • ')}</strong>. Disfruta de la transmisión deportiva en vivo en alta definición.
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
              onClick={() => handleOpenEvent(featuredLiveEvent, 0)}
            >
              <span>▶</span> VER TRANSMISIÓN EN VIVO
            </button>
          </div>

          {/* Right Team Logos VS Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', background: 'rgba(0,0,0,0.3)', padding: '1.5rem 2.5rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ textAlign: 'center', width: '110px' }}>
              <img
                src={featuredLiveEvent.homeLogo || 'https://cdn-icons-png.flaticon.com/512/747/747965.png'}
                alt={featuredLiveEvent.homeTeam}
                style={{ width: '80px', height: '80px', objectFit: 'contain', filter: 'drop-shadow(0 5px 15px rgba(0,0,0,0.8))' }}
                onError={(e) => { e.target.src = 'https://cdn-icons-png.flaticon.com/512/747/747965.png'; }}
              />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', display: 'block', marginTop: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {featuredLiveEvent.homeTeam}
              </span>
            </div>

            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ef4444', textShadow: '0 0 10px rgba(239,68,68,0.8)' }}>
              VS
            </span>

            <div style={{ textAlign: 'center', width: '110px' }}>
              <img
                src={featuredLiveEvent.awayLogo || 'https://cdn-icons-png.flaticon.com/512/747/747965.png'}
                alt={featuredLiveEvent.awayTeam}
                style={{ width: '80px', height: '80px', objectFit: 'contain', filter: 'drop-shadow(0 5px 15px rgba(0,0,0,0.8))' }}
                onError={(e) => { e.target.src = 'https://cdn-icons-png.flaticon.com/512/747/747965.png'; }}
              />
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', display: 'block', marginTop: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {featuredLiveEvent.awayTeam || 'Rival'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid Events Cards with VS Layout & Team Logos */}
      <div className="section-header" style={{ marginBottom: '1.25rem' }}>
        <h2 className="section-title" style={{ fontSize: '1.3rem', color: '#ffffff', margin: 0 }}>
          ⚽ Agenda de Transmisiones ({filteredEvents.length} Eventos)
        </h2>
      </div>

      <div className="media-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {filteredEvents.length > 0 ? (
          filteredEvents.map(eventItem => (
            <div
              key={eventItem.id}
              className="media-card"
              onClick={() => handleOpenEvent(eventItem, 0)}
              style={{
                position: 'relative',
                textAlign: 'left',
                cursor: 'pointer',
                background: 'rgba(20, 20, 32, 0.7)',
                borderRadius: '20px',
                border: `1px solid ${eventItem.isLive ? 'rgba(239, 68, 68, 0.45)' : 'rgba(255,255,255,0.08)'}`,
                padding: '1.25rem',
                transition: 'transform 0.25s ease, border-color 0.25s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: eventItem.isLive ? '0 6px 25px rgba(239, 68, 68, 0.2)' : 'none'
              }}
            >
              {/* Event Top Pills */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <span style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#60a5fa', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px' }}>
                    {eventItem.league}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 700 }}>
                    ⏰ {eventItem.time}
                  </span>
                </div>

                <span style={{
                  background: eventItem.isLive ? '#ef4444' : 'rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 900,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  boxShadow: eventItem.isLive ? '0 0 10px rgba(239, 68, 68, 0.5)' : 'none'
                }}>
                  {eventItem.isLive ? '🔴 EN VIVO' : 'PRONTO'}
                </span>
              </div>

              {/* Team Logos VS Layout (Matching streamx-hd.com Reference) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0.5rem 0' }}>
                {/* Home Team */}
                <div style={{ textAlign: 'center', width: '90px' }}>
                  <img
                    src={eventItem.homeLogo || 'https://cdn-icons-png.flaticon.com/512/747/747965.png'}
                    alt={eventItem.homeTeam}
                    style={{ width: '56px', height: '56px', objectFit: 'contain' }}
                    onError={(e) => { e.target.src = 'https://cdn-icons-png.flaticon.com/512/747/747965.png'; }}
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', display: 'block', marginTop: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {eventItem.homeTeam}
                  </span>
                </div>

                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ef4444' }}>VS</span>

                {/* Away Team */}
                <div style={{ textAlign: 'center', width: '90px' }}>
                  <img
                    src={eventItem.awayLogo || 'https://cdn-icons-png.flaticon.com/512/747/747965.png'}
                    alt={eventItem.awayTeam}
                    style={{ width: '56px', height: '56px', objectFit: 'contain' }}
                    onError={(e) => { e.target.src = 'https://cdn-icons-png.flaticon.com/512/747/747965.png'; }}
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', display: 'block', marginTop: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {eventItem.awayTeam || 'Rival'}
                  </span>
                </div>
              </div>

              {/* Available Servers Chips */}
              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>
                  SERVIDORES DISPONIBLES:
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {eventItem.servers.map((s, idx) => (
                    <button
                      key={s.name + idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEvent(eventItem, idx);
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
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

      {/* Video Streaming Modal Player */}
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
                  TRANSMISIÓN: {selectedEvent.title} ({selectedEvent.servers[selectedServerIndex]?.name || 'Servidor HD'})
                </span>
              </div>
              <div className="server-selector" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
                {selectedEvent.servers.map((s, idx) => (
                  <button 
                    key={s.name + idx}
                    className={`server-btn ${selectedServerIndex === idx ? 'active' : ''}`}
                    onClick={() => setSelectedServerIndex(idx)}
                  >
                    {s.name}
                  </button>
                ))}
                <button 
                  className={`server-btn ${playbackMode === 'live1' ? 'active' : ''}`}
                  onClick={() => setPlaybackMode('live1')}
                  style={{ background: playbackMode === 'live1' ? '#e50914' : 'rgba(255,255,255,0.1)' }}
                >
                  Live1 (Manual)
                </button>
                <button 
                  className={`server-btn ${playbackMode === 'live2' ? 'active' : ''}`}
                  onClick={() => setPlaybackMode('live2')}
                  style={{ background: playbackMode === 'live2' ? '#e50914' : 'rgba(255,255,255,0.1)' }}
                >
                  Live2 (Auto)
                </button>
              </div>
            </div>

            {/* Modal Body & Action Buttons */}
            <div className="modal-body">
              <div className="modal-meta">
                <span className="modal-genre" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                  🔴 EN VIVO • {selectedEvent.league}
                </span>
                <span className="modal-lang">⏰ Hora: {selectedEvent.time}</span>
                <span className="modal-lang">⚽ {selectedEvent.category}</span>
              </div>
              <h2 className="modal-title">{selectedEvent.title}</h2>
              <p className="modal-summary">
                Transmisión deportiva en vivo HD integrada de streamx-hd.com. Disfruta del encuentro entre {selectedEvent.homeTeam} vs {selectedEvent.awayTeam || 'su rival'}.
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
