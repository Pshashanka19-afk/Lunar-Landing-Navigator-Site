import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { EphemerisFactory } from '../../services/ephemeris/ephemeris.factory';
import { SpiceProvider } from '../../services/ephemeris/spice.provider';
import { DemFactory } from '../../services/terrain/dem.factory';
import { DemService } from '../../services/terrain/dem.service';

describe('Phase H: End-to-End Scientific Calculation Pipeline Tests', () => {
  const site = {
    id: 'shackleton-e2e',
    name: 'Shackleton E2E Benchmark',
    latitudeDeg: -89.78,
    longitudeDeg: 125.4,
    elevationMeters: 1250,
    observerHeightMeters: 2.0,
  };

  it('Pipeline A (Synthetic Fixture Mode): executes complete end-to-end pipeline with mock ephemeris and synthetic DEM', async () => {
    // 1. Validate landing site coordinates
    const siteRes = await request(app).post('/api/v1/sites/validate').send({ site });
    expect(siteRes.status).toBe(200);
    expect(siteRes.body.data.valid).toBe(true);

    // 2. Compute Sky ephemeris with mock provider
    const skyRes = await request(app)
      .post('/api/v1/geometry/sky')
      .send({
        epochUtc: '2026-10-29T12:00:00Z',
        site,
        ephemerisProvider: 'mock',
      });
    expect(skyRes.status).toBe(200);
    expect(skyRes.body.data.sun.provenance.providerName).toContain('Mock');

    // 3. Compute surface normal with synthetic DEM
    const normalRes = await request(app)
      .post('/api/v1/terrain/surface-normal')
      .send({
        site,
        demProvider: 'synthetic',
      });
    expect(normalRes.status).toBe(200);
    expect(normalRes.body.data.demMetadata.type).toBe('SYNTHETIC_FIXTURE');

    // 4. Compute 360-degree horizon with synthetic DEM
    const horizonRes = await request(app)
      .post('/api/v1/terrain/horizon')
      .send({
        site,
        searchRadiusMeters: 1000.0,
        azimuthStepDeg: 30.0,
        demProvider: 'synthetic',
      });
    expect(horizonRes.status).toBe(200);
    expect(horizonRes.body.data.samples.length).toBe(12);

    // 5. Evaluate target visibility with synthetic DEM
    const visRes = await request(app)
      .post('/api/v1/terrain/visibility')
      .send({
        site,
        targetAzimuthDeg: skyRes.body.data.sun.azimuthDeg,
        targetElevationDeg: skyRes.body.data.sun.elevationDeg,
        demProvider: 'synthetic',
      });
    expect(visRes.status).toBe(200);
    expect(visRes.body.data.evaluation.status).toBeDefined();

    // 6. Evaluate instantaneous direct illumination
    const illumRes = await request(app)
      .post('/api/v1/illumination/instant')
      .send({
        site,
        epochUtc: '2026-10-29T12:00:00Z',
        ephemerisProvider: 'mock',
        demProvider: 'synthetic',
      });
    expect(illumRes.status).toBe(200);
    expect(illumRes.body.data.illuminationStatus).toBeDefined();

    // 7. Calculate time-dependent visibility windows with boundary refinement
    const windowsRes = await request(app)
      .post('/api/v1/windows/calculate')
      .send({
        site,
        startTimeUtc: '2026-10-29T00:00:00Z',
        endTimeUtc: '2026-10-29T04:00:00Z',
        stepSeconds: 600,
        ephemerisProvider: 'mock',
        demProvider: 'synthetic',
        includeTimeSeries: true,
      });
    expect(windowsRes.status).toBe(200);
    expect(windowsRes.body.data.windows.sunWindows).toBeDefined();
    expect(windowsRes.body.data.summary.sunlightTotalHours).toBeDefined();
  });

  it('Pipeline B (Analytical IAU Ephemeris Mode): executes complete end-to-end pipeline with IAU analytical reduction', async () => {
    const windowsRes = await request(app)
      .post('/api/v1/windows/calculate')
      .send({
        site,
        startTimeUtc: '2026-10-29T00:00:00Z',
        endTimeUtc: '2026-10-29T02:00:00Z',
        stepSeconds: 600,
        ephemerisProvider: 'analytical',
        demProvider: 'synthetic',
      });

    expect(windowsRes.status).toBe(200);
    expect(windowsRes.body.data.metadata.ephemerisProvider).toContain('Analytical');
    expect(windowsRes.body.data.summary.sunlightTotalHours).toBeGreaterThanOrEqual(0);
  });

  it('Pipeline C (Real Resource Mode Verification): strictly returns 503 when real SPICE or GeoTIFF is requested but missing', async () => {
    // When real SPICE is requested without kernels mounted:
    const spiceProvider = EphemerisFactory.getSpiceProvider();
    const spiceReady = await spiceProvider.isReady();
    if (!spiceReady) {
      const spiceRes = await request(app)
        .post('/api/v1/geometry/sun')
        .send({
          epochUtc: '2026-10-29T12:00:00Z',
          site,
          ephemerisProvider: 'spice',
        });

      expect(spiceRes.status).toBe(503);
      expect(spiceRes.body.success).toBe(false);
      expect(spiceRes.body.error.code).toBe('SCIENTIFIC_RESOURCE_UNAVAILABLE');
      expect(spiceRes.body.error.message).toContain('SPICE');
    } else {
      const missingSpice = new SpiceProvider('./data/kernels/non-existent-dir', true);
      const ready = await missingSpice.isReady();
      expect(ready).toBe(false);
      await expect(
        missingSpice.calculateTarget({
          target: 'SUN',
          epochUtc: '2026-10-29T12:00:00Z',
          siteCoords: site,
        })
      ).rejects.toThrow();
    }

    // When real GeoTIFF is requested without GeoTIFF file mounted:
    const demService = DemFactory.getGeoTiffService();
    const demReady = await demService.isReady();
    if (!demReady) {
      const demRes = await request(app)
        .post('/api/v1/terrain/surface-normal')
        .send({
          site,
          demProvider: 'geotiff',
        });

      expect(demRes.status).toBe(503);
      expect(demRes.body.success).toBe(false);
      expect(demRes.body.error.code).toBe('SCIENTIFIC_RESOURCE_UNAVAILABLE');
    } else {
      const missingDem = new DemService('./data/dem/non-existent.tif', false);
      await expect(missingDem.getMetadata()).rejects.toThrow();
    }
  });

  it('Pipeline D (Real Production Mode with SPICE and GeoTIFF): executes complete end-to-end pipeline with real NASA SPICE and real LOLA DEM', async () => {
    // 1. Compute Sun geometry using real SPICE
    const sunRes = await request(app)
      .post('/api/v1/geometry/sun')
      .send({
        epochUtc: '2026-10-29T12:00:00Z',
        site,
        ephemerisProvider: 'spice',
      });

    expect(sunRes.status).toBe(200);
    expect(sunRes.body.data.provenance.providerName).toContain('SPICE');
    expect(sunRes.body.data.azimuthDeg).toBeCloseTo(190.13, 0);

    // 2. Compute Earth geometry using real SPICE
    const earthRes = await request(app)
      .post('/api/v1/geometry/earth')
      .send({
        epochUtc: '2026-10-29T12:00:00Z',
        site,
        ephemerisProvider: 'spice',
      });

    expect(earthRes.status).toBe(200);
    expect(earthRes.body.data.provenance.providerName).toContain('SPICE');
    expect(earthRes.body.data.azimuthDeg).toBeCloseTo(235.42, 0);

    // 3. Compute surface normal using real LOLA GeoTIFF
    const normalRes = await request(app)
      .post('/api/v1/terrain/surface-normal')
      .send({
        site,
        demProvider: 'geotiff',
      });

    expect(normalRes.status).toBe(200);
    expect(normalRes.body.data.demMetadata.type).toBe('GEOTIFF');
    expect(normalRes.body.data.elevationMeters).toBeCloseTo(1413.9, 0);

    // 4. Compute 360-degree horizon using real LOLA GeoTIFF
    const horizonRes = await request(app)
      .post('/api/v1/terrain/horizon')
      .send({
        site,
        searchRadiusMeters: 1000.0,
        azimuthStepDeg: 30.0,
        demProvider: 'geotiff',
      });

    expect(horizonRes.status).toBe(200);
    expect(horizonRes.body.data.samples.length).toBe(12);
    expect(horizonRes.body.data.demMetadata.type).toBe('GEOTIFF');

    // 5. Evaluate target visibility with real terrain and SPICE
    const visRes = await request(app)
      .post('/api/v1/terrain/visibility')
      .send({
        site,
        targetAzimuthDeg: sunRes.body.data.azimuthDeg,
        targetElevationDeg: sunRes.body.data.elevationDeg,
        searchRadiusMeters: 1000.0,
        demProvider: 'geotiff',
      });

    expect(visRes.status).toBe(200);
    expect(visRes.body.data.evaluation.status).toBeDefined();

    // 6. Evaluate instantaneous illumination with real SPICE and real LOLA GeoTIFF
    const illumRes = await request(app)
      .post('/api/v1/illumination/instant')
      .send({
        site,
        epochUtc: '2026-10-29T12:00:00Z',
        ephemerisProvider: 'spice',
        demProvider: 'geotiff',
      });

    expect(illumRes.status).toBe(200);
    expect(illumRes.body.data.illuminationStatus).toBeDefined();

    // 7. Compute time-dependent visibility windows with real SPICE and real LOLA GeoTIFF
    const windowsRes = await request(app)
      .post('/api/v1/windows/calculate')
      .send({
        site,
        startTimeUtc: '2026-10-29T00:00:00Z',
        endTimeUtc: '2026-10-29T03:00:00Z',
        stepSeconds: 3600,
        ephemerisProvider: 'spice',
        demProvider: 'geotiff',
      });

    expect(windowsRes.status).toBe(200);
    expect(windowsRes.body.data.metadata.ephemerisProvider).toContain('SPICE');
    expect(windowsRes.body.data.metadata.terrainDataset).toBeDefined();
  });
});
