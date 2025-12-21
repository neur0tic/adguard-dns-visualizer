# DNS Visualization Dashboard

A real-time DNS traffic visualization dashboard that connects to AdGuard Home and displays DNS queries as animated arcs on an interactive world map.

## Description

This application provides a beautiful, real-time visualization of DNS traffic from your AdGuard Home instance. Watch as DNS queries travel across the globe with animated arcs on an interactive map, complete with detailed logging and statistics.

**Key Features:**
- Real-time DNS query visualization with animated arcs
- Interactive world map with dark/light theme support
- Live statistics dashboard (response times, blocked queries, cache hits)
- WebSocket-based streaming for instant updates
- Smart label placement with collision detection
- Responsive design with mobile support
- Security-focused with rate limiting and input sanitization

## Tech Stack

### Backend
- **Node.js** (v18+) - Server runtime
- **Express** - Web framework
- **WebSocket (ws)** - Real-time communication
- **Helmet** - Security headers
- **express-rate-limit** - API rate limiting
- **dotenv** - Environment configuration

### Frontend
- **MapLibre GL JS** - Interactive mapping library
- **Vanilla JavaScript** - No framework dependencies
- **WebSocket API** - Real-time data streaming
- **Canvas API** - Chart rendering

### External Services
- **AdGuard Home** - DNS filtering and query logging
- **ip-api.com** - IP geolocation (free tier: 45 req/min)

## Requirements

### System Requirements
- **Node.js**: v18.0.0 or higher
- **RAM**: Minimum 512MB, recommended 1GB+
- **Network**: Access to AdGuard Home API

### AdGuard Home Setup
1. AdGuard Home must be installed and running
2. API access must be enabled
3. Query logging must be enabled in AdGuard settings
4. You need admin credentials for API authentication

### Browser Compatibility
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers with WebGL support

## Installation

### Standard Installation

1. Clone the repository:
```bash
git clone https://github.com/neur0tic/dns-visualizer.git
cd dns-visualizer
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` with your settings (see Configuration section below)

5. Start the server:
```bash
npm start
```

6. Access the dashboard:
```
http://localhost:8080
```

### Development Mode

For development with auto-reload:
```bash
npm run dev
```

## Configuration

### Environment Variables (.env)

Create a `.env` file in the project root with the following configuration:

```env
# AdGuard Home Configuration (Required)
ADGUARD_URL=http://localhost:3000
ADGUARD_USERNAME=admin
ADGUARD_PASSWORD=your_password_here

# Server Configuration
PORT=8080
NODE_ENV=production

# Source Location (Default: Kuala Lumpur)
# Change these to your actual location
SOURCE_LAT=3.139
SOURCE_LNG=101.6869

# GeoIP API Configuration (Optional)
# Default: http://ip-api.com/json (45 req/min free tier)
# GEOIP_API_URL=http://ip-api.com/json
# GEOIP_API_TIMEOUT=5000
# GEOIP_MAX_RETRIES=2
# GEOIP_RETRY_DELAY=1000
# GEOIP_MAX_CACHE_SIZE=10000
# GEOIP_MAX_REQUESTS_PER_MINUTE=15
# GEOIP_MIN_REQUEST_DELAY=4000

# Performance Settings
MAX_CONCURRENT_ARCS=100
LOG_RETENTION_COUNT=10
POLL_INTERVAL_MS=3000
STATS_INTERVAL_MS=5000
```

### Configuration Details

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `ADGUARD_URL` | AdGuard Home base URL | `http://localhost:3000` | Include protocol and port |
| `ADGUARD_USERNAME` | AdGuard admin username | `admin` | Required for API access |
| `ADGUARD_PASSWORD` | AdGuard admin password | - | **Required** |
| `PORT` | Server listening port | `8080` | Change if port is in use |
| `NODE_ENV` | Environment mode | `production` | Use `development` for debugging |
| `SOURCE_LAT` | Source latitude | `3.139` | Your location's latitude |
| `SOURCE_LNG` | Source longitude | `101.6869` | Your location's longitude |
| `GEOIP_MAX_CACHE_SIZE` | Max cached IP locations | `10000` | Increase for better performance |
| `GEOIP_MAX_REQUESTS_PER_MINUTE` | API rate limit | `15` | Stay under free tier limit |
| `GEOIP_MIN_REQUEST_DELAY` | Min delay between API calls (ms) | `4000` | Prevents API bursts |
| `MAX_CONCURRENT_ARCS` | Max simultaneous arcs | `100` | Reduce for lower-end hardware |
| `POLL_INTERVAL_MS` | DNS polling interval | `3000` | Lower = more real-time, higher CPU |
| `STATS_INTERVAL_MS` | Statistics update interval | `5000` | How often stats refresh |

