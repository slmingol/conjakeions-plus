# Backfill Commands

## Quick Reference

### Local/Development
```bash
# Check last 7 days (default)
npm run auto-backfill

# Check last 30 days
npm run backfill:30d

# Check last 90 days
npm run backfill:90d

# Full scan - check entire collection
npm run backfill:full

# Custom number of days
node scripts/auto-backfill.js 45
```

### In Docker Container
```bash
# Check last 7 days
docker compose exec conjakeions-plus node scripts/auto-backfill.js

# Check last 30 days  
docker compose exec conjakeions-plus node scripts/auto-backfill.js 30

# Full scan
docker compose exec conjakeions-plus node scripts/full-backfill.js
```

### On Production Server
```bash
# SSH into server first
ssh user@server

# Check last 7 days
docker exec conjakeions-plus node scripts/auto-backfill.js

# Full scan to fill all holes
docker exec conjakeions-plus node scripts/full-backfill.js
```

## Scheduled Tasks

The scheduler runs automatically in the Docker container:

- **Daily**: Checks last 7 days at 2am, 8am, 2pm, 8pm
- **Weekly**: Deep scan (90 days) every Sunday at 3am

View scheduler logs:
```bash
docker exec conjakeions-plus cat /var/log/scheduler.log
```

## How It Works

1. **auto-backfill.js** - Main script, accepts days as argument
2. **full-backfill.js** - Convenience wrapper for full scan (~3 years)
3. **scheduler.js** - Runs automatically in container for periodic checks
4. **Persistence** - All scraped puzzles saved to `/app/data/collected-puzzles.json` (Docker volume)
