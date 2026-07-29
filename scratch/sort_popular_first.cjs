const fs = require('fs');

function sortPopularFirst() {
  const data = JSON.parse(fs.readFileSync('src/data/animes.json', 'utf8'));

  const popularKeywords = [
    'spy x family', 'attack on titan', 'one piece', 'dragon ball super',
    'dragon ball z', 'jujutsu kaisen', 'naruto shippuden', 'bleach',
    'solo leveling', 'demon slayer', 'chainsaw man', 'my hero academia',
    'hunter x hunter', 'death note', 'tokyo revengers', 'blue lock',
    'dr. stone', 'black clover', 'cyberpunk', 'naruto'
  ];

  const popularItems = [];
  const normalItems = [];

  data.forEach(item => {
    const titleLower = item.title.toLowerCase();
    const isPop = popularKeywords.some(k => titleLower.includes(k));
    if (isPop) {
      popularItems.push(item);
    } else {
      normalItems.push(item);
    }
  });

  console.log(`Popular items prioritized: ${popularItems.length}`);
  console.log(`Normal items: ${normalItems.length}`);

  const sortedData = [...popularItems, ...normalItems];
  fs.writeFileSync('src/data/animes.json', JSON.stringify(sortedData, null, 2));
  console.log('Saved sorted dataset to src/data/animes.json');
}

sortPopularFirst();