### Performance Tuning

**High-traffic networks:**
- Increase `GEOIP_MAX_CACHE_SIZE` to 50000+
- Set `POLL_INTERVAL_MS` to 2000-3000
- Increase `MAX_CONCURRENT_ARCS` to 150-200

**Low-traffic or resource-constrained:**
- Decrease `MAX_CONCURRENT_ARCS` to 50
- Increase `POLL_INTERVAL_MS` to 5000+
- Reduce `GEOIP_MAX_CACHE_SIZE` to 5000

## Docker Compose Example

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  dns-visualizer:
    image: node:18-alpine
    container_name: dns-visualizer
    restart: unless-stopped
    working_dir: /app
    volumes:
      - ./:/app
      - /app/node_modules
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - ADGUARD_URL=http://adguard:3000
      - ADGUARD_USERNAME=admin
      - ADGUARD_PASSWORD=${ADGUARD_PASSWORD}
      - PORT=8080
      - SOURCE_LAT=3.139
      - SOURCE_LNG=101.6869
      - POLL_INTERVAL_MS=3000
      - STATS_INTERVAL_MS=5000
      - MAX_CONCURRENT_ARCS=100
    command: sh -c "npm install && npm start"
    depends_on:
      - adguard
    networks:
      - dns-network

  adguard:
    image: adguard/adguardhome:latest
    container_name: adguard
    restart: unless-stopped
    ports:
      - "53:53/tcp"
      - "53:53/udp"
      - "3000:3000/tcp"
    volumes:
      - ./adguard/work:/opt/adguardhome/work
      - ./adguard/conf:/opt/adguardhome/conf
    networks:
      - dns-network

networks:
  dns-network:
    driver: bridge
```

### Docker Compose Usage

1. Create `.env` file with your AdGuard password:
```bash
echo "ADGUARD_PASSWORD=your_secure_password" > .env
```

2. Start services:
```bash
docker-compose up -d
```

3. Access services:
- DNS Visualizer: `http://localhost:8080`
- AdGuard Home: `http://localhost:3000`

4. View logs:
```bash
docker-compose logs -f dns-visualizer
```

5. Stop services:
```bash
docker-compose down
```

## Usage

### First-Time Setup

1. Configure AdGuard Home:
   - Access AdGuard at `http://localhost:3000`
   - Complete initial setup wizard
   - Enable query logging in Settings > DNS Settings
   - Note your admin credentials

2. Update `.env` file with AdGuard credentials

3. Start the visualizer and access the dashboard

### Dashboard Features

**Map Controls:**
- Drag to pan
- Scroll to zoom
- Click navigation controls for zoom/rotation

**Sidebar Controls:**
- Theme toggle (sun/moon icon)
- Sidebar position toggle (left/right)
- Sidebar hide/show toggle
- Filter .local traffic toggle

**Statistics Panel:**
- Active Queries: Current arcs on map
- Total Queries: Lifetime query count
- Blocked Queries: Queries blocked by AdGuard
- Avg Response: Average DNS response time
- Upstream Response: Estimated upstream DNS time
- AdGuard Processing: AdGuard processing time

**Query Log:**
- Last 15 DNS queries
- Color-coded by type (A, AAAA, CNAME, etc.)
- Shows blocked queries in red
- Auto-fades after 5 seconds

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  AdGuard Home   │      │   Node.js Server │      │   Web Browser   │
│                 │      │                  │      │                 │
│  - DNS Filter   │◄─────┤  - API Client    │      │  - MapLibre GL  │
│  - Query Log    │      │  - WebSocket     │◄─────┤  - WebSocket    │
│  - Statistics   │      │  - GeoIP Cache   │      │  - UI/Charts    │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   ip-api.com    │
                         │  (GeoIP Lookup) │
                         └─────────────────┘
