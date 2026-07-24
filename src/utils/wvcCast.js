/**
 * PIRU TV - Web Video Caster Integration Helper
 * Launches Web Video Caster app via deep-linking & web receiver link to cast video streams to Smart TVs (LG, Samsung, Roku, Chromecast, Fire TV).
 */

export const castWithWebVideoCaster = (videoUrl, title = 'PIRU TV Stream') => {
  if (!videoUrl) {
    alert('No hay un enlace de video disponible para transmitir.');
    return;
  }

  // Ensure full URL protocol
  let fullUrl = videoUrl;
  if (videoUrl.startsWith('//')) {
    fullUrl = `https:${videoUrl}`;
  } else if (videoUrl.startsWith('/')) {
    fullUrl = `${window.location.origin}${videoUrl}`;
  }

  const encodedUrl = encodeURIComponent(fullUrl);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // 1. Try native Web Video Caster app deep link scheme
    const deepLink = `wvc-x-callback://open?url=${encodedUrl}&title=${encodeURIComponent(title)}`;
    
    // Set a timer fallback to web receiver link if app isn't installed or doesn't open
    const fallbackTimer = setTimeout(() => {
      window.location.href = `https://wvc.app/open?url=${encodedUrl}`;
    }, 1200);

    window.location.href = deepLink;

    window.addEventListener('pagehide', () => clearTimeout(fallbackTimer), { once: true });
  } else {
    // Desktop / Web Browser: Open Web Video Caster web receiver / bridge link
    window.open(`https://wvc.app/open?url=${encodedUrl}`, '_blank');
  }
};
