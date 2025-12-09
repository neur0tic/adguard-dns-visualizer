import geoip from 'geoip-lite';

/**
 * Geolocation Service
 * Converts IP addresses to geographic coordinates
 */
class GeoService {
  constructor(sourceLat, sourceLng) {
    this.source = {
      lat: parseFloat(sourceLat),
      lng: parseFloat(sourceLng),
      city: 'Kuala Lumpur'
    };

    // Cache for IP lookups to improve performance
    this.cache = new Map();
    this.maxCacheSize = 1000;
  }

  /**
   * Get coordinates for an IP address
   * @param {string} ip - IP address
   * @returns {Object|null} Coordinates object {lat, lng, city, country}
   */
  lookup(ip) {
    // Check cache first
    if (this.cache.has(ip)) {
      return this.cache.get(ip);
    }

    // Filter out private/local IPs
    if (this.isPrivateIP(ip)) {
      return null;
    }

    const geo = geoip.lookup(ip);

    if (!geo || !geo.ll) {
      return null;
    }

    const result = {
      lat: geo.ll[0],
      lng: geo.ll[1],
      city: geo.city || 'Unknown',
      country: geo.country || 'Unknown'
    };

    // Add to cache
    this.addToCache(ip, result);

    return result;
  }

  /**
   * Check if IP is private/local
   * @param {string} ip - IP address
   * @returns {boolean}
   */
  isPrivateIP(ip) {
    const parts = ip.split('.');

    // IPv4 private ranges
    if (parts.length === 4) {
      const first = parseInt(parts[0]);
      const second = parseInt(parts[1]);

      return (
        first === 10 ||
        first === 127 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        first === 0 ||
        first === 169 && second === 254
      );
    }

    // IPv6 private ranges (simplified check)
    if (ip.includes(':')) {
      return ip.startsWith('fe80:') ||
             ip.startsWith('fc00:') ||
             ip.startsWith('fd00:') ||
             ip === '::1';
    }

    return false;
  }

  /**
   * Add entry to cache with size limit
   * @param {string} ip - IP address
   * @param {Object} data - Geolocation data
   */
  addToCache(ip, data) {
    // Implement LRU-like behavior
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(ip, data);
  }

  /**
   * Get source location (Kuala Lumpur)
   * @returns {Object} Source coordinates
   */
  getSource() {
    return this.source;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize
    };
  }
}

export default GeoService;
