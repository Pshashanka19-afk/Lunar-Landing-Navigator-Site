import { describe, it, expect } from 'vitest';
import { AnalyticalEphemerisProvider } from '../../services/ephemeris/analytical.provider';
import { SpiceProvider } from '../../services/ephemeris/spice.provider';
import { DEFAULT_DEMO_SITES } from '../../config/scientific-config';
import { ScientificResourceUnavailableError } from '../../types/errors';

describe('Ephemeris providers tests', () => {
  const shackletonSite = {
    latitudeDeg: DEFAULT_DEMO_SITES[0].latitudeDeg,
    longitudeDeg: DEFAULT_DEMO_SITES[0].longitudeDeg,
    elevationMeters: DEFAULT_DEMO_SITES[0].elevationMeters,
  };

  it('calculates Sun geometry at Shackleton Crater for a valid epoch', async () => {
    const provider = new AnalyticalEphemerisProvider();
    const result = await provider.calculateTarget({
      target: 'SUN',
      epochUtc: '2026-10-29T12:00:00Z',
      siteCoords: shackletonSite,
      observerHeightMeters: 2.0,
    });

    expect(result.target).toBe('SUN');
    expect(result.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(result.azimuthDeg).toBeLessThan(360);
    // At the lunar South pole, Sun elevation is near horizontal (within ~ +/- 2 degrees)
    expect(result.elevationDeg).toBeGreaterThan(-5);
    expect(result.elevationDeg).toBeLessThan(5);
    // Distance should be approximately 1 AU (1.47e11 - 1.52e11 m)
    expect(result.distanceMeters).toBeGreaterThan(1.4e11);
    expect(result.distanceMeters).toBeLessThan(1.6e11);
    expect(result.provenance.providerName).toBe(provider.name);
  });

  it('calculates Earth geometry at Shackleton Crater for a valid epoch', async () => {
    const provider = new AnalyticalEphemerisProvider();
    const result = await provider.calculateTarget({
      target: 'EARTH',
      epochUtc: '2026-10-29T12:00:00Z',
      siteCoords: shackletonSite,
      observerHeightMeters: 2.0,
    });

    expect(result.target).toBe('EARTH');
    expect(result.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(result.azimuthDeg).toBeLessThan(360);
    // Earth distance is around 3.8e8 m
    expect(result.distanceMeters).toBeGreaterThan(3.5e8);
    expect(result.distanceMeters).toBeLessThan(4.2e8);
  });

  it('SpiceProvider reports unready when kernels are not configured', async () => {
    const provider = new SpiceProvider('./non-existent-kernel-dir', true);
    const ready = await provider.isReady();
    expect(ready).toBe(false);

    const details = await provider.getReadinessDetails();
    expect(details.ready).toBe(false);
    expect(details.missingKernels.length).toBeGreaterThan(0);

    await expect(
      provider.calculateTarget({
        target: 'SUN',
        epochUtc: '2026-10-29T12:00:00Z',
        siteCoords: shackletonSite,
      })
    ).rejects.toThrow(ScientificResourceUnavailableError);
  });
});
