# Adguard DNS Visualization Dashboard

A real-time visualization of DNS queries on a world map. Watch your network's DNS traffic as animated arcs connecting your location to servers around the globe.

# Demo

![Alt text for the image](DNSvizAnimation.webp)

## What is this?

When you visit a website, your computer asks "where is google.com?" - that's a DNS query. This tool connects to AdGuard Home, grabs those queries, figures out where the servers are located, and draws them on a map. It's pretty neat to see where your internet traffic actually goes.

## Quick Start

### Option 1: Docker (Recommended)

The easiest way to run the dashboard is using Docker:

```bash
# Create a .env file with your AdGuard credentials
cat > .env << EOF
ADGUARD_URL=http://your-adguard-ip:3000
ADGUARD_USERNAME=admin
ADGUARD_PASSWORD=your_password
SOURCE_LAT=3.139
SOURCE_LNG=101.6869
PORT=8080
EOF

# Run the container
docker run -d \
  --name dns-visualizer \
  -p 8080:8080 \
  --env-file .env \
  azwanngali/adguard-dns-visualizer:latest
```

Open `http://localhost:8080` and you should see a map. Browse some websites and watch the arcs appear.

#### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
services:
  dns-dashboard:
    image: azwanngali/adguard-dns-visualizer:latest
    container_name: dns-visualization-dashboard
    ports:
      - "${PORT:-8080}:${PORT:-8080}"
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:${PORT:-8080}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
    networks:
      - dns-network

networks:
  dns-network:
    driver: bridge
```

Then run:
```bash
docker compose up -d
```

To stop:
```bash
docker compose down
```

### Option 2: Node.js

You'll need Node.js 22.12+ and AdGuard Home running.

**Note:** Node.js 22.12 or higher is required (the test toolchain needs it, and older lines are end-of-life). If you're on an older version, upgrade first:
```bash
node -v  # Check your version
# If below v22.12, upgrade from nodejs.org or use nvm
```

```bash
# Clone and install
git clone https://github.com/neur0tic/dns-visualizer.git
cd dns-visualizer
npm install

# Set up config
cp .env.example .env
# Edit .env with your AdGuard credentials

# Run it
npm start
```

Open `http://localhost:8080` and you should see a map. Browse some websites and watch the arcs appear.

## Configuration

Edit the `.env` file:

```env
# AdGuard connection
ADGUARD_URL=http://localhost:3000
ADGUARD_USERNAME=admin
ADGUARD_PASSWORD=your_password

# Server port (change if 8080 is already in use)
PORT=8080

# Your location (default is Kuala Lumpur)
SOURCE_LAT=3.139
SOURCE_LNG=101.6869

# How often to poll for new queries (milliseconds)
POLL_INTERVAL_MS=2000

# Max arcs to show at once
MAX_CONCURRENT_ARCS=100
```

Find your coordinates at [latlong.net](https://www.latlong.net/) if you want to set your actual location.

### Security settings

```env
# Extra origins that may open the WebSocket (comma-separated).
# Only needed behind a reverse proxy that changes the Host header.
# Same-origin connections are always allowed; other sites are rejected.
ALLOWED_ORIGINS=https://dns.example.com

# Max WebSocket connections per client IP (0 = no limit).
# Behind a reverse proxy every viewer shares the proxy's IP, so raise this or set 0.
MAX_WS_CONNECTIONS_PER_IP=5

# Reverse proxy IPs / CIDR ranges whose X-Forwarded-For header is trusted,
# so rate limiting sees the real client IP. Leave unset without a proxy.
# Also accepts loopback, linklocal, uniquelocal. "true" and "*" are refused.
TRUST_PROXY=172.18.0.0/16
```

The dashboard has no login. It shows every DNS query and client IP on your network, so keep it on a trusted network or behind a reverse proxy that adds authentication.

The server warns at startup when `ADGUARD_URL` or `GEOIP_API_URL` uses plain HTTP to a remote host. Over HTTP, the AdGuard password and the looked-up destination IPs can be read on the network. The default GeoIP service (ip-api.com free tier) only supports HTTP; use an HTTPS provider in `GEOIP_API_URL` if that matters to you.

## Features

**Map stuff:**
- Dark/light themes
- Move sidebar left or right
- Set your own location
- Filter out .local traffic

**Stats:**
- Active queries on the map
- Total queries counted
- Blocked queries (ads/trackers)
- Response times

**Colors:**
Different DNS record types get different colors - A records are orange, AAAA are blue, CNAME are green, etc.

## Troubleshooting

**Can't connect to AdGuard:**
Check that AdGuard is actually running and the URL in `.env` is right. Try opening `http://<your_adguard_ip>:3000` in your browser.

**No arcs showing up:**
Make sure query logging is enabled in AdGuard (Settings → DNS Settings). Also try browsing some websites to generate queries.

**WebSocket keeps disconnecting:**
Refresh the page. If it keeps happening, check the server logs for errors. A log line `origin "..." not allowed` means you open the dashboard through a different hostname than the server sees (for example, a reverse proxy). Add that URL to `ALLOWED_ORIGINS`.

**Using too much CPU:**
Lower `MAX_CONCURRENT_ARCS` to 50 and increase `POLL_INTERVAL_MS` to 5000 in your `.env` file.

## Performance tuning

For a busy network, you might want:
```env
POLL_INTERVAL_MS=1000
MAX_CONCURRENT_ARCS=200
GEOIP_MAX_CACHE_SIZE=50000
```

For a home network or slower computer:
```env
POLL_INTERVAL_MS=5000
MAX_CONCURRENT_ARCS=50
GEOIP_MAX_CACHE_SIZE=5000
```

## Contributing

Pull requests welcome. Please test your changes and keep the code style consistent.

## License

MIT

## Credits

Built with MapLibre GL, AdGuard Home, and ip-api.com.

## Author
Azwan Ngali (azwan.ngali@gmail.com)
https://merakit.my
