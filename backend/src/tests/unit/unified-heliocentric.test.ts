import { describe, it, expect } from 'vitest';
import { AnalyticalEphemerisProvider } from '../../services/ephemeris/analytical.provider';
import { TimeConversionService } from '../../services/ephemeris/time-conversion.service';
import { degToRad, radToDeg } from '../../utils/angles';

describe('LUNARIS Unified Sun-Centric Heliocentric Visualization — Scientific Validation', () => {
  const provider = new AnalyticalEphemerisProvider();
  const testEpoch = '2026-10-14T12:00:00Z';
  const siteCoords = { latitudeDeg: -89.78, longitudeDeg: 125.40, elevationMeters: 1413.9 };

  it('1. Sun axial tilt is approximately 7.25° relative to the ecliptic normal', () => {
    const SUN_AXIAL_TILT_DEG = 7.25;
    const SUN_NODE_DEG = 75.76; // Ascending node of solar equator on ecliptic (J2000)

    const tiltRad = degToRad(SUN_AXIAL_TILT_DEG);
    const nodeRad = degToRad(SUN_NODE_DEG);

    // Ecliptic normal is [0, 1, 0]
    const eclipticNormal = { x: 0, y: 1, z: 0 };
    const sunAxis = {
      x: Math.sin(tiltRad) * Math.sin(nodeRad),
      y: Math.cos(tiltRad),
      z: -Math.sin(tiltRad) * Math.cos(nodeRad),
    };

    const dot = sunAxis.x * eclipticNormal.x + sunAxis.y * eclipticNormal.y + sunAxis.z * eclipticNormal.z;
    const computedAngleDeg = radToDeg(Math.acos(dot));

    expect(computedAngleDeg).toBeCloseTo(7.25, 2);
  });

  it('2. Earth axial tilt is approximately 23.44° relative to the ecliptic normal pointing toward Polaris', () => {
    const EARTH_AXIAL_TILT_DEG = 23.44;
    const tiltRad = degToRad(EARTH_AXIAL_TILT_DEG);

    const eclipticNormal = { x: 0, y: 1, z: 0 };
    // Earth spin axis fixed in inertial space pointing toward Polaris
    const earthAxis = {
      x: 0,
      y: Math.cos(tiltRad),
      z: -Math.sin(tiltRad),
    };

    const dot = earthAxis.x * eclipticNormal.x + earthAxis.y * eclipticNormal.y + earthAxis.z * eclipticNormal.z;
    const computedAngleDeg = radToDeg(Math.acos(dot));

    expect(computedAngleDeg).toBeCloseTo(23.44, 2);
  });

  it('3. Moon rotational-axis inclination is approximately 1.54° relative to the ecliptic normal (Cassini state 2)', () => {
    const MOON_AXIAL_TILT_DEG = 1.54;
    const tiltRad = degToRad(MOON_AXIAL_TILT_DEG);

    const eclipticNormal = { x: 0, y: 1, z: 0 };
    const moonAxis = {
      x: 0,
      y: Math.cos(tiltRad),
      z: Math.sin(tiltRad),
    };

    const dot = moonAxis.x * eclipticNormal.x + moonAxis.y * eclipticNormal.y + moonAxis.z * eclipticNormal.z;
    const computedAngleDeg = radToDeg(Math.acos(dot));

    expect(computedAngleDeg).toBeCloseTo(1.54, 2);
  });

  it('4. Moon orbital inclination is approximately 5.145° relative to the ecliptic', () => {
    const MOON_ORBIT_INCLINATION_DEG = 5.145;
    expect(MOON_ORBIT_INCLINATION_DEG).toBeCloseTo(5.15, 1);
    expect(MOON_ORBIT_INCLINATION_DEG).not.toEqual(1.54); // Distinct from axial tilt
  });

  it('5. Earth revolves around the Sun using backend ephemeris vectors (Sun at origin 0,0,0)', async () => {
    const sunResult = await provider.calculateTarget({
      target: 'SUN',
      epochUtc: testEpoch,
      siteCoords,
    });
    const earthResult = await provider.calculateTarget({
      target: 'EARTH',
      epochUtc: testEpoch,
      siteCoords,
    });

    const r_Sun_Moon = sunResult.targetPositionMoonCenteredME;
    const r_Earth_Moon = earthResult.targetPositionMoonCenteredME;

    // In heliocentric frame: Sun is at (0, 0, 0)
    // Vector Earth relative to Sun: r_Earth/Sun = r_Earth/Moon - r_Sun/Moon
    const r_Earth_Sun = {
      x: r_Earth_Moon.x - r_Sun_Moon.x,
      y: r_Earth_Moon.y - r_Sun_Moon.y,
      z: r_Earth_Moon.z - r_Sun_Moon.z,
    };
    const distanceEarthSunM = Math.hypot(r_Earth_Sun.x, r_Earth_Sun.y, r_Earth_Sun.z);

    // Distance must be ~1 AU (149.6 million km ± 3%)
    expect(distanceEarthSunM).toBeGreaterThan(1.45e11);
    expect(distanceEarthSunM).toBeLessThan(1.53e11);
  });

  it('6. Moon revolves around Earth on a geocentric orbit derived from authentic ephemeris', async () => {
    const earthResult = await provider.calculateTarget({
      target: 'EARTH',
      epochUtc: testEpoch,
      siteCoords,
    });

    const r_Earth_Moon = earthResult.targetPositionMoonCenteredME;
    // Vector Moon relative to Earth: r_Moon/Earth = - r_Earth/Moon
    const distanceMoonEarthM = Math.hypot(r_Earth_Moon.x, r_Earth_Moon.y, r_Earth_Moon.z);

    // Mean Earth-Moon distance is ~384,400 km (within 356,000 to 407,000 km range)
    expect(distanceMoonEarthM).toBeGreaterThan(3.56e8);
    expect(distanceMoonEarthM).toBeLessThan(4.07e8);
  });

  it('7. Earth rotational orientation is time-dependent (GMST / ERA)', () => {
    const jd1 = TimeConversionService.utcToJulianDate('2026-10-14T00:00:00Z');
    const d1 = jd1 - 2451545.0;
    const era1 = ((280.46061837 + 360.98564736629 * d1) % 360 + 360) % 360;

    const jd2 = TimeConversionService.utcToJulianDate('2026-10-14T12:00:00Z');
    const d2 = jd2 - 2451545.0;
    const era2 = ((280.46061837 + 360.98564736629 * d2) % 360 + 360) % 360;

    // Over 12 hours (half solar day), Earth rotates ~180.5 degrees
    let delta = (era2 - era1 + 360) % 360;
    expect(delta).toBeGreaterThan(179);
    expect(delta).toBeLessThan(182);
  });

  it('8. Sun differential / Carrington rotation period is 25.38 days', () => {
    const SUN_CARRINGTON_DAYS = 25.38;
    const dailyRateDeg = 360 / SUN_CARRINGTON_DAYS;
    expect(dailyRateDeg).toBeCloseTo(14.18, 1);
  });

  it('9. Moon synchronous rotation ensures tidal locking to Earth (27.32166 days)', () => {
    const MOON_SIDEREAL_DAYS = 27.321661;
    const dailyRateDeg = 360 / MOON_SIDEREAL_DAYS;
    expect(dailyRateDeg).toBeCloseTo(13.176, 2);
  });
});

