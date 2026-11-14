import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app';

describe('Site series API integration tests', () => {
  const site = { latitudeDeg: -89.5, longitudeDeg: 0.0, elevationMeters: 50.0 };
  const base = {
    site,
    startTimeUtc: '2026-10-29T00:00:00Z',
    endTimeUtc: '2026-10-29T06:00:00Z',
    stepSeconds: 3600,
    ephemerisProvider: 'analytical',
    demProvider: 'synthetic',
  };

  it('POST /api/v1/series/site returns moon, sunlight and temperature series with a summary', async () => {
    const res = await request(app).post('/api/v1/series/site').send(base);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.interval.sampleCount).toBe(7);
    expect(data.series).toHaveLength(7);

    const p = data.series[0];
    expect(p.moon.earthMoonDistanceKm).toBeGreaterThan(350000);
    expect(p.moon.earthMoonDistanceKm).toBeLessThan(410000);
    expect(p.moon.earthToMoonJ2000Km).toBeNull(); // analytical provider has no J2000 vector
    expect(p.moon.subEarthPoint.latitudeDeg).toBeGreaterThanOrEqual(-90);
    expect(p.moon.subEarthPoint.longitudeDeg).toBeGreaterThanOrEqual(-180);
    expect(p.moon.subEarthPoint.longitudeDeg).toBeLessThanOrEqual(180);
    expect(p.sunlight.sunElevationDeg).toBeDefined();
    expect(typeof p.sunlight.isDirectlyIlluminated).toBe('boolean');
    expect(p.temperature.surfaceTemperatureK).toBeGreaterThan(0);

    expect(data.summary.sunlit.litPercentage).toBeGreaterThanOrEqual(0);
    expect(data.summary.temperature.maxK).toBeGreaterThanOrEqual(data.summary.temperature.minK);
    expect(data.metadata.thermalModel.description).toContain('modelled');
  });

  it('returns only the requested components', async () => {
    const res = await request(app)
      .post('/api/v1/series/site')
      .send({ ...base, include: ['moon'] });

    expect(res.status).toBe(200);
    const p = res.body.data.series[0];
    expect(p.moon).toBeDefined();
    expect(p.sunlight).toBeUndefined();
    expect(p.temperature).toBeUndefined();
    expect(res.body.data.metadata.thermalModel).toBeNull();
  });

  it('applies a custom night temperature', async () => {
    const res = await request(app)
      .post('/api/v1/series/site')
      .send({ ...base, include: ['temperature'], thermal: { nightTemperatureK: 40 } });

    expect(res.status).toBe(200);
    expect(res.body.data.summary.temperature.minK).toBeGreaterThanOrEqual(40);
    expect(res.body.data.metadata.thermalModel.nightTemperatureK).toBe(40);
  });

  it('rejects inverted time range', async () => {
    const res = await request(app)
      .post('/api/v1/series/site')
      .send({ ...base, startTimeUtc: '2026-10-29T06:00:00Z', endTimeUtc: '2026-10-29T00:00:00Z' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects intervals longer than the mission limit', async () => {
    const res = await request(app)
      .post('/api/v1/series/site')
      .send({ ...base, startTimeUtc: '2026-01-01T00:00:00Z', endTimeUtc: '2026-06-01T00:00:00Z' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects requests that would exceed the sample limit', async () => {
    const res = await request(app)
      .post('/api/v1/series/site')
      .send({ ...base, startTimeUtc: '2026-10-01T00:00:00Z', endTimeUtc: '2026-12-01T00:00:00Z', stepSeconds: 60 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects a step below the 60 s minimum and an unknown component', async () => {
    const tooSmall = await request(app).post('/api/v1/series/site').send({ ...base, stepSeconds: 10 });
    expect(tooSmall.status).toBe(400);

    const badInclude = await request(app).post('/api/v1/series/site').send({ ...base, include: ['wind'] });
    expect(badInclude.status).toBe(400);
  });
});
