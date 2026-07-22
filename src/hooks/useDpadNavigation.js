import { useEffect } from 'react';

/**
 * Hook for Smart TV D-Pad Remote Control & Keyboard Navigation
 * Supports LG webOS Back key (keyCode 461), ESC, and Arrow keys.
 */
export const useDpadNavigation = ({ onBack, onEnter } = {}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const keyCode = e.keyCode || e.which;
      const key = e.key;

      // LG webOS Back button (461) or ESC key (27)
      if (keyCode === 461 || key === 'Escape' || key === 'Back') {
        if (typeof onBack === 'function') {
          e.preventDefault();
          onBack();
        }
      }

      // Enter / OK button on TV remote
      if (key === 'Enter' || keyCode === 13) {
        if (typeof onEnter === 'function') {
          onEnter();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onBack, onEnter]);
};

export default useDpadNavigation;
