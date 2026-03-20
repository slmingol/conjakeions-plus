# Puzzle Scraping Scripts

This directory contains scripts for collecting daily Connections puzzles from connectionsgame.org.

# Puzzle Scraping Scripts

This directory contains scripts for automatically collecting daily Connections puzzles from connectionsgame.org.

## Scripts

### `daily-scraper.js`
**Automatically** fetches today's puzzle with complete solution by simulating gameplay.

The scraper:
1. Navigates to connectionsgame.org
2. Extracts puzzle ID and date
3. Makes 4 random guesses to exhaust all attempts
4. Captures the revealed solution (all 4 categories with words)
5. Saves to `data/collected-puzzles.json`

```bash
npm run scrape
```

**Output example:**
```
✓ Daily scrape successful!
Puzzle #916 - Thursday, March 20, 2026
Categories:
  1. [Difficulty 1] Things that are round
     BALL, COIN, GLOBE, WHEEL
  2. [Difficulty 2] Types of cheese
     BRIE, CHEDDAR, GOUDA, SWISS
  ...
✓ Added to collected-puzzles.json
Run "npm run merge" to add to main puzzle collection
```

### `scheduler.js`
Runs the daily scraper automatically at scheduled times (2am, 8am, 2pm, 8pm).

```bash
npm run scheduler
```

Keep this running as a service or background process:
```bash
nohup npm run scheduler > logs/scheduler.log 2>&1 &
```

### `merge-puzzles.js`
Merges newly collected puzzles with the static `src/puzzles.json` file. Use this after manually adding solutions to `data/collected-puzzles.json`.

```bash
npm run merge
```

### `deduplicate-puzzles.js`
Removes duplicate puzzles (by ID) from both collected and static puzzle files.

```bash
npm run dedupe
```

## Workflow

### Fully Automated Collection

The entire process is now automated:

1. **Scrape today's puzzle** (with complete solution):
   ```bash
   npm run scrape
   ```

2. **Merge with main collection**:
   ```bash
   npm run merge
   ```

3. **Rebuild the app** to include new puzzles:
   ```bash
   npm run build
   ```

4. **(Optional) Remove duplicates**:
   ```bash
   npm run dedupe
   ```

### Continuous Collection with Scheduler

Run the scheduler to automatically collect puzzles 4 times daily:

```bash
npm run scheduler
```

The scheduler runs at **2am, 8am, 2pm, 8pm** and will:
- Check if today's puzzle has been collected
- Scrape and save any new puzzles
- Track state in `data/scheduler-state.json`

Keep it running as a background service:
```bash
nohup npm run scheduler > logs/scheduler.log 2>&1 &
```

## Automation with GitHub Actions

You can set up GitHub Actions to:
1. Run the scraper daily
2. Create an issue with puzzle metadata
3. Manually fill in solutions via PR
4. Auto-merge and rebuild

See `.github/workflows/` for examples from cat-climber project.

## Data Files

- `data/collected-puzzles.json` - Scraped/collected puzzles (can include partial/incomplete)
- `data/scheduler-state.json` - Scheduler state tracking
- `src/puzzles.json` - Main static puzzle collection (915 puzzles)
- `public/puzzles.json` - Copy for static serving

## Copyright Notice

NYT Connections puzzles are copyrighted by The New York Times. This scraper is for personal/educational use only. Respect connectionsgame.org's terms of service and rate limits.
