#!/usr/bin/env node
/**
 * Daily Connections puzzle scraper for connectionsgame.org
 * Fetches today's puzzle with solution
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color mapping for difficulty levels
const DIFFICULTY_COLORS = {
    1: '#F9DF6D', // Yellow
    2: '#A0C35A', // Green
    3: '#B0C4EF', // Blue
    4: '#BA81C5'  // Purple
};

/**
 * Get today's puzzle from connectionsgame.org by playing to reveal solution
 */
async function getTodaysPuzzle() {
    let browser;
    try {
        console.log(`[${new Date().toISOString()}] Starting daily puzzle scrape...`);
        
        browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        // Listen to console logs from the page
        page.on('console', msg => {
            const text = msg.text();
            if (!text.includes('Failed to load resource')) {
                console.log('[Page]', text);
            }
        });
        
        const url = 'https://connectionsgame.org/';
        console.log(`Fetching ${url}...`);
        
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extract puzzle metadata
        const metadata = await page.evaluate(() => {
            const data = {
                id: null,
                date: null
            };
            
            const bodyText = document.body.textContent;
            
            // Extract puzzle number
            const puzzleMatch = bodyText.match(/Puzzle\s+#?(\d+)/i) || 
                               bodyText.match(/#(\d+)/);
            if (puzzleMatch) {
                data.id = parseInt(puzzleMatch[1]);
            }
            
            // Extract date
            const dateMatch = bodyText.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^,]*,\s*\w+\s+\d+,\s*\d{4}/);
            if (dateMatch) {
                data.date = dateMatch[0];
            } else {
                data.date = new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            }
            
            return data;
        });
        
        console.log(`Found puzzle #${metadata.id} - ${metadata.date}`);
        
        // Now play the game to reveal the solution
        console.log('Playing game to exhaust attempts and reveal solution...');
        
        // Make 4 random wrong guesses to trigger solution reveal
        for (let attempt = 1; attempt <= 4; attempt++) {
            console.log(`Attempt ${attempt}/4...`);
            
            try {
                // Find all clickable word elements (try multiple selector strategies)
                let wordButtons = await page.$$('button:not(:disabled)');
                
                // Filter to get only word buttons (not submit/shuffle/clear)
                wordButtons = wordButtons.filter(async (btn) => {
                    const text = await btn.evaluate(el => el.textContent);
                    return text && text.length > 2 && text.length < 20;
                });
                
                if (wordButtons.length < 4) {
                    console.log('Not enough word buttons found, trying alternative approach...');
                    // Try clicking any divs or spans that look like words
                    wordButtons = await page.$$('div.word, span.word, [class*="word-"]');
                }
                
                if (wordButtons.length === 0) {
                    console.log('No word buttons found');
                    break;
                }
                
                // Shuffle and select first 4
                const shuffled = wordButtons.sort(() => Math.random() - 0.5);
                const toClick = shuffled.slice(0, Math.min(4, shuffled.length));
                
                // Click 4 random words
                for (const button of toClick) {
                    try {
                        await button.click();
                        await new Promise(resolve => setTimeout(resolve, 300));
                    } catch (e) {
                        // Button might have become disabled, skip it
                    }
                }
                
                // Find submit button using text content
                const submitButton = await page.evaluateHandle(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    return buttons.find(btn => 
                        btn.textContent.toLowerCase().includes('submit') ||
                        btn.textContent.toLowerCase().includes('guess') ||
                        btn.className.toLowerCase().includes('submit')
                    );
                });
                
                if (submitButton && submitButton.asElement()) {
                    await submitButton.asElement().click();
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    console.log('Could not find submit button, trying Enter key...');
                    await page.keyboard.press('Enter');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (err) {
                console.log(`Error on attempt ${attempt}:`, err.message);
            }
        }
        
        // Wait for solution to be revealed or reveal button to appear
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if there's a "Give Up" or "Show Answer" button and click it
        console.log('Looking for reveal/give-up button...');
        const buttonClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
            const revealBtn = buttons.find(btn => {
                const text = btn.textContent.toLowerCase();
                return text.includes('give up') || 
                       text.includes('reveal') || 
                       text.includes('show answer') ||
                       text.includes('see solution') ||
                       text.includes('view answer');
            });
            
            if (revealBtn) {
                console.log('Found reveal button:', revealBtn.textContent);
                revealBtn.click();
                return true;
            }
            return false;
        });
        
        if (buttonClicked) {
            console.log('Clicked reveal button, waiting for solution...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
            console.log('No reveal button found, checking if solution already visible...');
        }
        
        // Take a screenshot for debugging
        const screenshotPath = path.join(__dirname, '../debug-solution.png');
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved to ${screenshotPath}`);
        
        // Extract the revealed solution
        const puzzleData = await page.evaluate((metadata) => {
            const data = {
                id: metadata.id,
                date: metadata.date,
                categories: []
            };
            
            // Debug: log what we're seeing
            console.log('Page title:', document.title);
            console.log('Looking for solved categories...');
            
            // Try multiple selectors for solved/revealed categories
            const possibleSelectors = [
                '.solved-category',
                '.category',
                '[class*="solved"]',
                '[class*="category"]',
                '[class*="group"]',
                'div[style*="background-color"]',
                '.result'
            ];
            
            let categoryElements = [];
            for (const selector of possibleSelectors) {
                const elements = Array.from(document.querySelectorAll(selector));
                console.log(`Selector "${selector}" found ${elements.length} elements`);
                
                if (elements.length >= 4) {
                    categoryElements = elements;
                    console.log('Using selector:', selector);
                    break;
                }
            }
            
            // If still nothing, try looking at all divs with background colors
            if (categoryElements.length === 0) {
                console.log('Trying all colored divs...');
                const allDivs = Array.from(document.querySelectorAll('div'));
                categoryElements = allDivs.filter(div => {
                    const style = window.getComputedStyle(div);
                    const bgColor = style.backgroundColor;
                    // Look for non-white/transparent backgrounds
                    return bgColor && !bgColor.includes('255, 255, 255') && bgColor !== 'rgba(0, 0, 0, 0)';
                });
                console.log(`Found ${categoryElements.length} colored divs`);
            }
            
            console.log(`Processing ${categoryElements.length} category elements...`);
            
            categoryElements.forEach((el, idx) => {
                const text = el.textContent || '';
                const trimmed = text.trim();
                
                console.log(`Element ${idx}: "${trimmed.substring(0, 100)}..."`);
                
                // Try multiple parsing strategies
                let categoryName = '';
                let words = [];
                
                // Strategy 1: Look for structured elements
                const titleEl = el.querySelector('.category-name, .group-name, .title, h3, h4, strong, [class*="title"], [class*="name"]');
                const wordsList = el.querySelector('.words, .items, [class*="word"]');
                
                if (titleEl && wordsList) {
                    categoryName = titleEl.textContent.trim();
                    words = wordsList.textContent.split(/[,\n]/).map(w => w.trim()).filter(w => w.length > 0);
                } else {
                    // Strategy 2: Parse as text with category name followed by words
                    // Pattern: "CATEGORY NAMEWORD1, WORD2, WORD3, WORD4"
                    // The category is typically all caps or title case, followed by comma-separated words
                    
                    // Try to split by commas first
                    const parts = trimmed.split(',').map(p => p.trim()).filter(p => p.length > 0);
                    
                    if (parts.length >= 4) {
                        // First part might have category name + first word concatenated
                        const firstPart = parts[0];
                        
                        // Look for transition from all-caps category to title-case word
                        // e.g., "TRUST AS REALACCEPT" -> "TRUST AS REAL" + "ACCEPT"
                        const match = firstPart.match(/^([A-Z\s]+?)([A-Z][a-z].*)$/);
                        if (match) {
                            categoryName = match[1].trim();
                            words = [match[2].trim(), ...parts.slice(1)];
                        } else {
                            // Just use first part as category, rest as words
                            categoryName = firstPart;
                            words = parts.slice(1);
                        }
                    } else {
                        // Try splitting by newlines
                        const lines = trimmed.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
                        if (lines.length > 0) {
                            categoryName = lines[0];
                            words = lines.slice(1);
                        }
                    }
                }
                
                // Clean up words
                words = words
                    .filter(w => w.length > 0 && w.length < 20)
                    .filter(w => !w.match(/^(puzzle|guess|mistake|remaining|category|trust|power|summary|name)/i))
                    .slice(0, 4); // Take first 4
                
                console.log(`  Category: "${categoryName}", Words: [${words.join(', ')}]`);
                
                // Only add if we have a name and exactly 4 words
                if (categoryName && words.length === 4) {
                    const bgColor = window.getComputedStyle(el).backgroundColor;
                    
                    // Determine difficulty from color
                    let difficulty = idx + 1;
                    if (bgColor.includes('249, 223, 109') || bgColor.includes('249,223,109')) difficulty = 1;
                    else if (bgColor.includes('160, 195, 90') || bgColor.includes('160,195,90')) difficulty = 2;
                    else if (bgColor.includes('176, 196, 239') || bgColor.includes('176,196,239')) difficulty = 3;
                    else if (bgColor.includes('186, 129, 197') || bgColor.includes('186,129,197')) difficulty = 4;
                    
                    data.categories.push({
                        name: categoryName,
                        words: words,
                        difficulty: difficulty,
                        color: bgColor
                    });
                }
            });
            
            console.log(`Final categories extracted: ${data.categories.length}`);
            
            // Deduplicate by category name (sometimes rendered multiple times)
            const seen = new Set();
            data.categories = data.categories.filter(cat => {
                if (seen.has(cat.name)) return false;
                seen.add(cat.name);
                return true;
            });
            
            console.log(`After deduplication: ${data.categories.length} unique categories`);
            
            return data;
        }, metadata);
        
        await browser.close();
        
        if (puzzleData.categories.length === 4) {
            console.log(`✓ Successfully extracted solution with ${puzzleData.categories.length} categories`);
            puzzleData.categories.forEach((cat, idx) => {
                console.log(`  ${idx + 1}. ${cat.name}: ${cat.words.join(', ')}`);
            });
            
            // Normalize colors to our standard set
            puzzleData.categories = puzzleData.categories.map(cat => ({
                ...cat,
                color: DIFFICULTY_COLORS[cat.difficulty]
            }));
            
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
    getTodaysPuzzle().then((puzzleData) => {
        if (puzzleData && puzzleData.categories && puzzleData.categories.length === 4) {
            console.log('\n✓ Daily scrape successful!');
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
