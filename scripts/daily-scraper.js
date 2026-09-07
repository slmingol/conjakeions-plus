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
        
        // Use system chromium if available (for Docker containers)
        const launchOptions = {
            headless: true,
            timeout: 30000,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        };
        if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
        }

        browser = await chromium.launch(launchOptions);
        
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
            // Calculate target puzzle number - use src/puzzles.json which has the main dataset
            const srcPuzzlesPath = path.join(__dirname, '../src/puzzles.json');
            const collectionPath = path.join(__dirname, '../data/collected-puzzles.json');
            
            let maxPuzzleId = 0;
            
            // First, try to get max ID from src/puzzles.json (has 1000+ puzzles)
            if (fs.existsSync(srcPuzzlesPath)) {
                const srcPuzzles = JSON.parse(fs.readFileSync(srcPuzzlesPath, 'utf8'));
                const srcIds = srcPuzzles.map(p => p.id).filter(id => id != null);
                if (srcIds.length > 0) {
                    maxPuzzleId = Math.max(...srcIds);
                }
            }
            
            // Also check collected puzzles for any newer ones
            if (fs.existsSync(collectionPath)) {
                const collectionData = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
                const collectedIds = collectionData.puzzles.map(p => p.id).filter(id => id != null);
                if (collectedIds.length > 0) {
                    maxPuzzleId = Math.max(maxPuzzleId, ...collectedIds);
                }
            }
            
            if (maxPuzzleId === 0) {
                console.log('⚠️  No puzzles found to calculate puzzle number from.');
                console.log('   Fetch today\'s puzzle first (daysAgo=0) to initialize.');
                return null;
            }
            
            // maxPuzzleId represents the most recent puzzle we know about (typically today's)
            // To go back N days, simply subtract N from the max ID
            targetPuzzleNum = maxPuzzleId - daysAgo;
            
            // Safety check: don't try to fetch puzzles before #1
            if (targetPuzzleNum <= 0) {
                console.log(`⚠️  Cannot fetch puzzle from ${daysAgo} days ago`);
                console.log(`   Calculated puzzle #${targetPuzzleNum} (max known: #${maxPuzzleId})`);
                console.log(`   This would be before the first puzzle. Skipping.`);
                return null;
            }
            
            console.log(`Calculated puzzle # for ${daysAgo} days ago: #${targetPuzzleNum} (max known: #${maxPuzzleId})`);
            
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

        // Game word tiles are always displayed ALL-CAPS; control buttons (Submit, Shuffle, etc.) use mixed case.
        // This avoids brittle Chakra-UI hash class selectors that change on every site deploy.
        const CONTROL_TEXT_RE = /^(submit|shuffle|deselect(\s+all)?|organize|share|hints?|close|reveal|game|archive|community|create|play|random|next|back|tap|click|sign|log\s+in)$/i;

        async function getGameTileTexts() {
            return page.evaluate(() => {
                return Array.from(document.querySelectorAll('button'))
                    .filter(btn => {
                        const t = btn.textContent.trim();
                        return t.length > 0 && t.length <= 60 &&
                               t === t.toUpperCase() && /[A-Z]/.test(t) &&
                               btn.offsetParent !== null; // visible in layout
                    })
                    .map(btn => btn.textContent.trim());
            });
        }

        // Wait for word tiles to be present
        await page.waitForFunction(() => {
            return Array.from(document.querySelectorAll('button'))
                .filter(btn => {
                    const t = btn.textContent.trim();
                    return t.length > 0 && t.length <= 60 &&
                           t === t.toUpperCase() && /[A-Z]/.test(t) &&
                           btn.offsetParent !== null;
                }).length >= 15;
        }, { timeout: 10000 });

        const initialTileTexts = await getGameTileTexts();
        console.log(`Found ${initialTileTexts.length} word tiles`);
        
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
                await page.waitForTimeout(800); // Wait for any animation to settle
                const allTileTexts = await getGameTileTexts();
                const tileCountBefore = allTileTexts.length;
                console.log(`  Found ${tileCountBefore} tiles available`);
                console.log(`  Tile texts:`, allTileTexts.join(', '));

                if (tileCountBefore === 0) {
                    console.log('  No tiles found — game may be complete');
                    break;
                }

                // Find 4 unused words
                const wordsForThisAttempt = [];
                for (const text of allTileTexts) {
                    if (wordsForThisAttempt.length >= 4) break;
                    if (!usedWords.has(text)) {
                        wordsForThisAttempt.push(text);
                    }
                }

                if (wordsForThisAttempt.length < 4) {
                    console.log(`  Only ${wordsForThisAttempt.length} unused words — clearing used set`);
                    usedWords.clear();
                    wordsForThisAttempt.length = 0;
                    for (const text of allTileTexts) {
                        if (wordsForThisAttempt.length >= 4) break;
                        wordsForThisAttempt.push(text);
                    }
                }

                console.log(`  Selecting words:`, wordsForThisAttempt.join(', '));

                // Click each word by text — no CSS class dependency
                const clickedWords = [];
                for (const wordText of wordsForThisAttempt) {
                    const escapedWord = wordText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // Match button by exact text; game words are unique on the board
                    const tile = page.locator('button').filter({ hasText: new RegExp(`^${escapedWord}$`) });
                    await tile.first().click({ timeout: 10000 });
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
                    tileCountAfter = (await getGameTileTexts()).length;
                    waitAttempts++;
                }
                
                // Check if tiles were removed (correct guess) or not (wrong guess)
                if (tileCountAfter < tileCountBefore) {
                    console.log(`  ✓ Correct guess! Tiles: ${tileCountBefore} → ${tileCountAfter}`);
                    
                    // Extract ALL newly revealed categories (site may show multiple after each solve)
                    // Wait longer and poll for categories to appear
                    await page.waitForTimeout(3000); // Longer wait for category animation
                    
                    // Extract solved category data via page.evaluate (no CSS class dependency)
                    const newCategories = await page.evaluate(() => {
                        const results = [];
                        // Find all divs that look like solved category cards:
                        // - have a background color (yellow/green/blue/purple)
                        // - contain a category name + 4 words
                        const allDivs = Array.from(document.querySelectorAll('div, section, article'));
                        for (const div of allDivs) {
                            const style = window.getComputedStyle(div);
                            const bg = style.backgroundColor;
                            // Skip transparent/white/near-white backgrounds
                            if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
                            // Look for the Connections palette colors (rgb values)
                            const isGameColor = [
                                'rgb(249, 223, 109)', // yellow
                                'rgb(160, 195, 90)',  // green
                                'rgb(176, 196, 239)', // blue
                                'rgb(186, 129, 197)', // purple
                            ].some(c => bg.includes(c.slice(4, -1))); // compare r,g,b values loosely
                            if (!isGameColor) continue;

                            // Collect all leaf text nodes within this element
                            const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
                            const texts = [];
                            let node;
                            while ((node = walker.nextNode())) {
                                const t = node.textContent.trim();
                                if (t) texts.push(t);
                            }

                            // The category name is typically the first substantial non-word text;
                            // words are uppercase tokens. Require exactly 4 uppercase tokens.
                            const upperTokens = texts.filter(t => t === t.toUpperCase() && /[A-Z]/.test(t) && t.length < 60);
                            const nameTokens = texts.filter(t => t !== t.toUpperCase() || !/[A-Z]/.test(t));
                            if (upperTokens.length === 4 && nameTokens.length > 0) {
                                results.push({ name: nameTokens[0].trim(), words: upperTokens });
                            }
                        }
                        return results;
                    });

                    console.log(`  Found ${newCategories.length} category card(s) via background-color, have ${solvedCategories.length} captured so far`);
                    for (const cat of newCategories) {
                        const wordsKey = [...cat.words].sort().join(',');
                        const alreadyCaptured = solvedCategories.some(c => [...c.words].sort().join(',') === wordsKey);
                        if (!alreadyCaptured && cat.words.length === 4 && cat.name) {
                            solvedCategories.push(cat);
                            console.log(`  Captured category ${solvedCategories.length}: ${cat.name} - ${cat.words.join(', ')}`);
                        }
                    }
                    if (newCategories.length === 0) {
                        console.log(`  No category cards found after correct guess`);
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
        // Use background-color detection (same logic as in-gameplay capture)
        const categoriesAlreadyVisible = await page.evaluate(() => {
            const GAME_COLORS = ['249, 223, 109', '160, 195, 90', '176, 196, 239', '186, 129, 197'];
            return Array.from(document.querySelectorAll('div, section'))
                .filter(el => {
                    const bg = window.getComputedStyle(el).backgroundColor;
                    return bg && GAME_COLORS.some(c => bg.includes(c));
                }).length;
        });
        console.log(`  Found ${categoriesAlreadyVisible} categories already visible`);

        // Don't try to reveal if we already captured all 4 during gameplay
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
                await page.getByRole('button', { name: /reveal/i }).click({ timeout: 5000 });
                console.log('  ✓ Clicked reveal button');
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
                console.log('  ⚠️ No reveal button found');
            }
        } else {
            console.log('  ✓ All categories already revealed (game was solved during attempts)');
        }

        // Click any "Click/Tap to reveal a word" buttons — site now hides individual words
        // behind per-word reveal buttons even after the main "Reveal Answer" is clicked.
        console.log('Clicking any hidden word reveal buttons...');
        try {
            for (let pass = 0; pass < 3; pass++) {
                const revealBtns = await page.locator('button, [role="button"]')
                    .filter({ hasText: /reveal a word/i }).all();
                if (revealBtns.length === 0) break;
                console.log(`  Pass ${pass + 1}: found ${revealBtns.length} reveal button(s)`);
                for (const btn of revealBtns) {
                    try {
                        if (await btn.isVisible()) {
                            await btn.click();
                            await page.waitForTimeout(200);
                        }
                    } catch (_) { /* stale element, skip */ }
                }
                await page.waitForTimeout(1000);
            }
        } catch (err) {
            console.log(`  ⚠️ Error clicking reveal buttons: ${err.message}`);
        }

        // Wait for categories to be revealed (they should all be visible now)
        console.log('Waiting for categories to render...');
        await page.waitForTimeout(3000);
        
        // Save page HTML for debugging
        try {
            const htmlContent = await page.content();
            const htmlPath = path.join(__dirname, '../debug-page.html');
            fs.writeFileSync(htmlPath, htmlContent);
            console.log(`Debug HTML saved to ${htmlPath}`);
            // Also write to nginx html dir if running in container
            const nginxHtml = '/usr/share/nginx/html/debug-page.html';
            if (fs.existsSync('/usr/share/nginx/html')) {
                fs.writeFileSync(nginxHtml, htmlContent);
                console.log(`Debug HTML also at ${nginxHtml} (browse to /debug-page.html)`);
            }
        } catch (err) {
            console.log(`  ⚠️ Could not save debug HTML: ${err.message}`);
        }

        // Strategy 0: extract from Next.js __NEXT_DATA__ or React component state
        let nextDataCategories = null;
        try {
            nextDataCategories = await page.evaluate(() => {
                // Try __NEXT_DATA__ (Next.js SSR payload)
                const nextEl = document.getElementById('__NEXT_DATA__');
                if (nextEl) {
                    const data = JSON.parse(nextEl.textContent);
                    // Walk the props tree looking for categories/puzzle arrays
                    const json = JSON.stringify(data);
                    const m = json.match(/"categories"\s*:\s*(\[.*?\](?:,|\}))/);
                    if (m) {
                        try { return JSON.parse(m[1]); } catch (_) {}
                    }
                }
                // Try common window-level puzzle state keys
                for (const key of ['__puzzle__', '__PUZZLE__', '__gameData__', '__state__']) {
                    if (window[key]) return window[key].categories || null;
                }
                return null;
            });
            if (nextDataCategories) {
                console.log(`Strategy 0 (Next.js state): found categories data`);
            }
        } catch (err) {
            console.log(`  Strategy 0 failed: ${err.message}`);
        }

        // Try multiple selectors to find all category divs
        let categoryDivs = [];
        const selectors = [
            'div.css-jtgcyt',                    // Legacy Chakra hash (may still work)
            '[class*="category"]',               // Any class containing "category"
            'div[class*="css-"][class*="gyt"]',  // Partial Chakra hash match
            '.chakra-stack > div',               // Direct children of category container
            '[data-testid*="category"]',         // Test-id based
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
                    // Skip divs that still contain "reveal a word" — not fully revealed yet
                    if (!text || text.toLowerCase().includes('reveal a word')) continue;
                    if (text.length > 20 && text.length < 400) {
                        const childCount = await div.locator('> *').count();
                        // Category containers typically have 2 direct children (name + word list)
                        if (childCount >= 2 && childCount <= 6) {
                            potentialCategories.push(div);
                        }
                    }
                } catch (err) {
                    // Skip
                }
            }

            if (potentialCategories.length >= 4) {
                console.log(`Found ${potentialCategories.length} potential category divs by structure`);
                categoryDivs = potentialCategories; // process all; extraction loop filters non-categories
            }
        }

        console.log(`Final category div count: ${categoryDivs.length}`);
        
        // Take a screenshot for debugging
        const screenshotPath = path.join(__dirname, '../debug-solution.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to ${screenshotPath}`);
        
        // Extract all revealed categories
        console.log('Extracting revealed categories...');

        const puzzleData = {
            id: metadata.id,
            date: metadata.date,
            categories: []
        };

        const capturedWordKeys = new Set();

        // If we captured categories during gameplay, use those first
        if (solvedCategories.length > 0) {
            console.log(`Using ${solvedCategories.length} categories captured during gameplay`);
            for (const cat of solvedCategories) {
                capturedWordKeys.add([...cat.words].sort().join(','));
            }
            puzzleData.categories = solvedCategories.map((cat, idx) => ({
                name: cat.name,
                words: cat.words,
                difficulty: idx * 4 + 1,
                color: ['#F9DF6D', '#A0C35A', '#B0C4EF', '#BA81C5'][idx] || '#F9DF6D'
            }));
        }

        // Strategy 0: use Next.js state data if successfully extracted earlier
        if (puzzleData.categories.length < 4 && nextDataCategories && Array.isArray(nextDataCategories)) {
            console.log(`Strategy 0 (Next.js state): processing ${nextDataCategories.length} categories`);
            for (const cat of nextDataCategories) {
                const words = Array.isArray(cat.words) ? cat.words : (cat.answers || []);
                const name = cat.name || cat.title || cat.category || '';
                if (name && words.length === 4) {
                    const wordsKey = [...words].sort().join(',');
                    if (!capturedWordKeys.has(wordsKey)) {
                        const difficulty = puzzleData.categories.length * 4 + 1;
                        puzzleData.categories.push({
                            name,
                            words,
                            difficulty,
                            color: DIFFICULTY_COLORS[difficulty]
                        });
                        capturedWordKeys.add(wordsKey);
                    }
                }
            }
            console.log(`  Strategy 0 yielded ${puzzleData.categories.length} categories`);
        }

        // Strategies 1-3: scan DOM category divs for any still-missing categories
        console.log(`Scanning ${categoryDivs.length} DOM category divs for additional categories...`);
        for (let idx = 0; idx < categoryDivs.length; idx++) {
            if (puzzleData.categories.length >= 4) break;
            const div = categoryDivs[idx];

            const divText = (await div.textContent()).trim();
            console.log(`\nDiv ${idx + 1} text (first 100 chars): ${divText.substring(0, 100)}`);

            let categoryName = null;
            let words = [];

            // Strategy 1: legacy Chakra hash class selectors (may still work)
            const categoryNameEl = div.locator('.css-1gxnet, p.chakra-text.css-1gxnet').first();
            const wordsEl = div.locator('.css-z9cpgb, p.chakra-text.css-z9cpgb').first();

            if (await categoryNameEl.count() > 0 && await wordsEl.count() > 0) {
                categoryName = (await categoryNameEl.textContent()).trim();
                const wordsText = (await wordsEl.textContent()).trim();
                words = wordsText.split(',').map(w => w.trim()).filter(w => w.length > 0);
                console.log(`  Strategy 1 (CSS selectors) found: ${categoryName} - ${words.length} words`);
            }

            // Strategy 2: evaluate each leaf text node via font-weight
            if (!categoryName || words.length !== 4) {
                console.log(`  Trying font-weight detection...`);
                const allTextElements = await div.locator('p, span, div').all();

                for (const el of allTextElements) {
                    try {
                        const { fw, text } = await el.evaluate(node => ({
                            fw: window.getComputedStyle(node).fontWeight,
                            text: node.textContent.trim()
                        }));
                        if (!text || text.toLowerCase().includes('reveal')) continue;

                        const isBold = fw === 'bold' || parseInt(fw) >= 600;
                        if (isBold && text.length > 3 && !text.includes(',')) {
                            if (!categoryName) categoryName = text;
                        } else if (!isBold && text.includes(',') && !words.length) {
                            const parsed = text.split(',').map(w => w.trim()).filter(w => w.length > 0);
                            if (parsed.length === 4) words = parsed;
                        }
                    } catch (_) {}
                }

                if (categoryName && words.length === 4) {
                    console.log(`  Strategy 2 (font-weight) found: ${categoryName} - ${words.length} words`);
                } else {
                    console.log(`  Strategy 2 incomplete: categoryName="${categoryName}", words.length=${words.length}`);
                }
            }

            // Strategy 3: parse raw div text — site renders [WORD1][WORD2]...[CAT NAME][WORD1]...
            // After all reveal-buttons are clicked the text should be clean joined words.
            if (!categoryName || words.length !== 4) {
                console.log(`  Trying raw text parse (Strategy 3)...`);
                // Strip "Click/Tap to reveal a word" noise
                const cleaned = divText.replace(/click\s*\/?\s*tap\s+to\s+reveal\s+a\s+word/gi, '').trim();
                // Split on uppercase word boundaries — connection words are all-caps
                const tokens = cleaned.match(/[A-Z][A-Z0-9 ',.-]*/g) || [];
                console.log(`  Strategy 3 tokens: ${JSON.stringify(tokens.slice(0, 10))}`);
                // Heuristic: category name is a phrase; words are shorter tokens
                if (tokens.length >= 5) {
                    // Longest token is likely the category name
                    const sorted = [...tokens].sort((a, b) => b.length - a.length);
                    categoryName = sorted[0].trim();
                    words = tokens.filter(t => t.trim() !== categoryName).slice(0, 4).map(t => t.trim());
                    if (words.length === 4) {
                        console.log(`  Strategy 3 found: ${categoryName} - ${words.join(', ')}`);
                    } else {
                        categoryName = null;
                        words = [];
                        console.log(`  Strategy 3 failed (${words.length} words)`);
                    }
                }
            }

            if (categoryName && words.length === 4) {
                const wordsKey = [...words].sort().join(',');
                if (capturedWordKeys.has(wordsKey)) {
                    console.log(`  Skipped div ${idx + 1}: duplicate`);
                } else {
                    const difficulty = puzzleData.categories.length * 4 + 1;
                    puzzleData.categories.push({
                        name: categoryName,
                        words,
                        difficulty,
                        color: DIFFICULTY_COLORS[difficulty]
                    });
                    capturedWordKeys.add(wordsKey);
                    console.log(`Category ${idx + 1}: ${categoryName} - ${words.join(', ')}`);
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
        // Determine paths - always use /app/data which is persisted via volume
        const collectionPath = path.join(__dirname, '../data/collected-puzzles.json');
        
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
