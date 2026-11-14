import { describe, it, expect } from 'vitest';
import { EphemerisFactory } from '../../services/ephemeris/ephemeris.factory';
import { SpiceProvider } from '../../services/ephemeris/spice.provider';
import { DemFactory } from '../../services/terrain/dem.factory';
import { DemService } from '../../services/terrain/dem.service';
import { ScientificResourceUnavailableError } from '../../types/errors';

describe('Phase F: Scientific Fallback Prevention Tests', () => {
  const testSite = {
    latitudeDeg: -89.78,
    longitudeDeg: 125.4,
    elevationMeters: 1250,
  };

  it('1. Selecting SPICE without required kernels throws 503 and does NOT produce fake output', async () => {
    const spiceProvider = new SpiceProvider('./data/kernels/non-existent-dir', true);
    const ready = await spiceProvider.isReady();
    expect(ready).toBe(false);

    await expect(
      spiceProvider.calculateTarget({
        target: 'SUN',
        epochUtc: '2026-10-29T12:00:00Z',
        siteCoords: testSite,
      })
    ).rejects.toThrow(ScientificResourceUnavailableError);
  });

  it('2. Selecting a real DEM without a configured DEM file does NOT silently substitute synthetic terrain', async () => {
    // DemService with no synthetic fallback configured
    const missingDemService = new DemService('./data/dem/non-existent-dem.tif', false);
    const ready = await missingDemService.isReady();
    expect(ready).toBe(false);

    // Requesting metadata or elevation must throw ScientificResourceUnavailableError
    await expect(missingDemService.getMetadata()).rejects.toThrow(ScientificResourceUnavailableError);
    await expect(missingDemService.getElevationAt(0, 0)).rejects.toThrow(
      ScientificResourceUnavailableError
    );
  });

  it('3. Mock and analytical providers identify themselves with correct provenance', async () => {
    const analytical = EphemerisFactory.getAnalyticalProvider();
    const mock = EphemerisFactory.getMockProvider();

    const analyticalResult = await analytical.calculateTarget({
      target: 'SUN',
      epochUtc: '2026-10-29T12:00:00Z',
      siteCoords: testSite,
    });
    expect(analyticalResult.provenance.providerName).toContain('Analytical');
    expect(analyticalResult.provenance.ephemerisModel).toContain('IAU');

    const mockResult = await mock.calculateTarget({
      target: 'SUN',
      epochUtc: '2026-10-29T12:00:00Z',
      siteCoords: testSite,
    });
    expect(mockResult.provenance.providerName).toContain('Mock');
    expect(mockResult.provenance.ephemerisModel).toContain('Deterministic Test Fixture');
  });

  it('4. Synthetic DEM fixture explicitly declares isSynthetic: true in metadata', async () => {
    const syntheticDem = DemFactory.getSyntheticFixture();
    const meta = await syntheticDem.getMetadata();

    expect(meta.type).toBe('SYNTHETIC_FIXTURE');
    expect(syntheticDem.isSynthetic).toBe(true);
    expect(meta.source).toContain('Synthetic Test Fixture');
  });
});
