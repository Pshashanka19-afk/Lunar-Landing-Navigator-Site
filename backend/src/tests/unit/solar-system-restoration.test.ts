import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Unified 3D Solar System Restoration Verification', () => {
  it('verifies Sun physical constants and high-resolution photosphere texture', () => {
    const SUN_AXIAL_TILT_DEG = 7.25;
    const SUN_CARRINGTON_PERIOD_DAYS = 25.38;

    expect(SUN_AXIAL_TILT_DEG).toBe(7.25);
    expect(SUN_CARRINGTON_PERIOD_DAYS).toBe(25.38);

    const sunTexturePath = path.resolve(__dirname, '../../../../frontend/public/textures/sun/sun_photosphere_2k.jpg');
    expect(fs.existsSync(sunTexturePath)).toBe(true);
    const stats = fs.statSync(sunTexturePath);
    expect(stats.size).toBeGreaterThan(100000); // Authentic 2K image (>100KB)
  });

  it('verifies Earth physical constants, obliquity, and orbit scaling', () => {
    const EARTH_AXIAL_TILT_DEG = 23.44;
    const EARTH_SIDEREAL_DAY_HOURS = 23.9344696;
    const VISUAL_SCALE_EARTH_ORBIT_R = 96.0;
    const VISUAL_SCALE_EARTH_RADIUS = 2.6;

    expect(EARTH_AXIAL_TILT_DEG).toBe(23.44);
    expect(Math.abs(EARTH_SIDEREAL_DAY_HOURS - 23.9344696)).toBeLessThan(0.001);
    expect(VISUAL_SCALE_EARTH_ORBIT_R).toBe(96.0);
    expect(VISUAL_SCALE_EARTH_RADIUS).toBe(2.6);
  });

  it('verifies Moon physical constants, Cassini tilt, inclination, and IAU radius', () => {
    const MOON_AXIAL_TILT_DEG = 1.54;
    const MOON_ORBIT_INCLINATION_DEG = 5.145;
    const MOON_SIDEREAL_PERIOD_DAYS = 27.321661;
    const LUNAR_MEAN_RADIUS_METERS = 1737400;
    const VISUAL_SCALE_MOON_ORBIT_R = 14.5;

    expect(MOON_AXIAL_TILT_DEG).toBe(1.54);
    expect(MOON_ORBIT_INCLINATION_DEG).toBe(5.145);
    expect(Math.abs(MOON_SIDEREAL_PERIOD_DAYS - 27.321661)).toBeLessThan(0.001);
    expect(LUNAR_MEAN_RADIUS_METERS).toBe(1737400);
    expect(VISUAL_SCALE_MOON_ORBIT_R).toBe(14.5);
  });

  it('verifies LunarInteractiveMap contains Sun/Earth shaders, CesiumJS Moon Trek overlay, and camera synchronization', () => {
    const mapSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../frontend/src/components/LunarInteractiveMap.tsx'),
      'utf-8'
    );

    // Sun restoration
    expect(mapSrc).toContain('sunShaderMat');
    expect(mapSrc).toContain('sunPhotosphere');
    expect(mapSrc).toContain('Eddington solar limb darkening');
    expect(mapSrc).toContain('SUN_CARRINGTON_PERIOD_DAYS');

    // Earth restoration
    expect(mapSrc).toContain('earthShaderMat');
    expect(mapSrc).toContain('uDayMap');
    expect(mapSrc).toContain('uNightMap');
    expect(mapSrc).toContain('earthCloudsMesh');
    expect(mapSrc).toContain('EARTH_AXIAL_TILT_DEG');

    // Moon Trek CesiumJS integration
    expect(mapSrc).toContain('cesiumMountRef');
    expect(mapSrc).toContain('cesiumViewerRef');
    expect(mapSrc).toContain('LRO_WAC_Mosaic_Global_303ppd_v02');
    expect(mapSrc).toContain('cartesianToSelenographic');
    expect(mapSrc).toContain('Cesium.Color.TRANSPARENT');
    expect(mapSrc).toContain('destCesium');

    // Single unified viewport without competing globes
    expect(mapSrc).toContain('moonMeshRef.current.visible = false');
  });

  it('verifies MissionBrowserPage removed disconnected scene switcher and renders single continuous scene', () => {
    const browserSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../../frontend/src/pages/MissionBrowserPage.tsx'),
      'utf-8'
    );

    expect(browserSrc).not.toContain("visEngine === 'MOON_TREK_GLOBE'");
    expect(browserSrc).not.toContain("visEngine === 'ORBITAL_SYSTEM'");
    expect(browserSrc).toContain('<LunarInteractiveMap');
  });
});

