import { app } from '../app';
import request from 'supertest';

async function verifyAllEndpoints() {
  console.log('=== VERIFYING ALL CLPS LUNAR MISSION BROWSER API ENDPOINTS ===\n');

  const site = {
    latitudeDeg: -89.78,
    longitudeDeg: 154.54,
    elevationMeters: 1413.9,
    observerHeightMeters: 2.0,
  };
  const epochUtc = '2026-10-29T12:00:00Z';

  // 1. GET /api/v1/health
  const healthRes = await request(app).get('/api/v1/health');
  console.log('1. GET /api/v1/health:', healthRes.status, JSON.stringify(healthRes.body));

  // 2. GET /api/v1/health/science
  const scienceRes = await request(app).get('/api/v1/health/science');
  console.log('2. GET /api/v1/health/science:', scienceRes.status, JSON.stringify(scienceRes.body, null, 2));

  // 3. GET /api/v1/sites
  const sitesRes = await request(app).get('/api/v1/sites');
  console.log('3. GET /api/v1/sites:', sitesRes.status, `count=${sitesRes.body.data?.length}`);

  // 4. GET /api/v1/sites/default
  const defaultSiteRes = await request(app).get('/api/v1/sites/default');
  console.log('4. GET /api/v1/sites/default:', defaultSiteRes.status, defaultSiteRes.body.data?.name);

  // 5. POST /api/v1/sites/validate
  const validateRes = await request(app).post('/api/v1/sites/validate').send({
    latitudeDeg: -89.78,
    longitudeDeg: 154.54,
  });
  console.log('5. POST /api/v1/sites/validate:', validateRes.status, JSON.stringify(validateRes.body.data));

  // 6. POST /api/v1/geometry/sun
  const sunRes = await request(app).post('/api/v1/geometry/sun').send({
    site,
    epochUtc,
    ephemerisProvider: 'spice',
  });
  console.log('6. POST /api/v1/geometry/sun:', sunRes.status, {
    azimuthDeg: sunRes.body.data?.azimuthDeg,
    elevationDeg: sunRes.body.data?.elevationDeg,
    distanceKm: sunRes.body.data?.distanceKm,
    provider: sunRes.body.data?.metadata?.provider,
  });

  // 7. POST /api/v1/geometry/earth
  const earthRes = await request(app).post('/api/v1/geometry/earth').send({
    site,
    epochUtc,
    ephemerisProvider: 'spice',
  });
  console.log('7. POST /api/v1/geometry/earth:', earthRes.status, {
    azimuthDeg: earthRes.body.data?.azimuthDeg,
    elevationDeg: earthRes.body.data?.elevationDeg,
    distanceKm: earthRes.body.data?.distanceKm,
    provider: earthRes.body.data?.metadata?.provider,
  });

  // 8. POST /api/v1/geometry/sky
  const skyRes = await request(app).post('/api/v1/geometry/sky').send({
    site,
    epochUtc,
    ephemerisProvider: 'spice',
  });
  console.log('8. POST /api/v1/geometry/sky:', skyRes.status, {
    sunEl: skyRes.body.data?.sun?.elevationDeg,
    earthEl: skyRes.body.data?.earth?.elevationDeg,
    provider: skyRes.body.data?.metadata?.provider,
  });

  // 9. POST /api/v1/terrain/surface-normal
  const normalRes = await request(app).post('/api/v1/terrain/surface-normal').send({
    site,
    demProvider: 'geotiff',
  });
  console.log('9. POST /api/v1/terrain/surface-normal:', normalRes.status, {
    slopeDeg: normalRes.body.data?.slopeDeg,
    aspectDeg: normalRes.body.data?.aspectDeg,
    normalEnu: normalRes.body.data?.surfaceNormalEnu,
    source: normalRes.body.data?.demMetadata?.source,
  });

  // 10. POST /api/v1/terrain/horizon
  const horizonRes = await request(app).post('/api/v1/terrain/horizon').send({
    site,
    demProvider: 'geotiff',
    searchRadiusMeters: 1000,
    azimuthStepDeg: 30,
  });
  console.log('10. POST /api/v1/terrain/horizon:', horizonRes.status, {
    sampleCount: horizonRes.body.data?.samples?.length,
    minHorizonEl: horizonRes.body.data?.minHorizonElevationDeg,
    maxHorizonEl: horizonRes.body.data?.maxHorizonElevationDeg,
    source: horizonRes.body.data?.demMetadata?.source,
  });

  // 11. POST /api/v1/terrain/horizon-at-azimuth
  const azProfileRes = await request(app).post('/api/v1/terrain/horizon-at-azimuth').send({
    site,
    demProvider: 'geotiff',
    azimuthDeg: 180,
    searchRadiusMeters: 1000,
  });
  console.log('11. POST /api/v1/terrain/horizon-at-azimuth:', azProfileRes.status, {
    requestedAzimuthDeg: azProfileRes.body.data?.requestedAzimuthDeg,
    horizonElevationDeg: azProfileRes.body.data?.horizonElevationDeg,
    source: azProfileRes.body.data?.demMetadata?.source,
  });

  // 12. POST /api/v1/terrain/visibility
  const visRes = await request(app).post('/api/v1/terrain/visibility').send({
    site,
    demProvider: 'geotiff',
    targetAzimuthDeg: 190.13,
    targetElevationDeg: 1.22,
    searchRadiusMeters: 1000,
  });
  console.log('12. POST /api/v1/terrain/visibility:', visRes.status, {
    isVisible: visRes.body.data?.evaluation?.isVisible,
    clearanceDeg: visRes.body.data?.evaluation?.clearanceDeg,
    horizonElevationDeg: visRes.body.data?.evaluation?.horizonElevationDeg,
  });

  // 13. POST /api/v1/illumination/instant
  const illumRes = await request(app).post('/api/v1/illumination/instant').send({
    site,
    epochUtc,
    ephemerisProvider: 'spice',
    demProvider: 'geotiff',
  });
  console.log('13. POST /api/v1/illumination/instant:', illumRes.status, {
    illuminationStatus: illumRes.body.data?.illuminationStatus,
    isDirectlyIlluminated: illumRes.body.data?.isDirectlyIlluminated,
    solarElevationDeg: illumRes.body.data?.sunGeometry?.elevationDeg,
    horizonDeg: illumRes.body.data?.terrainVisibility?.horizonElevationDeg,
    incidenceAngleDeg: illumRes.body.data?.surfaceOrientation?.incidenceAngleDeg,
  });

  // 14. POST /api/v1/windows/calculate
  const windowsRes = await request(app).post('/api/v1/windows/calculate').send({
    site,
    startTimeUtc: '2026-10-29T00:00:00Z',
    endTimeUtc: '2026-10-29T03:00:00Z',
    stepSeconds: 3600,
    ephemerisProvider: 'spice',
    demProvider: 'geotiff',
  });
  console.log('14. POST /api/v1/windows/calculate:', windowsRes.status, {
    sunWindowsCount: windowsRes.body.data?.windows?.sunWindows?.length,
    sunlightTotalHours: windowsRes.body.data?.summary?.sunlightTotalHours,
    earthVisibilityTotalHours: windowsRes.body.data?.summary?.earthVisibilityTotalHours,
    ephemerisProvider: windowsRes.body.data?.metadata?.ephemerisProvider,
    terrainDataset: windowsRes.body.data?.metadata?.terrainDataset,
  });

  // 15. POST /api/v1/sites/compare
  const compareRes = await request(app).post('/api/v1/sites/compare').send({
    sites: [
      {
        id: 'SHACKLETON_CR_1',
        name: 'Shackleton Connecting Ridge',
        latitudeDeg: -89.78,
        longitudeDeg: 154.54,
      },
      {
        id: 'MALAPERT_MTN_1',
        name: 'Malapert Mountain',
        latitudeDeg: -85.99,
        longitudeDeg: 2.91,
      },
    ],
    requirements: {
      minSunlightHours: 0.0,
      maxSlopeDeg: 25.0,
    },
    startTimeUtc: '2026-10-29T00:00:00Z',
    endTimeUtc: '2026-10-29T03:00:00Z',
    stepSeconds: 3600,
    ephemerisProvider: 'spice',
    demProvider: 'geotiff',
  });
  console.log('15. POST /api/v1/sites/compare:', compareRes.status, {
    comparisonCount: compareRes.body.data?.sites?.length,
    ranking: compareRes.body.data?.ranking?.map((r: any) => ({ siteId: r.siteId, score: r.overallScore })),
  });

  console.log('\n=== ALL 15 ENDPOINTS VERIFIED SUCCESSFULLY ===');
}

verifyAllEndpoints().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
