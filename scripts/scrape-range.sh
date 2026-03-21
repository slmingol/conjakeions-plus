#!/bin/bash
# Scrape a range of past puzzles
# Usage: ./scrape-range.sh [days]
# Example: ./scrape-range.sh 20  (scrapes last 20 days)

DAYS=${1:-20}

echo "Scraping last ${DAYS} days of puzzles..."
echo "Start time: $(date)"
echo ""

SUCCESSFUL=0
FAILED=0

for day in $(seq 1 $DAYS); do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Scraping puzzle from ${day} day(s) ago..."
    echo ""
    
    if node "$(dirname "$0")/daily-scraper.js" "$day"; then
        ((SUCCESSFUL++))
        echo "✓ Success (${day} days ago)"
    else
        ((FAILED++))
        echo "✗ Failed (${day} days ago)"
    fi
    
    echo ""
    
    # Small delay to avoid overwhelming the server
    sleep 2
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total puzzles attempted: ${DAYS}"
echo "Successful: ${SUCCESSFUL}"
echo "Failed: ${FAILED}"
echo "End time: $(date)"