```

## Security

### Implemented Security Features

1. **Helmet.js Security Headers**
   - Content Security Policy (CSP)
   - X-Frame-Options
   - X-Content-Type-Options
   - Strict-Transport-Security

2. **Rate Limiting**
   - 100 requests per 15 minutes per IP (production)
   - 1000 requests per 15 minutes (development)

3. **Input Sanitization**
   - All DNS data sanitized before display
   - HTML entity encoding
   - IP address validation

4. **Authentication**
   - Basic auth to AdGuard Home API
   - Credentials stored in environment variables

5. **Private IP Filtering**
   - Local/private IPs excluded from visualization
   - Prevents internal network exposure

### Production Deployment Recommendations

1. **Use HTTPS**: Deploy behind reverse proxy (Nginx, Caddy, Traefik)
2. **Firewall**: Restrict access to trusted networks
3. **Strong Passwords**: Use strong AdGuard credentials
4. **Keep Updated**: Regularly update dependencies
5. **Monitor**: Set up logging and monitoring

### Example Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name dns-viz.example.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Troubleshooting

### Common Issues

**Cannot connect to AdGuard Home:**
- Verify `ADGUARD_URL` is correct and accessible
- Check AdGuard Home is running: `curl http://localhost:3000`
- Verify credentials are correct
- Check firewall rules

**No arcs appearing on map:**
- Ensure DNS queries are happening (check AdGuard logs)
- Verify query logging is enabled in AdGuard
- Check browser console for errors
- Confirm GeoIP API is working (check server logs)

**High CPU usage:**
- Reduce `MAX_CONCURRENT_ARCS`
- Increase `POLL_INTERVAL_MS`
- Check for browser memory leaks (close/reopen tab)

**WebSocket disconnections:**
- Check server logs for errors
- Verify reverse proxy WebSocket support
- Check network stability

**Rate limit errors:**
- Increase `GEOIP_MIN_REQUEST_DELAY`
- Decrease `GEOIP_MAX_REQUESTS_PER_MINUTE`
- Consider using a paid GeoIP service

## Development

### Project Structure

```
dns-visualizer/
├── server/
│   ├── index.js           # Main server & WebSocket
│   ├── adguard-client.js  # AdGuard API client
│   └── geo-service.js     # GeoIP service with caching
├── public/
│   ├── index.html         # Dashboard UI
│   ├── app.js            # Frontend logic
│   └── styles.css        # Styling
├── .env.example          # Environment template
├── package.json          # Dependencies
└── README.md            # This file
```

### Development Commands

```bash
# Install dependencies
npm install

# Development mode (auto-reload)
npm run dev

# Production mode
npm start

# Check for security vulnerabilities
npm audit

# Update dependencies
npm update
```

### API Endpoints

**Health Check:**
```
GET /health
Response: {"status":"ok","timestamp":"...","connections":1}
```

**Static Files:**
```
GET /           # Dashboard HTML
GET /app.js     # Frontend JavaScript
GET /styles.css # Styles
```

**WebSocket:**
```
WS /
Messages: JSON-formatted DNS query events
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details

## Credits

- [MapLibre GL JS](https://maplibre.org/) - Open-source mapping library
- [AdGuard Home](https://adguard.com/adguard-home/) - Network-wide ad blocking
- [ip-api.com](https://ip-api.com/) - Free IP geolocation API
- [Express](https://expressjs.com/) - Web framework
- [Helmet](https://helmetjs.github.io/) - Security middleware

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/neur0tic/dns-visualizer/issues
- Documentation: See MIGRATION_GUIDE.md and GEOIP_ALTERNATIVES.md

## Changelog

### Version 1.0.0
- Initial release
- Real-time DNS visualization
- AdGuard Home integration
- GeoIP caching and rate limiting
- Dark/light theme support
- Mobile responsive design
