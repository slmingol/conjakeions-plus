#!/usr/bin/env node
/**
 * Daily Connections puzzle scraper for connectionsplus.io
 * Fetches today's puzzle with solution by playing through it
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color mapping for difficulty levels
const DIFFICULTY_COLORS = {
    1: '#F9DF6D', // Yellow - Straightforward
    5: '#A0C35A', // Green
    9: '#B0C4EF', // Blue
    13: '#BA81C5'  // Purple - Tricky
};

/**
 * Get a puzzle from connectionsplus.io by playing to reveal solution
 * @param {number} daysAgo - How many days ago (0 = today, 1 = yesterday, etc.)
 */
async function getTodaysPuzzle(daysAgo = 0) {
    let browser;
    let context;
    try {
        console.log(`[${new Date().toISOString()}] Starting puzzle scrape (${daysAgo} days ago)...`);
        
        browser = await chromium.launch({ 
            headless: true
        });
        
        context = await browser.newContext({
            viewport: { width: 1280, height: 800 }
        });
        
        const page = await context.newPage();
        
        // Listen to console logs from the page
        page.on('console', msg => {
            const text = msg.text();
            if (!text.includes('Failed to load resource')) {
                console.log('[Page]', text);
            }
        });
        
        let url;
        if (daysAgo === 0) {
            // Go directly to main page (today's daily puzzle)
            url = 'https://connectionsplus.io/';
            console.log(`Fetching today's puzzle from ${url}...`);
            await page.goto(url, { waitUntil: 'load', timeout: 60000 });
            await page.waitForTimeout(3000);
        } else {
            // Go to archive and click on specific past puzzle
            url = 'https://connectionsplus.io/nyt-archive';
            console.log(`Fetching archive from ${url}...`);
            await page.goto(url, { waitUntil: 'load', timeout: 60000 });
            await page.waitForTimeout(3000);
            
            // First, get today's puzzle number from the page
            const bodyText = await page.textContent('body');
            const todayMatch = bodyText.match(/Connections #(\d+)/);
            if (!todayMatch) {
                throw new Error('Could not find today\'s puzzle number in archive');
            }
            const todayPuzzleNum = parseInt(todayMatch[1]);
            const targetPuzzleNum = todayPuzzleNum - daysAgo;
            
            console.log(`Today's puzzle: #${todayPuzzleNum}, targeting #${targetPuzzleNum}`);
            
            // Click on the target puzzle in the archive (with pagination support)
            let puzzleCell = page.locator('td').filter({ hasText: `Connections #${targetPuzzleNum}` });
            let maxPages = 20; // Safety limit
            let pageNum = 1;
            
            while (await puzzleCell.count() === 0 && pageNum < maxPages) {
                // Look for "next-page" aria-label button
                const nextButton = page.getByRole('button', { name: 'next-page' });
                const hasNext = await nextButton.count() > 0 && await nextButton.isEnabled();
                
                if (!hasNext) {
                    throw new Error(`Puzzle #${targetPuzzleNum} not found in archive (checked ${pageNum} page(s))`);
                }
                
                console.log(`  Puzzle not on page ${pageNum}, clicking Next...`);
                await nextButton.click();
                await page.waitForTimeout(2000);
                pageNum++;
                
                // Re-query for the puzzle on the new page
                puzzleCell = page.locator('td').filter({ hasText: `Connections #${targetPuzzleNum}` });
            }
            
            if (await puzzleCell.count() === 0) {
                throw new Error(`Puzzle #${targetPuzzleNum} not found in archive after checking ${maxPages} pages`);
            }
            
            await puzzleCell.click();
            console.log(`Clicked on puzzle #${targetPuzzleNum}`);
            await page.waitForTimeout(2000);
        }
        
        console.log('Page loaded; waiting for word tiles...');
        
        // Extract puzzle metadata
        const puzzleText = await page.textContent('body');
        const metadata = {
            id: null,
            date: null
        };
        
        // Extract puzzle number
        const puzzleMatch = puzzleText.match(/Puzzle\s+#?(\d+)/i) || 
                           puzzleText.match(/#(\d+)/);
        if (puzzleMatch) {
            metadata.id = parseInt(puzzleMatch[1]);
        }
        
        // Extract date
        const dateMatch = puzzleText.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^,]*,\s*\w+\s+\d+,\s*\d{4}/);
        if (dateMatch) {
            metadata.date = dateMatch[0];
        } else {
            metadata.date = new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
        
        console.log(`Found puzzle #${metadata.id} - ${metadata.date}`);
        
        // Dismiss slider widget at bottom if present
        console.log('Dismissing slider widget...');
        try {
            const closeButtons = await page.locator('[class*="slider"] button, [class*="banner"] button, [class*="notification"] button, [class*="close"]').all();
            for (const btn of closeButtons) {
                if (await btn.isVisible()) {
                    await btn.click();
                    console.log('  Dismissed slider widget');
                }
            }
        } catch (err) {
            // Slider may not exist, that's OK
        }
        await page.waitForTimeout(1000);
        
        // Play the game: select 4 DIFFERENT words each time, submit, deselect - repeat 4 times
        console.log('Making 4 wrong guesses to exhaust attempts...');
        
        // Get all word buttons
        const allWordButtons = await page.locator('button.chakra-button').all();
        const wordTiles = [];
        
        for (const btn of allWordButtons) {
            const text = await btn.textContent();
            const trimmed = text.trim();
            // Filter out control buttons
            if (trimmed.length >= 3 && 
                trimmed.length <= 20 &&
                !trimmed.match(/^(submit|shuffle|deselect|share|close|reveal)/i)) {
                wordTiles.push(btn);
            }
        }
        
        console.log(`Found ${wordTiles.length} word tiles`);
        
        // Select different sets of 4 words for each attempt (0-3, 4-7, 8-11, 12-15)
        for (let attempt = 1; attempt <= 4; attempt++) {
            console.log(`Attempt ${attempt}/4...`);
            
            try {
                const startIdx = (attempt - 1) * 4;
                const endIdx = startIdx + 4;
                const wordsForThisAttempt = wordTiles.slice(startIdx, endIdx);
                
                // Click the words
                const clickedWords = [];
                for (const wordBtn of wordsForThisAttempt) {
                    const text = await wordBtn.textContent();
                    await wordBtn.click();
                    clickedWords.push(text.trim());
                }
                
                console.log(`  Selected ${clickedWords.length} words:`, clickedWords.join(', '));
                await page.waitForTimeout(500);
                
                // Click Submit
                await page.getByRole('button', { name: 'Submit' }).click();
                console.log('  Clicked Submit');
                await page.waitForTimeout(2000);
                
                // Click Deselect All after submit
                const deselectBtn = page.locator('button.chakra-button').filter({ hasText: /deselect/i });
                if (await deselectBtn.count() > 0) {
                    await deselectBtn.first().click();
                    console.log('  Clicked Deselect All');
                }
                await page.waitForTimeout(1000);
                
            } catch (err) {
                console.log(`  Error on attempt ${attempt}:`, err.message);
            }
        }
        
        await page.waitForTimeout(3000);
        
        // CRITICAL: After 4 attempts, a modal appears that must be closed first!
        console.log('Waiting for modal and looking for "Close" button...');
        
        try {
            // Wait for Close button to appear (use aria-label check from codegen)
            await page.getByRole('button', { name: 'Close' }).click({ timeout: 5000 });
            console.log('  ✓ Clicked "Close" button on modal');
            await page.waitForTimeout(1500);
        } catch (err) {
            console.log('  No "Close" button found (modal may be auto-dismissed)');
        }
        
        // Now the "Reveal Answer" button should be visible
        console.log('Looking for "Reveal Answer" button...');
        
        try {
            await page.getByRole('button', { name: 'Reveal Answer' }).click({ timeout: 5000 });
            console.log('  ✓ Clicked "Reveal Answer" button');
            await page.waitForTimeout(2000);
            
            // On archive puzzles, a "Nice try!" modal appears after revealing
            console.log('Checking for post-reveal modal...');
            try {
                await page.getByRole('button', { name: 'Close' }).click({ timeout: 3000 });
                console.log('  ✓ Dismissed "Nice try!" modal');
                await page.waitForTimeout(2000);  // Extra wait for categories to render after modal closes
            } catch (err) {
                console.log('  No post-reveal modal found');
            }
            await page.waitForTimeout(1000);
        } catch (err) {
            console.log('  ⚠️ "Reveal Answer" button not found');
        }
        
        // Wait for categories to be revealed (they should all be visible now)
        console.log('Waiting for categories to render...');
        await page.waitForTimeout(5000);  // Increased from 2s to 5s for archive puzzles
        
        // Take a screenshot for debugging
        const screenshotPath = path.join(__dirname, '../debug-solution.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to ${screenshotPath}`);
        
        // Extract all revealed categories
        console.log('Extracting revealed categories...');
        
        const categoryDivs = await page.locator('div.css-jtgcyt').all();
        console.log(`Found ${categoryDivs.length} category divs with css-jtgcyt`);
        
        const puzzleData = {
            id: metadata.id,
            date: metadata.date,
            categories: []
        };
        
        for (let idx = 0; idx < categoryDivs.length; idx++) {
            const div = categoryDivs[idx];
            
            // Debug: log the full text content of this div
            const divText = (await div.textContent()).trim();
            console.log(`\nDiv ${idx + 1} text (first 100 chars): ${divText.substring(0, 100)}`);
            
            // Try multiple selector strategies
            let categoryName = null;
            let words = [];
            
            // Strategy 1: Look for .css-1gxnet and .css-z9cpgb
            const categoryNameEl = div.locator('.css-1gxnet, p.chakra-text.css-1gxnet').first();
            const wordsEl = div.locator('.css-z9cpgb, p.chakra-text.css-z9cpgb').first();
            
            if (await categoryNameEl.count() > 0 && await wordsEl.count() > 0) {
                categoryName = (await categoryNameEl.textContent()).trim();
                const wordsText = (await wordsEl.textContent()).trim();
                words = wordsText.split(',').map(w => w.trim()).filter(w => w.length > 0);
                console.log(`  Strategy 1 (selectors) found: ${categoryName} - ${words.length} words`);
            } else {
                // Strategy 2: Look for bold text within the div
                // Category names are bold, word lists are regular weight
                console.log(`  Trying font-weight detection...`);
                const allTextElements = await div.locator('p, span, div').all();
                
                for (const el of allTextElements) {
                    try {
                        const fontWeight = await el.evaluate(node => {
                            const style = window.getComputedStyle(node);
                            return style.fontWeight;
                        });
                        const text = (await el.textContent()).trim();
                        
                        // Bold font weights are typically 600, 700, or 'bold'
                        const isBold = fontWeight === 'bold' || parseInt(fontWeight) >= 600;
                        
                        if (isBold && text.length > 3 && !text.includes(',')) {
                            // This is likely the category name (bold, no commas)
                            if (!categoryName || text.length > categoryName.length) {
                                categoryName = text;
                                console.log(`    Found bold text (weight ${fontWeight}): "${text}"`);
                            }
                        } else if (!isBold && text.includes(',')) {
                            // This is likely the word list (not bold, has commas)
                            const parsedWords = text.split(',').map(w => w.trim()).filter(w => w.length > 0);
                            if (parsedWords.length === 4 && !words.length) {
                                words = parsedWords;
                                console.log(`    Found word list (weight ${fontWeight}): ${words.join(', ')}`);
                            }
                        }
                    } catch (err) {
                        // Skip elements that can't be evaluated
                    }
                }
                
                if (categoryName && words.length === 4) {
                    console.log(`  Strategy 2 (font-weight) found: ${categoryName} - ${words.length} words`);
                } else {
                    console.log(`  Strategy 2 incomplete: categoryName="${categoryName}", words.length=${words.length}`);
                }
            }
            
            if (categoryName && words.length === 4) {
                console.log(`Category ${idx + 1}: ${categoryName} - ${words.join(', ')}`);
                
                // Difficulty: 1, 5, 9, 13 (yellow, green, blue, purple)
                const difficulty = idx * 4 + 1;
                
                puzzleData.categories.push({
                    name: categoryName,
                    words: words,
                    difficulty: difficulty,
                    color: DIFFICULTY_COLORS[difficulty]
                });
            } else {
                console.log(`  Skipped div ${idx + 1}: categoryName=${categoryName}, words.length=${words.length}`);
            }
        }
        
        console.log(`Final categories extracted: ${puzzleData.categories.length}`);
        
        await browser.close();
        
        if (puzzleData.categories.length === 4) {
            console.log(`✓ Successfully extracted solution with ${puzzleData.categories.length} categories`);
            puzzleData.categories.forEach((cat, idx) => {
                console.log(`  ${idx + 1}. [Difficulty ${cat.difficulty}] ${cat.name}`);
                console.log(`     ${cat.words.join(', ')}`);
            });
            
            return puzzleData;
        } else {
            console.log(`Warning: Only found ${puzzleData.categories.length} categories (expected 4)`);
            return puzzleData.categories.length > 0 ? puzzleData : null;
        }
        
    } catch (error) {
        console.error('Error fetching daily puzzle:', error.message);
        if (browser) await browser.close();
        return null;
    }
}

/**
 * Manual puzzle entry helper
 * Since connectionsgame.org may not expose the solution without playing,
 * this helps format manually entered puzzles
 */
function createPuzzleEntry(puzzleId, date, categories) {
    return {
        id: puzzleId,
        date: date,
        categories: categories.map((cat, idx) => ({
            name: cat.name,
            words: cat.words,
            difficulty: cat.difficulty || (idx + 1),
            color: DIFFICULTY_COLORS[cat.difficulty || (idx + 1)]
        }))
    };
}

/**
 * Add puzzle to collection
 */
function addToCollection(puzzleData) {
    try {
        // Determine paths
        const isContainer = fs.existsSync('/usr/share/nginx/html/');
        const collectionPath = isContainer 
            ? '/usr/share/nginx/html/collected-puzzles.json'
            : path.join(__dirname, '../data/collected-puzzles.json');
        
        console.log(`Using collection path: ${collectionPath}`);
        
        let collection = { 
            collected: new Date().toISOString(), 
            count: 0, 
            puzzles: [] 
        };
        
        if (fs.existsSync(collectionPath)) {
            collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
        }
        
        // Check if puzzle already exists
        const exists = collection.puzzles.some(p => p.id === puzzleData.id);
        
        if (exists) {
            console.log(`Puzzle #${puzzleData.id} already exists in collection`);
            return false;
        }
        
        // Add to beginning (newest first)
        collection.puzzles.unshift(puzzleData);
        collection.count = collection.puzzles.length;
        collection.collected = new Date().toISOString();
        
        // Save
        const dir = path.dirname(collectionPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
        console.log(`✓ Added puzzle #${puzzleData.id} to collection`);
        console.log(`Total puzzles: ${collection.count}`);
        
        return true;
        
    } catch (error) {
        console.error('Error adding to collection:', error.message);
        return false;
    }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    // Check for daysAgo argument (default 0 = today)
    const daysAgo = process.argv[2] ? parseInt(process.argv[2]) : 0;
    
    getTodaysPuzzle(daysAgo).then((puzzleData) => {
        if (puzzleData && puzzleData.categories && puzzleData.categories.length === 4) {
            const daysLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;
            console.log(`\n✓ Scrape successful! (${daysLabel})`);
            console.log(`Puzzle #${puzzleData.id} - ${puzzleData.date}`);
            console.log('Categories:');
            puzzleData.categories.forEach((cat, idx) => {
                console.log(`  ${idx + 1}. [Difficulty ${cat.difficulty}] ${cat.name}`);
                console.log(`     ${cat.words.join(', ')}`);
            });
            
            // Automatically add to collection
            const added = addToCollection(puzzleData);
            
            if (added) {
                console.log('\n✓ Added to collected-puzzles.json');
                console.log('Run "npm run merge" to add to main puzzle collection');
            }
            
            process.exit(0);
        } else if (puzzleData) {
            console.log('\n⚠ Partial data retrieved - may need manual completion');
            console.log('Puzzle data:', JSON.stringify(puzzleData, null, 2));
            process.exit(0);
        } else {
            console.log('\n✗ No puzzle retrieved');
            process.exit(1);
        }
    }).catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

export { 
    getTodaysPuzzle, 
    createPuzzleEntry, 
    addToCollection,
    DIFFICULTY_COLORS 
};
