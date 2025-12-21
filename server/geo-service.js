/**
 * Geolocation Service with External API
 * Uses ip-api.com for GeoIP lookups (0MB vs 153MB for geoip-lite)
 *
 * Security Features:
 * - Input validation and sanitization
 * - Rate limiting (45 req/min free tier)
 * - Request timeout protection
 * - Circuit breaker pattern for API failures
 * - Retry logic with exponential backoff
 * - Private IP filtering
 * - LRU caching to minimize API calls
 *
 * @author DNS Visualization Dashboard
 * @version 2.0.0
 */

class GeoService {
  constructor(sourceLat, sourceLng, options = {}) {
    // Validate and sanitize source coordinates
    this.source = {
      lat: parseFloat(sourceLat),
      lng: parseFloat(sourceLng),
      city: 'Kuala Lumpur',
      country: 'MY'
    };

    if (!this.isValidCoordinate(this.source.lat, this.source.lng)) {
      throw new Error('Invalid source coordinates');
    }

    // LRU Cache configuration
    this.cache = new Map();
    this.pendingRequests = new Map(); // Track ongoing lookups
    this.maxCacheSize = this.validatePositiveInteger(options.maxCacheSize, 10000);
    this.cacheHits = 0;
    this.cacheMisses = 0;

    // API configuration with security defaults
    this.apiUrl = this.sanitizeUrl(options.apiUrl || process.env.GEOIP_API_URL || 'http://ip-api.com/json');
    this.apiTimeout = this.validatePositiveInteger(options.apiTimeout, 5000);
    this.maxRetries = this.validatePositiveInteger(options.maxRetries, 2);
    this.retryDelay = this.validatePositiveInteger(options.retryDelay, 1000);

    // Rate limiting (45 requests/minute free tier)
    // Conservative limit to avoid bursts: 15 req/min = 1 every 4 seconds
    this.requestQueue = [];
    this.maxRequestsPerMinute = this.validatePositiveInteger(options.maxRequestsPerMinute, 15);
    this.requestWindow = 60000; // 1 minute
    this.minRequestDelay = this.validatePositiveInteger(options.minRequestDelay, 4000); // 4s between requests
    this.lastRequestTime = 0;

    // Circuit breaker pattern
    this.circuitBreaker = {
      failures: 0,
      maxFailures: 5,
      resetTimeout: 30000, // 30 seconds
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      lastFailureTime: null
    };

    // Statistics
    this.stats = {
      totalLookups: 0,
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      apiFailures: 0,
      rateLimitHits: 0,
      circuitBreakerTrips: 0
    };
  }

  /**
   * Get coordinates for an IP address
   * @param {string} ip - IP address to lookup
   * @returns {Promise<Object|null>} Coordinates object {lat, lng, city, country}
   */
  async lookup(ip) {
    this.stats.totalLookups++;

    // Validate input
    if (!this.isValidInput(ip)) {
      return null;
    }

    // Sanitize IP
    const sanitizedIp = this.sanitizeIp(ip);
    if (!sanitizedIp) {
      return null;
    }

    // Check cache first (LRU)
    if (this.cache.has(sanitizedIp)) {
      this.stats.cacheHits++;
      const value = this.cache.get(sanitizedIp);

      // Move to end (LRU)
      this.cache.delete(sanitizedIp);
      this.cache.set(sanitizedIp, value);

      console.log(`💾 Cache HIT for ${sanitizedIp} (${this.stats.cacheHits} hits, ${this.stats.cacheMisses} misses)`);

      return value;
    }

    this.stats.cacheMisses++;

    // Check if there's already a pending request for this IP
    if (this.pendingRequests.has(sanitizedIp)) {
      console.log(`⏳ Joining existing pending request for ${sanitizedIp}`);
      return this.pendingRequests.get(sanitizedIp);
    }

    console.log(`🔍 Cache MISS for ${sanitizedIp} - will call API (${this.stats.cacheHits} hits, ${this.stats.cacheMisses} misses)`);

    // Filter private/reserved IPs
    if (this.isPrivateIP(sanitizedIp)) {
      console.log(`🏠 Private IP detected: ${sanitizedIp} - skipping API call`);
      return null;
    }

    // Check circuit breaker
    if (this.circuitBreaker.state === 'OPEN') {
      const now = Date.now();
      if (now - this.circuitBreaker.lastFailureTime > this.circuitBreaker.resetTimeout) {
        console.log('🔄 Circuit breaker: Transitioning to HALF_OPEN');
        this.circuitBreaker.state = 'HALF_OPEN';
      } else {
        console.warn(`⚠️  Circuit breaker OPEN, skipping API call for ${sanitizedIp}`);
        this.addToCache(sanitizedIp, null);
        return null;
      }
    }

    // Create a promise for the lookup and store it in pendingRequests
    const lookupPromise = (async () => {
      try {
        // Perform API lookup with retries
        const result = await this.apiLookupWithRetry(sanitizedIp);

        // Success - update circuit breaker
        if (result) {
          this.circuitBreaker.failures = 0;
          if (this.circuitBreaker.state === 'HALF_OPEN') {
            console.log('✅ Circuit breaker: Transitioning to CLOSED');
            this.circuitBreaker.state = 'CLOSED';
          }
        }

        this.addToCache(sanitizedIp, result);
        return result;

      } catch (error) {
        console.error(`❌ GeoIP lookup failed for ${sanitizedIp}:`, error.message);

        // Update circuit breaker
        this.handleApiFailure(error);

        this.addToCache(sanitizedIp, null);
        return null;
      } finally {
        // Always remove from pending once done
        this.pendingRequests.delete(sanitizedIp);
      }
    })();

    this.pendingRequests.set(sanitizedIp, lookupPromise);
    return lookupPromise;
  }

