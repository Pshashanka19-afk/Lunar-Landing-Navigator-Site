import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app';

describe('Geometry API integration tests', () => {
  const site = {
    latitudeDeg: -89.78,
    longitudeDeg: 125.4,
    elevationMeters: 1250,
  };

  it('POST /api/v1/geometry/sun returns instantaneous Sun geometry in ENU', async () => {
    const res = await request(app)
      .post('/api/v1/geometry/sun')
      .send({
        epochUtc: '2026-10-29T12:00:00Z',
        site,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.target).toBe('SUN');
    expect(res.body.data.azimuthDeg).toBeDefined();
    expect(res.body.data.elevationDeg).toBeDefined();
    expect(res.body.data.frame).toBe('LOCAL_ENU');
    expect(res.body.data.units.angles).toBe('degrees');
  });

  it('POST /api/v1/geometry/earth returns instantaneous Earth geometry in ENU', async () => {
    const res = await request(app)
      .post('/api/v1/geometry/earth')
      .send({
        epochUtc: '2026-10-29T12:00:00Z',
        site,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.target).toBe('EARTH');
    expect(res.body.data.distanceMeters).toBeGreaterThan(3e8);
  });

  it('POST /api/v1/geometry/sky returns Sun and Earth geometry together', async () => {
    const res = await request(app)
      .post('/api/v1/geometry/sky')
      .send({
        epochUtc: '2026-10-29T12:00:00Z',
        site,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sun).toBeDefined();
    expect(res.body.data.earth).toBeDefined();
  });

  it('POST /api/v1/geometry/sun rejects invalid epoch format with 400', async () => {
    const res = await request(app)
      .post('/api/v1/geometry/sun')
      .send({
        epochUtc: 'invalid-date-string',
        site,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
