#!/usr/bin/env node
/**
 * Built-in scheduler for daily puzzle collection
 * Runs checks multiple times per day
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CHECK_TIMES = [2, 8, 14, 20]; // Check at 2am, 8am, 2pm, 8pm
const CHECK_INTERVAL = 15 * 60 * 1000; // Check every 15 minutes
const WEEKLY_DEEP_SCAN_DAY = 0; // Sunday = 0, Monday = 1, etc.
const WEEKLY_DEEP_SCAN_HOUR = 3; // 3am on Sunday
const STATE_FILE = path.join(__dirname, '../data/scheduler-state.json');

// State tracking
let state = {
    lastRun: null,
    lastCheckDate: null,
    lastDeepScan: null,
    checksToday: 0,
    consecutiveErrors: 0,
    totalRuns: 0,
    totalErrors: 0,
    deepScans: 0
};

// Load state
function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const loaded = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            state = { ...state, ...loaded };
            console.log(`[Scheduler] Loaded state: last run ${state.lastRun || 'never'}`);
        }
    } catch (err) {
        console.error('[Scheduler] Error loading state:', err.message);
    }
}

// Save state
function saveState() {
    try {
        const dir = path.dirname(STATE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
        console.error('[Scheduler] Error saving state:', err.message);
    }
}

// Should we run now?
function shouldRun() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDate = now.toISOString().split('T')[0];
    const currentDay = now.getDay();
    
    // Reset daily counter if it's a new day
    if (state.lastCheckDate !== currentDate) {
        state.checksToday = 0;
        state.lastCheckDate = currentDate;
    }
    
    // Check for weekly deep scan (Sunday at 3am)
    if (currentDay === WEEKLY_DEEP_SCAN_DAY && currentHour === WEEKLY_DEEP_SCAN_HOUR) {
        const lastDeepScanDate = state.lastDeepScan ? new Date(state.lastDeepScan).toISOString().split('T')[0] : null;
        if (lastDeepScanDate !== currentDate) {
            return { type: 'deep', days: 90 }; // Check last 90 days
        }
    }
    
    // Check if we're in a regular check time window
    const isCheckTime = CHECK_TIMES.some(hour => 
        currentHour === hour && (!state.lastRun || 
        new Date(state.lastRun).getHours() !== hour)
    );
    
    if (isCheckTime) {
        return { type: 'regular', days: 7 }; // Regular 7-day check
    }
    
    return null;
}

// Run the auto-backfill to ensure last N days are complete
async function runScraper(type, days) {
    return new Promise((resolve) => {
        const scanType = type === 'deep' ? 'DEEP SCAN' : 'regular check';
        console.log(`[${new Date().toISOString()}] Running scheduled auto-backfill (${scanType}, ${days} days)...`);
        
        const backfillPath = path.join(__dirname, 'auto-backfill.js');
        const backfill = spawn('node', [backfillPath, days.toString()], {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        
        backfill.on('close', (code) => {
            if (code === 0) {
                state.consecutiveErrors = 0;
                console.log(`[Scheduler] Auto-backfill ${scanType} completed successfully`);
                if (type === 'deep') {
                    state.lastDeepScan = new Date().toISOString();
                    state.deepScans++;
                }
            } else {
                console.error(`[Scheduler] Auto-backfill ${scanType} failed with exit code ${code}`);
                state.consecutiveErrors++;
                state.totalErrors++;
            }
            
            state.lastRun = new Date().toISOString();
            state.checksToday++;
            state.totalRuns++;
            saveState();
            resolve();
        });
        
        backfill.on('error', (err) => {
            console.error('[Scheduler] Error spawning auto-backfill:', err.message);
            state.consecutiveErrors++;
            state.totalErrors++;
            state.lastRun = new Date().toISOString();
            state.checksToday++;
            state.totalRuns++;
            saveState();
            resolve();
        });
    });
}

// Main scheduler loop
async function start() {
    console.log('[Scheduler] Starting...');
    console.log(`[Scheduler] Daily checks at hours: ${CHECK_TIMES.join(', ')}`);
    console.log(`[Scheduler] Weekly deep scan: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][WEEKLY_DEEP_SCAN_DAY]} at ${WEEKLY_DEEP_SCAN_HOUR}:00`);
    
    loadState();
    
    // Check immediately on startup
    const shouldRunNow = shouldRun();
    if (shouldRunNow) {
        await runScraper(shouldRunNow.type, shouldRunNow.days);
    }
    
    // Then check periodically
    setInterval(async () => {
        const check = shouldRun();
        if (check) {
            await runScraper(check.type, check.days);
        }
    }, CHECK_INTERVAL);
    
    console.log('[Scheduler] Running. Press Ctrl+C to stop.');
}

// Handle shutdown
process.on('SIGTERM', () => {
    console.log('[Scheduler] Shutting down...');
    saveState();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[Scheduler] Shutting down...');
    saveState();
    process.exit(0);
});

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    start().catch(err => {
        console.error('[Scheduler] Fatal error:', err);
        process.exit(1);
    });
}

export { start, shouldRun, runScraper };
