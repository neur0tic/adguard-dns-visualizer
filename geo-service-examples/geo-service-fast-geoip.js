/**
 * GeoService using fast-geoip (30MB package)
 * 80% smaller than geoip-lite
 *
 * Benefits:
 * - Docker image: -123MB (30MB vs 153MB)
 * - Works offline
 * - City-level data
 * - Fast performance
 *
 * Setup:
 * 1. npm uninstall geoip-lite
 * 2. npm install fast-geoip
 * 3. Copy this file over server/geo-service.js
 */

import geoip from 'fast-geoip';

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

    // LRU Cache
    this.cache = new Map();
    this.maxCacheSize = options.maxCacheSize || 1000;
  }

  /**
   * Get coordinates for an IP address (async with fast-geoip)
   */
  async lookup(ip) {
    if (!ip || typeof ip !== 'string') return null;

    // Check cache first
    if (this.cache.has(ip)) {
      const value = this.cache.get(ip);
      this.cache.delete(ip);
      this.cache.set(ip, value);
      return value;
    }

    // Filter private IPs
    if (this.isPrivateIP(ip)) {
      return null;
    }

    try {
      // Perform lookup (fast-geoip is async)
      const geo = await geoip.lookup(ip);

      if (!geo || !geo.ll || geo.ll.length !== 2) {
        this.addToCache(ip, null);
        return null;
      }

      const result = {
        lat: geo.ll[0],
        lng: geo.ll[1],
        city: geo.city || 'Unknown',
        country: geo.country || 'Unknown'
      };

      if (isNaN(result.lat) || isNaN(result.lng)) {
        this.addToCache(ip, null);
        return null;
      }

      this.addToCache(ip, result);
      return result;

    } catch (error) {
      console.error(`GeoIP lookup failed for ${ip}:`, error);
      this.addToCache(ip, null);
      return null;
    }
  }

  /**
   * Check if IP is private/local
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
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize
    };
  }
}

export default GeoService;
