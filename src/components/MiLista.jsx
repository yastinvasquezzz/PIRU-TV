import React, { useState, useEffect } from 'react';
import { getFavorites, getWatchHistory, toggleFavorite } from '../utils/storage';

export default function MiLista({ onOpenItem }) {
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('favorites'); // 'favorites' or 'history'

  const loadData = () => {
    setFavorites(getFavorites());
    setHistory(getWatchHistory());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRemoveFavorite = (e, item) => {
    e.stopPropagation();
    toggleFavorite(item);
    loadData();
  };

  return (
    <div className="mi-lista-container" style={{ padding: '1rem 0' }}>
      <div className="section-header">
        <h1 className="section-title">❤️ Mi Biblioteca Personal</h1>
        <div className="filters-wrapper" style={{ margin: 0 }}>
          <button
            className={`filter-badge ${activeSubTab === 'favorites' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('favorites')}
          >
            ❤️ Mis Favoritos ({favorites.length})
          </button>
          <button
            className={`filter-badge ${activeSubTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('history')}
          >
            🕒 Continuar Viendo ({history.length})
          </button>
        </div>
      </div>

      {activeSubTab === 'favorites' ? (
        favorites.length > 0 ? (
          <div className="media-grid">
            {favorites.map((item) => (
              <button
                type="button"
                key={item.id}
                className="media-card"
                onClick={() => onOpenItem && onOpenItem(item)}
                style={{ textAlign: 'left', font: 'inherit', color: 'inherit', padding: 0 }}
              >
                <div className="card-thumbnail-wrapper" style={{ aspectRatio: '2/3' }}>
                  <img
                    src={item.poster || item.portada || 'https://via.placeholder.com/160x240?text=?'}
                    alt={item.title || item.titulo}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div className="play-hover-btn">
                    <div className="play-icon">▶</div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveFavorite(e, item)}
                    title="Quitar de favoritos"
                    style={{
                      position: 'absolute',
                      top: '0.6rem',
                      right: '0.6rem',
                      background: 'rgba(239, 68, 68, 0.85)',
                      border: 'none',
                      color: 'white',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      zIndex: 10
                    }}
                  >
                    ❤️
                  </button>
                </div>
                <div className="card-info">
                  <span className="card-genre">{item.category || item.type || 'Contenido'}</span>
                  <h3 className="card-title">{item.title || item.titulo}</h3>
                  <div className="card-footer">
                    <span>Guardado</span>
                    <span className="card-lang">FAV</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '5rem 2rem' }}>
            <span className="empty-icon">❤️</span>
            <h3 className="empty-title">Aún no tienes favoritos guardados</h3>
            <p>Haz clic en el ícono de corazón en cualquier película, dorama o serie para guardarla aquí.</p>
          </div>
        )
      ) : (
        history.length > 0 ? (
          <div className="media-grid">
            {history.map((item) => (
              <button
                type="button"
                key={item.id}
                className="media-card"
                onClick={() => onOpenItem && onOpenItem(item)}
                style={{ textAlign: 'left', font: 'inherit', color: 'inherit', padding: 0 }}
              >
                <div className="card-thumbnail-wrapper" style={{ aspectRatio: '16/9' }}>
                  <img
                    src={item.poster || item.portada || 'https://via.placeholder.com/160x240?text=?'}
                    alt={item.title || item.titulo}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div className="play-hover-btn">
                    <div className="play-icon">▶</div>
                  </div>
                </div>
                <div className="card-info">
                  <span className="card-genre">Continuar Viendo</span>
                  <h3 className="card-title">{item.title || item.titulo}</h3>
                  <p className="card-summary">
                    {item.season && item.episode ? `Temporada ${item.season} • Episodio ${item.episode}` : 'Reanudar reproducción'}
                  </p>
                  <div className="card-footer">
                    <span>Visto recientemente</span>
                    <span className="card-lang">PLAY</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '5rem 2rem' }}>
            <span className="empty-icon">🕒</span>
            <h3 className="empty-title">No hay historial de reproducción</h3>
            <p>Los videos que comiences a ver aparecerán automáticamente aquí para reanudarlos.</p>
          </div>
        )
      )}
    </div>
  );
}
