/**
 * Cloudflare Worker - Proxy para API de Doramasflix
 * 
 * Deploy en: https://workers.cloudflare.com/
 * Crea un worker nuevo y pega este código.
 * Una vez desplegado, usa la URL del worker en lugar de sv1.fluxcedene.net
 */
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Only allow POST
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  const body = await request.text();

  const response = await fetch('https://sv1.fluxcedene.net/api/gql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // No Origin header = server returns 200
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
