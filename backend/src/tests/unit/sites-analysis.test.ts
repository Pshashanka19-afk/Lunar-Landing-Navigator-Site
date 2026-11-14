import { describe, it, expect, vi } from 'vitest';
import { SitesController } from '../../controllers/sites.controller';
import { Request, Response } from 'express';

describe('SitesController Unit Tests', () => {
  it('getDefaultSites returns all 8 default candidate landing sites', async () => {
    const req = {} as Request;
    let jsonResult: any = null;
    const res = {
      json: vi.fn((data) => {
        jsonResult = data;
        return res;
      }),
    } as unknown as Response;

    await SitesController.getDefaultSites(req, res);

    expect(jsonResult).toBeDefined();
    expect(jsonResult.success).toBe(true);
    expect(jsonResult.data.count).toBe(8);
    expect(jsonResult.data.demonstrationSites.length).toBe(8);
    const siteIds = jsonResult.data.demonstrationSites.map((s: any) => s.id);
    expect(siteIds).toContain('shackleton-connecting-ridge');
    expect(siteIds).toContain('malapert-massif');
    expect(siteIds).toContain('de-gerlache-rim');
  });

  it('getSiteById returns site data for an existing ID', async () => {
    const req = {
      params: { id: 'shackleton-connecting-ridge' },
    } as unknown as Request;
    let jsonResult: any = null;
    const res = {
      json: vi.fn((data) => {
        jsonResult = data;
        return res;
      }),
      status: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    await SitesController.getSiteById(req, res, next);

    expect(jsonResult).toBeDefined();
    expect(jsonResult.success).toBe(true);
    expect(jsonResult.data.id).toBe('shackleton-connecting-ridge');
    expect(jsonResult.data.name).toBe('Shackleton Crater - Connecting Ridge');
    expect(jsonResult.data.latitudeDeg).toBe(-89.78);
  });

  it('getSiteById returns 404 for a non-existent ID', async () => {
    const req = {
      params: { id: 'unknown-lunar-site' },
    } as unknown as Request;
    let jsonResult: any = null;
    let statusCode = 200;
    const res = {
      status: vi.fn((code) => {
        statusCode = code;
        return res;
      }),
      json: vi.fn((data) => {
        jsonResult = data;
        return res;
      }),
    } as unknown as Response;
    const next = vi.fn();

    await SitesController.getSiteById(req, res, next);

    expect(statusCode).toBe(404);
    expect(jsonResult.success).toBe(false);
    expect(jsonResult.error.code).toBe('SITE_NOT_FOUND');
  });

  it('getSiteAnalysis computes real topocentric ephemeris and solar geometry for Shackleton Ridge', async () => {
    const req = {
      body: {
        site: {
          id: 'shackleton-connecting-ridge',
          name: 'Shackleton Connecting Ridge',
          latitudeDeg: -89.74,
          longitudeDeg: 120.0,
          elevationMeters: 1450.0,
        },
        epochUtc: '2026-10-14T12:00:00Z',
        observerHeightMeters: 2.0,
      },
    } as Request;

    let jsonResult: any = null;
    const res = {
      json: vi.fn((data) => {
        jsonResult = data;
        return res;
      }),
      status: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn();

    await SitesController.getSiteAnalysis(req, res, next);

    expect(jsonResult).toBeDefined();
    expect(jsonResult.success).toBe(true);
    const analysis = jsonResult.data;

    // Check site
    expect(analysis.site.id).toBe('shackleton-connecting-ridge');
    expect(analysis.site.latitudeDeg).toBe(-89.74);

    // Check sun ephemeris calculations
    expect(analysis.sun).toBeDefined();
    expect(typeof analysis.sun.azimuthDeg).toBe('number');
    expect(typeof analysis.sun.elevationDeg).toBe('number');
    expect(typeof analysis.sun.relativeIncidenceFactor).toBe('number');
    expect(typeof analysis.sun.isDirectlyVisible).toBe('boolean');

    // Check earth ephemeris calculations
    expect(analysis.earth).toBeDefined();
    expect(typeof analysis.earth.azimuthDeg).toBe('number');
    expect(typeof analysis.earth.elevationDeg).toBe('number');
    expect(analysis.earth.distanceKm).toBeGreaterThan(350000);
    expect(analysis.earth.distanceKm).toBeLessThan(410000);

    // Check terrain metrics
    expect(analysis.terrain).toBeDefined();
    expect(typeof analysis.terrain.slopeDeg).toBe('number');
    expect(typeof analysis.terrain.aspectDeg).toBe('number');

    // Check 24-hour summary
    expect(analysis.next24HoursSummary).toBeDefined();
    expect(analysis.next24HoursSummary.sunlightTotalHours).toBeGreaterThanOrEqual(0);
    expect(analysis.next24HoursSummary.earthVisibilityTotalHours).toBeGreaterThanOrEqual(0);
  });
});
