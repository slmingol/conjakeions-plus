#!/usr/bin/env node
/**
 * Backfill script - Collects puzzles from the last 7 days
 * Usage: node backfill-puzzles.js [days]
 * Example: node backfill-puzzles.js 7
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { addToCollection } from './daily-scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color mapping for difficulty levels
const DIFFICULTY_COLORS = {
    1: '#F9DF6D', // Yellow - Straightforward
    5: '#A0C35A', // Green
    9: '#B0C4EF', // Blue
    13: '#BA81C5'  // Purple - Tricky
};

const header = '╔' + '═'.repeat(58) + '╗';
const footer = '╚' + '═'.repeat(58) + '╝\n';
const divider = '─'.repeat(60);

/**
 * Get puzzle for a specific date by navigating archive
 */
async function getPuzzleForDate(browser, targetDate) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    try {
        console.log(`\nFetching puzzle for ${targetDate.toLocaleDateString()}...`);
        
        const url = 'https://connectionsgame.org/';
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Look for archive/calendar button
        console.log('Looking for archive navigation...');
        const archiveClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"], [class*="archive"], [class*="calendar"]'));
            const archiveBtn = buttons.find(btn => {
                const text = btn.textContent.toLowerCase();
                const className = btn.className.toLowerCase();
                return text.includes('archive') || 
                       text.includes('calendar') || 
                       text.includes('previous') ||
                       className.includes('archive') ||
                       className.includes('calendar');
            });
            
            if (archiveBtn) {
                console.log('Found archive button:', archiveBtn.textContent || archiveBtn.className);
                archiveBtn.click();
                return true;
            }
            return false;
        });
        
        if (!archiveClicked) {
            console.log('⚠️ Could not find archive navigation button');
            await page.close();
            return null;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try to click on the specific date
        const dateStr = targetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const day = targetDate.getDate();
        
        console.log(`Clicking on date: ${dateStr} (day ${day})...`);
        
        const dateClicked = await page.evaluate((day) => {
            // Look for date buttons/links
            const dateElements = Array.from(document.querySelectorAll('button, a, div[role="button"], [class*="date"], [class*="day"]'));
            const targetEl = dateElements.find(el => {
                const text = el.textContent.trim();
                return text === day.toString() || text === String(day).padStart(2, '0');
            });
            
            if (targetEl) {
                console.log('Found date element:', targetEl.textContent);
                targetEl.click();
                return true;
            }
            return false;
        }, day);
        
        if (!dateClicked) {
            console.log('⚠️ Could not find date in calendar');
            await page.close();
            return null;
        }
        
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
            }
            
            return data;
        });
        
        if (!metadata.id) {
            console.log('⚠️ Could not extract puzzle ID');
            await page.close();
            return null;
        }
        
        console.log(`Found puzzle #${metadata.id} - ${metadata.date || targetDate.toLocaleDateString()}`);
        
        // Play the game to reveal solution
        console.log('Playing game to reveal solution...');
        
        for (let attempt = 1; attempt <= 4; attempt++) {
            try {
                const wordButtons = await page.$$('button:not(:disabled)');
                if (wordButtons.length < 4) break;
                
                const shuffled = wordButtons.sort(() => Math.random() - 0.5);
                const toClick = shuffled.slice(0, Math.min(4, shuffled.length));
                
                for (const button of toClick) {
                    await button.click();
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                
                const submitButton = await page.evaluateHandle(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    return buttons.find(btn => 
                        btn.textContent.toLowerCase().includes('submit') ||
                        btn.textContent.toLowerCase().includes('guess')
                    );
                });
                
                if (submitButton && submitButton.asElement()) {
                    await submitButton.asElement().click();
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            } catch (err) {
                console.log(`Attempt ${attempt} error:`, err.message);
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Click reveal button
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
            const revealBtn = buttons.find(btn => {
                const text = btn.textContent.toLowerCase();
                return text.includes('give up') || 
                       text.includes('reveal') || 
                       text.includes('show answer');
            });
            
            if (revealBtn) {
                revealBtn.click();
            }
        });
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extract the solution
        const puzzleData = await page.evaluate((metadata, DIFFICULTY_COLORS) => {
            const data = {
                id: metadata.id,
                date: metadata.date,
                categories: []
            };
            
            // Try to find solved categories
            const possibleSelectors = [
                '.solved-category',
                '.category',
                '[class*="solved"]',
                '[class*="category"]',
                '[class*="group"]'
            ];
            
            let categoryElements = [];
            for (const selector of possibleSelectors) {
                const elements = Array.from(document.querySelectorAll(selector));
                if (elements.length >= 4) {
                    categoryElements = elements.slice(0, 4);
                    break;
                }
            }
            
            // Parse each category
            const seenCategories = new Set();
            
            categoryElements.forEach((el) => {
                const text = el.textContent.trim();
                
                // Try to extract category name and words
                // Pattern: "CATEGORY NAMEWORD1, WORD2, WORD3, WORD4"
                const match = text.match(/^([A-Z\s]+?)([A-Z][a-z].*)$/);
                
                if (match) {
                    const categoryName = match[1].trim();
                    const wordsText = match[2];
                    
                    // Skip duplicates
                    if (seenCategories.has(categoryName)) return;
                    seenCategories.add(categoryName);
                    
                    // Split words (could be comma-separated or just concatenated)
                    let words = [];
                    if (wordsText.includes(',')) {
                        words = wordsText.split(',').map(w => w.trim());
                    } else {
                        // Try to split by capital letters
                        words = wordsText.match(/[A-Z][a-z]+/g) || [];
                    }
                    
                    if (words.length >= 4) {
                        words = words.slice(0, 4);
                        
                        const difficulty = data.categories.length * 4 + 1;
                        data.categories.push({
                            name: categoryName,
                            words: words,
                            difficulty: difficulty,
                            color: DIFFICULTY_COLORS[difficulty]
                        });
                    }
                }
            });
            
            return data;
        }, metadata, DIFFICULTY_COLORS);
        
        await page.close();
        
        if (puzzleData.categories.length === 4) {
            return puzzleData;
        } else {
            console.log(`⚠️ Only found ${puzzleData.categories.length}/4 categories`);
            return null;
        }
        
    } catch (error) {
        console.error(`Error fetching puzzle: ${error.message}`);
        await page.close();
        return null;
    }
}

