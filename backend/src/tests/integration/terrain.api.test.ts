import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app';

describe('Terrain API integration tests', () => {
  const site = {
    latitudeDeg: -89.5,
    longitudeDeg: 0.0,
    elevationMeters: 50.0,
  };

  it('POST /api/v1/terrain/surface-normal calculates slope and aspect', async () => {
    const res = await request(app)
      .post('/api/v1/terrain/surface-normal')
      .send({
        site,
        derivativeMethod: 'CENTRAL_DIFFERENCE',
        demProvider: 'synthetic',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.surfaceNormalEnu).toBeDefined();
    expect(res.body.data.slopeDeg).toBeDefined();
    expect(res.body.data.aspectDeg).toBeDefined();
  });

  it('POST /api/v1/terrain/horizon generates 360-degree horizon profile', async () => {
    const res = await request(app)
      .post('/api/v1/terrain/horizon')
      .send({
        site,
        searchRadiusMeters: 500.0,
        azimuthStepDeg: 45.0,
        demProvider: 'synthetic',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.samples.length).toBe(8);
    expect(res.body.data.minHorizonElevationDeg).toBeDefined();
  });

  it('POST /api/v1/terrain/horizon-at-azimuth interpolates horizon angle at specific direction', async () => {
    const res = await request(app)
      .post('/api/v1/terrain/horizon-at-azimuth')
      .send({
        site,
        azimuthDeg: 137.5,
        demProvider: 'synthetic',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.requestedAzimuthDeg).toBe(137.5);
    expect(res.body.data.horizonElevationDeg).toBeDefined();
  });

  it('POST /api/v1/terrain/visibility evaluates target clearance and classification', async () => {
    const res = await request(app)
      .post('/api/v1/terrain/visibility')
      .send({
        site,
        targetAzimuthDeg: 120.0,
        targetElevationDeg: 5.0,
        demProvider: 'synthetic',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.evaluation.status).toBeDefined();
    expect(res.body.data.evaluation.clearanceDeg).toBeDefined();
  });
});
