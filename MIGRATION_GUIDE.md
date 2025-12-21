# GeoIP Migration Guide

## Quick Decision Matrix

**Answer these questions:**

1. **Can your server access the internet?**
   - ✅ YES → Go to Option A (API - 0MB)
   - ❌ NO → Go to Option B (Offline packages)

2. **Do you need city-level precision?**
   - ✅ YES → Use ip-api.com API or fast-geoip
   - ❌ NO → Use geoip-country-only (5MB)

3. **What's your traffic?**
   - Low (<1000 unique IPs/day) → ip-api.com API
   - Medium (<10K IPs/day) → fast-geoip (30MB)
   - High (>10K IPs/day) → Keep geoip-lite or use MaxMind

---

## Option A: ip-api.com API (0MB) ⭐ RECOMMENDED

### Step 1: Backup
```bash
cp server/geo-service.js server/geo-service.js.backup
```

### Step 2: Replace
```bash
cp geo-service-examples/geo-service-api.js server/geo-service.js
```

### Step 3: Remove geoip-lite
```bash
npm uninstall geoip-lite
```

### Step 4: Update code that calls lookup()

**Before (synchronous):**
```javascript
const geo = geoService.lookup(ip);
```

**After (asynchronous):**
```javascript
const geo = await geoService.lookup(ip);
```

### Step 5: Test
```bash
npm start
# Visit your dashboard and check if geolocations still work
```

### Expected Results
- ✅ Docker image: -153MB
- ✅ Build time: Faster
- ✅ Same functionality
- ✅ Always up-to-date data

---

## Option B: fast-geoip (30MB)

### Step 1: Backup
```bash
cp server/geo-service.js server/geo-service.js.backup
```

### Step 2: Install
```bash
npm uninstall geoip-lite
npm install fast-geoip
```

### Step 3: Replace
```bash
cp geo-service-examples/geo-service-fast-geoip.js server/geo-service.js
```

### Step 4: Update code (make lookup async)

**Before:**
```javascript
const geo = geoService.lookup(ip);
```

**After:**
```javascript
const geo = await geoService.lookup(ip);
```

### Step 5: Test
```bash
npm start
```

### Expected Results
- ✅ Docker image: -123MB (30MB vs 153MB)
- ✅ Works offline
- ✅ Same accuracy
- ✅ Still has city data

---

## Option C: geoip-country-only (5MB)

### When to Use
- You only need country-level dots on the map
- Don't need city names or precise coordinates

### Install
```bash
npm uninstall geoip-lite
npm install geoip-country-only
```

### Code Changes
```javascript
import geoip from 'geoip-country-only';

const result = geoip.lookup(ip);
// Returns: { country: 'US', region: '' }

// You'll need to map countries to approximate coordinates
const countryCoords = {
  'US': { lat: 37.0902, lng: -95.7129 },
  'GB': { lat: 55.3781, lng: -3.4360 },
  // ... add more countries
};
```

---

## Code Changes Needed

### In server/index.js (or wherever you use geoService)

**Find this pattern:**
```javascript
const destination = geoService.lookup(data.resolvedIP);
```

**Change to:**
```javascript
const destination = await geoService.lookup(data.resolvedIP);
```

**And make the function async:**
```javascript
// Before
function handleDNSQuery(data) {
  const destination = geoService.lookup(data.resolvedIP);
  // ...
}

// After
async function handleDNSQuery(data) {
  const destination = await geoService.lookup(data.resolvedIP);
  // ...
}
```

---

## Testing Checklist

After migration, test these scenarios:

### ✅ Public IPs
```bash
# Should show location on map
# Test with known IPs: 8.8.8.8, 1.1.1.1
```

### ✅ Private IPs
```bash
# Should be filtered out (192.168.x.x, 10.x.x.x, etc.)
# Should not appear on map
```

### ✅ Cache Working
```bash
# Same IP queried twice should be instant second time
# Check cache stats in your logs
```

### ✅ Rate Limiting (API only)
```bash
# If using API, verify it handles >45 requests/minute gracefully
# Should queue or cache, not error
```

---

## Rollback Instructions

If something goes wrong:

### Restore Original
```bash
cp server/geo-service.js.backup server/geo-service.js
npm install geoip-lite
```

### Revert Code Changes
```bash
# Remove 'await' and 'async' keywords you added
# Or use git to revert:
git checkout server/index.js  # (if changes only in index.js)
```

---

## Performance Comparison

| Metric | geoip-lite | ip-api.com | fast-geoip |
|--------|------------|------------|------------|
| **First lookup** | 1ms | 50-100ms | 1ms |
| **Cached lookup** | 1ms | <1ms | <1ms |
| **Docker image** | 538MB | 85MB | 115MB |
| **Offline** | ✅ | ❌ | ✅ |
| **Maintenance** | Low | Zero | Low |
| **Accuracy** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## Common Issues

### Issue: "lookup is not a function"
**Cause:** Forgot to make function async
**Fix:** Add `async` keyword before function

### Issue: "Cannot read property 'lat' of undefined"
**Cause:** Forgot to `await` the lookup call
**Fix:** Add `await` before `geoService.lookup(ip)`

### Issue: "Rate limit exceeded" (API only)
**Cause:** Too many unique IPs in short time
**Fix:**
- Increase cache size
- Use fast-geoip instead
- Or upgrade to paid API tier

### Issue: "Network error" (API only)
**Cause:** No internet connection
**Fix:** Switch to fast-geoip for offline support

---

## Size Verification

After migration, verify the size reduction:

```bash
# Check node_modules size
du -sh node_modules

# Before: ~176MB
# After (API): ~23MB ✅
# After (fast-geoip): ~53MB ✅

# Build Docker and check
docker build -t dns-viz .
docker images dns-viz

# Before: ~538MB
# After (API): ~85MB ✅
# After (fast-geoip): ~115MB ✅
```

---

## Recommended: ip-api.com API

For your DNS visualization dashboard:

✅ **Perfect fit because:**
- Low traffic (home/office monitoring)
- High cache hit rate
- 45 req/min = way more than needed
- Always up-to-date data
- Zero maintenance

✅ **Expected usage:**
```
Unique IPs/hour: 10-50
API calls needed: 10-50 (cached after)
Free limit: 2,700/hour
Your usage: <2% ✅
```

Ready to migrate? Start with Option A (API) - it's the simplest and gives the biggest size reduction!
