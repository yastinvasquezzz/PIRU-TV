import React, { useState, useMemo, useEffect, useRef } from 'react';

/* --- Curated Data --- */

const CURATED_STREAMS = [
  {
    name: "DW Español (Alemania)",
    genre: "Noticias",
    logo: "https://upload.wikimedia.org/wikipedia/commons/d/d1/Deutsche_Welle_logo.svg",
    url: "https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/index.m3u8"
  },
  {
    name: "TeleSUR (Latinoamérica)",
    genre: "Noticias",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/2f/Telesur_logo.svg",
    url: "https://telesur-live.akamaized.net/hls/live/2015099/telesur/Telesur_HLS_500.m3u8"
  },
  {
    name: "Canal 26 (Argentina)",
    genre: "Noticias",
    logo: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Canal26_logo.svg",
    url: "https://live-01-02-canal26.secure.footprint.net/canal26/canal26.m3u8"
  },
  {
    name: "BBC Drama (Rakuten)",
    genre: "Series",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/ad/BBC_logo_%282021%29.svg",
    url: "https://amg00793-amg00793c40-rakuten-es-5444.playouts.now.amagi.tv/playlist.m3u8"
  },
  {
    name: "Pluto TV Cine Estelar",
    genre: "Cine",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Pluto_TV_logo.svg",
    url: "https://service-channelfilter.clusters.pluto.tv/v1/channel/5f0f3531b79fbb00072bc5d1/stream?userAgent=Mozilla&deviceType=web&deviceVersion=1.0&deviceSid=123"
  },
  {
    name: "Pluto TV Películas",
    genre: "Cine",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Pluto_TV_logo.svg",
    url: "https://service-channelfilter.clusters.pluto.tv/v1/channel/5e834bd31e87870007d4b293/stream?userAgent=Mozilla&deviceType=web&deviceVersion=1.0&deviceSid=123"
  },
  {
    name: "Pluto TV Anime",
    genre: "Anime",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Pluto_TV_logo.svg",
    url: "https://service-channelfilter.clusters.pluto.tv/v1/channel/5f1b5bc938b81300078bb091/stream?userAgent=Mozilla&deviceType=web&deviceVersion=1.0&deviceSid=123"
  },
  {
    name: "Pluto TV Ciencia",
    genre: "Documentales",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Pluto_TV_logo.svg",
    url: "https://service-channelfilter.clusters.pluto.tv/v1/channel/5f1b5bd55db6db00076a084c/stream?userAgent=Mozilla&deviceType=web&deviceVersion=1.0&deviceSid=123"
  },
  {
    name: "Anime Vision",
    genre: "Animation",
    logo: "https://upload.wikimedia.org/wikipedia/commons/f/f6/Anime_Icon.svg",
    url: "https://d1ujfw1zyymzyd.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-a6fukwkbxmex8/live/fast-channel-animevision-64527ec0/fast-channel-animevision-64527ec0.m3u8"
  },
  {
    name: "Activa TV (Música)",
    genre: "Music",
    logo: "https://upload.wikimedia.org/wikipedia/commons/d/df/Music_icon.svg",
    url: "https://streamtv.mediasector.es/hls/activatv/index.m3u8"
  }
];

/* --- M3U Parser Hook --- */

const parseM3U = (text) => {
  const lines = text.split('\n');
  const parsedChannels = [];
  let currentChannel = null;
  let hasOption = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      currentChannel = {};
      hasOption = false;
      
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      currentChannel.logo = logoMatch ? logoMatch[1] : '';

      const groupMatch = line.match(/group-title="([^"]+)"/);
      currentChannel.genre = groupMatch ? groupMatch[1] : 'General';

      const lastCommaIndex = line.lastIndexOf(',');
      currentChannel.name = lastCommaIndex !== -1 ? line.substring(lastCommaIndex + 1).trim() : 'Canal sin nombre';
    } else if (line.startsWith('#')) {
      hasOption = true;
    } else if (line && currentChannel) {
      currentChannel.url = line;
      
      const hasNonStandardPort = /:\d{4,5}/.test(line.replace('https://', '').replace('http://', ''));
      const isHttps = line.startsWith('https://');

      if (isHttps && !hasOption && !hasNonStandardPort) {
        parsedChannels.push(currentChannel);
      }
      currentChannel = null;
    }
  }
  return parsedChannels;
};

const useM3uParser = (url) => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const fetchPlaylist = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Error al descargar la lista IPTV M3U');
        const text = await res.text();
        if (active) {
          const parsed = parseM3U(text);
          const filteredParsed = parsed.filter(p => !CURATED_STREAMS.some(c => c.url === p.url));
          setChannels([...CURATED_STREAMS, ...filteredParsed]);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Error de conexión');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchPlaylist();
    return () => {
      active = false;
    };
  }, [url]);

  return { channels, loading, error };
};

/* --- Video Player Component --- */

