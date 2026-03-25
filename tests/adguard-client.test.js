import { describe, it, expect } from 'vitest';
import AdGuardClient from '../server/adguard-client.js';

const client = new AdGuardClient('http://fake', 'user', 'pass');

describe('AdGuardClient.isValidIP', () => {
  it('accepts a valid IPv4', () => {
    expect(client.isValidIP('8.8.8.8')).toBe(true);
  });

  it('rejects loopback', () => {
    expect(client.isValidIP('127.0.0.1')).toBe(false);
  });

  it('rejects 0.0.0.0', () => {
    expect(client.isValidIP('0.0.0.0')).toBe(false);
  });

  it('rejects :: (IPv6 unspecified)', () => {
    expect(client.isValidIP('::')).toBe(false);
  });

  it('accepts a valid IPv6', () => {
    expect(client.isValidIP('2001:4860:4860::8888')).toBe(true);
  });

  it('rejects null', () => {
    expect(client.isValidIP(null)).toBe(false);
  });

  it('rejects out-of-range octet', () => {
    expect(client.isValidIP('256.0.0.1')).toBe(false);
  });
});

describe('AdGuardClient.sanitizeIP', () => {
  it('returns IPv4 as-is', () => {
    expect(client.sanitizeIP('192.168.1.1')).toBe('192.168.1.1');
  });

  it('strips brackets from bracketed IPv6', () => {
    expect(client.sanitizeIP('[::1]')).toBe('::1');
  });

  it('strips port from bracketed IPv6', () => {
    expect(client.sanitizeIP('[::1]:53')).toBe('::1');
  });

  it('strips port from plain IPv4:port', () => {
    expect(client.sanitizeIP('192.168.1.1:8080')).toBe('192.168.1.1');
  });

  it('returns unknown for null', () => {
    expect(client.sanitizeIP(null)).toBe('unknown');
  });
});

describe('AdGuardClient.sanitizeDomain', () => {
  it('removes trailing dot', () => {
    expect(client.sanitizeDomain('example.com.')).toBe('example.com');
  });

  it('lowercases', () => {
    expect(client.sanitizeDomain('Example.COM')).toBe('example.com');
  });

  it('returns unknown for null', () => {
    expect(client.sanitizeDomain(null)).toBe('unknown');
  });
});

describe('AdGuardClient.parseAnswer', () => {
  it('extracts A record IPs', () => {
    const answer = [
      { type: 'A', value: '1.2.3.4' },
      { type: 'A', value: '5.6.7.8' }
    ];
    expect(client.parseAnswer(answer)).toEqual({ ips: ['1.2.3.4', '5.6.7.8'], cname: null });
  });

  it('caps IPs at 3', () => {
    const answer = [
      { type: 'A', value: '1.1.1.1' },
      { type: 'A', value: '2.2.2.2' },
      { type: 'A', value: '3.3.3.3' },
      { type: 'A', value: '4.4.4.4' }
    ];
    expect(client.parseAnswer(answer).ips).toHaveLength(3);
  });

  it('returns cname when no A records exist', () => {
    const answer = [{ type: 'CNAME', value: 'alias.example.com' }];
    const result = client.parseAnswer(answer);
    expect(result.ips).toHaveLength(0);
    expect(result.cname).toBe('alias.example.com');
  });

  it('resolves IPs from nested CNAME answer', () => {
    const answer = [{
      type: 'CNAME',
      value: 'alias.example.com',
      answer: [{ type: 'A', value: '9.9.9.9' }]
    }];
    expect(client.parseAnswer(answer).ips).toContain('9.9.9.9');
  });

  it('returns empty for null', () => {
    expect(client.parseAnswer(null)).toEqual({ ips: [], cname: null });
  });
});

describe('AdGuardClient.parseQueryLogs', () => {
  it('returns empty array for non-array input', () => {
    expect(client.parseQueryLogs(null)).toEqual([]);
    expect(client.parseQueryLogs('string')).toEqual([]);
  });

  it('marks filtered queries', () => {
    const logs = [{
      time: new Date().toISOString(),
      reason: 'FilteredBlacklist',
      question: { name: 'ads.example.com', type: 'A' },
      status: 'NOERROR',
      elapsedMs: '5',
      cached: false,
      upstream: ''
    }];
    const result = client.parseQueryLogs(logs);
    expect(result[0].filtered).toBe(true);
  });

  it('calculates upstreamElapsed as 0 for cached queries', () => {
    const logs = [{
      time: new Date().toISOString(),
      question: { name: 'example.com', type: 'A' },
      status: 'NOERROR',
      elapsedMs: '10',
      cached: true,
      upstream: 'dns.cloudflare.com'
    }];
    const result = client.parseQueryLogs(logs);
    expect(result[0].upstreamElapsed).toBe(0);
  });
});
