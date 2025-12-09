# Project Structure

```
MapLibre/
├── server/
│   ├── index.js              # Main Express + WebSocket server
│   ├── adguard-client.js     # AdGuard Home API client
│   └── geo-service.js        # IP geolocation service
│
├── public/
│   ├── index.html            # Main dashboard UI
│   └── app.js                # Frontend application logic
│
├── node_modules/             # Dependencies (generated)
│
├── .env                      # Environment configuration (DO NOT COMMIT)
├── .env.example              # Example environment configuration
├── .gitignore                # Git ignore rules
├── package.json              # NPM dependencies and scripts
├── README.md                 # Full documentation
├── QUICKSTART.md             # Quick start guide
└── PROJECT_STRUCTURE.md      # This file

```

## File Descriptions

### Backend Files

**server/index.js**
- Express HTTP server setup
- WebSocket server for real-time communication
- Security middleware (Helmet, rate limiting)
- DNS log polling and broadcasting
- Graceful shutdown handling

**server/adguard-client.js**
- AdGuard Home API authentication
- DNS query log fetching with pagination
- Data parsing and sanitization
- Connection testing

**server/geo-service.js**
- IP to geographic coordinate conversion
- Private IP filtering
- LRU cache for performance
- Country and city lookup

### Frontend Files

**public/index.html**
- Responsive dashboard layout
- MapLibre GL JS integration
- Real-time statistics display
- DNS log stream UI
- Dark/light theme toggle
- Sophisticated dark theme styling

**public/app.js**
- WebSocket client connection
- MapLibre map initialization
- Arc animation system
- Label positioning and lifecycle
- Log stream management
- Statistics calculation
- Theme switching

## Key Features by File

### Security (server/index.js)
- ✅ Helmet.js security headers
- ✅ Content Security Policy
- ✅ Rate limiting (100 req/15min)
- ✅ Input sanitization
- ✅ Environment variable isolation

### Performance Optimizations
- ✅ IP geolocation caching (geo-service.js)
- ✅ Log deduplication (index.js)
- ✅ Maximum concurrent arcs limit (app.js)
- ✅ Efficient WebSocket polling (index.js)
- ✅ Auto-cleanup of old elements (app.js)

### User Experience
- ✅ Real-time arc animations (app.js)
- ✅ Auto-fading labels and logs (index.html, app.js)
- ✅ Connection status indicator (index.html)
- ✅ Live statistics (app.js)
- ✅ Automatic reconnection (app.js)
- ✅ Responsive design (index.html)

## Data Flow

```
1. AdGuard Home
   ↓ (HTTP API)
2. server/adguard-client.js
   ↓ (Parse & Sanitize)
3. server/geo-service.js
   ↓ (Add Coordinates)
4. server/index.js
   ↓ (WebSocket)
5. public/app.js
   ↓ (Render)
6. public/index.html (Display)
```

## Configuration Files

**.env**
- Runtime configuration
- AdGuard credentials
- Server settings
- Performance tuning

**package.json**
- Dependencies manifest
- NPM scripts
- Project metadata

**.gitignore**
- Excludes sensitive files
- Prevents committing credentials
- Ignores node_modules

## Best Practices Implemented

### Code Quality
- ✅ JSDoc comments for all functions
- ✅ Error handling and logging
- ✅ Modular architecture
- ✅ Separation of concerns

### Security
- ✅ No hardcoded credentials
- ✅ Input validation
- ✅ Private IP filtering
- ✅ Secure WebSocket upgrade

### Performance
- ✅ Caching strategies
- ✅ Resource cleanup
- ✅ Memory management
- ✅ Efficient rendering

### Maintainability
- ✅ Clear file organization
- ✅ Comprehensive documentation
- ✅ Example configurations
- ✅ Troubleshooting guides
