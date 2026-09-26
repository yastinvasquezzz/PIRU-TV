import { useEffect } from 'react';

/**
 * Hook for Smart TV D-Pad Remote Control & Keyboard Navigation
 * Supports:
 * - LG webOS Back key (keyCode 461)
 * - Samsung Tizen Back key (keyCode 10009)
 * - Android TV / Fire TV Back key (keyCode 4, 'GoBack', 'BrowserBack')
 * - PC Keyboard (Escape, Back)
 * - Remote OK / Enter (keyCode 13)
 */
export const useDpadNavigation = ({ onBack, onEnter } = {}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const keyCode = e.keyCode || e.which;
      const key = e.key;

      const isBackKey = 
        keyCode === 461 ||   // LG webOS
        keyCode === 10009 || // Samsung Tizen
        keyCode === 4 ||     // Android TV
        key === 'Escape' ||
        key === 'Back' ||
        key === 'GoBack' ||
        key === 'BrowserBack';

      if (isBackKey) {
        // Do not intercept if user is typing inside an input/textarea and presses Escape on PC, unless it's a TV remote key
        const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
        if (isTyping && (key === 'Escape' || keyCode === 27)) {
          document.activeElement.blur();
          return;
        }

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
