import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app';

describe('Sites API integration tests', () => {
  it('POST /api/v1/sites/validate validates correct lunar site coordinates', async () => {
    const res = await request(app)
      .post('/api/v1/sites/validate')
      .send({
        site: {
          id: 'shackleton',
          name: 'Shackleton Crater',
          latitudeDeg: -89.78,
          longitudeDeg: 125.4,
          elevationMeters: 1250,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.cartesianCoordinatesME).toBeDefined();
    expect(res.body.data.frame).toBe('MOON_ME');
  });

  it('POST /api/v1/sites/validate rejects out-of-range latitude with 400', async () => {
    const res = await request(app)
      .post('/api/v1/sites/validate')
      .send({
        site: {
          latitudeDeg: -105.0, // Invalid latitude < -90
          longitudeDeg: 0.0,
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/sites/defaults returns demonstration lunar landing sites', async () => {
    const res = await request(app).get('/api/v1/sites/defaults');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.demonstrationSites.length).toBeGreaterThan(0);
    expect(res.body.data.demonstrationSites[0].name).toContain('Shackleton');
  });

  it('POST /api/v1/sites/compare evaluates multi-site mission requirements', async () => {
    const res = await request(app)
      .post('/api/v1/sites/compare')
      .send({
        sites: [
          {
            id: 'site-1',
            name: 'Shackleton Site',
            latitudeDeg: -89.78,
            longitudeDeg: 125.4,
          },
          {
            id: 'site-2',
            name: 'Malapert Mountain',
            latitudeDeg: -85.99,
            longitudeDeg: 2.91,
          },
        ],
        requirements: {
          minSunlightHours: 1.0,
          maxSlopeDeg: 15.0,
        },
        startTimeUtc: '2026-10-29T00:00:00Z',
        endTimeUtc: '2026-10-29T02:00:00Z',
        stepSeconds: 600,
        demProvider: 'synthetic',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sites.length).toBe(2);
    expect(res.body.data.ranking.length).toBe(2);
    expect(res.body.data.disclaimer).toContain('decision-support');
  });
});
