import React from 'react';

/**
 * PIRU TV - Global Error Boundary
 * Prevents full-app blank crashes if any subcomponent or third-party stream data fails.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PIRU TV ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '65vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '2rem 1.5rem',
          background: '#141414',
          color: '#ffffff'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(229, 9, 20, 0.15)',
            border: '2px solid rgba(229, 9, 20, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            marginBottom: '1.25rem'
          }}>
            🎬
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: 'var(--font-title, sans-serif)' }}>
            Ocurrió un inconveniente al cargar esta sección
          </h2>
          <p style={{ maxWidth: '480px', color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            No te preocupes, el resto de la aplicación sigue funcionando. Puedes intentar recargar la sección o regresar a Inicio.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                background: '#e50914',
                color: '#fff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(229, 9, 20, 0.4)',
                transition: 'transform 0.15s ease'
              }}
            >
              🔄 Reintentar
            </button>
            <button
              type="button"
              onClick={() => {
                this.handleReset();
                if (typeof this.props.onGoHome === 'function') {
                  this.props.onGoHome();
                } else {
                  window.location.reload();
                }
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              🏠 Ir a Inicio
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
