import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import AdGuardClient from './adguard-client.js';
import GeoService from './geo-service.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parseEnvInt = (val) => val ? parseInt(val, 10) : undefined;

const config = {
  port: parseEnvInt(process.env.PORT) || 8080,
  pollInterval: parseEnvInt(process.env.POLL_INTERVAL_MS) || 2000,
  statsInterval: parseEnvInt(process.env.STATS_INTERVAL_MS) || 5000,
  maxProcessedIds: parseEnvInt(process.env.MAX_PROCESSED_IDS) || 1000,
  maxConcurrentArcs: parseEnvInt(process.env.MAX_CONCURRENT_ARCS) || 50,
  maxConnections: parseEnvInt(process.env.MAX_WS_CONNECTIONS) || 50,
  sourceLat: parseFloat(process.env.SOURCE_LAT) || 3.139,
  sourceLng: parseFloat(process.env.SOURCE_LNG) || 101.6869,
  nodeEnv: process.env.NODE_ENV || 'development'
};

const requiredEnvVars = ['ADGUARD_URL', 'ADGUARD_USERNAME', 'ADGUARD_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]?.trim());

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please create a .env file with the required variables.');
  process.exit(1);
}

const adguardClient = new AdGuardClient(
  process.env.ADGUARD_URL,
  process.env.ADGUARD_USERNAME,
  process.env.ADGUARD_PASSWORD
);

const geoService = new GeoService(config.sourceLat, config.sourceLng, {
  apiUrl: process.env.GEOIP_API_URL,
  apiTimeout: parseEnvInt(process.env.GEOIP_API_TIMEOUT),
  maxRetries: parseEnvInt(process.env.GEOIP_MAX_RETRIES),
  retryDelay: parseEnvInt(process.env.GEOIP_RETRY_DELAY),
  maxCacheSize: parseEnvInt(process.env.GEOIP_MAX_CACHE_SIZE),
  maxRequestsPerMinute: parseEnvInt(process.env.GEOIP_MAX_REQUESTS_PER_MINUTE),
  minRequestDelay: parseEnvInt(process.env.GEOIP_MIN_REQUEST_DELAY),
  sourceCity: process.env.SOURCE_CITY,
  sourceCountry: process.env.SOURCE_COUNTRY
});

class DNSPoller {
  constructor(adguardClient, geoService, config) {
    this.adguardClient = adguardClient;
    this.geoService = geoService;
    this.config = config;

    this.activeConnections = new Set();
    this.processedIds = new Set();
    this.lastPollTime = Date.now();
    this.dnsPollingInterval = null;
    this.statsPollingInterval = null;
  }

  addConnection(ws) {
    this.activeConnections.add(ws);
  }

  removeConnection(ws) {
    this.activeConnections.delete(ws);
  }

  startPolling() {
    if (this.dnsPollingInterval || this.activeConnections.size === 0) return;

    console.log('▶️  Starting DNS polling...');

    this.dnsPollingInterval = setInterval(async () => {
      try {
        await this.pollDNSLogs();
      } catch (error) {
        console.error('Error in DNS polling:', error.message);
        this.broadcast({ type: 'error', message: 'Failed to fetch DNS logs' });
      }
    }, this.config.pollInterval);

    this.statsPollingInterval = setInterval(async () => {
      try {
        await this.pollStats();
      } catch (error) {
        console.error('Error in stats polling:', error.message);
      }
    }, this.config.statsInterval);

    this.pollDNSLogs().catch(err => console.error('Initial DNS poll failed:', err));
    this.pollStats().catch(err => console.error('Initial stats poll failed:', err));
  }

  stopPolling() {
    if (this.activeConnections.size > 0) return;

    console.log('⏸️  Stopping DNS polling (no active connections)...');

    if (this.dnsPollingInterval) {
      clearInterval(this.dnsPollingInterval);
      this.dnsPollingInterval = null;
    }

    if (this.statsPollingInterval) {
      clearInterval(this.statsPollingInterval);
      this.statsPollingInterval = null;
    }
  }

