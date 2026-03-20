#!/usr/bin/env node
/**
 * Backfill script - Collects today's puzzle
 * For historical puzzles, run the scheduler daily
 * Usage: node backfill-puzzles.js
 */

import { getTodaysPuzzle, addToCollection } from './daily-scraper.js';

const header = '╔' + '═'.repeat(58) + '╗';
const footer = '╚' + '═'.repeat(58) + '╝\n';
const divider = '─'.repeat(60);

console.log(header);
console.log('║  Connections Puzzle Collection                           ║');
console.log(footer);

console.log('Note: connectionsgame.org archive requires interactive navigation.');
console.log('This script will collect today\'s available puzzle.\n');
console.log('For historical collection:');
console.log('  • Run "npm run scheduler" daily to auto-collect');
console.log('  • Or manually run "npm run scrape" each day\n');

console.log(divider);
console.log('Fetching today\'s puzzle...');
console.log(divider + '\n');

try {
    const puzzleData = await getTodaysPuzzle();
    
    if (puzzleData && puzzleData.categories && puzzleData.categories.length === 4) {
        console.log('\n✓ Successfully extracted puzzle:');
        console.log('  Puzzle #' + puzzleData.id + ' - ' + puzzleData.date);
        puzzleData.categories.forEach((cat, idx) => {
            console.log('  ' + (idx + 1) + '. [Difficulty ' + cat.difficulty + '] ' + cat.name);
            console.log('     ' + cat.words.join(', '));
        });
        
        const added = addToCollection(puzzleData);
        
        if (added) {
            console.log('\n✓ Added to collection');
            console.log('  Run "npm run merge" to add to main puzzle collection');
            console.log('  Then "npm run build" to rebuild the app\n');
            process.exit(0);
        } else {
            console.log('\n⊘ Puzzle already in collection\n');
            process.exit(0);
        }
    } else {
        console.log('\n✗ Failed to extract complete puzzle data\n');
        process.exit(1);
    }
} catch (error) {
    console.error('\n✗ Error:', error.message, '\n');
    process.exit(1);
}
