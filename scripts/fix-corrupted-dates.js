#!/usr/bin/env node
/**
 * Fix corrupted dates in collected-puzzles.json and src/puzzles.json
 * Removes puzzle ID prefix from dates like "1018March 25, 2026" -> "March 25, 2026"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const collectedPath = path.join(__dirname, '../data/collected-puzzles.json');
const srcPath = path.join(__dirname, '../src/puzzles.json');

function fixCorruptedDates() {
    console.log('Fixing corrupted dates in puzzle files...\n');
    
    let totalFixed = 0;
    
    // Fix both collected-puzzles.json and src/puzzles.json
    for (const filePath of [collectedPath, srcPath]) {
        if (!fs.existsSync(filePath)) {
            console.log(`Note: ${path.basename(filePath)} not found, skipping`);
            continue;
        }
        
        console.log(`Processing ${path.basename(filePath)}...`);
        
        // Load data
        let data;
        if (filePath === collectedPath) {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } else {
            // src/puzzles.json is just an array
            data = { puzzles: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
        }
        
        let fixedCount = 0;
        let alreadyOkCount = 0;
        
        // Fix each puzzle's date
        for (const puzzle of data.puzzles) {
            const originalDate = puzzle.date;
            
            // Check if date starts with digits followed by letters (corrupted format)
            const corruptedMatch = originalDate.match(/^(\d+)([A-Za-z].*)$/);
            
            if (corruptedMatch) {
                const puzzleId = corruptedMatch[1];
                const cleanDate = corruptedMatch[2];
                
                console.log(`  Puzzle #${puzzle.id}: "${originalDate}" → "${cleanDate}"`);
                
                puzzle.date = cleanDate;
                fixedCount++;
            } else {
                alreadyOkCount++;
            }
        }
        
        console.log(`  Fixed: ${fixedCount}, Already OK: ${alreadyOkCount}\n`);
        
        if (fixedCount > 0) {
            // Backup original
            const backupPath = filePath + '.backup';
            fs.copyFileSync(filePath, backupPath);
            console.log(`  ✓ Created backup: ${path.basename(backupPath)}`);
            
            // Write fixed data
            if (filePath === collectedPath) {
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            } else {
                // src/puzzles.json is just an array
                fs.writeFileSync(filePath, JSON.stringify(data.puzzles, null, 2));
            }
            console.log(`  ✓ Updated: ${path.basename(filePath)}`);
            totalFixed += fixedCount;
        }
    }
    
    console.log(`${'='.repeat(60)}`);
    console.log(`Total dates fixed across all files: ${totalFixed}`);
    console.log(`${'='.repeat(60)}`);
}

fixCorruptedDates();
