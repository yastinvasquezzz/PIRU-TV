/**
 * Cloudflare Worker - Proxy para API de Doramasflix y Servidor Primeload
 * 
 * Deploy en: https://workers.cloudflare.com/
 */
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle CORS OPTIONS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  // 1. Proxy GET/POST requests for primeload.co (stripping CSP to bypass ERR_BLOCKED_BY_RESPONSE)
  const isPrimeload = path.startsWith('/embed/') || 
                       path.startsWith('/player/') || 
                       path.startsWith('/player-dist/') || 
                       path.startsWith('/api/v1/') ||
                       url.searchParams.has('primeload');

  if (isPrimeload) {
    const targetHost = 'primeload.co';
    const targetUrl = `https://${targetHost}${path}${url.search}`;
    
    // Copy headers and filter out host/referer
    const newHeaders = new Headers(request.headers);
    newHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    newHeaders.delete('host');
    newHeaders.delete('referer');
    newHeaders.delete('origin');

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: newHeaders,
      body: request.method === 'POST' ? await request.arrayBuffer() : undefined,
      redirect: 'manual'
    });

    // Handle redirects
    if ([301, 302, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (location) {
        const newLocation = location.replace(`https://${targetHost}`, `https://${url.host}`);
        return new Response(null, {
          status: response.status,
          headers: {
            'Location': newLocation,
            'Access-Control-Allow-Origin': '*',
          }
        });
      }
    }

    // Strip Content-Security-Policy & X-Frame-Options
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-security-policy');
    responseHeaders.delete('x-frame-options');
    responseHeaders.delete('referrer-policy');
    responseHeaders.set('access-control-allow-origin', '*');
    responseHeaders.set('access-control-allow-methods', 'GET, POST, OPTIONS');
    responseHeaders.set('access-control-allow-headers', '*');

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html') || contentType.includes('javascript') || contentType.includes('json')) {
      let bodyText = await response.text();
      // Rewrite any references from primeload.co to our worker host
      bodyText = bodyText.replace(new RegExp(`https://${targetHost}`, 'g'), `https://${url.host}`);
      return new Response(bodyText, {
        status: response.status,
        headers: responseHeaders
      });
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders
    });
  }

  // 2. Default: GraphQL API Proxy for Doramasflix
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await request.text();
  const response = await fetch('https://sv1.fluxcedene.net/api/gql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body,
  });

  const data = await response.text();

  return new Response(data, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
