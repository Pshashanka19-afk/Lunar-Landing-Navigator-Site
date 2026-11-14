import { describe, it, expect } from 'vitest';
import { WindowCalculationService } from '../../services/windows/window-calculation.service';
import { MockEphemerisProvider } from '../../services/ephemeris/mock.provider';
import { SyntheticDemFixture } from '../../services/terrain/synthetic-dem.fixture';

describe('Time-dependent visibility window tests', () => {
  const flatDem = SyntheticDemFixture.createFlatDem(0.0);
  const siteCoords = { latitudeDeg: -89.5, longitudeDeg: 0.0, elevationMeters: 0 };

  it('calculates continuous visibility windows when sun and earth are continuously clear', async () => {
    // Mock provider with Sun at 10 deg elevation (clearing flat horizon)
    // and Earth at 15 deg elevation
    const mockEphem = new MockEphemerisProvider(
      { azimuthDeg: 120.0, elevationDeg: 10.0 },
      { azimuthDeg: 0.0, elevationDeg: 15.0 }
    );

    const startTime = '2026-10-29T00:00:00Z';
    const endTime = '2026-10-29T02:00:00Z'; // 2 hours

    const result = await WindowCalculationService.calculateWindows(mockEphem, flatDem, {
      siteCoords,
      startTimeUtc: startTime,
      endTimeUtc: endTime,
      stepSeconds: 600, // 10 minutes
    });

    expect(result.windows.sunWindows.length).toBe(1);
    expect(result.windows.earthWindows.length).toBe(1);
    expect(result.windows.bothWindows.length).toBe(1);

    expect(result.summary.sunlightTotalHours).toBeCloseTo(2.0, 1);
    expect(result.summary.earthVisibilityTotalHours).toBeCloseTo(2.0, 1);
    expect(result.summary.bothVisibilityTotalHours).toBeCloseTo(2.0, 1);
  });

  it('detects blocked windows when sun is below horizon', async () => {
    // Sun at -5 deg (below local horizon)
    const mockEphem = new MockEphemerisProvider(
      { azimuthDeg: 120.0, elevationDeg: -5.0 },
      { azimuthDeg: 0.0, elevationDeg: 15.0 }
    );

    const result = await WindowCalculationService.calculateWindows(mockEphem, flatDem, {
      siteCoords,
      startTimeUtc: '2026-10-29T00:00:00Z',
      endTimeUtc: '2026-10-29T01:00:00Z',
      stepSeconds: 600,
    });

    expect(result.windows.sunWindows.length).toBe(0);
    expect(result.summary.sunlightTotalHours).toBe(0);
    expect(result.windows.bothWindows.length).toBe(0);
    // Earth is still visible
    expect(result.windows.earthWindows.length).toBe(1);
    expect(result.summary.earthVisibilityTotalHours).toBeCloseTo(1.0, 1);
  });

  it('rejects invalid or inverted time intervals', async () => {
    const mockEphem = new MockEphemerisProvider();
    await expect(
      WindowCalculationService.calculateWindows(mockEphem, flatDem, {
        siteCoords,
        startTimeUtc: '2026-10-29T12:00:00Z',
        endTimeUtc: '2026-10-29T00:00:00Z', // start after end
      })
    ).rejects.toThrow();
  });
});
