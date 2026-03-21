#!/bin/bash

DAYS=${1:-300}

# Get oldest collected puzzle ID
OLDEST=$(jq -r '.puzzles | sort_by(.id) | .[0].id' data/collected-puzzles.json 2>/dev/null)

if [ -z "$OLDEST" ] || [ "$OLDEST" = "null" ]; then
    echo "No puzzles found in collection, starting from day 1"
    START=1
else
    # Fetch today's puzzle number from archive page (dynamically)
    echo "Detecting current puzzle number..."
    TODAY=$(node -e "
        const { chromium } = require('playwright');
        (async () => {
            const browser = await chromium.launch({ headless: true });
            const page = await browser.newPage();
            await page.goto('https://connectionsplus.io/nyt-archive', { waitUntil: 'load' });
            const bodyText = await page.textContent('body');
            const match = bodyText.match(/Connections #(\d+)/);
            await browser.close();
            console.log(match ? match[1] : '1014');
        })();
    " 2>/dev/null || echo "1014")
    
    START=$((TODAY - OLDEST + 1))
    echo "Oldest collected: #$OLDEST"
    echo "Current puzzle: #$TODAY"
    echo "Resuming from day $START to fill gaps..."
fi

# Summary
TOTAL=$((DAYS - START + 1))
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Will scrape $TOTAL puzzles (days $START-$DAYS)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for day in $(seq $START $DAYS); do
    node scripts/daily-scraper.js "$day"
    sleep 2
done
