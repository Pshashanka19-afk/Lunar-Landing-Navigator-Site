import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app';

describe('Phase I: Production Security and Resource Limits Tests', () => {
  const site = {
    latitudeDeg: -89.78,
    longitudeDeg: 125.4,
  };

  it('rejects mission comparison request exceeding 50 candidate sites', async () => {
    const excessiveSites = Array.from({ length: 51 }, (_, i) => ({
      id: `site-${i + 1}`,
      latitudeDeg: -89.0,
      longitudeDeg: (i * 5) % 360,
    }));

    const res = await request(app)
      .post('/api/v1/sites/compare')
      .send({
        sites: excessiveSites,
        requirements: { minSunlightHours: 5.0 },
        startTimeUtc: '2026-10-29T00:00:00Z',
        endTimeUtc: '2026-10-30T00:00:00Z',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('validation failed');
  });

  it('rejects mission window calculation interval exceeding 90 days limit', async () => {
    const res = await request(app)
      .post('/api/v1/windows/calculate')
      .send({
        site,
        startTimeUtc: '2026-01-01T00:00:00Z',
        endTimeUtc: '2026-06-01T00:00:00Z', // ~150 days > 90 days limit
        stepSeconds: 3600,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('handles malformed JSON gracefully with 400 and without crashing process', async () => {
    const res = await request(app)
      .post('/api/v1/sites/validate')
      .set('Content-Type', 'application/json')
      .send('{ malformed json body ');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_JSON');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('enforces request-id header on all error and success responses', async () => {
    const customId = 'client-specified-test-id-12345';
    const res = await request(app)
      .get('/api/v1/health')
      .set('X-Request-Id', customId);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(customId);
  });
});
