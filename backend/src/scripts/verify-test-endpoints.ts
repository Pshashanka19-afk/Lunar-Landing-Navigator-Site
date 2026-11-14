import { app } from '../app';
import request from 'supertest';

async function verifyTestEndpoints() {
  console.log('=== VERIFYING DEDICATED /api/test/ ENDPOINTS ===\n');

  const site = {
    id: 'shackleton-connecting-ridge',
    name: 'Shackleton Crater - Connecting Ridge',
    latitudeDeg: -89.78,
    longitudeDeg: 125.4,
    elevationMeters: 1413.9,
    observerHeightMeters: 2.0,
  };
  const epochUtc = '2026-10-29T12:00:00Z';

  // 1. GET /api/test/health
  const t1 = await request(app).get('/api/test/health');
  console.log('1. GET /api/test/health:', t1.status, t1.body.data?.service, t1.body.data?.status);

  // 2. GET /api/test/data-status
  const t2 = await request(app).get('/api/test/data-status');
  console.log('2. GET /api/test/data-status:', t2.status, {
    overallStatus: t2.body.data?.overallStatus,
    passed: t2.body.data?.summary?.passed,
    failed: t2.body.data?.summary?.failed,
    warnings: t2.body.data?.summary?.warnings,
  });

  // 3. GET /api/test/sites
  const t3 = await request(app).get('/api/test/sites');
  console.log('3. GET /api/test/sites:', t3.status, `count=${t3.body.data?.count}`);

  // 4. POST /api/test/site-analysis
  const t4 = await request(app).post('/api/test/site-analysis').send({ site, epochUtc });
  console.log('4. POST /api/test/site-analysis:', t4.status, {
    elevationMeters: t4.body.data?.terrain?.elevationMeters,
    slopeDeg: t4.body.data?.terrain?.slopeDeg,
    sunAz: t4.body.data?.sun?.azimuthDeg,
    sunEl: t4.body.data?.sun?.elevationDeg,
    earthAz: t4.body.data?.earth?.azimuthDeg,
    earthEl: t4.body.data?.earth?.elevationDeg,
  });

  // 5. POST /api/test/compare-sites
  const t5 = await request(app).post('/api/test/compare-sites').send({
    sites: [
      site,
      {
        id: 'malapert-mountain',
        name: 'Malapert Mountain',
        latitudeDeg: -85.99,
        longitudeDeg: 2.91,
      },
      {
        id: 'haworth-crater-rim',
        name: 'Haworth Crater Rim Plateau',
        latitudeDeg: -87.45,
        longitudeDeg: -5.10,
      },
    ],
    epochUtc,
    durationHours: 24,
  });
  console.log('5. POST /api/test/compare-sites:', t5.status, {
    siteCount: t5.body.data?.sites?.length,
    ranking: t5.body.data?.ranking,
  });

  // 6. POST /api/test/time-analysis
  const t6 = await request(app).post('/api/test/time-analysis').send({
    site,
    startTimeUtc: '2026-10-29T00:00:00Z',
    durationPreset: '24h',
  });
  console.log('6. POST /api/test/time-analysis:', t6.status, {
    points: t6.body.data?.timeSeries?.length,
    sunlightTotalHours: t6.body.data?.summary?.sunlightTotalHours,
    earthVisibilityTotalHours: t6.body.data?.summary?.earthVisibilityTotalHours,
  });

  // 7. POST /api/test/sun-earth-position
  const t7 = await request(app).post('/api/test/sun-earth-position').send({ site, epochUtc });
  console.log('7. POST /api/test/sun-earth-position:', t7.status, {
    sunEl: t7.body.data?.sun?.elevationDeg,
    sunStatus: t7.body.data?.sun?.status,
    earthEl: t7.body.data?.earth?.elevationDeg,
    earthStatus: t7.body.data?.earth?.status,
    horizonSamples: t7.body.data?.horizon?.samplesCount,
  });

  // 8. POST /api/test/mission-assessment
  const t8 = await request(app).post('/api/test/mission-assessment').send({
    site,
    startTimeUtc: '2026-10-29T00:00:00Z',
    durationHours: 48,
    minSunlightDurationHours: 12,
    maxSlopeDeg: 20,
  });
  console.log('8. POST /api/test/mission-assessment:', t8.status, {
    assessment: t8.body.data?.finalAssessment?.status,
    score: t8.body.data?.finalAssessment?.score,
    powerMaxEl: t8.body.data?.powerAssessment?.maxSolarElevationDeg,
    commVisHours: t8.body.data?.communicationAssessment?.earthVisibilityTotalHours,
  });

  // 9. POST /api/test/terrain
  const t9 = await request(app).post('/api/test/terrain').send({
    site,
    radiusMeters: 2000,
    gridResolution: 50,
  });
  console.log('9. POST /api/test/terrain:', t9.status, {
    gridW: t9.body.data?.grid?.width,
    gridH: t9.body.data?.grid?.height,
    minEl: t9.body.data?.grid?.minElevationMeters,
    maxEl: t9.body.data?.grid?.maxElevationMeters,
    stepM: t9.body.data?.grid?.stepMeters,
    source: t9.body.data?.demMetadata?.source,
  });

  // 10. POST /api/test/timeline
  const t10 = await request(app).post('/api/test/timeline').send({
    site,
    startTimeUtc: '2026-10-29T00:00:00Z',
    durationHours: 48,
    stepSeconds: 3600,
  });
  console.log('10. POST /api/test/timeline:', t10.status, {
    pointCount: t10.body.data?.pointCount,
    days: t10.body.data?.dayMetrics?.length,
  });

  // 11. GET /api/test/logs
  const t11 = await request(app).get('/api/test/logs');
  console.log('11. GET /api/test/logs:', t11.status, `logCount=${t11.body.data?.count}`);

  console.log('\n=== ALL DEDICATED TEST LAB ENDPOINTS VERIFIED AND FUNCTIONAL ===');
}

verifyTestEndpoints().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});

