export default async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const upstreamRes = await fetch('https://userapi.cloudfleir.xyz/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://doramasflix.in',
        'Referer': 'https://doramasflix.in/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: rawBody
    });

    const data = await upstreamRes.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(upstreamRes.status).send(data);
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
