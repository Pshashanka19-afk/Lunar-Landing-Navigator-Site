import { describe, it, expect } from 'vitest';
import { SiteScoringService } from '../../services/comparison/site-scoring.service';
import { MockEphemerisProvider } from '../../services/ephemeris/mock.provider';
import { SyntheticDemFixture } from '../../services/terrain/synthetic-dem.fixture';

describe('Site comparison and scoring service tests', () => {
  const flatDem = SyntheticDemFixture.createFlatDem(100.0);
  const mockEphem = new MockEphemerisProvider(
    { azimuthDeg: 120.0, elevationDeg: 10.0 }, // Sun visible
    { azimuthDeg: 0.0, elevationDeg: 15.0 }    // Earth visible
  );

  const candidateSites = [
    {
      id: 'site-a',
      name: 'Site Alpha',
      latitudeDeg: -89.5,
      longitudeDeg: 0.0,
      elevationMeters: 100,
    },
    {
      id: 'site-b',
      name: 'Site Beta',
      latitudeDeg: -88.0,
      longitudeDeg: 45.0,
      elevationMeters: 100,
    },
  ];

  it('evaluates pass/fail requirements and produces non-empty comparison ranking', async () => {
    const res = await SiteScoringService.compareSites(
      mockEphem,
      flatDem,
      candidateSites,
      {
        minSunlightHours: 1.0,
        maxSlopeDeg: 10.0,
        weights: {
          sunlightDuration: 40,
          slopeFlatness: 60,
        },
      },
      '2026-10-29T00:00:00Z',
      '2026-10-29T02:00:00Z',
      600
    );

    expect(res.sites.length).toBe(2);
    expect(res.ranking.length).toBe(2);
    expect(res.disclaimer).toBeDefined();

    for (const site of res.sites) {
      expect(site.overallStatus).toBe('ALL_PASSED');
      expect(site.score).toBeDefined();
      expect(site.score).toBeGreaterThan(0);
      expect(site.requirementChecks.length).toBe(2);
    }
  });

  it('detects constraint violation when requirement is not met', async () => {
    const res = await SiteScoringService.compareSites(
      mockEphem,
      flatDem,
      [candidateSites[0]],
      {
        minSunlightHours: 100.0, // impossible within a 2-hour interval
      },
      '2026-10-29T00:00:00Z',
      '2026-10-29T02:00:00Z',
      600
    );

    expect(res.sites[0].overallStatus).toBe('CONSTRAINTS_VIOLATED');
    expect(res.sites[0].reasons.length).toBeGreaterThan(0);
  });
});