const VideoPlayer = ({ streamUrl }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const triedProxy = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    triedProxy.current = false;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.4.12/dist/hls.min.js';
      script.async = true;
      
      script.onload = () => {
        if (window.Hls && window.Hls.isSupported()) {
          if (hlsRef.current) {
            hlsRef.current.destroy();
          }
          const hls = new window.Hls({
            manifestLoadingMaxRetry: 2,
            levelLoadingMaxRetry: 2
          });
          hlsRef.current = hls;
          hls.loadSource(streamUrl);
          hls.attachMedia(video);

          hls.on(window.Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) {
                if (!triedProxy.current) {
                  triedProxy.current = true;
                  const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(streamUrl)}`;
                  hls.loadSource(proxiedUrl);
                  hls.startLoad();
                }
              } else if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
                hls.recoverMediaError();
              } else {
                hls.destroy();
              }
            }
          });
        }
      };

      document.body.appendChild(script);

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    }
  }, [streamUrl]);

  return (
    <video
      ref={videoRef}
      className="player-iframe"
      controls
      autoPlay
      playsInline
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
};

/* --- Main TV Component --- */

export default function TvLibre() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('Todos');
  const [selectedChannel, setSelectedChannel] = useState(null);

  const { channels, loading, error } = useM3uParser('https://iptv-org.github.io/iptv/languages/spa.m3u');

  const genres = useMemo(() => {
    if (!channels.length) return ['Todos'];
    const allGenres = channels.map(ch => ch.genre || 'General');
    const uniqueGenres = Array.from(new Set(allGenres)).sort();
    return ['Todos', ...uniqueGenres];
  }, [channels]);

  const filteredChannels = useMemo(() => {
    return channels.filter(ch => {
      const matchesSearch = (ch.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGenre = selectedGenre === 'Todos' || ch.genre === selectedGenre;
      return matchesSearch && matchesGenre;
    });
  }, [searchTerm, selectedGenre, channels]);

  return (
    <div className="tv-libre-container">
      <div className="section-header">
        <h1 className="section-title">TV Libre</h1>
        <div className="controls-group">
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Buscar canal en vivo..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="player-loading-spinner" style={{ position: 'relative', margin: '0 auto 1.5rem' }}></div>
          <h3 className="empty-title">Descargando lista de canales...</h3>
          <p>Se está procesando la lista IPTV en tiempo real.</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <span className="empty-icon">⚠️</span>
          <h3 className="empty-title">Error al cargar canales</h3>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <div className="filters-wrapper">
            {genres.map(genre => (
              <button
                key={genre}
                className={`filter-badge ${selectedGenre === genre ? 'active' : ''}`}
                onClick={() => {
                  setSelectedGenre(genre);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {genre}
              </button>
            ))}
          </div>

          <div className="media-grid">
            {filteredChannels.length > 0 ? (
              filteredChannels.map((channel, index) => (
                <div 
                  key={`${channel.name}-${index}`} 
                  className="media-card"
                  onClick={() => setSelectedChannel(channel)}
                >
                  <div className="card-thumbnail-wrapper" style={{ aspectRatio: '16/9' }}>
                    <div className="card-thumbnail-glow"></div>
                    {channel.logo ? (
                      <img 
                        src={channel.logo} 
                        alt={channel.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '1rem', background: '#020205' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentNode.querySelector('.card-icon-placeholder').style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className="card-icon-placeholder" style={channel.logo ? { display: 'none' } : {}}>
                      📺
                    </div>
                    <div className="play-hover-btn">
                      <div className="play-icon">▶</div>
                    </div>
                    <span className="card-badge" style={{ background: 'rgba(139, 92, 246, 0.9)', color: '#fff' }}>
                      DIRECTO
                    </span>
                  </div>
                  <div className="card-info">
                    <span className="card-genre" style={{ color: '#a78bfa' }}>
                      {channel.genre || 'General'}
                    </span>
                    <h3 className="card-title">{channel.name}</h3>
                    <p className="card-summary" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {channel.url}
                    </p>
                    <div className="card-footer">
                      <span>Reproductor Integrado</span>
                      <span className="card-lang">ES</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <span className="empty-icon">📺</span>
                <h3 className="empty-title">No se encontraron canales</h3>
                <p>Prueba buscando con palabras clave diferentes o cambiando de género.</p>
              </div>
            )}
          </div>
        </>
      )}

      {selectedChannel && (
        <div className="modal-overlay" onClick={() => setSelectedChannel(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedChannel(null)}>
              ✕
            </button>
            
            <div className="movie-player-container">
              <VideoPlayer streamUrl={selectedChannel.url} />
            </div>

            <div className="modal-body">
              <div className="modal-meta">
                <span className="modal-genre">{selectedChannel.genre || 'General'}</span>
                <span className="modal-lang">Español</span>
              </div>
              <h2 className="modal-title">{selectedChannel.name}</h2>
              <p className="modal-summary" style={{ wordBreak: 'break-all' }}>
                URL del stream: {selectedChannel.url}
              </p>
              
              <div className="fallback-box">
                <div>
                  <strong style={{ color: '#fff', display: 'block', marginBottom: '0.2rem' }}>
                    Reproducción Directa HLS
                  </strong>
                  <span>
                    Este canal se está transmitiendo en vivo directamente dentro de tu página web de PIRU TV.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
