import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app';

describe('Illumination API integration tests', () => {
  const site = {
    latitudeDeg: -89.5,
    longitudeDeg: 0.0,
    elevationMeters: 50.0,
  };

  it('POST /api/v1/illumination/instant calculates instant illumination status', async () => {
    const res = await request(app)
      .post('/api/v1/illumination/instant')
      .send({
        site,
        epochUtc: '2026-10-29T12:00:00Z',
        demProvider: 'synthetic',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.illuminationStatus).toBeDefined();
    expect(res.body.data.sunGeometry).toBeDefined();
    expect(res.body.data.terrainVisibility).toBeDefined();
    expect(res.body.data.surfaceOrientation).toBeDefined();
    expect(res.body.data.conditions).toBeDefined();
    expect(res.body.data.limitations.length).toBeGreaterThan(0);
  });
});
