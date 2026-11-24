import { describe, it, expect } from 'vitest';
import {
  parseAllowedOrigins,
  isOriginAllowed,
  ConnectionLimiter,
  insecureUrlWarning,
  parseTrustProxy,
  parseAllowedHosts,
  isHostAllowed
} from '../server/security.js';

describe('isHostAllowed (DNS-rebinding guard)', () => {
  it('allows IP literals and localhost, with or without port', () => {
    for (const host of ['192.168.1.5:8080', '10.0.0.2', '[::1]:8080', '[fd00::5]', 'localhost:8080', 'LOCALHOST']) {
      expect(isHostAllowed(host)).toBe(true);
    }
  });

  it('rejects an unknown hostname (rebinding attacker domain)', () => {
    expect(isHostAllowed('evil.example:8080')).toBe(false);
    expect(isHostAllowed('dash.lan:8080')).toBe(false);
  });

  it('allows hostnames from ALLOWED_HOSTS, case-insensitively and ignoring port', () => {
    const allowed = parseAllowedHosts('Dash.LAN, dns.example.com:443');
    expect(allowed).toEqual(['dash.lan', 'dns.example.com']);
    expect(isHostAllowed('dash.lan:8080', allowed)).toBe(true);
    expect(isHostAllowed('DNS.example.com', allowed)).toBe(true);
    expect(isHostAllowed('evil.example', allowed)).toBe(false);
  });

  it('rejects malformed Host values and allows a missing one', () => {
    expect(isHostAllowed('')).toBe(false);
    expect(isHostAllowed('bad host/with space')).toBe(false);
    expect(isHostAllowed(undefined)).toBe(true);
  });

  it('does not treat an IP-looking subdomain as an IP literal', () => {
    expect(isHostAllowed('192.168.1.5.evil.example')).toBe(false);
  });
});

describe('parseTrustProxy', () => {
  it('is off when unset, empty or "false"', () => {
    expect(parseTrustProxy(undefined)).toEqual({ value: false, error: null });
    expect(parseTrustProxy('  ')).toEqual({ value: false, error: null });
    expect(parseTrustProxy('false')).toEqual({ value: false, error: null });
  });

  it('returns a list of proxies', () => {
    expect(parseTrustProxy('loopback, 172.18.0.0/16')).toEqual({
      value: ['loopback', '172.18.0.0/16'],
      error: null
    });
  });

  it('refuses blanket trust values', () => {
    for (const bad of ['true', '*', '1', 'loopback, true']) {
      const result = parseTrustProxy(bad);
      expect(result.value).toBe(false);
      expect(result.error).toMatch(/X-Forwarded-For/);
    }
  });
});

describe('isOriginAllowed (CSWSH guard)', () => {
  it('allows same-origin requests', () => {
    expect(isOriginAllowed('http://dash.lan:8080', 'dash.lan:8080')).toBe(true);
  });

  it('compares host case-insensitively', () => {
    expect(isOriginAllowed('http://Dash.LAN:8080', 'dash.lan:8080')).toBe(true);
  });

  it('rejects a foreign origin', () => {
    expect(isOriginAllowed('https://evil.example', 'dash.lan:8080')).toBe(false);
  });

  it('rejects same host on a different port', () => {
    expect(isOriginAllowed('http://dash.lan:9999', 'dash.lan:8080')).toBe(false);
  });

  it('rejects the "null" origin (sandboxed iframes, file://)', () => {
    expect(isOriginAllowed('null', 'dash.lan:8080')).toBe(false);
  });

  it('rejects malformed and non-http origins', () => {
    expect(isOriginAllowed('not a url', 'dash.lan:8080')).toBe(false);
    expect(isOriginAllowed('chrome-extension://abc', 'abc')).toBe(false);
  });

  it('allows a missing Origin (non-browser client)', () => {
    expect(isOriginAllowed(undefined, 'dash.lan:8080')).toBe(true);
  });

  it('allows an origin from ALLOWED_ORIGINS', () => {
    const allowed = parseAllowedOrigins('https://dns.example.com, https://other.example');
    expect(isOriginAllowed('https://dns.example.com', 'internal:8080', allowed)).toBe(true);
    expect(isOriginAllowed('https://evil.example', 'internal:8080', allowed)).toBe(false);
  });

  it('rejects when Host is missing and origin is not allow-listed', () => {
    expect(isOriginAllowed('http://dash.lan:8080', undefined)).toBe(false);
  });
});

describe('parseAllowedOrigins', () => {
  it('normalizes entries and drops invalid ones', () => {
    expect(parseAllowedOrigins('https://A.example/path, bogus, ')).toEqual(['https://a.example']);
  });

  it('returns [] for empty input', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins('')).toEqual([]);
  });
});

describe('ConnectionLimiter', () => {
  it('caps connections per IP and frees slots on release', () => {
    const limiter = new ConnectionLimiter(2);
    expect(limiter.tryAcquire('1.1.1.1')).toBe(true);
    expect(limiter.tryAcquire('1.1.1.1')).toBe(true);
    expect(limiter.tryAcquire('1.1.1.1')).toBe(false);
    expect(limiter.tryAcquire('2.2.2.2')).toBe(true);

    limiter.release('1.1.1.1');
    expect(limiter.tryAcquire('1.1.1.1')).toBe(true);
  });

  it('removes the IP entry when its count reaches zero', () => {
    const limiter = new ConnectionLimiter(2);
    limiter.tryAcquire('1.1.1.1');
    limiter.release('1.1.1.1');
    limiter.release('1.1.1.1');
    expect(limiter.count('1.1.1.1')).toBe(0);
    expect(limiter.counts.size).toBe(0);
  });

  it('treats 0 as unlimited', () => {
    const limiter = new ConnectionLimiter(0);
    for (let i = 0; i < 100; i++) expect(limiter.tryAcquire('1.1.1.1')).toBe(true);
  });

  it('falls back to 5 for invalid values', () => {
    expect(new ConnectionLimiter(NaN).maxPerIp).toBe(5);
    expect(new ConnectionLimiter(-1).maxPerIp).toBe(5);
  });
});

describe('insecureUrlWarning', () => {
  it('warns for plain HTTP to a remote host', () => {
    expect(insecureUrlWarning('http://ip-api.com/json', 'GEOIP_API_URL', 'Data')).toMatch(/plain HTTP/);
    expect(insecureUrlWarning('http://192.168.1.2:3000', 'ADGUARD_URL', 'Creds')).toMatch(/192\.168\.1\.2:3000/);
  });

  it('does not warn for HTTPS or loopback', () => {
    expect(insecureUrlWarning('https://ip-api.com/json', 'X', 'Y')).toBeNull();
    expect(insecureUrlWarning('http://localhost:3000', 'X', 'Y')).toBeNull();
    expect(insecureUrlWarning('http://127.0.0.1:3000', 'X', 'Y')).toBeNull();
    expect(insecureUrlWarning('http://[::1]:3000', 'X', 'Y')).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(insecureUrlWarning('nope', 'X', 'Y')).toBeNull();
    expect(insecureUrlWarning(undefined, 'X', 'Y')).toBeNull();
  });
});
