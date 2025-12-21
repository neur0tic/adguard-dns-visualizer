# GeoIP Alternatives to geoip-lite

## Problem
`geoip-lite` package is **153MB** - making your Docker image unnecessarily large.

## 📊 Comparison Table

| Solution | Size | Offline | Accuracy | Setup | Free Limit | Best For |
|----------|------|---------|----------|-------|------------|----------|
| **ip-api.com API** | 0MB | ❌ | ⭐⭐⭐⭐⭐ | Easy | 45/min | Small-medium traffic |
| **ipapi.co API** | 0MB | ❌ | ⭐⭐⭐⭐⭐ | Easy | 1000/day | Low traffic |
| **geoip-country-only** | 5MB | ✅ | ⭐⭐⭐ | Easy | Unlimited | Country only needed |
| **fast-geoip** | 30MB | ✅ | ⭐⭐⭐⭐ | Easy | Unlimited | Smaller than geoip-lite |
| **node-geoip** | 40MB | ✅ | ⭐⭐⭐⭐ | Easy | Unlimited | Good balance |
| **MaxMind API** | 0MB | ❌ | ⭐⭐⭐⭐⭐ | Medium | 1000/day free | High accuracy |
| **geoip-lite** (current) | 153MB | ✅ | ⭐⭐⭐⭐⭐ | Easy | Unlimited | Large images OK |

---

## Option 1: External API (FREE) ⭐ RECOMMENDED

### 1A. ip-api.com
**Size: 0MB | Free: 45 requests/minute**

**Pros:**
- ✅ Zero size impact
- ✅ Highest accuracy
- ✅ City-level precision
- ✅ No API key needed
- ✅ 45 req/min = 2,700/hour

**Cons:**
- ⚠️ Requires internet
- ⚠️ ~50-100ms latency per request
- ⚠️ Rate limited

**Example:**
```javascript
async function getLocation(ip) {
  const res = await fetch(`http://ip-api.com/json/${ip}?fields=lat,lon,city,country`);
  const data = await res.json();
  return {
    lat: data.lat,
    lng: data.lon,
    city: data.city,
    country: data.country
  };
}
```

**Your use case:** Perfect! DNS monitoring typically has:
- 10-100 unique IPs/hour
- Your cache (1000 entries) will handle most lookups
- You'll use <5% of the free limit

---

### 1B. ipapi.co
**Size: 0MB | Free: 1,000 requests/day**

**Pros:**
- ✅ Zero size
- ✅ Good accuracy
- ✅ Simple API
- ✅ HTTPS by default

**Cons:**
- ⚠️ Lower daily limit (1000 vs 2,700/hour)
- ⚠️ Requires internet

**Example:**
```javascript
async function getLocation(ip) {
  const res = await fetch(`https://ipapi.co/${ip}/json/`);
  const data = await res.json();
  return {
    lat: parseFloat(data.latitude),
    lng: parseFloat(data.longitude),
    city: data.city,
    country: data.country_name
  };
}
```

---

### 1C. GeoJS (Unlimited!)
**Size: 0MB | Free: Unlimited**

**Pros:**
- ✅ Zero size
- ✅ Unlimited requests!
- ✅ No API key
- ✅ Fast CDN

**Cons:**
- ⚠️ Medium accuracy (not as precise as ip-api)
- ⚠️ Requires internet

**Example:**
```javascript
async function getLocation(ip) {
  const res = await fetch(`https://get.geojs.io/v1/ip/geo/${ip}.json`);
  const data = await res.json();
  return {
    lat: parseFloat(data.latitude),
    lng: parseFloat(data.longitude),
    city: data.city,
    country: data.country
  };
}
```

---

## Option 2: Lightweight NPM Packages

### 2A. geoip-country-only
**Size: ~5MB | Offline: ✅**

**Install:**
```bash
npm uninstall geoip-lite
npm install geoip-country-only
```

**Pros:**
- ✅ Tiny size (5MB vs 153MB)
- ✅ Works offline
- ✅ Fast lookups
- ✅ No external dependencies

**Cons:**
- ⚠️ Country-level only (no city)
- ⚠️ Less precise coordinates

**Example:**
```javascript
import geoip from 'geoip-country-only';

const geo = geoip.lookup(ip);
// Returns: { country: 'US', region: '' }
```

**When to use:** If you only need country-level dots on your map

---

### 2B. fast-geoip
**Size: ~30MB | Offline: ✅**

**Install:**
```bash
npm uninstall geoip-lite
npm install fast-geoip
```

**Pros:**
- ✅ 80% smaller than geoip-lite
- ✅ City-level data
- ✅ Fast performance
- ✅ Similar API

**Cons:**
- ⚠️ Still 30MB
- ⚠️ Less data than geoip-lite

**Example:**
```javascript
import geoip from 'fast-geoip';

const geo = await geoip.lookup(ip);
// Returns: { country: 'US', city: 'Mountain View', ll: [lat, lng] }
```

**When to use:** Need offline + smaller size, can accept 30MB

---

### 2C. node-geoip
**Size: ~40MB | Offline: ✅**

**Install:**
```bash
npm uninstall geoip-lite
npm install node-geoip
```

**Pros:**
- ✅ 75% smaller than geoip-lite
- ✅ Good accuracy
- ✅ Active maintenance
- ✅ Similar features

**Cons:**
- ⚠️ Still 40MB

**Example:**
```javascript
import geoip from 'node-geoip';

