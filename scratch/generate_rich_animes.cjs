const fs = require('fs');

function generateRichAnimes() {
  console.log('Generating rich anime dataset with unique posters and seasons...');

  const animeData = [
    {
      id: 'anime-solo-leveling',
      slug: 'solo-leveling',
      title: 'Solo Leveling',
      poster: 'https://cdn.myanimelist.net/images/anime/1170/124178.jpg',
      rating: '9.8',
      genres: ['Acción', 'Fantasía', 'Magia'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Temporada 1', episodeCount: 12 }
      ],
      synopsis: 'En un mundo donde cazadores humanos deben luchar contra monstruos en mazmorras, el cazador más débil Sung Jin-woo recibe una segunda oportunidad de subir de nivel sin límites.',
      embedBase: 'https://tokianime.tv/watch/solo-leveling'
    },
    {
      id: 'anime-one-piece',
      slug: 'one-piece',
      title: 'ONE PIECE',
      poster: 'https://cdn.myanimelist.net/images/anime/6/73245.jpg',
      rating: '9.9',
      genres: ['Acción', 'Aventura', 'Comedia', 'Fantasía'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'East Blue', episodeCount: 61 },
        { seasonNumber: 2, title: 'Alabasta', episodeCount: 74 },
        { seasonNumber: 3, title: 'Skypiea', episodeCount: 71 },
        { seasonNumber: 4, title: 'Water 7 / Enies Lobby', episodeCount: 119 },
        { seasonNumber: 5, title: 'Thriller Bark & Marineford', episodeCount: 191 },
        { seasonNumber: 6, title: 'Isla Gyojin & Punk Hazard', episodeCount: 112 },
        { seasonNumber: 7, title: 'Dressrosa & Whole Cake', episodeCount: 221 },
        { seasonNumber: 8, title: 'País de Wano & Egghead', episodeCount: 273 }
      ],
      synopsis: 'Monkey D. Luffy emprende su viaje con la tripulación de los Sombrero de Paja para encontrar el tesoro legendario One Piece y convertirse en el Rey de los Piratas.',
      embedBase: 'https://tokianime.tv/watch/one-piece'
    },
    {
      id: 'anime-demon-slayer',
      slug: 'demon-slayer-kimetsu-no-yaiba',
      title: 'Demon Slayer: Kimetsu no Yaiba',
      poster: 'https://cdn.myanimelist.net/images/anime/1286/99889.jpg',
      rating: '9.7',
      genres: ['Acción', 'Sobrenatural', 'Artes Marciales'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Temporada 1 - Tanjiro Kamado Unwavering Resolve', episodeCount: 26 },
        { seasonNumber: 2, title: 'Temporada 2 - Mugen Train & Entertainment District', episodeCount: 18 },
        { seasonNumber: 3, title: 'Temporada 3 - Swordsmith Village Arc', episodeCount: 11 },
        { seasonNumber: 4, title: 'Temporada 4 - Hashira Training Arc', episodeCount: 8 }
      ],
      synopsis: 'Tanjiro se convierte en cazador de demonios para vengar a su familia y restaurar la humanidad de su hermana Nezuko.',
      embedBase: 'https://tokianime.tv/watch/demon-slayer-kimetsu-no-yaiba'
    },
    {
      id: 'anime-dragon-ball-super',
      slug: 'dragon-ball-super',
      title: 'Dragon Ball Super',
      poster: 'https://cdn.myanimelist.net/images/anime/7/74606.jpg',
      rating: '9.4',
      genres: ['Acción', 'Artes Marciales', 'Aventura'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Saga de los Dioses & Golden Freezer', episodeCount: 27 },
        { seasonNumber: 2, title: 'Torneo del Universo 6 & Black Goku', episodeCount: 49 },
        { seasonNumber: 3, title: 'Torneo del Poder', episodeCount: 55 }
      ],
      synopsis: 'Goku y sus amigos enfrentan nuevos desafíos cósmicos con la llegada del Dios de la Destrucción Bills y el Torneo del Poder.',
      embedBase: 'https://tokianime.tv/watch/dragon-ball-super'
    },
    {
      id: 'anime-jujutsu-kaisen',
      slug: 'jujutsu-kaisen',
      title: 'Jujutsu Kaisen',
      poster: 'https://cdn.myanimelist.net/images/anime/1171/109222.jpg',
      rating: '9.6',
      genres: ['Acción', 'Sobrenatural', 'Escolar'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Temporada 1', episodeCount: 24 },
        { seasonNumber: 2, title: 'Temporada 2 - Kaibutsu & Incident de Shibuya', episodeCount: 23 }
      ],
      synopsis: 'Yuji Itadori traga un amuleto maldito con la fuerza del Rey de las Maldiciones Sukuna y entra al mundo de los hechiceros jujutsu.',
      embedBase: 'https://tokianime.tv/watch/jujutsu-kaisen'
    },
    {
      id: 'anime-attack-on-titan',
      slug: 'shingeki-no-kyojin',
      title: 'Attack on Titan (Shingeki no Kyojin)',
      poster: 'https://cdn.myanimelist.net/images/anime/10/47347.jpg',
      rating: '9.8',
      genres: ['Acción', 'Misterio', 'Drama'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Temporada 1', episodeCount: 25 },
        { seasonNumber: 2, title: 'Temporada 2', episodeCount: 12 },
        { seasonNumber: 3, title: 'Temporada 3 - Part 1 & 2', episodeCount: 22 },
        { seasonNumber: 4, title: 'Temporada Final - The Final Season', episodeCount: 30 }
      ],
      synopsis: 'Eren Jaeger jura exterminar a todos los Titanes luego de que destruyen su ciudad natal y matan a su madre.',
      embedBase: 'https://tokianime.tv/watch/shingeki-no-kyojin'
    },
    {
      id: 'anime-my-hero-academia',
      slug: 'my-hero-academia',
      title: 'My Hero Academia (Boku no Hero)',
      poster: 'https://cdn.myanimelist.net/images/anime/10/78745.jpg',
      rating: '9.2',
      genres: ['Acción', 'Superhéroes', 'Escolar'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Temporada 1', episodeCount: 13 },
        { seasonNumber: 2, title: 'Temporada 2', episodeCount: 25 },
        { seasonNumber: 3, title: 'Temporada 3', episodeCount: 25 },
        { seasonNumber: 4, title: 'Temporada 4', episodeCount: 25 },
        { seasonNumber: 5, title: 'Temporada 5', episodeCount: 25 },
        { seasonNumber: 6, title: 'Temporada 6 & 7', episodeCount: 36 }
      ],
      synopsis: 'Izuku Midoriya nace sin poderes en un mundo de superhéroes, pero hereda el Don de All Might para convertirse en el héroe #1.',
      embedBase: 'https://tokianime.tv/watch/my-hero-academia'
    },
    {
      id: 'anime-chainsaw-man',
      slug: 'chainsaw-man',
      title: 'Chainsaw Man',
      poster: 'https://cdn.myanimelist.net/images/anime/1806/126216.jpg',
      rating: '9.4',
      genres: ['Acción', 'Terror', 'Sobrenatural'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Temporada 1', episodeCount: 12 }
      ],
      synopsis: 'Denji renace como el Demonio Motosierra tras fusionarse con su mascota Pochita y se une a los Cazadores de Demonios de Seguridad Pública.',
      embedBase: 'https://tokianime.tv/watch/chainsaw-man'
    },
    {
      id: 'anime-bleach-tybw',
      slug: 'bleach-sennen-kessen-hen',
      title: 'Bleach: Thousand-Year Blood War',
      poster: 'https://cdn.myanimelist.net/images/anime/1764/126627.jpg',
      rating: '9.6',
      genres: ['Acción', 'Sobrenatural', 'Fantasía'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Parte 1 - The Blood Warfare', episodeCount: 13 },
        { seasonNumber: 2, title: 'Parte 2 - The Separation', episodeCount: 13 },
        { seasonNumber: 3, title: 'Parte 3 - The Conflict', episodeCount: 13 }
      ],
      synopsis: 'Ichigo Kurosaki regresa a la batalla definitiva cuando la Sociedad de Almas sufre la invasión del Imperio Quincy liderado por Yhwach.',
      embedBase: 'https://tokianime.tv/watch/bleach-sennen-kessen-hen'
    },
    {
      id: 'anime-naruto-shippuden',
      slug: 'naruto-shippuden',
      title: 'Naruto Shippuden',
      poster: 'https://cdn.myanimelist.net/images/anime/1565/111305.jpg',
      rating: '9.7',
      genres: ['Acción', 'Ninja', 'Aventura'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Rescate del Kazekage & Akatsuki', episodeCount: 88 },
        { seasonNumber: 2, title: 'Saga de Pain & Cumbre de los 5 Kages', episodeCount: 116 },
        { seasonNumber: 3, title: 'Cuarta Gran Guerra Ninja', episodeCount: 296 }
      ],
      synopsis: 'Naruto Uzumaki regresa a Konoha tras dos años de entrenamiento para proteger al mundo de la organización Akatsuki.',
      embedBase: 'https://tokianime.tv/watch/naruto-shippuden'
    },
    {
      id: 'anime-death-note',
      slug: 'death-note',
      title: 'Death Note',
      poster: 'https://cdn.myanimelist.net/images/anime/9/9444.jpg',
      rating: '9.5',
      genres: ['Suspenso', 'Psicológico', 'Sobrenatural'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Temporada 1 - Kira vs L', episodeCount: 37 }
      ],
      synopsis: 'Light Yagami encuentra una libreta sobrenatural que le permite matar a cualquiera cuyo nombre escriba en ella.',
      embedBase: 'https://tokianime.tv/watch/death-note'
    },
    {
      id: 'anime-hunter-x-hunter',
      slug: 'hunter-x-hunter-2011',
      title: 'Hunter x Hunter (2011)',
      poster: 'https://cdn.myanimelist.net/images/anime/1337/99013.jpg',
      rating: '9.8',
      genres: ['Acción', 'Aventura', 'Fantasía'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Examen de Cazador & Torre Celestial', episodeCount: 36 },
        { seasonNumber: 2, title: 'Yorknew City & Greed Island', episodeCount: 39 },
        { seasonNumber: 3, title: 'Saga Hormigas Quimera & Elección de Presidente', episodeCount: 73 }
      ],
      synopsis: 'Gon Freecss realiza el peligroso examen de Cazador para encontrar a su padre Ging y embarcarse en grandiosas aventuras.',
      embedBase: 'https://tokianime.tv/watch/hunter-x-hunter-2011'
    },
    {
      id: 'anime-spy-x-family',
      slug: 'spy-x-family',
      title: 'SPY x FAMILY',
      poster: 'https://cdn.myanimelist.net/images/anime/1441/122795.jpg',
      rating: '9.3',
      genres: ['Comedia', 'Acción', 'Escolar'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Temporada 1 - Parte 1 & 2', episodeCount: 25 },
        { seasonNumber: 2, title: 'Temporada 2', episodeCount: 12 }
      ],
      synopsis: 'Un espía, una asesina y una niña telépata forman una familia falsa para cumplir sus misiones sin revelar sus verdaderas identidades.',
      embedBase: 'https://tokianime.tv/watch/spy-x-family'
    },
    {
      id: 'anime-dr-stone',
      slug: 'dr-stone',
      title: 'Dr. STONE',
      poster: 'https://cdn.myanimelist.net/images/anime/1734/101037.jpg',
      rating: '9.1',
      genres: ['Sci-Fi', 'Aventura', 'Comedia'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Temporada 1 - Kingdom of Science', episodeCount: 24 },
        { seasonNumber: 2, title: 'Temporada 2 - Stone Wars', episodeCount: 11 },
        { seasonNumber: 3, title: 'Temporada 3 - New World', episodeCount: 22 }
      ],
      synopsis: 'Senku Ishigami despierta miles de años después de que la humanidad fuera petrificada y usa la ciencia para reconstruir la civilización.',
      embedBase: 'https://tokianime.tv/watch/dr-stone'
    },
    {
      id: 'anime-black-clover',
      slug: 'black-clover',
      title: 'Black Clover',
      poster: 'https://cdn.myanimelist.net/images/anime/2/88336.jpg',
      rating: '9.0',
      genres: ['Acción', 'Magia', 'Fantasía'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Saga Caballeros Mágicos', episodeCount: 51 },
        { seasonNumber: 2, title: 'Saga Ojo de la Noche Blanca', episodeCount: 51 },
        { seasonNumber: 3, title: 'Saga Reino de los Elfos & Reino de Spade', episodeCount: 68 }
      ],
      synopsis: 'Asta nace sin ningún poder mágico pero recibe un grimorio de 5 hojas con espada anti-magia para convertirse en el Rey Mago.',
      embedBase: 'https://tokianime.tv/watch/black-clover'
    },
    {
      id: 'anime-tokyo-revengers',
      slug: 'tokyo-revengers',
      title: 'Tokyo Revengers',
      poster: 'https://cdn.myanimelist.net/images/anime/1830/118780.jpg',
      rating: '9.1',
      genres: ['Acción', 'Drama', 'Viajes en el Tiempo'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Temporada 1', episodeCount: 24 },
        { seasonNumber: 2, title: 'Temporada 2 - Christmas Showdown', episodeCount: 13 },
        { seasonNumber: 3, title: 'Temporada 3 - Tenjiku Arc', episodeCount: 13 }
      ],
      synopsis: 'Takemichi Hanagaki viaja 12 años al pasado para salvar a su única exnovia Hinata de ser asesinada por la pandilla Tokyo Manji.',
      embedBase: 'https://tokianime.tv/watch/tokyo-revengers'
    },
    {
      id: 'anime-blue-lock',
      slug: 'blue-lock',
      title: 'BLUELOCK',
      poster: 'https://cdn.myanimelist.net/images/anime/1258/126929.jpg',
      rating: '9.2',
      genres: ['Deportes', 'Acción', 'Escolar'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Temporada 1 - Selección 1 & 2', episodeCount: 24 },
        { seasonNumber: 2, title: 'Temporada 2 - vs Sub-20', episodeCount: 14 }
      ],
      synopsis: '300 delanteros de secundaria son aislados en el complejo Blue Lock para entrenar al delantero más egoísta y supremo de Japón.',
      embedBase: 'https://tokianime.tv/watch/blue-lock'
    },
    {
      id: 'anime-cyberpunk',
      slug: 'cyberpunk-edgerunners',
      title: 'Cyberpunk: Edgerunners',
      poster: 'https://cdn.myanimelist.net/images/anime/1818/126436.jpg',
      rating: '9.5',
      genres: ['Sci-Fi', 'Acción', 'Cyberpunk'],
      hasLatino: true,
      hasSub: true,
      seasons: [
        { seasonNumber: 1, title: 'Temporada 1', episodeCount: 10 }
      ],
      synopsis: 'Un chico de la calle intenta sobrevivir en Night City convirtiéndose en un edgerunner, un mercenario proscrito conocido como cyberpunk.',
      embedBase: 'https://tokianime.tv/watch/cyberpunk-edgerunners'
    }
  ];

  fs.writeFileSync('src/data/animes.json', JSON.stringify(animeData, null, 2));
  console.log('Saved 18 rich anime series with unique posters and seasons!');
}

generateRichAnimes();
