# Quick Start Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure AdGuard Home Access

Edit `.env` file with your AdGuard Home credentials:

```bash
ADGUARD_URL=http://your-adguard-ip:3000
ADGUARD_USERNAME=your_username
ADGUARD_PASSWORD=your_password
```

## 3. Start the Server

```bash
npm start
```

## 4. Open Dashboard

Navigate to: `http://localhost:8080`

## What You'll See

- **World Map**: Interactive map centered on Kuala Lumpur (your DNS source)
- **Animated Arcs**: Live DNS queries visualized as animated arcs
- **Log Stream**: Bottom-right panel showing last 10 DNS queries
- **Statistics**: Top-right panel with active queries, total count, and average response time
- **Theme Toggle**: Bottom-left button to switch between dark/light modes

## Features Explained

### Arc Animations
- Each DNS query creates an arc from Kuala Lumpur to the destination IP's location
- Arcs animate over 2 seconds
- Labels appear at destination showing domain, IP, query type, response time
- Arcs and labels fade out after 5 seconds

### Log Stream
- Displays last 10 DNS queries
- Shows domain, IP address, query type, response time
- Entries fade out after 5 seconds
- Auto-scrolls to show newest entries

### Performance
- Maximum 100 concurrent arcs to prevent overload
- IP geolocation caching for better performance
- WebSocket connection with automatic reconnection
- Efficient rendering with requestAnimationFrame

## Troubleshooting

**No arcs appearing?**
- Check AdGuard Home is generating DNS traffic
- Verify `.env` credentials are correct
- Open browser console (F12) to check for errors

**Connection issues?**
- Ensure AdGuard Home API is accessible from server
- Check firewall rules
- Verify AdGuard Home API is enabled in settings

**Performance issues?**
- Reduce `MAX_CONCURRENT_ARCS` in `.env`
- Increase `POLL_INTERVAL_MS` for slower polling
- Close other browser tabs

## Advanced Configuration

### Change Source Location

Edit `.env`:
```bash
SOURCE_LAT=your_latitude
SOURCE_LNG=your_longitude
```

### Adjust Polling Speed

```bash
POLL_INTERVAL_MS=1000  # Poll every 1 second (faster)
POLL_INTERVAL_MS=5000  # Poll every 5 seconds (slower)
```

### Production Deployment

See [README.md](README.md) for production deployment with HTTPS and reverse proxy configuration.
