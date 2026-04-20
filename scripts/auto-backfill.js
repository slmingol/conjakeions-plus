#!/usr/bin/env node
/**
 * Auto-backfill script - Automatically checks and fills missing puzzles
 * Usage: node auto-backfill.js [days]
 * 
 * Examples:
 *   node auto-backfill.js       # Check last 7 days (default)
 *   node auto-backfill.js 30    # Check last 30 days
 *   node auto-backfill.js 365   # Check last year
 *   node auto-backfill.js all   # Check entire collection
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get days from command line argument or use default
const daysArg = process.argv[2];
let DAYS_TO_CHECK;

if (daysArg === 'all') {
    DAYS_TO_CHECK = 1095; // ~3 years, covers the entire puzzle history
} else if (daysArg && !isNaN(parseInt(daysArg))) {
    DAYS_TO_CHECK = parseInt(daysArg);
} else {
    DAYS_TO_CHECK = 7; // Default: last 7 days
}

const dataPath = path.join(__dirname, '../data/collected-puzzles.json');
const srcPath = path.join(__dirname, '../src/puzzles.json');

/**
 * Get date string in YYYY-MM-DD format
 */
function getDateString(daysAgo = 0) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
}

/**
 * Normalize date to ISO format (YYYY-MM-DD) for comparison
 */
function normalizeDate(dateStr) {
    try {
        // Handle various formats: "March 25, 2026", "2026-03-25", "1018March 25, 2026"
        // Remove any leading digits+non-space chars (e.g., "1018March" -> "March")
        const cleaned = dateStr.replace(/^\d+(?=[A-Z])/,'');
        const date = new Date(cleaned);
        if (isNaN(date.getTime())) {
            return dateStr; // Return original if parsing fails
        }
        return date.toISOString().split('T')[0];
    } catch {
        return dateStr;
    }
}

/**
 * Get the maximum puzzle ID from existing puzzles
 */
function getMaxPuzzleId(puzzles) {
    const puzzleIds = puzzles
        .map(p => p.id)
        .filter(id => id != null && !isNaN(id));
    
    if (puzzleIds.length === 0) {
        return 0;
    }
    
    return Math.max(...puzzleIds);
}

/**
 * Check which puzzles from the last N days are missing
 */
function getMissingDates() {
    console.log(`\n[Auto-Backfill] Checking for missing puzzles from last ${DAYS_TO_CHECK} days...`);
    
    // Load existing puzzles from src/puzzles.json (build-time static set)
    let existingPuzzles = [];
    if (fs.existsSync(srcPath)) {
        existingPuzzles = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
    }

    // Also load persisted collected puzzles (survive container restarts via Docker volume)
    if (fs.existsSync(dataPath)) {
        try {
            const collectedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            const collectedPuzzles = collectedData?.puzzles || [];
            if (collectedPuzzles.length > 0) {
                existingPuzzles = [...existingPuzzles, ...collectedPuzzles];
            }
        } catch (err) {
            console.log(`  ⚠️  Could not read collected puzzles: ${err.message}`);
        }
    }

    // Calculate the maximum puzzle ID to determine earliest valid puzzle
    const maxPuzzleId = getMaxPuzzleId(existingPuzzles);
    console.log(`  Max puzzle ID: #${maxPuzzleId}`);
    
    // Build set of existing dates (normalized to ISO format)
    const existingDates = new Set(
        existingPuzzles
            .map(p => normalizeDate(p.date))
            .filter(d => d && d.includes('-')) // Only valid ISO dates
    );
    
    console.log(`  Found ${existingDates.size} existing puzzles with valid dates`);
    
    // Check last N days, but only if puzzle number would be valid (> 0)
    const missingDays = [];
    for (let i = 0; i < DAYS_TO_CHECK; i++) {
        // Calculate what the puzzle number would be for this day
        const estimatedPuzzleNum = maxPuzzleId - i;
        
        // Skip if this would be before puzzle #1
        if (estimatedPuzzleNum <= 0) {
            console.log(`  ⏭️  Skipping: ${i} days ago (would be puzzle #${estimatedPuzzleNum}, before first puzzle)`);
            continue;
        }
        
        const dateStr = getDateString(i);
        if (!existingDates.has(dateStr)) {
            missingDays.push(i);
            console.log(`  ⚠️  Missing: ${dateStr} (${i} days ago, ~puzzle #${estimatedPuzzleNum})`);
        } else {
            console.log(`  ✓  Found: ${dateStr}`);
        }
    }
    
    return missingDays;
}

