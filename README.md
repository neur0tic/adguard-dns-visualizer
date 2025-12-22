# DNS Visualization Dashboard

**TL;DR:** A real-time visualization tool that shows your DNS queries as animated arcs on a world map.

This app connects to AdGuard Home and displays every DNS lookup your network makes, drawing animated lines from your location to where those servers are located worldwide.

---

## What Does This Do?

Every time you visit a website, your computer performs a DNS lookup to find the server's IP address. This application:

1. **Captures** those DNS queries from AdGuard Home
2. **Locates** where each server is in the world
3. **Visualizes** the connection as an animated arc on a map
4. **Displays** statistics like response time, blocked queries, and cache hits

Think of it as a live map of your internet activity.

---

## Quick Start

### Prerequisites

- **Node.js** version 18 or higher ([Download here](https://nodejs.org/))
- **AdGuard Home** installed and running ([Get it here](https://adguard.com/adguard-home/))
- Basic command line knowledge

### Installation (5 minutes)

**Step 1: Download the project**
```bash
git clone https://github.com/neur0tic/dns-visualizer.git
cd dns-visualizer
```

**Step 2: Install dependencies**
```bash
npm install
```
This downloads all required libraries.

**Step 3: Create configuration file**
```bash
cp .env.example .env
```
This creates your settings file from the template.

**Step 4: Configure your settings**

Open the `.env` file in any text editor and update:

```env
# AdGuard Home connection
ADGUARD_URL=http://localhost:3000
ADGUARD_USERNAME=admin
ADGUARD_PASSWORD=your_password_here

# Your location (default: Kuala Lumpur)
SOURCE_LAT=3.139
SOURCE_LNG=101.6869

# Server port
PORT=8080
```

**Step 5: Start the server**
```bash
npm start
```

**Step 6: Open in browser**

Navigate to: `http://localhost:8080`

You should see a world map. Start browsing websites and watch the arcs appear as DNS queries are made.

---

## What You'll See

### The Map Interface

- **Pulsing circle** - Your source location
- **Animated arcs** - DNS queries traveling to their destinations
- **Labels** - Information about each query (domain, IP, response time)
- **Color coding** - Different DNS record types have different colors

### Sidebar Statistics

The sidebar shows real-time metrics:

- **Active Queries** - Current number of arcs on the map
- **Total Queries** - Cumulative count of DNS lookups
- **Blocked Queries** - Ads and trackers blocked by AdGuard
- **Avg Response** - Average DNS response time
- **Upstream Response** - Time taken by upstream DNS servers
- **AdGuard Processing** - Time spent in AdGuard filtering

### DNS Record Colors

- **Orange** - A record (IPv4 address)
- **Blue** - AAAA record (IPv6 address)
- **Green** - CNAME (canonical name/alias)
- **Purple** - MX (mail exchange)
- **Red** - Blocked queries

---

## Features

### Theme Toggle
Switch between dark and light modes using the theme toggle button.

### Sidebar Position
Move the sidebar between left and right sides of the screen.

### Custom Source Location
Set your actual location:
- Choose from preset cities
- Enter custom latitude/longitude coordinates
- Changes persist across sessions

### Traffic Filtering
Toggle the `.local` filter to hide local network traffic (printers, NAS devices, etc.)

### Layout Options
Cycle through different dashboard layouts to suit your preference.

---

## Configuration Options

All settings are in the `.env` file:

### Performance Tuning

```env
# Polling intervals (in milliseconds)
POLL_INTERVAL_MS=2000          # How often to check for new DNS queries
STATS_INTERVAL_MS=5000         # How often to update statistics

# Display limits
MAX_CONCURRENT_ARCS=100        # Maximum arcs shown simultaneously
LOG_RETENTION_COUNT=10         # Number of log entries to keep
```

**For high-traffic networks:**
- Decrease `POLL_INTERVAL_MS` to 1000-1500 for more real-time updates
- Increase `MAX_CONCURRENT_ARCS` to 150-200

**For low-end hardware:**
- Increase `POLL_INTERVAL_MS` to 5000+
- Decrease `MAX_CONCURRENT_ARCS` to 50

### Location Settings

Find your coordinates at [latlong.net](https://www.latlong.net/)

```env
SOURCE_LAT=40.7128    # New York City example
SOURCE_LNG=-74.0060
```

### GeoIP API Settings

```env
GEOIP_MAX_CACHE_SIZE=10000        # Number of IP locations to cache
GEOIP_MAX_REQUESTS_PER_MINUTE=15  # API rate limit (free tier: 45/min)
GEOIP_MIN_REQUEST_DELAY=4000      # Minimum delay between API calls (ms)
```

---

## Troubleshooting

### Cannot connect to AdGuard Home

**Symptoms:** Error message about connection failure

**Solutions:**
1. Verify AdGuard Home is running: `curl http://localhost:3000`
2. Check the `ADGUARD_URL` in your `.env` file
3. Confirm your username and password are correct
4. Ensure AdGuard Home API is enabled

### No arcs appearing on map

**Symptoms:** Map loads but no visualizations appear

**Solutions:**
1. Verify DNS queries are happening (browse some websites)
2. Check AdGuard Home has query logging enabled (Settings > DNS Settings)
3. Open browser console (F12) and check for errors
4. Verify the GeoIP API is working (check server logs)

### WebSocket disconnected

**Symptoms:** "Disconnected" status in the UI

**Solutions:**
1. Refresh the browser page
2. Check if the server is still running
3. Verify port 8080 is not blocked by firewall
4. Check server logs for error messages

### High CPU usage

**Symptoms:** Computer running slow, high CPU in task manager

**Solutions:**
1. Reduce `MAX_CONCURRENT_ARCS` to 50 in `.env`
2. Increase `POLL_INTERVAL_MS` to 5000 in `.env`
3. Close other browser tabs
4. Restart the server after making changes

### Rate limit errors

**Symptoms:** "Rate limit reached" messages in logs

**Solutions:**
1. Increase `GEOIP_MIN_REQUEST_DELAY` to 5000
2. Decrease `GEOIP_MAX_REQUESTS_PER_MINUTE` to 10
3. Increase `GEOIP_MAX_CACHE_SIZE` to reduce API calls
4. Consider using a paid GeoIP service for higher limits

---

## Docker Deployment

If you prefer using Docker:

**docker-compose.yml:**
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
      - ADGUARD_URL=http://adguard:3000
      - ADGUARD_USERNAME=admin
      - ADGUARD_PASSWORD=${ADGUARD_PASSWORD}
      - SOURCE_LAT=3.139
      - SOURCE_LNG=101.6869
    command: sh -c "npm install && npm start"
    depends_on:
      - adguard

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
```

**Start with Docker:**
```bash
echo "ADGUARD_PASSWORD=your_password" > .env
docker-compose up -d
```

**View logs:**
```bash
docker-compose logs -f dns-visualizer
```

**Stop services:**
```bash
docker-compose down
```

---

## How It Works

### Architecture Overview

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  AdGuard Home   │      │   Node.js Server │      │   Web Browser   │
│                 │      │                  │      │                 │
│  - DNS Filter   │<─────┤  - API Client    │      │  - MapLibre GL  │
│  - Query Log    │      │  - WebSocket     │<─────┤  - WebSocket    │
│  - Statistics   │      │  - GeoIP Cache   │      │  - UI/Charts    │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   ip-api.com    │
                         │  (GeoIP Lookup) │
                         └─────────────────┘
```

### Data Flow

1. **DNS Query** - User's device makes a DNS lookup
2. **AdGuard Logs** - AdGuard Home logs the query
3. **Server Polls** - Node.js server fetches new logs via API
4. **GeoIP Lookup** - Server finds geographic location of IP address
5. **WebSocket Push** - Server sends data to browser in real-time
6. **Visualization** - Browser draws animated arc on map

### Caching Strategy

The application uses an LRU (Least Recently Used) cache to minimize API calls:
- IP locations are cached after first lookup
- Cache size configurable (default: 10,000 entries)
- Reduces API usage and improves performance
- Cache persists for the server session

---

## Security

### Implemented Security Measures

**Helmet.js Security Headers:**
- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

**Rate Limiting:**
- 100 requests per 15 minutes per IP (production)
- 1000 requests per 15 minutes (development)

**Input Sanitization:**
- All DNS data sanitized before display
- HTML entity encoding
- IP address validation

**Authentication:**
- Basic auth to AdGuard Home API
- Credentials stored in environment variables (not in code)

**Private IP Filtering:**
- Local/private IPs excluded from visualization
- Prevents internal network exposure

### Best Practices for Production

1. **Use HTTPS** - Deploy behind a reverse proxy (Nginx, Caddy, Traefik)
2. **Firewall** - Restrict access to trusted networks only
3. **Strong Passwords** - Use strong AdGuard credentials
4. **Keep Updated** - Regularly update dependencies
5. **Monitor Logs** - Set up logging and monitoring
6. **Backup .env** - Keep `.env` file secure and backed up

### Important Security Notes

- The `.env` file contains sensitive credentials
- **Never commit `.env` to version control**
- `.env` is already in `.gitignore` by default
- Rotate passwords if `.env` is ever exposed

---

## Project Structure

```
dns-visualizer/
├── server/
│   ├── index.js           # Main server & WebSocket handler
│   ├── adguard-client.js  # AdGuard Home API client
│   └── geo-service.js     # GeoIP service with caching
├── public/
│   ├── index.html         # Dashboard UI
│   ├── app.js            # Frontend logic & animations
│   └── styles.css        # Styling
├── .env.example          # Environment template
├── .env                  # Your settings (create this)
├── package.json          # Dependencies
└── README.md            # This file
```

---

## Technology Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **WebSocket (ws)** - Real-time communication
- **Helmet** - Security middleware
- **express-rate-limit** - Rate limiting
- **dotenv** - Environment configuration

### Frontend
- **MapLibre GL JS** - Open-source mapping library
- **Vanilla JavaScript** - No framework dependencies
- **WebSocket API** - Real-time updates
- **CSS3** - Modern styling with animations

### External Services
- **AdGuard Home** - DNS filtering and logging
- **ip-api.com** - Free IP geolocation API (45 requests/minute)

---

## Development

### Development Mode

Run with auto-reload:
```bash
npm run dev
```

### Available Commands

```bash
npm start          # Start production server
npm run dev        # Start with auto-reload
npm install        # Install dependencies
npm update         # Update dependencies
npm audit          # Check for security vulnerabilities
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

---

## Performance Optimization

### Recommended Settings by Use Case

**Home Network (Low Traffic):**
```env
POLL_INTERVAL_MS=3000
MAX_CONCURRENT_ARCS=50
GEOIP_MAX_CACHE_SIZE=5000
```

**Office Network (Medium Traffic):**
```env
POLL_INTERVAL_MS=2000
MAX_CONCURRENT_ARCS=100
GEOIP_MAX_CACHE_SIZE=10000
```

**Enterprise Network (High Traffic):**
```env
POLL_INTERVAL_MS=1000
MAX_CONCURRENT_ARCS=200
GEOIP_MAX_CACHE_SIZE=50000
```

### Monitoring Performance

Check browser DevTools:
- **Memory tab** - Monitor for memory leaks
- **Performance tab** - Check frame rate
- **Network tab** - Monitor WebSocket traffic
- **Console** - Check for errors

---

## Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m "Add amazing feature"`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- Use ES6+ JavaScript features
- Follow existing code formatting
- Add comments for complex logic
- Update documentation for new features

---

## License

MIT License - See LICENSE file for details

---

## Support

- **Issues:** [GitHub Issues](https://github.com/neur0tic/dns-visualizer/issues)
- **Discussions:** [GitHub Discussions](https://github.com/neur0tic/dns-visualizer/discussions)
- **Documentation:** See additional docs in the repository

---

## Credits

- [MapLibre GL JS](https://maplibre.org/) - Open-source mapping library
- [AdGuard Home](https://adguard.com/adguard-home/) - Network-wide ad blocking
- [ip-api.com](https://ip-api.com/) - Free IP geolocation API
- [Express](https://expressjs.com/) - Web framework
- [Helmet](https://helmetjs.github.io/) - Security middleware

---

## Changelog

### Version 1.0.0
- Initial release
- Real-time DNS visualization
- AdGuard Home integration
- GeoIP caching and rate limiting
- Dark/light theme support
- Mobile responsive design
- Custom source location
- Layout customization

---

**Made for privacy-conscious users who want to understand their network traffic**
