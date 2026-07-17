const fs = require('fs');
const path = require('path');

const csvPath = 'C:\\Users\\Vasquez\\Downloads\\canales free.csv';
const outputPath = path.join(__dirname, '..', 'src', 'data', 'channels.json');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Toggle quote mode
      inQuotes = !inQuotes;
    } else if (char === ';' && !inQuotes) {
      // Split on semicolon if not inside quotes
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

try {
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length === 0) {
    console.error('CSV file is empty.');
    process.exit(1);
  }

  // Header is the first line
  const headers = parseCSVLine(lines[0]);
  const channels = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) {
      // Skip incomplete lines
      continue;
    }

    const channel = {};
    headers.forEach((header, index) => {
      // Remove surrounding quotes if they still exist
      let val = values[index] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      channel[header] = val;
    });

    channels.push(channel);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(channels, null, 2), 'utf-8');
  console.log(`Successfully converted ${channels.length} channels to ${outputPath}`);
} catch (error) {
  console.error('Error during CSV conversion:', error);
  process.exit(1);
}
