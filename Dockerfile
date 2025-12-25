# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:25-alpine3.22 AS dependencies

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# ============================================
# Stage 2: Production
# ============================================
FROM node:25-alpine3.22 AS production

# Set NODE_ENV
ENV NODE_ENV=production

# Create non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

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
    CMD node -e "require('http').get('http://localhost:8080', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server/index.js"]
