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
        let targetPuzzleNum = null;
        
        if (daysAgo === 0) {
            // Go directly to main page (today's daily puzzle)
            url = 'https://connectionsplus.io/';
            console.log(`Fetching today's puzzle from ${url}...`);
            await page.goto(url, { waitUntil: 'load', timeout: 60000 });
            await page.waitForTimeout(3000);
        } else {
            // Calculate target puzzle number from collection
            const collectionPath = path.join(__dirname, '../data/collected-puzzles.json');
            const collectionData = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
            const puzzleIds = collectionData.puzzles.map(p => p.id).sort((a, b) => a - b);
            const referenceId = puzzleIds[puzzleIds.length - 1] + 1; // max + 1
            targetPuzzleNum = referenceId - daysAgo;
            
            // Go directly to the puzzle URL
            url = `https://connectionsplus.io/game/${targetPuzzleNum}`;
            console.log(`Fetching puzzle #${targetPuzzleNum} from ${url}...`);
            await page.goto(url, { waitUntil: 'load', timeout: 60000 });
            await page.waitForTimeout(3000);
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
        
        // Extract date (format: "November 29, 2025")
        // Use [A-Za-z]+ to match only letters (not \w+ which includes digits)
        const dateMatch = puzzleText.match(/[A-Za-z]+\s+\d+,\s*\d{4}/);
        if (dateMatch) {
            metadata.date = dateMatch[0];
        } else {
            metadata.date = new Date().toLocaleDateString('en-US', { 
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
        
        // Play the game: select 4 DIFFERENT words each time, submit, deselect - repeat until 4 mistakes
        console.log('Making guesses to accumulate 4 mistakes...');
        
        // Wait for word tiles to be present
        // Word tiles have the specific class css-l7vr7s (distinct from control buttons)
        await page.waitForFunction(() => {
            const buttons = Array.from(document.querySelectorAll('button.css-l7vr7s'));
            return buttons.length >= 15; // Wait for at least 15 tiles
        }, { timeout: 10000 });
        
        // Get all word tile buttons (they have the css-l7vr7s class)
        const wordTiles = await page.locator('button.css-l7vr7s').all();
        
        console.log(`Found ${wordTiles.length} word tiles`);
        
        // Track which words we've already used across all attempts
        const usedWords = new Set();
        
        // Track mistakes (we need 4 mistakes, not 4 attempts)
        let mistakeCount = 0;
        let attemptCount = 0;
        const maxMistakes = 4;
        const maxAttempts = 20; // Safety limit to prevent infinite loop
        
        // Track solved categories as they appear
        const solvedCategories = [];
        
        // Select different sets of 4 words for each attempt
        while (mistakeCount < maxMistakes && attemptCount < maxAttempts) {
            attemptCount++;
            console.log(`Attempt ${attemptCount} (${mistakeCount}/${maxMistakes} mistakes)...`);
            
            try {
                // Re-query tiles before each attempt (they may be re-ordered after submit)
                await page.waitForTimeout(500); // Small wait before querying
                const currentTiles = await page.locator('button.css-l7vr7s').all();
                const tileCountBefore = currentTiles.length;
                console.log(`  Found ${tileCountBefore} tiles available`);
                
                // Debug: log the text of all tiles
                const allTileTexts = [];
                for (const tile of currentTiles) {
                    allTileTexts.push(await tile.textContent());
                }
                console.log(`  Tile texts:`, allTileTexts.join(', '));
                
                // Find 4 unused words
                const wordsForThisAttempt = [];
                for (const tile of currentTiles) {
                    if (wordsForThisAttempt.length >= 4) break;
                    
                    const text = await tile.textContent();
                    const trimmed = text.trim();
                    
                    if (!usedWords.has(trimmed)) {
                        wordsForThisAttempt.push(trimmed); // Store only text, not button
                    }
                }
                
                console.log(`  Selecting words:`, wordsForThisAttempt.join(', '));
                
                // Click each word by re-querying it (avoid stale locators)
                const clickedWords = [];
                for (const wordText of wordsForThisAttempt) {
                    // Escape special regex characters in word text
                    const escapedWord = wordText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // Re-query the tile by its text content
                    const tile = page.locator('button.css-l7vr7s').filter({ hasText: new RegExp(`^${escapedWord}$`) });
                    await tile.first().click();
                    clickedWords.push(wordText);
                    usedWords.add(wordText);
                }
                
                console.log(`  Selected ${clickedWords.length} words:`, clickedWords.join(', '));
                await page.waitForTimeout(500);
                
                // Click Submit
                await page.getByRole('button', { name: 'Submit' }).click();
                console.log('  Clicked Submit');
                
                // Wait for DOM to update by checking tile count change
                await page.waitForTimeout(1000);
                let tileCountAfter = tileCountBefore;
                let waitAttempts = 0;
                while (tileCountAfter === tileCountBefore && waitAttempts < 10) {
                    await page.waitForTimeout(500);
                    const tiles = await page.locator('button.css-l7vr7s').all();
                    tileCountAfter = tiles.length;
                    waitAttempts++;
                }
                
                // Check if tiles were removed (correct guess) or not (wrong guess)
                if (tileCountAfter < tileCountBefore) {
                    console.log(`  ✓ Correct guess! Tiles: ${tileCountBefore} → ${tileCountAfter}`);
                    
                    // Extract ALL newly revealed categories (site may show multiple after each solve)
                    // Wait longer and poll for categories to appear
                    await page.waitForTimeout(3000); // Longer wait for category animation
                    
                    // Poll for category divs with multiple attempts
                    let categoryDivs = [];
                    for (let pollAttempt = 0; pollAttempt < 5; pollAttempt++) {
                        categoryDivs = await page.locator('div.css-jtgcyt').all();
                        if (categoryDivs.length > 0) break;
                        await page.waitForTimeout(500);
                    }
                    
                    // If still no divs found, try broader selectors
                    if (categoryDivs.length === 0) {
                        categoryDivs = await page.locator('[class*="category"], div[class*="css-j"]').all();
                    }
                    console.log(`  Found ${categoryDivs.length} category divs, have ${solvedCategories.length} captured so far`);
                    
                    // Try to extract from ALL visible category divs (not just the first one)
                    for (const categoryDiv of categoryDivs) {
                        try {
                            // Get the full text and parse it
                            const fullText = (await categoryDiv.textContent()).trim();
                            
                            // Try to find words using the words selector
                            const wordsEl = categoryDiv.locator('.css-z9cpgb, p.chakra-text.css-z9cpgb').first();
                            if (await wordsEl.count() > 0) {
                                const wordsText = (await wordsEl.textContent()).trim();
                                const words = wordsText.split(',').map(w => w.trim()).filter(w => w.length > 0);
                                
                                // Check if we already captured this category by comparing words
                                const wordsKey = words.sort().join(',');
                                const alreadyCaptured = solvedCategories.some(cat => 
                                    cat.words.sort().join(',') === wordsKey
                                );
                                
                                if (!alreadyCaptured && words.length === 4) {
                                    // Extract category name by removing the words from the full text
                                    let categoryName = fullText;
                                    words.forEach(word => {
                                        categoryName = categoryName.replace(word, '').replace(',', '');
                                    });
                                    categoryName = categoryName.trim();
                                    
                                    solvedCategories.push({
                                        name: categoryName,
                                        words: words
                                    });
                                    console.log(`  📦 Captured category ${solvedCategories.length}: ${categoryName} - ${words.join(', ')}`);
                                } else if (alreadyCaptured) {
                                    console.log(`  ⚠️ Category already captured (duplicate)`);
                                }
                            }
                        } catch (err) {
                            console.log(`  ⚠️ Error extracting category: ${err.message}`);
                        }
                    }
                    
                    if (categoryDivs.length === 0) {
                        console.log(`  ⚠️ No category divs found after correct guess`);
                    }
                    
                    // Clear used words since correct categories are removed from board
                    usedWords.clear();
                    // Wait for category reveal animation - NO deselect needed
                    await page.waitForTimeout(2000);
                    
                    // Check if game is complete
                    if (tileCountAfter === 0) {
                        console.log('  🎉 All categories solved!');
                        break;
                    }
                } else {
                    console.log(`  ✗ Wrong guess (mistake #${mistakeCount + 1})`);
                    mistakeCount++;
                    
                    // Click Deselect All after WRONG guess only
                    const deselectBtn = page.locator('button.chakra-button').filter({ hasText: /deselect/i });
                    if (await deselectBtn.count() > 0) {
                        await deselectBtn.first().click();
                        console.log('  Clicked Deselect All');
                    }
                    await page.waitForTimeout(1000);
                }
                
            } catch (err) {
                console.log(`  Error on attempt ${attemptCount}:`, err.message);
                mistakeCount++; // Count errors as mistakes to prevent infinite loop
            }
        }
        
        await page.waitForTimeout(3000);
        
        // Check if categories are already visible (game was solved during attempts)
        console.log('Checking if categories are already revealed...');
        let categoriesAlreadyVisible = await page.locator('div.css-jtgcyt').count();
        console.log(`  Found ${categoriesAlreadyVisible} categories already visible`);
        
        // If game was fully solved, all 4 categories should already be visible
        // Don't try to reveal answer if we already have all categories
        const gameFullySolved = categoriesAlreadyVisible >= 4 || solvedCategories.length >= 4;
        
        if (!gameFullySolved && categoriesAlreadyVisible < 4) {
            // CRITICAL: After 4 mistakes, a modal appears that must be closed first!
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
        } else {
            console.log('  ✓ All categories already revealed (game was solved during attempts)');
        }
        
        // Wait for categories to be revealed (they should all be visible now)
        console.log('Waiting for categories to render...');
        await page.waitForTimeout(3000);
        
        // Try multiple selectors to find all category divs
        let categoryDivs = [];
        const selectors = [
            'div.css-jtgcyt',                    // Primary selector
            '[class*="category"]',               // Any class containing "category"
            'div[class*="css-"][class*="gyt"]',  // Partial class match
            '.chakra-stack > div'                // Direct children of category container
        ];
        
        for (const selector of selectors) {
            const divs = await page.locator(selector).all();
            if (divs.length >= 4) {
                console.log(`Found ${divs.length} category divs using selector: ${selector}`);
                categoryDivs = divs;
                break;
            }
        }
        
        // If still no luck with selectors, try finding by content structure
        if (categoryDivs.length < 4) {
            console.log(`Only found ${categoryDivs.length} divs with known selectors, trying content-based search...`);
            const allDivs = await page.locator('div').all();
            
            const potentialCategories = [];
            for (const div of allDivs) {
                try {
                    const text = await div.textContent();
                    // Category divs contain comma-separated words and are not too long
                    if (text && text.includes(',') && text.length > 20 && text.length < 300) {
                        const hasMultiCommas = (text.match(/,/g) || []).length >= 2;
                        if (hasMultiCommas) {
                            potentialCategories.push(div);
                        }
                    }
                } catch (err) {
                    // Skip
                }
            }
            
            if (potentialCategories.length >= 4) {
                console.log(`Found ${potentialCategories.length} potential category divs by content`);
                categoryDivs = potentialCategories.slice(0, 4); // Take first 4
            }
        }
        
        console.log(`Final category div count: ${categoryDivs.length}`);
        
        // Take a screenshot for debugging
        const screenshotPath = path.join(__dirname, '../debug-solution.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to ${screenshotPath}`);
        
        // Extract all revealed categories
        console.log('Extracting revealed categories...');
        console.log(`Processing ${categoryDivs.length} category divs...`);
        
        const puzzleData = {
            id: metadata.id,
            date: metadata.date,
            categories: []
        };
        
        // Create a Set to track words we've already captured to avoid duplicates
        const capturedWordKeys = new Set();
        
        // If we captured categories during gameplay, use those first
        if (solvedCategories.length > 0) {
            console.log(`Using ${solvedCategories.length} categories captured during gameplay`);
            for (const cat of solvedCategories) {
                const wordsKey = cat.words.sort().join(',');
                capturedWordKeys.add(wordsKey);
            }
            puzzleData.categories = solvedCategories.map((cat, idx) => ({
                name: cat.name,
                words: cat.words,
                difficulty: idx * 4 + 1,
                color: ['#F9DF6D', '#A0C35A', '#B0C4EF', '#BA81C5'][idx] || '#F9DF6D'
            }));
        }
        
        // Also try to extract from the DOM (for any missed or additional categories)
        console.log(`Scanning ${categoryDivs.length} DOM category divs for additional categories...`);
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
                        
                        if (isBold && text.length > 3) {
                            // This might be the category name, possibly with word list concatenated
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
                
                // If we found both, try to clean up category name if words are concatenated
                if (categoryName && words.length === 4) {
                    // Check if the first word appears in the category name (concatenated)
                    const firstWord = words[0];
                    const wordListStr = words.join(', ');
                    
                    // Try to find where the word list starts in the category name
                    if (categoryName.includes(firstWord)) {
                        const firstWordIndex = categoryName.indexOf(firstWord);
                        if (firstWordIndex > 5) {  // Make sure there's actual category text before it
                            const cleanCategoryName = categoryName.substring(0, firstWordIndex).trim();
                            console.log(`    Cleaned category name: "${categoryName}" -> "${cleanCategoryName}"`);
                            categoryName = cleanCategoryName;
                        }
                    }
                }
                
                if (categoryName && words.length === 4) {
                    console.log(`  Strategy 2 (font-weight) found: ${categoryName} - ${words.length} words`);
                } else {
                    console.log(`  Strategy 2 incomplete: categoryName="${categoryName}", words.length=${words.length}`);
                }
            }
            
            if (categoryName && words.length === 4) {
                // Check if we already captured this category (deduplicate)
                const wordsKey = words.sort().join(',');
                
                if (capturedWordKeys.has(wordsKey)) {
                    console.log(`  Skipped div ${idx + 1}: Already captured (duplicate) - ${categoryName}`);
                } else {
                    console.log(`Category ${idx + 1}: ${categoryName} - ${words.join(', ')}`);
                    
                    // Difficulty: assign based on current category count
                    const difficulty = puzzleData.categories.length * 4 + 1;
                    
                    puzzleData.categories.push({
                        name: categoryName,
                        words: words,
                        difficulty: difficulty,
                        color: DIFFICULTY_COLORS[difficulty]
                    });
                    
                    capturedWordKeys.add(wordsKey);
                }
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
                console.log('Note: Run "node scripts/process-scraped-data.js" to update app puzzle files');
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
