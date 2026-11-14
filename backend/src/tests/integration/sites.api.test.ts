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
    const sites = res.body.data.demonstrationSites as Array<{
      id: string; name: string; latitudeDeg: number; longitudeDeg: number;
    }>;
    const names = sites.map((site) => site.name);
    const ids = sites.map((site) => site.id);
    expect(new Set(ids).size).toBe(ids.length); // IDs must be unique for frontend keys and API consumers

    for (const requiredName of [
      'Statio Shiv Shakti', 'Mons Mouton', 'Malapert Massif', 'Haworth',
      'Peak Near Shackleton', 'Nobile Rim 1',
    ]) {
      expect(names.some((name) => name.includes(requiredName))).toBe(true);
    }

    const byId = Object.fromEntries(sites.map((site) => [site.id, site]));
    expect(byId['statio-shiv-shakti']).toMatchObject({ latitudeDeg: -69.3734, longitudeDeg: 32.3198 });
    expect(byId['mons-mouton']).toMatchObject({ latitudeDeg: -85.416, longitudeDeg: 31.851 });
    expect(byId['malapert-massif']).toMatchObject({ latitudeDeg: -85.9948, longitudeDeg: -0.23578 });
    expect(byId['haworth-crater-rim']).toMatchObject({ latitudeDeg: -86.7639, longitudeDeg: -22.777 });
    expect(byId['peak-near-shackleton']).toMatchObject({ latitudeDeg: -88.811, longitudeDeg: 123.6901 });
    expect(byId['nobile-rim-1']).toMatchObject({ latitudeDeg: -85.295, longitudeDeg: 36.917 });
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

  it('GET /api/v1/sites/:id returns site details for valid site ID', async () => {
    const res = await request(app).get('/api/v1/sites/shackleton-connecting-ridge');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('shackleton-connecting-ridge');
    expect(res.body.data.latitudeDeg).toBeCloseTo(-89.78, 2);
    expect(res.body.data.name).toContain('Shackleton');
  });

  it('GET /api/v1/sites/:id returns 404 for unknown site ID', async () => {
    const res = await request(app).get('/api/v1/sites/non-existent-site-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SITE_NOT_FOUND');
  });

  it('POST /api/v1/sites/analysis computes authoritative SPICE DE440 & LOLA analysis', async () => {
    const res = await request(app)
      .post('/api/v1/sites/analysis')
      .send({
        site: {
          id: 'shackleton-connecting-ridge',
          name: 'Shackleton Crater - Connecting Ridge',
          latitudeDeg: -89.78,
          longitudeDeg: 125.40,
          elevationMeters: 1413.9,
        },
        epochUtc: '2026-10-14T12:00:00Z',
        observerHeightMeters: 2.0,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.site.name).toContain('Shackleton');
    expect(res.body.data.terrain).toBeDefined();
    expect(res.body.data.terrain.slopeDeg).toBeDefined();
    expect(res.body.data.sun).toBeDefined();
    expect(res.body.data.sun.elevationDeg).toBeDefined();
    expect(res.body.data.sun.azimuthDeg).toBeDefined();
    expect(res.body.data.earth).toBeDefined();
    expect(res.body.data.earth.elevationDeg).toBeDefined();
    expect(res.body.data.next24HoursSummary).toBeDefined();
    expect(res.body.data.metadata.ephemerisProvider).toBeDefined();
  });
});