  async pollDNSLogs() {
    const logs = await this.adguardClient.getQueryLog();

    const currentPollTime = Date.now();
    const timeSinceLastPoll = currentPollTime - this.lastPollTime;

    const blockedCount = logs.filter(entry => entry.filtered).length;
    const totalCount = logs.length;

    const cutoffTime = new Date(this.lastPollTime - 2000);
    const newEntries = logs.filter(entry => entry.timestamp > cutoffTime);

    if (totalCount > 0) {
      console.log(`📊 Fetched ${totalCount} DNS entries (${blockedCount} blocked) - ${newEntries.length} new entries since last poll (${(timeSinceLastPoll / 1000).toFixed(1)}s ago)`);
    }

    this.lastPollTime = currentPollTime;
    let processedCount = 0;
    let skippedDuplicates = 0;

    for (const entry of newEntries) {
      const entryId = `${entry.timestamp.getTime()}-${entry.domain}-${entry.client}`;

      if (this.processedIds.has(entryId)) {
        skippedDuplicates++;
        continue;
      }

      this.processedIds.add(entryId);
      if (this.processedIds.size > this.config.maxProcessedIds) {
        const firstId = this.processedIds.values().next().value;
        this.processedIds.delete(firstId);
      }

      await this.processDNSEntry(entry);
      processedCount++;
    }

    if (processedCount > 0 || skippedDuplicates > 0) {
      console.log(`✅ Processed ${processedCount} new queries (skipped ${skippedDuplicates} duplicates)`);
    }
  }

  async pollStats() {
    const stats = await this.adguardClient.getStats();
    this.broadcast({
      type: 'stats',
      data: stats
    });
  }

  async _resolveToIPs(target, label) {
    try {
      const ips = await this.adguardClient.resolveCNAME(target);
      if (ips && ips.length > 0) {
        console.log(`✅ ${label} resolved to ${ips.join(', ')}`);
        return ips;
      }
      console.log(`⚠️  ${label} resolution failed`);
    } catch (error) {
      console.error(`❌ ${label} resolution error:`, error.message);
    }
    return null;
  }

  async processDNSEntry(rawEntry) {
    const entry = { ...rawEntry };
    const source = this.geoService.getSource();

    console.log(`\n🔍 Processing DNS Entry: ${entry.domain} (${entry.type}) - IP: ${entry.answer?.join(', ') || 'none'}`);

    if (!entry.answer || entry.answer.length === 0) {
      if (entry.cname && !entry.filtered) {
        const ips = await this._resolveToIPs(entry.cname, `CNAME ${entry.cname}`);
        if (ips) { entry.answer = ips; entry.resolvedFromCname = true; }
      }

      if (!entry.answer || entry.answer.length === 0) {
        const nonIpRecordTypes = ['HTTPS', 'SRV', 'MX', 'TXT', 'NS', 'SOA', 'CAA', 'DNSKEY', 'DS'];
        if (nonIpRecordTypes.includes(entry.type) && !entry.filtered) {
          const ips = await this._resolveToIPs(entry.domain, `${entry.type}→A/AAAA ${entry.domain}`);
          if (ips) { entry.answer = ips; entry.resolvedFromNonIpRecord = true; }
        }
      }

      if (!entry.answer || entry.answer.length === 0) {
        if (Math.random() < (entry.filtered ? 0.1 : 0.05)) {
          const statusMsg = entry.filtered
            ? `blocked (reason: ${entry.reason})`
            : (entry.status === 'NXDOMAIN' ? 'domain not found' : 'no IP addresses');
          console.log(`${entry.filtered ? '🚫' : 'ℹ️ '} ${entry.domain}: ${statusMsg}`);
        }
        this.broadcast({
          type: 'dns_query',
          timestamp: entry.timestamp.toISOString(),
          source,
          destination: null,
          data: {
            domain: entry.domain,
            ip: entry.filtered ? 'Blocked' : 'No Answer',
            queryType: entry.type,
            elapsed: entry.elapsed,
            upstream: entry.upstreamElapsed,
            cached: entry.cached,
            filtered: entry.filtered,
            clientIp: entry.client,
            status: entry.status
          }
        });
        return;
      }
    }

    const lookups = await Promise.all(
      entry.answer.map(ip => this.geoService.lookup(ip).then(destination => ({ ip, destination })))
    );

    for (const { ip, destination } of lookups) {
      console.log(`  🌍 Looking up GeoIP for: ${ip}`);

      if (destination) {
        console.log(`  ✅ GeoIP found: ${destination.city}, ${destination.country} (${destination.lat}, ${destination.lng})`);
      } else {
        console.log(`  ❌ GeoIP lookup failed for: ${ip} (private IP or API failure)`);
      }

      let queryTypeLabel = entry.type;
      if (entry.resolvedFromCname && entry.cname) {
        queryTypeLabel = `CNAME→A/AAAA`;
      } else if (entry.resolvedFromNonIpRecord) {
        queryTypeLabel = `${entry.type}→A/AAAA`;
      }

      const message = {
        type: 'dns_query',
        timestamp: entry.timestamp.toISOString(),
        source,
        destination,
        data: {
          domain: entry.domain,
          ip,
          queryType: queryTypeLabel,
          cname: entry.resolvedFromCname ? entry.cname : undefined,
          elapsed: entry.elapsed,
          upstream: entry.upstreamElapsed,
          cached: entry.cached,
          filtered: entry.filtered,
          clientIp: entry.client,
          status: entry.status
        }
      };

      console.log(`  📤 Broadcasting: destination=${destination ? 'YES' : 'NO'}`);
      this.broadcast(message);
    }
  }

