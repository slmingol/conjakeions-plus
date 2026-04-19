<div align="center">
  <img src="public/logo.png" alt="Conjakeions+ Logo" width="200"/>
</div>

# Conjakeions+

[![Version](https://img.shields.io/github/package-json/v/slmingol/conjakeions-plus?label=Version&color=brightgreen)](https://github.com/slmingol/conjakeions-plus)
[![Build Status](https://img.shields.io/github/actions/workflow/status/slmingol/conjakeions-plus/docker-build.yml?branch=main&label=Build)](https://github.com/slmingol/conjakeions-plus/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4.11-646CFF.svg)](https://vitejs.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![Container Registry](https://img.shields.io/badge/GHCR-Published-blue)](https://github.com/slmingol/conjakeions-plus/pkgs/container/conjakeions-plus)

A word puzzle game with **1,036+ unique puzzles** inspired by Connections. Features automated puzzle scraping, scheduled backfill, and Docker deployment.

## About

Conjakeions+ is a word puzzle game where players must find groups of four words that share something in common. The game features:

- 16 words arranged in a 4x4 grid
- 4 categories of words to discover
- 4 difficulty levels (indicated by colors)
- Maximum of 4 mistakes allowed
- Shuffle, Clear, and Submit controls

## Features

### Game Features
- ✨ Clean, modern UI design
- 🎮 Full game mechanics (select, submit, shuffle)
- 🎯 Mistake tracking (4 mistakes maximum)
- 🎊 Win/lose conditions with animations
- 📱 Responsive design for mobile and desktop
- 🔄 Play again functionality
- 🎲 1,036+ unique puzzles (June 2023 - April 2026)
- 🌈 4 difficulty levels with color-coded categories

### Puzzle Management
- 🤖 **Automated Puzzle Scraping** - Daily puzzle collection using Playwright
- ⏰ **Scheduled Backfill** - Automatic checks 4x daily (2am, 8am, 2pm, 8pm)
- 📅 **Weekly Deep Scans** - Sunday 3am scans for missing puzzles (90 days)
- 💾 **Persistent Storage** - Docker volume for collected puzzles
- 🔍 **On-Demand Backfill** - Manual full collection scans
- 🔄 **Auto-Merge** - Seamlessly integrates new puzzles into the game

### Deployment
- 🐳 **Docker Ready** - Production-ready container with nginx
- 📦 **GitHub Container Registry** - Automated builds and publishing
- 🔧 **Auto-Versioning** - Semantic versioning with each commit
- 🚀 **CI/CD Pipeline** - Automated testing and deployment

## How to Play

1. Select 4 words that you think belong to the same category
2. Click "Submit" to check your guess
3. If correct, the category is revealed and removed from the grid
4. If incorrect, you lose one of your 4 chances
5. Find all 4 categories to win!

## Quick Start

### Docker (Recommended)

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/slmingol/conjakeions-plus:latest

# Run the container
docker run -d \
  -p 4545:80 \
  -v conjakeions-data:/app/data \
  --name conjakeions-plus \
  ghcr.io/slmingol/conjakeions-plus:latest

# Access at http://localhost:4545
```

Or using Docker Compose:

```yaml
services:
  conjakeions-plus:
    image: ghcr.io/slmingol/conjakeions-plus:latest
    container_name: conjakeions-plus
    ports:
      - "4545:80"
    volumes:
      - puzzle-data:/app/data
    restart: unless-stopped

volumes:
  puzzle-data:
    driver: local
```

### Local Development

```bash
# Clone the repository
git clone https://github.com/slmingol/conjakeions-plus.git
cd conjakeions-plus

# Install dependencies
npm install

# Start the development server
npm run dev
```

The game will open at `http://localhost:3000`

## Puzzle Management

### Automated Scheduling

The Docker container automatically:
- **Daily**: Checks for missing puzzles from last 7 days at 2am, 8am, 2pm, 8pm
- **Weekly**: Deep scan (90 days) every Sunday at 3am

View scheduler logs:
```bash
docker exec conjakeions-plus cat /var/log/scheduler.log
```

### On-Demand Backfill

Fill all gaps in your puzzle collection:

```bash
# Full scan (~3 years of puzzles)
docker exec conjakeions-plus node scripts/full-backfill.js

# Or specific timeframes
docker exec conjakeions-plus node scripts/auto-backfill.js 30  # Last 30 days
docker exec conjakeions-plus node scripts/auto-backfill.js 90  # Last 90 days
```

Local development:
```bash
npm run backfill:full    # Full scan
npm run backfill:30d     # Last 30 days
npm run backfill:90d     # Last 90 days
npm run auto-backfill    # Last 7 days
```

See [docs/BACKFILL.md](docs/BACKFILL.md) for detailed documentation.

## Project Structure

```
conjakeions-plus/
├── docker/
│   ├── Dockerfile              # Production container
│   ├── Dockerfile.dev          # Development container
│   ├── docker-entrypoint.sh    # Container startup script
│   ├── nginx.conf              # Nginx configuration
│   └── docker-compose.*.yml    # Compose configurations
├── scripts/
│   ├── auto-backfill.js        # Automated puzzle backfill
│   ├── full-backfill.js        # On-demand full scan
│   ├── daily-scraper.js        # Single puzzle scraper
│   ├── scheduler.js            # Automated task scheduler
│   ├── merge-puzzles.js        # Puzzle collection merger
│   └── deduplicate-puzzles.js  # Duplicate puzzle remover
├── src/
│   ├── components/             # React components
│   ├── puzzles.json            # 1,036+ puzzle collection
│   ├── App.jsx                 # Main game component
│   └── main.jsx                # React entry point
├── docs/
│   └── BACKFILL.md            # Backfill documentation
├── .github/workflows/
│   ├── docker-build.yml        # Docker CI/CD
│   ├── auto-version.yml        # Semantic versioning
│   └── cleanup-*.yml           # Artifact cleanup
└── package.json
```

## Technologies Used

### Frontend
- **React 18.2** - UI framework
- **Vite 5.4** - Build tool and dev server
- **CSS3** - Styling with modern features

### Automation
- **Playwright 1.58** - Browser automation for puzzle scraping
- **Node.js 18** - Runtime environment

### Deployment
- **Docker** - Containerization
- **nginx** - Web server
- **Alpine Linux** - Lightweight base image
- **GitHub Actions** - CI/CD pipeline
- **GitHub Container Registry** - Image hosting

### Monitoring
- **Cron-based Scheduler** - Automated task execution
- **Persistent Storage** - Docker volumes for puzzle data

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start Vite dev server
npm run build            # Build for production
npm run preview          # Preview production build

# Puzzle Management
npm run scrape           # Scrape today's puzzle
npm run backfill         # Backfill missing puzzles
npm run backfill:full    # Full collection scan
npm run backfill:30d     # Scan last 30 days
npm run backfill:90d     # Scan last 90 days
npm run merge            # Merge collected puzzles
npm run dedupe           # Remove duplicate puzzles

# Utilities
npm run scheduler        # Start automated scheduler
```

### Docker Development

```bash
# Build local image
docker build -f docker/Dockerfile -t conjakeions-plus:dev .

# Run development container
cd docker
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Access shell
docker compose -f docker-compose.dev.yml exec conjakeions-plus-dev sh
```

## Deployment

### Production Container

The production container includes:
- ✅ Nginx web server for static files
- ✅ Automated puzzle backfill on startup
- ✅ Scheduled puzzle collection (4x daily + weekly deep scan)
- ✅ Persistent storage for collected puzzles
- ✅ Health checks and logging

Environment variables:
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` - Path to Chromium browser
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` - Skip Playwright browser download

### GitHub Actions CI/CD

The project uses automated workflows:
- **docker-build.yml** - Builds and publishes Docker images
- **auto-version.yml** - Auto-increments version on commits
- **cleanup-docker.yml** - Removes old untagged images
- **cleanup-artifacts.yml** - Cleans up old releases

### Version Tags

Images are tagged with:
- `latest` - Latest build from main branch
- `main` - Main branch builds
- `v2.x.x` - Semantic version tags
- `sha-<commit>` - Specific commit builds

## Troubleshooting

### Puzzle Backfill Issues

If puzzles aren't being collected:

```bash
# Check scheduler logs
docker exec conjakeions-plus cat /var/log/scheduler.log

# Manually trigger backfill
docker exec conjakeions-plus node scripts/auto-backfill.js

# Check collected puzzles
docker exec conjakeions-plus cat data/collected-puzzles.json
```

### Container Won't Start

```bash
# Check container logs
docker logs conjakeions-plus

# Verify volume mount
docker volume inspect conjakeions-plus_puzzle-data

# Restart container
docker restart conjakeions-plus
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks

## Acknowledgments

- Inspired by the [NYT Connections](https://www.nytimes.com/games/connections) game
- Puzzles sourced from [connectionsplus.io](https://connectionsplus.io)
- Built with ❤️ using React and Vite

## License

MIT License - see [LICENSE](LICENSE) for details

---

<div align="center">
  <p>
    <a href="https://github.com/slmingol/conjakeions-plus">⭐ Star on GitHub</a> •
    <a href="https://github.com/slmingol/conjakeions-plus/issues">🐛 Report Bug</a> •
    <a href="https://github.com/slmingol/conjakeions-plus/issues">💡 Request Feature</a>
  </p>
  <p>Made with ❤️ by <a href="https://github.com/slmingol">slmingol</a></p>
</div>
