import { describe, it, expect } from 'vitest';
import { LunarFrameService } from '../../services/coordinates/lunar-frame.service';
import { LocalEnuService } from '../../services/coordinates/local-enu.service';
import { SCIENTIFIC_CONSTANTS } from '../../config/scientific-config';
import { magnitude, dot } from '../../utils/vectors';

describe('Lunar coordinate and ENU frame tests', () => {
  it('converts Equator/Prime Meridian to Cartesian and back', () => {
    const coords = { latitudeDeg: 0, longitudeDeg: 0, elevationMeters: 100 };
    const cart = LunarFrameService.selenographicToCartesianME(coords);

    expect(cart.x).toBeCloseTo(SCIENTIFIC_CONSTANTS.MOON_MEAN_RADIUS_M + 100, 1);
    expect(cart.y).toBeCloseTo(0, 1);
    expect(cart.z).toBeCloseTo(0, 1);

    const back = LunarFrameService.cartesianMEToSelenographic(cart);
    expect(back.latitudeDeg).toBeCloseTo(0, 4);
    expect(back.longitudeDeg).toBeCloseTo(0, 4);
    expect(back.elevationMeters).toBeCloseTo(100, 1);
  });

  it('converts North and South pole positions accurately', () => {
    const northPole = { latitudeDeg: 90, longitudeDeg: 0, elevationMeters: 0 };
    const npCart = LunarFrameService.selenographicToCartesianME(northPole);
    expect(npCart.x).toBeCloseTo(0, 1);
    expect(npCart.y).toBeCloseTo(0, 1);
    expect(npCart.z).toBeCloseTo(SCIENTIFIC_CONSTANTS.MOON_MEAN_RADIUS_M, 1);

    const southPole = { latitudeDeg: -90, longitudeDeg: 0, elevationMeters: 0 };
    const spCart = LunarFrameService.selenographicToCartesianME(southPole);
    expect(spCart.x).toBeCloseTo(0, 1);
    expect(spCart.y).toBeCloseTo(0, 1);
    expect(spCart.z).toBeCloseTo(-SCIENTIFIC_CONSTANTS.MOON_MEAN_RADIUS_M, 1);
  });

  it('verifies that the ENU basis is orthonormal', () => {
    const site = { latitudeDeg: -89.78, longitudeDeg: 125.4, elevationMeters: 1250 };
    const basis = LocalEnuService.computeEnuBasis(site);

    // Magnitudes should be 1
    expect(magnitude(basis.east)).toBeCloseTo(1.0, 6);
    expect(magnitude(basis.north)).toBeCloseTo(1.0, 6);
    expect(magnitude(basis.up)).toBeCloseTo(1.0, 6);

    // Dot products between different basis vectors should be 0
    expect(dot(basis.east, basis.north)).toBeCloseTo(0.0, 6);
    expect(dot(basis.east, basis.up)).toBeCloseTo(0.0, 6);
    expect(dot(basis.north, basis.up)).toBeCloseTo(0.0, 6);
  });

  it('transforms vector from ME to ENU and back with identity roundtrip', () => {
    const site = { latitudeDeg: -85.0, longitudeDeg: 45.0, elevationMeters: 500 };
    const testVectorME = { x: 12345.6, y: -65432.1, z: 98765.4 };

    const enu = LocalEnuService.vectorMEToEnu(testVectorME, site);
    const restoredME = LocalEnuService.vectorEnuToME(enu, site);

    expect(restoredME.x).toBeCloseTo(testVectorME.x, 3);
    expect(restoredME.y).toBeCloseTo(testVectorME.y, 3);
    expect(restoredME.z).toBeCloseTo(testVectorME.z, 3);
  });
});