/**
 * Run the daily scraper for a specific day
 */
async function scrapePuzzle(daysAgo) {
    return new Promise((resolve) => {
        console.log(`\n[Auto-Backfill] Scraping puzzle from ${daysAgo} days ago...`);
        
        const scraperPath = path.join(__dirname, 'daily-scraper.js');
        const scraper = spawn('node', [scraperPath, daysAgo.toString()], {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        
        scraper.on('close', (code) => {
            if (code === 0) {
                console.log(`✓ Successfully scraped puzzle from ${daysAgo} days ago`);
                resolve(true);
            } else {
                console.log(`✗ Failed to scrape puzzle from ${daysAgo} days ago (exit code: ${code})`);
                resolve(false);
            }
        });
    });
}

/**
 * Merge collected puzzles into main collection
 */
async function mergePuzzles() {
    return new Promise((resolve) => {
        console.log('\n[Auto-Backfill] Merging collected puzzles into main collection...');
        
        const mergePath = path.join(__dirname, 'merge-puzzles.js');
        const merger = spawn('node', [mergePath], {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        
        merger.on('close', (code) => {
            if (code === 0) {
                console.log('✓ Successfully merged puzzles');
                resolve(true);
            } else {
                console.log('✗ Failed to merge puzzles');
                resolve(false);
            }
        });
    });
}

/**
 * Main auto-backfill logic
 */
async function main() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  Conjakeions+ Auto-Backfill                            ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    // If persisted collected puzzles exist, merge them into nginx first.
    // This restores the served puzzles.json after a container restart without
    // needing to re-scrape puzzles that are already in the volume.
    if (fs.existsSync(dataPath)) {
        console.log('\n[Auto-Backfill] Persisted collected puzzles found. Merging into nginx...');
        await mergePuzzles();
    }

    const missingDays = getMissingDates();
    
    if (missingDays.length === 0) {
        console.log('\n✓ All puzzles from last 7 days are present. No backfill needed.');
        process.exit(0);
    }
    
    console.log(`\n⚠️  Found ${missingDays.length} missing puzzle(s). Starting backfill...`);
    
    // Check if collection file exists - always use /app/data which is persisted
    const collectionPath = path.join(__dirname, '../data/collected-puzzles.json');
    const dataDir = path.join(__dirname, '../data');
    
    if (!fs.existsSync(collectionPath)) {
        console.log('\n⚠️  Collection file not found. Fetching today\'s puzzle first to bootstrap...');
        console.log(`   Looking for: ${collectionPath}`);
        
        // Create data directory if it doesn't exist
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Fetch today's puzzle first (daysAgo = 0)
        const todaySuccess = await scrapePuzzle(0);
        if (!todaySuccess) {
            console.log('\n⚠️  Failed to fetch today\'s puzzle. Cannot proceed with backfill.');
            process.exit(1);
        }
        
        // Wait a bit before backfilling
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    let successCount = 0;
    let failCount = 0;
    
    // Scrape missing puzzles one by one (skip day 0 if we just fetched it)
    const daysToFetch = missingDays.filter(d => d !== 0 || !fs.existsSync(collectionPath));
    for (const daysAgo of daysToFetch) {
        const success = await scrapePuzzle(daysAgo);
        if (success) {
            successCount++;
        } else {
            failCount++;
        }
        
        // Wait between scrapes to avoid overwhelming the source
        if (daysAgo !== daysToFetch[daysToFetch.length - 1]) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    console.log('\n────────────────────────────────────────────────────────');
    console.log(`Backfill Summary:`);
    console.log(`  Successfully scraped: ${successCount}`);
    console.log(`  Failed: ${failCount}`);
    console.log('────────────────────────────────────────────────────────');
    
    // Merge if we successfully scraped anything
    if (successCount > 0) {
        await mergePuzzles();
        console.log('\n✓ Auto-backfill complete!');
    } else {
        console.log('\n⚠️  No puzzles were successfully scraped.');
    }
    
    process.exit(failCount > 0 ? 1 : 0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

export { getMissingDates, scrapePuzzle, mergePuzzles, normalizeDate };
