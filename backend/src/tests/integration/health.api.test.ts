import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app';

describe('Health API integration tests', () => {
  it('GET /api/v1/health returns 200 with service status and version', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('UP');
    expect(res.body.data.version).toBe('1.0.0');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /api/v1/health/science reports SPICE and DEM readiness diagnostics', async () => {
    const res = await request(app).get('/api/v1/health/science');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ephemeris).toBeDefined();
    expect(res.body.data.ephemeris.activeDefaultProvider).toBeDefined();
    expect(res.body.data.terrainDem).toBeDefined();
    expect(res.body.data.operationalMode).toBeDefined();
  });

  it('returns 404 for unknown endpoints', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
