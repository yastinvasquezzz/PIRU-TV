import React from 'react';

export default function WelcomeConfirmedModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ backdropFilter: 'blur(16px)', background: 'rgba(2, 2, 6, 0.88)', zIndex: 99999 }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: '480px', 
          minHeight: 'auto', 
          borderRadius: '28px', 
          padding: '3rem 2.25rem',
          textAlign: 'center',
          background: 'linear-gradient(145deg, rgba(25, 25, 40, 0.98) 0%, rgba(12, 12, 22, 0.99) 100%)',
          border: '1px solid rgba(34, 197, 94, 0.4)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(34, 197, 94, 0.3)',
          animation: 'zoomIn 0.3s ease-out'
        }}
      >
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.8rem', fontWeight: 900, color: '#ffffff', marginBottom: '0.8rem', lineHeight: '1.2' }}>
          ¡Correo Confirmado con Éxito!
        </h2>
        <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: '1.6', marginBottom: '2rem' }}>
          Gracias por confirmar tu correo. Ya puedes disfrutar de películas, series, doramas y TV en vivo totalmente gratis en <strong style={{ color: '#e50914' }}>PIRU TV</strong>.
        </p>

        <button
          onClick={onClose}
          className="btn-primary"
          style={{
            width: '100%',
            borderRadius: '14px',
            fontSize: '1.1rem',
            padding: '1rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #e50914 0%, #9333ea 100%)',
            boxShadow: '0 6px 25px rgba(229, 9, 20, 0.5)'
          }}
        >
          🎬 Empezar a ver ahora
        </button>
      </div>
    </div>
  );
}