/**
 * Backfill puzzles for the last N days
 */
async function backfillPuzzles(days = 7) {
    console.log(header);
    console.log('║  Connections Puzzle Backfill                             ║');
    console.log(footer);
    console.log(`Collecting puzzles from the last ${days} days...\n`);
    console.log(divider);
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const results = {
        total: 0,
        success: 0,
        failed: 0,
        skipped: 0
    };
    
    try {
        for (let i = 0; i < days; i++) {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - i);
            
            results.total++;
            
            const puzzleData = await getPuzzleForDate(browser, targetDate);
            
            if (puzzleData) {
                console.log(`\n✓ Successfully extracted puzzle #${puzzleData.id}`);
                puzzleData.categories.forEach((cat, idx) => {
                    console.log(`  ${idx + 1}. [Difficulty ${cat.difficulty}] ${cat.name}`);
                    console.log(`     ${cat.words.join(', ')}`);
                });
                
                const added = addToCollection(puzzleData);
                if (added) {
                    console.log('  → Added to collection');
                    results.success++;
                } else {
                    console.log('  → Already in collection');
                    results.skipped++;
                }
            } else {
                console.log('✗ Failed to extract puzzle');
                results.failed++;
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } finally {
        await browser.close();
    }
    
    console.log('\n' + divider);
    console.log('Backfill Summary:');
    console.log(`  Total attempted: ${results.total}`);
    console.log(`  Successfully added: ${results.success}`);
    console.log(`  Already in collection: ${results.skipped}`);
    console.log(`  Failed: ${results.failed}`);
    console.log(divider + '\n');
    
    if (results.success > 0) {
        console.log('Next steps:');
        console.log('  1. Run "npm run merge" to merge with main collection');
        console.log('  2. Run "npm run build" to rebuild the app\n');
    }
}

// Parse command line arguments
const days = parseInt(process.argv[2]) || 7;
backfillPuzzles(days).catch(error => {
    console.error('\n✗ Fatal error:', error.message, '\n');
    process.exit(1);
});
