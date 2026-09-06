# ==============================================================================
# Stage 1: Build TypeScript application
# ==============================================================================
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies needed for build
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY tsconfig.json ./
COPY index.html ./
COPY vite.config.mts ./
COPY src/ ./src/
RUN npm run build
RUN npm run build:client

# ==============================================================================
# Stage 2: Minimal production runner
# ==============================================================================
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/platform.db

# Install production-only dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist

# Create persistent storage mount directory and set ownership to unprivileged user
RUN mkdir -p /app/data && chown -R node:node /app

# Run as non-root node user (UID: 1000)
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/backend/server.js"]
