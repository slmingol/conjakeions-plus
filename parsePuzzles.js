const fs = require('fs');
const path = require('path');

// Read the CSV file
const csvPath = '/Users/smingolelli/Downloads/Connections_Data.csv';
const csvData = fs.readFileSync(csvPath, 'utf-8');

// Parse CSV
const lines = csvData.trim().split('\n');
const headers = lines[0].split(',');

// Group data by Game ID
const puzzles = {};

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g).map(v => v.replace(/^"|"$/g, '').trim());
  
  const gameId = values[0];
  const puzzleDate = values[1];
  const word = values[2];
  const groupName = values[3];
  const groupLevel = parseInt(values[4]);
  
  if (!puzzles[gameId]) {
    puzzles[gameId] = {
      id: parseInt(gameId),
      date: puzzleDate,
      categories: {}
    };
  }
  
  if (!puzzles[gameId].categories[groupName]) {
    puzzles[gameId].categories[groupName] = {
      name: groupName,
      words: [],
      difficulty: groupLevel
    };
  }
  
  puzzles[gameId].categories[groupName].words.push(word);
}

// Convert to array and format for the game
const puzzleArray = Object.values(puzzles).map(puzzle => {
  const categories = Object.values(puzzle.categories).map(cat => ({
    name: cat.name,
    words: cat.words,
    difficulty: cat.difficulty,
    color: getColorForDifficulty(cat.difficulty)
  }));
  
  return {
    id: puzzle.id,
    date: puzzle.date,
    categories: categories
  };
});

function getColorForDifficulty(difficulty) {
  const colors = ['#f9df6d', '#a0c35a', '#b0c4ef', '#ba81c5'];
  return colors[difficulty] || '#f9df6d';
}

// Write to JSON file
const outputPath = path.join(__dirname, 'src', 'puzzles.json');
fs.writeFileSync(outputPath, JSON.stringify(puzzleArray, null, 2));

console.log(`✓ Successfully parsed ${puzzleArray.length} puzzles`);
console.log(`✓ Output written to: ${outputPath}`);
