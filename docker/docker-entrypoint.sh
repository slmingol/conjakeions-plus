#!/bin/sh
set -e

# Read and display version if available
if [ -f /usr/share/nginx/html/version.txt ]; then
    VERSION=$(cat /usr/share/nginx/html/version.txt)
    echo "=========================================="
    echo "🎮 Conjakeions+ v${VERSION}"
    echo "=========================================="
    echo "Starting services..."
    echo ""
fi

# Start auto-backfill in the background so nginx comes up immediately
echo "🔄 Starting auto-backfill in background (last 7 days)..."
cd /app
node scripts/auto-backfill.js > /var/log/auto-backfill.log 2>&1 &
BACKFILL_PID=$!
echo "   Backfill PID: $BACKFILL_PID"
echo "   Logs: /var/log/auto-backfill.log"
echo ""

# Start the puzzle scheduler in the background
echo "🤖 Starting puzzle collection scheduler..."
cd /app
node scripts/scheduler.js > /var/log/scheduler.log 2>&1 &
SCHEDULER_PID=$!
echo "   Scheduler PID: $SCHEDULER_PID"
echo "   Logs: /var/log/scheduler.log"
echo "   Schedule: 2am, 8am, 2pm, 8pm daily"
echo ""

# Start nginx
echo "🌐 Starting nginx web server..."
echo ""

# Execute the CMD (nginx)
exec "$@"
