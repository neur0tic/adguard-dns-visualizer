/**
 * Security helpers for the HTTP/WebSocket server.
 * Kept free of side effects so they can be unit-tested in isolation.
 */

import net from 'net';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Parse a comma-separated ALLOWED_ORIGINS value into normalized origins.
 * @param {string|undefined} value
 * @returns {string[]}
 */
export function parseAllowedOrigins(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      try {
        return new URL(entry).origin.toLowerCase();
      } catch {
        console.warn(`⚠️  Ignoring invalid ALLOWED_ORIGINS entry: "${entry}"`);
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Decide whether a WebSocket handshake Origin may connect (CSWSH guard).
 *
 * - No Origin header: allowed. Browsers always send Origin on WebSocket
 *   handshakes, so a missing header means a non-browser client, which
 *   cross-site hijacking cannot use.
 * - Origin host equals the request Host header: allowed (same origin).
 * - Origin listed in allowedOrigins: allowed (e.g. a reverse proxy domain).
 * - Anything else, including "null" and malformed values: rejected.
 *
 * @param {string|undefined} origin - Origin request header
 * @param {string|undefined} host - Host request header
 * @param {string[]} allowedOrigins - normalized extra origins
 * @returns {boolean}
 */
export function isOriginAllowed(origin, host, allowedOrigins = []) {
  if (origin === undefined) return true;
  if (typeof origin !== 'string' || origin === '' || origin === 'null') return false;

  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  const normalizedOrigin = parsed.origin.toLowerCase();
  if (allowedOrigins.includes(normalizedOrigin)) return true;

  if (typeof host === 'string' && host !== '') {
    return parsed.host.toLowerCase() === host.toLowerCase();
  }

  return false;
}

/**
 * Parse a comma-separated ALLOWED_HOSTS value into lowercase hostnames
 * (ports and brackets removed).
 * @param {string|undefined} value
 * @returns {string[]}
 */
export function parseAllowedHosts(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map(entry => hostnameOf(entry.trim()))
    .filter(Boolean);
}

/**
 * Extract the bare lowercase hostname from a Host header value
 * ("Dash.LAN:8080" → "dash.lan", "[::1]:8080" → "::1"). Null if invalid.
 * @param {string} hostHeader
 * @returns {string|null}
 */
function hostnameOf(hostHeader) {
  if (!hostHeader) return null;
  try {
    const hostname = new URL(`http://${hostHeader}`).hostname.toLowerCase();
    return hostname.replace(/^\[(.*)\]$/, '$1') || null;
  } catch {
    return null;
  }
}

/**
 * DNS-rebinding guard: decide whether a request's Host header names this server.
 *
 * A rebinding attack points an attacker-owned domain at this server's IP, so the
 * browser sends Host: attacker.example (and a matching Origin). Only names we
 * expect are accepted:
 * - IP literals (an attacker cannot serve a page from the server's own IP origin)
 * - localhost
 * - hostnames listed in allowedHosts (ALLOWED_HOSTS + ALLOWED_ORIGINS hosts)
 *
 * A missing Host header is allowed: browsers always send one, so its absence
 * means a non-browser client that rebinding cannot drive.
 *
 * @param {string|undefined} hostHeader
 * @param {string[]} allowedHosts - lowercase hostnames
 * @returns {boolean}
 */
export function isHostAllowed(hostHeader, allowedHosts = []) {
  if (hostHeader === undefined) return true;
  const hostname = hostnameOf(hostHeader);
  if (!hostname) return false;
  if (hostname === 'localhost' || net.isIP(hostname) !== 0) return true;
  return allowedHosts.includes(hostname);
}

/**
 * Tracks open WebSocket connections per client IP.
 */
export class ConnectionLimiter {
  /**
   * @param {number} maxPerIp - max simultaneous connections per IP (0 = unlimited)
   */
  constructor(maxPerIp) {
    this.maxPerIp = Number.isInteger(maxPerIp) && maxPerIp >= 0 ? maxPerIp : 5;
    this.counts = new Map();
  }

  /**
   * Reserve a slot for this IP.
   * @param {string} ip
   * @returns {boolean} true if the slot was granted
   */
  tryAcquire(ip) {
    const key = ip || 'unknown';
    const current = this.counts.get(key) || 0;
    if (this.maxPerIp > 0 && current >= this.maxPerIp) return false;
    this.counts.set(key, current + 1);
    return true;
  }

  /**
   * Release a slot previously granted by tryAcquire.
   * @param {string} ip
   */
  release(ip) {
    const key = ip || 'unknown';
    const current = this.counts.get(key) || 0;
    if (current <= 1) {
      this.counts.delete(key);
    } else {
      this.counts.set(key, current - 1);
    }
  }

  count(ip) {
    return this.counts.get(ip || 'unknown') || 0;
  }
}

/**
 * Parse TRUST_PROXY into a value for Express's 'trust proxy' setting.
 *
 * Accepts a comma-separated list of proxy IPs / CIDR ranges, or the
 * proxy-addr names "loopback", "linklocal", "uniquelocal".
 * Blanket values ("true", "*", hop counts) are refused: they let any client
 * forge X-Forwarded-For and dodge IP-based rate limiting.
 *
 * @param {string|undefined} value
 * @returns {{ value: string[]|false, error: string|null }}
 */
export function parseTrustProxy(value) {
  if (value === undefined || value.trim() === '' || value.trim().toLowerCase() === 'false') {
    return { value: false, error: null };
  }

  const entries = value.split(',').map(entry => entry.trim()).filter(Boolean);
  const blanket = entries.find(entry => entry.toLowerCase() === 'true' || entry === '*' || /^\d+$/.test(entry));
  if (blanket) {
    return {
      value: false,
      error: `TRUST_PROXY="${blanket}" trusts every client's X-Forwarded-For. ` +
        'List your proxy IPs or CIDR ranges instead (e.g. 172.18.0.0/16 or loopback).'
    };
  }

  return { value: entries, error: null };
}

/**
 * Return a warning message when a URL sends data in cleartext to a
 * non-loopback host, or null when the URL is HTTPS / loopback / invalid.
 * @param {string} url
 * @param {string} label - name used in the message (e.g. env var name)
 * @param {string} risk - what leaks if the traffic is sniffed
 * @returns {string|null}
 */
export function insecureUrlWarning(url, label, risk) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:') return null;
  if (LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  return `⚠️  ${label} uses plain HTTP (${parsed.host}). ${risk} ` +
    'can be read or changed on the network. Use https:// where possible.';
}
