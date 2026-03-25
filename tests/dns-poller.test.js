import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DNSPoller } from '../server/index.js';

function makeAdGuardMock() {
  return {
    getQueryLog: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({ numDnsQueries: 0 }),
    resolveCNAME: vi.fn().mockResolvedValue([])
  };
}

function makeGeoMock() {
  return {
    getSource: vi.fn().mockReturnValue({ lat: 3, lng: 101, city: 'Test', country: 'TS' }),
    lookup: vi.fn().mockResolvedValue({ lat: 1, lng: 2, city: 'Dest', country: 'DC' })
  };
}

const testConfig = {
  pollInterval: 2000,
  statsInterval: 5000,
  maxProcessedIds: 100,
  maxConcurrentArcs: 50
};

describe('DNSPoller — connection management', () => {
  it('adds and removes connections', () => {
    const poller = new DNSPoller(makeAdGuardMock(), makeGeoMock(), testConfig);
    const ws = { readyState: 1, send: vi.fn() };

    poller.addConnection(ws);
    expect(poller.activeConnections.size).toBe(1);

    poller.removeConnection(ws);
    expect(poller.activeConnections.size).toBe(0);
  });
});

describe('DNSPoller — startPolling / stopPolling', () => {
  it('does not start polling with no connections', () => {
    const poller = new DNSPoller(makeAdGuardMock(), makeGeoMock(), testConfig);
    poller.startPolling();
    expect(poller.dnsPollingInterval).toBeNull();
  });

  it('starts polling when connection is present', () => {
    const adguard = makeAdGuardMock();
    const poller = new DNSPoller(adguard, makeGeoMock(), testConfig);
    poller.addConnection({ readyState: 1, send: vi.fn(), close: vi.fn() });
    poller.startPolling();
    expect(poller.dnsPollingInterval).not.toBeNull();
    poller.shutdown();
  });

  it('stops polling when last connection is removed', () => {
    const poller = new DNSPoller(makeAdGuardMock(), makeGeoMock(), testConfig);
    const ws = { readyState: 1, send: vi.fn() };
    poller.addConnection(ws);
    poller.startPolling();
    poller.removeConnection(ws);
    poller.stopPolling();
    expect(poller.dnsPollingInterval).toBeNull();
  });
});

describe('DNSPoller — duplicate deduplication', () => {
  it('does not process duplicate entries', async () => {
    const adguard = makeAdGuardMock();
    const geo = makeGeoMock();
    const poller = new DNSPoller(adguard, geo, testConfig);
    const ws = { readyState: 1, send: vi.fn() };
    poller.addConnection(ws);

    const entry = {
      timestamp: new Date(Date.now() - 500),
      domain: 'example.com',
      client: '192.168.1.1',
      type: 'A',
      answer: ['8.8.8.8'],
      cname: null,
      filtered: false,
      status: 'NOERROR',
      elapsed: '10',
      upstreamElapsed: '8',
      cached: false,
      reason: ''
    };

    adguard.getQueryLog.mockResolvedValue([entry, entry]);
    poller.lastPollTime = Date.now() - 10000; // ensure entries pass cutoff

    await poller.pollDNSLogs();

    // Two identical entries → only one geo lookup
    expect(geo.lookup).toHaveBeenCalledTimes(1);
  });
});

describe('DNSPoller — processDNSEntry', () => {
  it('does not mutate the original entry', async () => {
    const adguard = makeAdGuardMock();
    adguard.resolveCNAME.mockResolvedValue(['1.2.3.4']);
    const poller = new DNSPoller(adguard, makeGeoMock(), testConfig);
    poller.addConnection({ readyState: 1, send: vi.fn() });

    const original = {
      timestamp: new Date(),
      domain: 'alias.example.com',
      client: '10.0.0.1',
      type: 'CNAME',
      answer: [],
      cname: 'target.example.com',
      filtered: false,
      status: 'NOERROR',
      elapsed: '5',
      upstreamElapsed: '4',
      cached: false,
      reason: ''
    };

    const originalAnswerRef = original.answer;
    await poller.processDNSEntry(original);

    expect(original.answer).toBe(originalAnswerRef);
    expect(original.resolvedFromCname).toBeUndefined();
  });
});