  broadcast(message) {
    const data = JSON.stringify(message);

    this.activeConnections.forEach(ws => {
      if (ws.readyState === 1) {
        try {
          ws.send(data);
        } catch (error) {
          console.error('Error broadcasting to client:', error.message);
        }
      }
    });
  }

  shutdown() {
    this.activeConnections.forEach(ws => {
      ws.close(1000, 'Server shutting down');
    });
    this.activeConnections.clear();
    this.stopPolling();
  }
}

const app = express();
const server = http.createServer(app);
const poller = new DNSPoller(adguardClient, geoService, config);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "https://unpkg.com"],
      connectSrc: ["'self'", "https://unpkg.com", "https://demotiles.maplibre.org"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      upgradeInsecureRequests: null
    }
  },
  crossOriginEmbedderPolicy: false
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.nodeEnv === 'production' ? 100 : 1000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    connections: poller.activeConnections.size
  });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;

  // Cap concurrent connections to prevent resource-exhaustion DoS
  if (poller.activeConnections.size >= config.maxConnections) {
    console.warn(`🚫 Connection from ${clientIp} rejected: max connections (${config.maxConnections}) reached`);
    ws.close(1013, 'Server at capacity, try again later');
    return;
  }

  console.log(`✅ Client connected from ${clientIp} (Total: ${poller.activeConnections.size + 1})`);

  poller.addConnection(ws);
  poller.startPolling();

  ws.on('close', () => {
    console.log(`❌ Client disconnected from ${clientIp} (Total: ${poller.activeConnections.size - 1})`);
    poller.removeConnection(ws);
    poller.stopPolling();
  });

  ws.on('error', (error) => {
    // 'error' is always followed by 'close', so removeConnection/stopPolling run twice — harmless for Set
    console.error(`WebSocket error from ${clientIp}:`, error.message);
    poller.removeConnection(ws);
    poller.stopPolling();
  });

  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to DNS Visualization Server',
    config: {
      pollInterval: config.pollInterval,
      maxConcurrentArcs: config.maxConcurrentArcs
    }
  }));
});

function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Closing gracefully...`);

  poller.shutdown();

  wss.close(() => {
    console.log('WebSocket server closed');
  });

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { DNSPoller };

if (process.env.NODE_ENV !== 'test') {
  server.listen(config.port, () => {
    const sourceCity = process.env.SOURCE_CITY || 'configured location';
    console.log(`\n🚀 DNS Visualization Dashboard`);
    console.log(`📡 Server running on http://localhost:${config.port}`);
    console.log(`🔄 Polling interval: ${config.pollInterval}ms`);
    console.log(`📊 Stats interval: ${config.statsInterval}ms`);
    console.log(`🌍 Source location: ${sourceCity} (${config.sourceLat}, ${config.sourceLng})`);
    console.log(`🔒 Environment: ${config.nodeEnv}`);
    console.log(`\nWaiting for client connections...\n`);
  });
}
