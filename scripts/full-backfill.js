#!/usr/bin/env node
/**
 * Full Backfill - On-demand complete puzzle collection scan
 * Scans the entire puzzle collection for gaps and fills them
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  Conjakeions+ Full Backfill                            ║');
console.log('║  Scanning entire collection for missing puzzles        ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log('');
console.log('⏱️  This may take a while depending on network speed');
console.log('    and number of missing puzzles...');
console.log('');

const backfillPath = path.join(__dirname, 'auto-backfill.js');
const backfill = spawn('node', [backfillPath, 'all'], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
});

backfill.on('close', (code) => {
    console.log('');
    if (code === 0) {
        console.log('✅ Full backfill completed successfully!');
    } else {
        console.error('❌ Full backfill failed with exit code', code);
    }
    process.exit(code);
});

backfill.on('error', (err) => {
    console.error('❌ Error running backfill:', err.message);
    process.exit(1);
});