  /**
   * API lookup with retry logic and exponential backoff
   */
  async apiLookupWithRetry(ip, attempt = 1) {
    try {
      return await this.apiLookup(ip);
    } catch (error) {
      // Don't retry if it's a rate limit error or the circuit breaker is opening
      if (error.message.includes('Rate limit') || this.circuitBreaker.state === 'OPEN') {
        return null;
      }

      if (attempt < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`🔄 Retrying API call for ${ip} (attempt ${attempt + 1}/${this.maxRetries}) in ${delay}ms`);

        await this.sleep(delay);
        return await this.apiLookupWithRetry(ip, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Perform API lookup with rate limiting and timeout
   */
  async apiLookup(ip) {
    // Check and enforce rate limiting
    await this.checkRateLimit();

    this.stats.apiCalls++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.apiTimeout);

    try {
      // Construct URL with limited fields for security and efficiency
      const fields = 'status,message,lat,lon,city,country';
      const url = `${this.apiUrl}/${encodeURIComponent(ip)}?fields=${fields}`;

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'DNS-Visualization-Dashboard/2.0',
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`);
      }

      const data = await response.json();

      // Validate response
      if (data.status === 'fail') {
        console.warn(`⚠️  GeoIP API failed for ${ip}: ${data.message}`);
        return null;
      }

      // Validate and sanitize response data
      if (!this.isValidCoordinate(data.lat, data.lon)) {
        console.warn(`⚠️  Invalid coordinates from API for ${ip}`);
        return null;
      }

      const result = {
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon),
        city: this.sanitizeString(data.city) || 'Unknown',
        country: this.sanitizeString(data.country) || 'Unknown'
      };

      console.log(`✅ GeoIP API success for ${ip}: ${result.city}, ${result.country} (${result.lat}, ${result.lng})`);

      return result;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`API request timeout after ${this.apiTimeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Rate limiting with sliding window + minimum delay between requests
   */
  async checkRateLimit() {
    const now = Date.now();

    // Enforce minimum delay between requests (prevents bursts)
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestDelay) {
      const waitTime = this.minRequestDelay - timeSinceLastRequest;
      // If we need to wait more than 2 seconds, fail fast to avoid blocking the main loop
      if (waitTime > 2000) {
        throw new Error('Rate limit: minimum delay exceeded');
      }
      console.log(`⏸️  Enforcing minimum ${this.minRequestDelay}ms delay, waiting ${waitTime}ms`);
      await this.sleep(waitTime);
    }

    const windowStart = now - this.requestWindow;

    // Remove old requests outside the window
    this.requestQueue = this.requestQueue.filter(time => time > windowStart);

    // Check if at limit
    if (this.requestQueue.length >= this.maxRequestsPerMinute) {
      this.stats.rateLimitHits++;

      const oldestRequest = this.requestQueue[0];
      const waitTime = this.requestWindow - (now - oldestRequest);

      if (waitTime > 0) {
        // If we're at the limit, don't block for more than a few seconds
        console.warn(`⏳ Rate limit reached, skip pending IP lookup to avoid blocking (wait time: ${waitTime}ms)`);
        throw new Error('Rate limit: requests per minute exceeded');
      }
    }

    this.lastRequestTime = Date.now();
    this.requestQueue.push(this.lastRequestTime);
  }

  /**
   * Handle API failures and update circuit breaker
   */
  handleApiFailure(error) {
    this.stats.apiFailures++;
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.circuitBreaker.maxFailures) {
      if (this.circuitBreaker.state !== 'OPEN') {
        console.error(`🔴 Circuit breaker OPEN after ${this.circuitBreaker.failures} failures`);
        this.stats.circuitBreakerTrips++;
      }
      this.circuitBreaker.state = 'OPEN';
    }
  }

  /**
   * Validate input
   */
  isValidInput(ip) {
    return ip && typeof ip === 'string' && ip.length > 0 && ip.length <= 45; // Max IPv6 length
  }

  /**
   * Sanitize IP address
   */
  sanitizeIp(ip) {
    // Remove whitespace and non-printable characters
    const cleaned = ip.trim().replace(/[^\w.:\[\]]/g, '');

    // Basic validation
    if (cleaned.length === 0 || cleaned.length > 45) {
      return null;
    }

    return cleaned;
  }

  /**
   * Sanitize string output
   */
  sanitizeString(str) {
    if (typeof str !== 'string') return '';

    // Remove potentially dangerous characters
    return str
      .trim()
      .replace(/[<>\"\'&]/g, '')
      .substring(0, 100); // Max length
  }

  /**
   * Validate URL
   */
  sanitizeUrl(url) {
    if (!url || typeof url !== 'string') {
      return 'http://ip-api.com/json';
    }

    // Only allow http/https
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'http://ip-api.com/json';
    }

    return url;
  }

  /**
   * Validate coordinates
   */
  isValidCoordinate(lat, lng) {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }

  /**
   * Validate positive integer
   */
  validatePositiveInteger(value, defaultValue) {
    const parsed = parseInt(value, 10);
    return (parsed > 0) ? parsed : defaultValue;
  }

  /**
   * Check if IP is private/local/reserved
   */
  isPrivateIP(ip) {
    if (!ip || typeof ip !== 'string') return true;

    // IPv4 private and reserved ranges
    if (ip.includes('.')) {
      const parts = ip.split('.');

      if (parts.length !== 4) return true;

      const octets = parts.map(p => parseInt(p, 10));

      // Validate all octets
      if (octets.some(o => isNaN(o) || o < 0 || o > 255)) return true;

      const [first, second, third] = octets;

      return (
        first === 10 ||                                    // 10.0.0.0/8 (Private)
        first === 127 ||                                   // 127.0.0.0/8 (Loopback)
        (first === 172 && second >= 16 && second <= 31) || // 172.16.0.0/12 (Private)
        (first === 192 && second === 168) ||               // 192.168.0.0/16 (Private)
        first === 0 ||                                     // 0.0.0.0/8 (Current network)
        (first === 169 && second === 254) ||               // 169.254.0.0/16 (Link-local)
        first === 255 ||                                   // 255.0.0.0/8 (Broadcast)
        (first === 100 && second >= 64 && second <= 127) || // 100.64.0.0/10 (Shared)
        (first === 192 && second === 0 && (third === 0 || third === 2)) || // 192.0.0.0/24, 192.0.2.0/24
        (first === 198 && second === 18) ||                // 198.18.0.0/15 (Benchmarking)
        (first === 198 && second === 51 && third === 100) || // 198.51.100.0/24 (Documentation)
        (first === 203 && second === 0 && third === 113) || // 203.0.113.0/24 (Documentation)
        first >= 224                                       // 224.0.0.0/4 (Multicast & Reserved)
      );
    }

    // IPv6 private and reserved ranges
    if (ip.includes(':')) {
      const lower = ip.toLowerCase();

      return (
        lower.startsWith('fe80:') ||    // Link-local
        lower.startsWith('fe80::') ||
        lower.startsWith('fec0:') ||    // Site-local (deprecated)
        lower.startsWith('fc00:') ||    // Unique local address (ULA)
        lower.startsWith('fd00:') ||    // ULA
        lower === '::1' ||              // Loopback
        lower === '::' ||               // Unspecified
        lower.startsWith('ff00:') ||    // Multicast
        lower.startsWith('2001:db8:') || // Documentation
        lower.startsWith('2001:10:') || // Deprecated ORCHID
        lower.startsWith('2002:')       // 6to4 (often problematic)
      );
    }

    return true; // Unknown format, treat as private
  }

  /**
   * Add entry to cache with LRU eviction
   */
  addToCache(ip, data) {
    // Remove oldest entry if cache is full (LRU: first item is oldest)
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
    return { ...this.source }; // Return copy to prevent mutation
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
    this.requestQueue = [];
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
  }

  /**
   * Get statistics
   */
  getStats() {
    const cacheHitRate = this.stats.totalLookups > 0
      ? ((this.stats.cacheHits / this.stats.totalLookups) * 100).toFixed(2)
      : '0.00';

    return {
      ...this.stats,
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      cacheHitRate: `${cacheHitRate}%`,
      requestsInWindow: this.requestQueue.length,
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      circuitBreakerState: this.circuitBreaker.state,
      circuitBreakerFailures: this.circuitBreaker.failures
    };
  }

  /**
   * Reset circuit breaker (for admin/testing)
   */
  resetCircuitBreaker() {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.state = 'CLOSED';
    this.circuitBreaker.lastFailureTime = null;
    console.log('🔄 Circuit breaker manually reset');
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default GeoService;
