import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app';

describe('Windows API integration tests', () => {
  const site = {
    latitudeDeg: -89.5,
    longitudeDeg: 0.0,
    elevationMeters: 50.0,
  };

  it('POST /api/v1/windows/calculate calculates time-dependent windows and summary metrics', async () => {
    const res = await request(app)
      .post('/api/v1/windows/calculate')
      .send({
        site,
        startTimeUtc: '2026-10-29T00:00:00Z',
        endTimeUtc: '2026-10-29T02:00:00Z',
        stepSeconds: 600,
        boundaryToleranceSeconds: 30,
        includeTimeSeries: true,
        demProvider: 'synthetic',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.windows).toBeDefined();
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.summary.sunlightTotalHours).toBeDefined();
    expect(res.body.data.summary.earthVisibilityTotalHours).toBeDefined();
    expect(res.body.data.summary.bothVisibilityTotalHours).toBeDefined();
    expect(res.body.data.timeSeries).toBeDefined();
    expect(res.body.data.timeSeries.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/windows/calculate rejects inverted time range with 422/400', async () => {
    const res = await request(app)
      .post('/api/v1/windows/calculate')
      .send({
        site,
        startTimeUtc: '2026-10-29T04:00:00Z',
        endTimeUtc: '2026-10-29T02:00:00Z', // start after end
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });
});
