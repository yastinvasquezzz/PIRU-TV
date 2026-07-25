const fs = require('fs');

async function parseM3u() {
  console.log('Fetching index.m3u from iptv-org...');
  const res = await fetch('https://iptv-org.github.io/iptv/index.m3u');
  const text = await res.text();
  console.log('Downloaded M3U size:', text.length, 'bytes');

  const lines = text.split('\n');
  const latinChannels = [];
  let currentExt = null;

  const latamKeywords = [
    'latin america', 'latam', 'latino', 'hispano',
    'mexico', 'argentina', 'colombia', 'peru', 'chile', 'venezuela', 
    'ecuador', 'guatemala', 'dominicana', 'puerto rico', 'uruguay', 
    'bolivia', 'paraguay', 'costa rica', 'honduras', 'el salvador', 
    'nicaragua', 'panama'
  ];

  const latamCountryCodes = ['AR','BO','CL','CO','CR','CU','DO','EC','SV','GT','HN','MX','NI','PA','PY','PE','PR','UY','VE'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      currentExt = line;
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      if (currentExt) {
        const logoMatch = currentExt.match(/tvg-logo="([^"]+)"/);
        const groupMatch = currentExt.match(/group-title="([^"]+)"/);
        const countryMatch = currentExt.match(/tvg-country="([^"]+)"/);
        const titleParts = currentExt.split(',');
        const name = titleParts[titleParts.length - 1].trim();

        const lowerName = name.toLowerCase();
        const group = groupMatch ? groupMatch[1].toLowerCase() : '';
        const countryCode = countryMatch ? countryMatch[1].toUpperCase() : '';

        const isLatin = latamKeywords.some(kw => lowerName.includes(kw) || group.includes(kw)) ||
                        latamCountryCodes.includes(countryCode);

        if (isLatin) {
          // Determine Category/Ambit based on name & group
          let ambit = 'General';
          const lower = (name + ' ' + group).toLowerCase();
          if (lower.includes('news') || lower.includes('noticia') || lower.includes('24') || lower.includes('informacion')) ambit = 'Noticias';
          else if (lower.includes('sport') || lower.includes('deporte') || lower.includes('espn') || lower.includes('fox sports') || lower.includes('futbol')) ambit = 'Deportes';
          else if (lower.includes('cine') || lower.includes('movie') || lower.includes('film') || lower.includes('hbo') || lower.includes('universal') || lower.includes('star') || lower.includes('studio') || lower.includes('cinema')) ambit = 'Cine';
          else if (lower.includes('music') || lower.includes('mtv') || lower.includes('vevo') || lower.includes('musica') || lower.includes('telehit')) ambit = 'Música';
          else if (lower.includes('disney') || lower.includes('nick') || lower.includes('cartoon') || lower.includes('kids') || lower.includes('infantil') || lower.includes('toons')) ambit = 'Infantil';
          else if (lower.includes('tv') || lower.includes('channel') || lower.includes('tnt') || lower.includes('fx') || lower.includes('axn') || lower.includes('telemundo') || lower.includes('univision')) ambit = 'Entretenimiento';

          latinChannels.push({
            id: 'latam-' + (latinChannels.length + 1),
            name: name,
            logo: logoMatch ? logoMatch[1] : 'https://via.placeholder.com/150?text=LATAM',
            ambit: ambit,
            country: countryCode || 'Latin America',
            url: line,
            isAudio: line.includes('.mp3') || line.includes('.aac')
          });
        }
      }
      currentExt = null;
    }
  }

  console.log('Total Latin America channels parsed:', latinChannels.length);
  if (latinChannels.length > 0) {
    fs.writeFileSync('src/data/latin_america_iptv.json', JSON.stringify(latinChannels, null, 2));
    console.log('Saved to src/data/latin_america_iptv.json successfully!');
  }
}

parseM3u();
