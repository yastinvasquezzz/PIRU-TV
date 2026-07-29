const fs = require('fs');

async function fetchVimeusAnimes() {
  console.log('Fetching all Vimeus Animes...');
  const API_KEY = 'ak_YxtAmgEstw2LMOLzzd8vBG8bXE2JOBXF';
  
  const allAnimes = [];
  const seenTmdb = new Set();
  let page = 1;
  let totalPages = 1;

  for (page = 1; page <= totalPages; page++) {
    try {
      console.log(`Fetching Vimeus page ${page}...`);
      const res = await fetch(`https://vimeus.com/api/listing/animes?page=${page}`, {
        headers: { 'X-API-Key': API_KEY }
      });
      const data = await res.json();
      
      if (data.data?.pages) totalPages = data.data.pages;
      const list = data.data?.result || data.data?.animes || [];

      for (const item of list) {
        const tmdbId = item.tmdb_id;
        if (tmdbId && !seenTmdb.has(tmdbId)) {
          seenTmdb.add(tmdbId);
          const poster = item.poster ? `https://image.tmdb.org/t/p/w500${item.poster}` : 'https://via.placeholder.com/200x300?text=Anime';
          const backdrop = item.backdrop ? `https://image.tmdb.org/t/p/original${item.backdrop}` : null;

          allAnimes.push({
            id: `vimeus-anime-${tmdbId}`,
            tmdb_id: tmdbId,
            imdb_id: item.imdb_id || null,
            title: item.title,
            poster: poster,
            backdrop: backdrop,
            quality: item.quality || 'FULL HD',
            type: 'vimeus-anime'
          });
        }
      }
    } catch (e) {
      console.error(`Error page ${page}:`, e);
      break;
    }
  }

  console.log(`Successfully extracted ${allAnimes.length} Vimeus Animes across ${totalPages} pages!`);
  fs.writeFileSync('src/data/animes.json', JSON.stringify(allAnimes, null, 2));
  console.log('Saved to src/data/animes.json');
}

fetchVimeusAnimes();
