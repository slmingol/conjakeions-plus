#!/usr/bin/env node
/**
 * Backfill missing puzzles #1019-1029 (March 26 - April 5, 2026)
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const today = new Date('2026-04-11'); // April 11, 2026
const missingPuzzles = [
  { id: 1019, date: '2026-03-26', daysAgo: 16 },
  { id: 1020, date: '2026-03-27', daysAgo: 15 },
  { id: 1021, date: '2026-03-28', daysAgo: 14 },
  { id: 1022, date: '2026-03-29', daysAgo: 13 },
  { id: 1023, date: '2026-03-30', daysAgo: 12 },
  { id: 1024, date: '2026-03-31', daysAgo: 11 },
  { id: 1025, date: '2026-04-01', daysAgo: 10 },
  { id: 1026, date: '2026-04-02', daysAgo: 9 },
  { id: 1027, date: '2026-04-03', daysAgo: 8 },
  { id: 1028, date: '2026-04-04', daysAgo: 7 },
  { id: 1029, date: '2026-04-05', daysAgo: 6 },
];

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  Backfilling Missing Puzzles                           ║');
console.log('╚════════════════════════════════════════════════════════╝\n');
console.log(`Found ${missingPuzzles.length} missing puzzles to backfill\n`);

async function backfillAll() {
  let successCount = 0;
  let failCount = 0;

  for (const puzzle of missingPuzzles) {
    console.log(`\n[${puzzle.id}] Scraping puzzle from ${puzzle.daysAgo} days ago (${puzzle.date})...`);
    
    try {
      const { stdout, stderr } = await execAsync(`node scripts/daily-scraper.js ${puzzle.daysAgo}`);
      console.log(stdout);
      if (stderr) console.error(stderr);
      console.log(`✓ Successfully scraped puzzle #${puzzle.id}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Error scraping puzzle #${puzzle.id}:`, error.message);
      failCount++;
    }

    // Brief delay between scrapes to avoid rate limiting
    if (puzzle.id !== missingPuzzles[missingPuzzles.length - 1].id) {
      console.log('Waiting 3 seconds before next scrape...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('\n────────────────────────────────────────────────────────');
  console.log('Backfill Summary:');
  console.log(`  Successfully scraped: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log('────────────────────────────────────────────────────────\n');

  if (successCount > 0) {
    console.log('Merging collected puzzles...');
    try {
      await execAsync('node scripts/merge-puzzles.js');
      console.log('✓ Merge complete!\n');
    } catch (error) {
      console.error('✗ Merge failed:', error.message);
    }
  }
}

backfillAll().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
