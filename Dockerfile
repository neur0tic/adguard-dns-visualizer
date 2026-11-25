# syntax=docker/dockerfile:1

# Base image is pinned by multi-platform index digest for reproducible builds.
# To update: docker buildx imagetools inspect node:26-alpine  → copy the top "Digest"
# into both FROM lines, rebuild, and rescan.

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS dependencies

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling and update packages for security
RUN apk upgrade --no-cache && apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force

# ============================================
# Stage 2: Production
# ============================================
FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS production

# Set NODE_ENV
ENV NODE_ENV=production

# Upgrade base-image packages to pick up security fixes (e.g. openssl >=3.5.7-r0,
# CVE-2026-34182) — the dependencies stage's upgrade does not carry into this stage.
# Also remove the bundled npm/npx CLI: it is not used at runtime (the app starts via
# `node server/index.js`) and its vendored deps carry vulns (e.g. picomatch ReDoS,
# CVE-2026-33671). Dropping it removes the finding and shrinks the attack surface.
RUN apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Create non-root user and group
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy dumb-init from dependencies stage
COPY --from=dependencies /usr/bin/dumb-init /usr/bin/dumb-init

# Copy node_modules from dependencies stage with correct ownership
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application files with correct ownership
COPY --chown=nodejs:nodejs server ./server
COPY --chown=nodejs:nodejs public ./public
COPY --chown=nodejs:nodejs package.json ./

# Switch to non-root user
USER nodejs

# Expose port (configurable via environment variable)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server/index.js"]
