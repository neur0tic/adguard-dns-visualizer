# DNS Visualization Dashboard

A real-time DNS traffic visualization dashboard that connects to AdGuard Home and displays DNS queries as animated arcs on an interactive world map using MapLibre GL JS.

## Features

- **Real-time DNS Traffic Visualization**: Live streaming of DNS queries from AdGuard Home
- **Interactive World Map**: Built with MapLibre GL JS with dark/light theme support
- **Animated Arcs**: Beautiful arc animations from Kuala Lumpur (source) to destination IPs
- **Live Log Stream**: Display last 10 DNS queries with auto-fade animation
- **Performance Optimized**:
  - Limited concurrent arcs (100 max)
  - IP geolocation caching
  - Efficient WebSocket streaming
  - Request deduplication
- **Security Focused**:
  - Helmet.js security headers
  - Rate limiting
  - Input sanitization
  - CSP policies
- **Clean Minimalistic UI**: Sophisticated dark theme with gold accents

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│ AdGuard     │─────▶│   Node.js    │─────▶│  Browser    │
│ Home API    │      │   Server     │      │  (MapLibre) │
└─────────────┘      │              │      └─────────────┘
                     │ - API Client │
                     │ - WebSocket  │
                     │ - GeoIP      │
                     └──────────────┘
```

### Components

**Backend (`/server`)**:
- `index.js`: Express server with WebSocket support
- `adguard-client.js`: AdGuard Home API client with authentication
- `geo-service.js`: IP geolocation using geoip-lite with caching

**Frontend (`/public`)**:
- `index.html`: Main dashboard UI
- `app.js`: MapLibre integration and WebSocket client

## Installation

### Prerequisites

- Node.js 18+
- AdGuard Home instance with API access
- Network access to AdGuard Home API

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file**:
   ```env
   ADGUARD_URL=http://your-adguard-home:3000
   ADGUARD_USERNAME=your_username
   ADGUARD_PASSWORD=your_password
   PORT=8080
   SOURCE_LAT=3.139
   SOURCE_LNG=101.6869
   ```

4. **Start the server**:
   ```bash
   npm start
   ```

5. **Access dashboard**:
   Open browser to `http://localhost:8080`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADGUARD_URL` | AdGuard Home URL | `http://localhost:3000` |
| `ADGUARD_USERNAME` | AdGuard username | `admin` |
| `ADGUARD_PASSWORD` | AdGuard password | - |
| `PORT` | Server port | `8080` |
| `SOURCE_LAT` | Source latitude (KL) | `3.139` |
| `SOURCE_LNG` | Source longitude (KL) | `101.6869` |
| `MAX_CONCURRENT_ARCS` | Max simultaneous arcs | `100` |
| `LOG_RETENTION_COUNT` | Max log entries | `10` |
| `POLL_INTERVAL_MS` | Polling interval | `2000` |

### Performance Tuning

**For high-traffic environments**:
- Reduce `POLL_INTERVAL_MS` for more frequent updates
- Increase `MAX_CONCURRENT_ARCS` if you have powerful hardware
- Adjust `LOG_RETENTION_COUNT` based on screen size

**For low-traffic or resource-constrained**:
- Increase `POLL_INTERVAL_MS` to reduce CPU usage
- Decrease `MAX_CONCURRENT_ARCS` to improve rendering performance

## Security Best Practices

### Implemented Security Measures

1. **Authentication**: Basic auth to AdGuard Home API
2. **Rate Limiting**: 100 requests per 15 minutes per IP
3. **Security Headers**: Helmet.js with CSP
4. **Input Sanitization**: All DNS data sanitized
5. **HTTPS Support**: WebSocket upgrades to WSS
6. **Private IP Filtering**: Local IPs excluded from visualization

### Recommended Deployment

1. **Use HTTPS**: Deploy behind reverse proxy (nginx/Caddy)
2. **Firewall**: Restrict access to trusted networks
3. **Environment Variables**: Never commit `.env` file
4. **Updates**: Keep dependencies updated (`npm audit`)
5. **Monitoring**: Monitor WebSocket connections and memory usage

### Example Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name dns-viz.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## API Integration

### AdGuard Home API Endpoints Used

- `POST /control/querylog`: Fetch DNS query logs
- `GET /control/status`: Health check

### WebSocket Protocol

**Client → Server**: Connection only, no messages sent

**Server → Client**: JSON messages

```json
{
  "type": "dns_query",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "source": {
    "lat": 3.139,
    "lng": 101.6869,
    "city": "Kuala Lumpur"
  },
  "destination": {
    "lat": 37.7749,
    "lng": -122.4194,
    "city": "San Francisco",
    "country": "US"
  },
  "data": {
    "domain": "example.com",
    "queryType": "A",
    "ip": "93.184.216.34",
    "elapsed": 15,
    "status": "processed",
    "cached": false
  }
}
```

## Troubleshooting

### Connection Issues

**"Failed to connect to AdGuard Home"**:
- Verify `ADGUARD_URL` is correct
- Check AdGuard Home is running
- Verify credentials in `.env`
- Check firewall/network access

**WebSocket disconnects**:
- Check browser console for errors
- Verify server is running
- Check reverse proxy WebSocket support

### Performance Issues

**High CPU usage**:
- Reduce `MAX_CONCURRENT_ARCS`
- Increase `POLL_INTERVAL_MS`
- Check for memory leaks in browser

**Arcs not showing**:
- Check browser console for errors
- Verify DNS queries have answer IPs
- Check GeoIP database loaded successfully

## Development

```bash
# Watch mode (Node 18+)
npm run dev

# Check logs
tail -f server.log

# Test AdGuard connection
curl -u username:password http://adguard-url/control/status
```

## License

MIT

## Credits

- MapLibre GL JS for mapping
- AdGuard Home for DNS filtering
- geoip-lite for IP geolocation
