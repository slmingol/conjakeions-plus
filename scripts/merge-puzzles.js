#!/usr/bin/env node
/**
 * Merge collected (scraped) puzzles with static puzzles.json
 * Combines both sources and updates the main puzzle file used by the app
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine paths
const isContainer = fs.existsSync('/usr/share/nginx/html/');
const collectedDataPath = isContainer 
    ? '/usr/share/nginx/html/collected-puzzles.json'
    : path.join(__dirname, '../data/collected-puzzles.json');
const srcDir = path.join(__dirname, '../src');
const publicDir = path.join(__dirname, '../public');
const nginxPublicDir = '/usr/share/nginx/html';

function loadJSON(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log(`Note: ${filePath} not found`);
        return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeDate(dateStr) {
    try {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0];
    } catch {
        return dateStr;
    }
}

function main() {
    console.log('Merging puzzle sources...');
    
    // Load static puzzles (from initial import)
    const staticPath = path.join(srcDir, 'puzzles.json');
    const staticPuzzles = loadJSON(staticPath) || [];
    console.log(`Loaded ${staticPuzzles.length} static puzzles`);
    
    // Load collected puzzles (from scraping)
    const collectedData = loadJSON(collectedDataPath);
    const collectedPuzzles = collectedData?.puzzles || [];
    console.log(`Loaded ${collectedPuzzles.length} collected puzzles`);
    
    // Create a map of existing puzzle IDs from static collection
    const existingIds = new Set(staticPuzzles.map(p => p.id));
    
    // Add new collected puzzles that don't exist in static collection
    const newPuzzles = collectedPuzzles.filter(p => !existingIds.has(p.id));
    
    if (newPuzzles.length > 0) {
        console.log(`Found ${newPuzzles.length} new puzzles to add`);
        
        // Combine: static puzzles + new scraped puzzles
        const combined = [...staticPuzzles, ...newPuzzles];
        
        // Sort by ID (ascending)
        combined.sort((a, b) => a.id - b.id);
        
        // Update src/puzzles.json (for dev builds)
        fs.writeFileSync(staticPath, JSON.stringify(combined, null, 2));
        console.log(`✓ Updated ${staticPath}`);
        
        // Update public/puzzles.json (for direct serving - dev environment)
        const publicPath = path.join(publicDir, 'puzzles.json');
        fs.writeFileSync(publicPath, JSON.stringify(combined, null, 2));
        console.log(`✓ Updated ${publicPath}`);
        
        // In container, also update nginx served puzzles.json
        if (isContainer && fs.existsSync(nginxPublicDir)) {
            const nginxPuzzlesPath = path.join(nginxPublicDir, 'puzzles.json');
            fs.writeFileSync(nginxPuzzlesPath, JSON.stringify(combined, null, 2));
            console.log(`✓ Updated ${nginxPuzzlesPath} (nginx)`);
        }
        
        console.log(`Total puzzles: ${combined.length}`);
    } else {
        console.log('No new puzzles to merge');
    }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    try {
        main();
    } catch (err) {
        console.error('Error during merge:', err);
        process.exit(1);
    }
}

export { main };
