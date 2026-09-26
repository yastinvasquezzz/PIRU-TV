/**
 * PIRU TV - Device Detection Utility
 * Detects LG Smart TV (webOS) and other Smart TV browsers with precision.
 * Covers user agent variants: 'Web0S' (with zero), 'webOS', 'SmartTV', 'NetCast', 'LG TV', 'WebAppManager'.
 */

export const checkIsLgTv = () => {
  if (typeof window === 'undefined' || !navigator?.userAgent) return false;
  const ua = navigator.userAgent;
  return /web0s|webos|smart[-_]?tv|netcast|lg\s?tv|webappmanager/i.test(ua);
};

export const isLgTv = () => {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('is-lg-tv')) {
    return true;
  }
  return checkIsLgTv();
};

export default isLgTv;