const geo = geoip.lookup(ip);
// Returns: { country: 'US', city: 'Los Angeles', ll: [lat, lng] }
```

---

## Option 3: MaxMind GeoLite2 (Official)

### 3A. MaxMind API (Cloud)
**Size: 0MB | Free: 1,000 requests/day**

**Install:**
```bash
npm install @maxmind/geoip2-node
```

**Pros:**
- ✅ Most accurate (official data source)
- ✅ Zero size impact
- ✅ Professional support
- ✅ 1000 free requests/day

**Cons:**
- ⚠️ Requires account + API key
- ⚠️ More setup complexity

**Setup:**
1. Sign up: https://www.maxmind.com/en/geolite2/signup
2. Get API key
3. Use their Node.js client

---

### 3B. MaxMind Database (Self-hosted)
**Size: ~50MB | Offline: ✅**

**Install:**
```bash
npm install maxmind
```

**Pros:**
- ✅ Most accurate
- ✅ Works offline
- ✅ Control your data
- ✅ Smaller than geoip-lite (50MB vs 153MB)

**Cons:**
- ⚠️ Manual database download
- ⚠️ Requires MaxMind account
- ⚠️ Need to update database monthly

**Setup:**
1. Sign up at MaxMind
2. Download GeoLite2-City.mmdb
3. Use maxmind package

---

## 🎯 Recommendation by Use Case

### For Your DNS Visualization Dashboard:

**Use ip-api.com API** ⭐

**Why:**
1. Your traffic is LOW (home/office network monitoring)
2. Cache hit rate will be HIGH (~90% after warmup)
3. 45 requests/min = way more than you need
4. Saves 153MB from Docker image
5. Zero maintenance, always updated

**Expected usage:**
```
Unique IPs per hour: 10-50
API calls needed: 10-50 (first time only)
Cached after: Yes (1000 IP cache)
API limit: 45/min = 2,700/hour
Usage: <2% of free limit ✅
```

---

### If You MUST Work Offline:

**Use fast-geoip (30MB)**

Best balance of:
- ✅ Smaller size (30MB vs 153MB)
- ✅ City-level data
- ✅ Works offline
- ✅ Easy migration

---

### If You Only Need Countries:

**Use geoip-country-only (5MB)**

Smallest possible:
- ✅ Only 5MB
- ✅ Country-level sufficient for many dashboards
- ✅ Super fast

---

## 📈 Size Comparison

```
Current (geoip-lite):     153MB  ███████████████████
fast-geoip:                30MB  ████
node-geoip:                40MB  █████
MaxMind DB:                50MB  ██████
geoip-country-only:         5MB  █
API-based (ip-api.com):     0MB  (empty)
```

---

## 🚀 Migration Examples

### Migrate to ip-api.com (0MB)

```javascript
// Before (geoip-lite)
import geoip from 'geoip-lite';
const geo = geoip.lookup(ip);

// After (ip-api.com)
async function lookup(ip) {
  // Check cache first (you already have this)
  if (cache.has(ip)) return cache.get(ip);

  // API lookup
  const res = await fetch(`http://ip-api.com/json/${ip}?fields=lat,lon,city,country`);
  const data = await res.json();

  const result = {
    lat: data.lat,
    lng: data.lon,
    city: data.city,
    country: data.country
  };

  cache.set(ip, result);
  return result;
}
```

---

### Migrate to fast-geoip (30MB)

```javascript
// Before (geoip-lite)
import geoip from 'geoip-lite';
const geo = geoip.lookup(ip);

// After (fast-geoip)
import geoip from 'fast-geoip';
const geo = await geoip.lookup(ip); // Note: async
```

---

### Migrate to geoip-country-only (5MB)

```javascript
// Before (geoip-lite)
import geoip from 'geoip-lite';
const geo = geoip.lookup(ip);
// geo.ll = [lat, lng]
// geo.city = 'City Name'

// After (geoip-country-only)
import geoip from 'geoip-country-only';
const geo = geoip.lookup(ip);
// geo.country = 'US'
// Note: No city or coordinates!
// You'd need to map country to rough coordinates
```

---

## 💡 Implementation Tips

### With API + Smart Caching

Your existing cache will make the API solution work great:

```javascript
class GeoService {
  constructor() {
    this.cache = new Map(); // Already have this
    this.maxCacheSize = 1000;
  }

  async lookup(ip) {
    // 1. Check cache (instant)
    if (this.cache.has(ip)) {
      return this.cache.get(ip);
    }

    // 2. API lookup (only for new IPs)
    const result = await this.apiLookup(ip);

    // 3. Cache it
    this.cache.set(ip, result);

    return result;
  }
}
```

**Result:**
- First lookup: 50ms (API)
- Subsequent: <1ms (cache)
- Most IPs get cached quickly
- API calls: Very low

---

## 🔧 Quick Test

### Test ip-api.com:

```bash
# Test the API directly
curl "http://ip-api.com/json/8.8.8.8?fields=lat,lon,city,country"

# Response:
# {"lat":37.386,"lon":-122.0838,"city":"Mountain View","country":"United States"}
```

### Test fast-geoip:

```bash
npm install fast-geoip
node -e "import('fast-geoip').then(m => m.default.lookup('8.8.8.8').then(console.log))"
```

---

## 📝 Summary

| Your Priority | Recommended Solution | Size Savings |
|---------------|---------------------|--------------|
| **Smallest image** | ip-api.com API | -153MB |
| **Offline required** | fast-geoip | -123MB |
| **Country only** | geoip-country-only | -148MB |
| **Most accurate offline** | MaxMind DB | -103MB |
| **Keep current** | geoip-lite | 0MB |

**For DNS monitoring dashboards → Use ip-api.com API** ⭐

Want me to create a ready-to-use implementation for any of these options?
