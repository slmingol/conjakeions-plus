# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production=false

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Extract version for container logs
RUN node -p "require('./package.json').version" > /app/dist/version.txt

# Production stage
FROM node:18-alpine

# Install nginx and dependencies for puppeteer
RUN apk add --no-cache \
    nginx \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to use installed chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --production

# Install Playwright browsers
RUN npx playwright install chromium --with-deps

# Copy scripts for puzzle scraping
COPY scripts ./scripts

# Copy src directory for merge script to access puzzles.json
COPY src ./src

# Create data directory for collected puzzles
RUN mkdir -p /app/data

# Copy entrypoint script
COPY docker/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configurations
COPY docker/nginx-main.conf /etc/nginx/nginx.conf
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Create nginx run directory
RUN mkdir -p /run/nginx

# Expose port 80
EXPOSE 80

# Use custom entrypoint to start both nginx and scheduler
ENTRYPOINT ["/docker-entrypoint.sh"]

# Start nginx in foreground (scheduler starts in background via entrypoint)
CMD ["nginx", "-g", "daemon off;"]
