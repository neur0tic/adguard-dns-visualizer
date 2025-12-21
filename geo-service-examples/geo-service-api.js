/**
 * GeoService using ip-api.com (FREE API)
 * Drop-in replacement for geoip-lite
 *
 * Benefits:
 * - Docker image: -153MB (no database)
 * - Free tier: 45 requests/minute
 * - High accuracy with city-level data
 * - No npm dependencies needed
 *
 * Usage:
 * 1. Copy this file over server/geo-service.js
 * 2. Run: npm uninstall geoip-lite
 * 3. Done! Same API, zero size impact
 */

class GeoService {
  constructor(sourceLat, sourceLng, options = {}) {
    this.source = {
      lat: parseFloat(sourceLat),
      lng: parseFloat(sourceLng),
      city: 'Kuala Lumpur',
      country: 'MY'
    };

    if (isNaN(this.source.lat) || isNaN(this.source.lng)) {
      throw new Error('Invalid source coordinates');
    }

    // LRU Cache (same as original)
    this.cache = new Map();
    this.maxCacheSize = options.maxCacheSize || 1000;

    // API configuration
    this.apiUrl = options.apiUrl || 'http://ip-api.com/json';
    this.apiTimeout = options.apiTimeout || 5000;

    // Rate limiting
    this.requestQueue = [];
    this.maxRequestsPerMinute = 40; // Under 45/min limit
  }

  /**
   * Get coordinates for an IP address (async version)
   * @param {string} ip - IP address
   * @returns {Promise<Object|null>} Coordinates object
   */
  async lookup(ip) {
    if (!ip || typeof ip !== 'string') return null;

    // Check cache first
    if (this.cache.has(ip)) {
      const value = this.cache.get(ip);
      // Move to end (LRU)
      this.cache.delete(ip);
      this.cache.set(ip, value);
      return value;
    }

    // Filter private IPs
    if (this.isPrivateIP(ip)) {
      return null;
    }

    try {
      // Perform API lookup
      const result = await this.apiLookup(ip);
      this.addToCache(ip, result);
      return result;
    } catch (error) {
      console.error(`GeoIP lookup failed for ${ip}:`, error.message);
      this.addToCache(ip, null);
      return null;
    }
  }

  /**
   * API lookup with rate limiting
   */
  async apiLookup(ip) {
    // Rate limit check
    await this.checkRateLimit();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.apiTimeout);

    try {
      const url = `${this.apiUrl}/${ip}?fields=status,message,lat,lon,city,country`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'DNS-Dashboard/1.0' }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'fail') {
        console.warn(`GeoIP failed for ${ip}: ${data.message}`);
        return null;
      }

      if (typeof data.lat !== 'number' || typeof data.lon !== 'number') {
        return null;
      }

      return {
        lat: data.lat,
        lng: data.lon,
        city: data.city || 'Unknown',
        country: data.country || 'Unknown'
      };

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Rate limiting (45 requests/minute free tier)
   */
  async checkRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old requests
    this.requestQueue = this.requestQueue.filter(time => time > oneMinuteAgo);

    // Check if at limit
    if (this.requestQueue.length >= this.maxRequestsPerMinute) {
      const oldestRequest = this.requestQueue[0];
      const waitTime = 60000 - (now - oldestRequest);

      if (waitTime > 0) {
        console.log(`Rate limit reached, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime + 100));
        return this.checkRateLimit();
      }
    }

    this.requestQueue.push(now);
  }

  /**
   * Check if IP is private/local (same as original)
   */
  isPrivateIP(ip) {
    if (!ip || typeof ip !== 'string') return true;

    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length !== 4) return true;

      const octets = parts.map(p => parseInt(p, 10));
      if (octets.some(o => isNaN(o) || o < 0 || o > 255)) return true;

      const [first, second, third] = octets;

      return (
        first === 10 ||
        first === 127 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        first === 0 ||
        (first === 169 && second === 254) ||
        first === 255 ||
        (first === 100 && second >= 64 && second <= 127) ||
        (first === 192 && second === 0 && (third === 0 || third === 2)) ||
        (first === 198 && second === 18) ||
        (first === 198 && second === 51 && third === 100) ||
        (first === 203 && second === 0 && third === 113) ||
        first >= 224
      );
    }

    if (ip.includes(':')) {
      const lower = ip.toLowerCase();
      return (
        lower.startsWith('fe80:') ||
        lower.startsWith('fe80::') ||
        lower.startsWith('fec0:') ||
        lower.startsWith('fc00:') ||
        lower.startsWith('fd00:') ||
        lower === '::1' ||
        lower === '::' ||
        lower.startsWith('ff00:') ||
        lower.startsWith('2001:db8:') ||
        lower.startsWith('2001:10:') ||
        lower.startsWith('2002:')
      );
    }

    return true;
  }

  /**
   * Add entry to cache with LRU eviction
   */
  addToCache(ip, data) {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(ip, data);
  }

  /**
   * Get source location
   */
  getSource() {
    return { ...this.source };
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
    this.requestQueue = [];
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      requestsInLastMinute: this.requestQueue.length,
      maxRequestsPerMinute: this.maxRequestsPerMinute
    };
  }
}

export default GeoService;
