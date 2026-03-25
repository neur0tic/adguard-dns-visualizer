import { describe, it, expect } from 'vitest';
import GeoService from '../server/geo-service.js';

const geo = new GeoService(3.139, 101.6869);

describe('GeoService.isPrivateIP', () => {
  it('returns true for 10.x.x.x', () => {
    expect(geo.isPrivateIP('10.0.0.1')).toBe(true);
  });

  it('returns true for 192.168.x.x', () => {
    expect(geo.isPrivateIP('192.168.1.1')).toBe(true);
  });

  it('returns true for 172.16.x.x', () => {
    expect(geo.isPrivateIP('172.16.0.1')).toBe(true);
  });

  it('returns true for 127.0.0.1', () => {
    expect(geo.isPrivateIP('127.0.0.1')).toBe(true);
  });

  it('returns false for a public IPv4', () => {
    expect(geo.isPrivateIP('8.8.8.8')).toBe(false);
  });

  it('returns true for fe80:: (link-local IPv6)', () => {
    expect(geo.isPrivateIP('fe80::1')).toBe(true);
  });

  it('returns false for a public IPv6', () => {
    expect(geo.isPrivateIP('2001:4860:4860::8888')).toBe(false);
  });

  it('returns true for null', () => {
    expect(geo.isPrivateIP(null)).toBe(true);
  });
});

describe('GeoService.sanitizeIp', () => {
  it('trims whitespace', () => {
    expect(geo.sanitizeIp('  8.8.8.8  ')).toBe('8.8.8.8');
  });

  it('returns null for empty string', () => {
    expect(geo.sanitizeIp('')).toBeNull();
  });

  it('returns null for overlong input', () => {
    expect(geo.sanitizeIp('a'.repeat(46))).toBeNull();
  });
});

describe('GeoService.isValidCoordinate', () => {
  it('accepts valid coordinates', () => {
    expect(geo.isValidCoordinate(3.139, 101.6869)).toBe(true);
  });

  it('rejects NaN', () => {
    expect(geo.isValidCoordinate(NaN, 101)).toBe(false);
  });

  it('rejects out-of-range latitude', () => {
    expect(geo.isValidCoordinate(91, 0)).toBe(false);
  });

  it('rejects out-of-range longitude', () => {
    expect(geo.isValidCoordinate(0, 181)).toBe(false);
  });
});

describe('GeoService.validatePositiveInteger', () => {
  it('returns parsed value for valid input', () => {
    expect(geo.validatePositiveInteger(42, 100)).toBe(42);
  });

  it('returns default for undefined', () => {
    expect(geo.validatePositiveInteger(undefined, 100)).toBe(100);
  });

  it('returns default for NaN', () => {
    expect(geo.validatePositiveInteger(NaN, 100)).toBe(100);
  });

  it('returns default for zero', () => {
    expect(geo.validatePositiveInteger(0, 100)).toBe(100);
  });

  it('returns default for negative', () => {
    expect(geo.validatePositiveInteger(-5, 100)).toBe(100);
  });
});

describe('GeoService constructor', () => {
  it('throws for invalid coordinates', () => {
    expect(() => new GeoService(200, 0)).toThrow('Invalid source coordinates');
  });

  it('uses sourceCity/sourceCountry from options', () => {
    const g = new GeoService(1, 1, { sourceCity: 'TestCity', sourceCountry: 'TC' });
    expect(g.getSource().city).toBe('TestCity');
    expect(g.getSource().country).toBe('TC');
  });

  it('defaults to Unknown when sourceCity not provided', () => {
    const g = new GeoService(1, 1);
    expect(g.getSource().city).toBe('Unknown');
  });
});
