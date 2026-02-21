#!/bin/sh
set -e

# Read and display version if available
if [ -f /usr/share/nginx/html/version.txt ]; then
    VERSION=$(cat /usr/share/nginx/html/version.txt)
    echo "=========================================="
    echo "🎮 Conjakeions+ v${VERSION}"
    echo "=========================================="
    echo "Starting nginx web server..."
    echo ""
fi

# Execute the CMD (nginx)
exec "$@"
