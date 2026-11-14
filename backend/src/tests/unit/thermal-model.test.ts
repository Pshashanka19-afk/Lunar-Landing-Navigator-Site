import { describe, it, expect } from 'vitest';
import {
  ThermalModelService,
  DEFAULT_THERMAL_PARAMETERS,
  SOLAR_CONSTANT_AT_1AU_W_M2,
} from '../../services/thermal/thermal-model.service';
import { SCIENTIFIC_CONSTANTS } from '../../config/scientific-config';

const AU = SCIENTIFIC_CONSTANTS.ASTRONOMICAL_UNIT_M;
const params = ThermalModelService.resolveParameters();

describe('ThermalModelService', () => {
  it('returns the solar constant at 1 AU and scales with inverse square distance', () => {
    expect(ThermalModelService.solarFluxAtDistance(AU)).toBeCloseTo(SOLAR_CONSTANT_AT_1AU_W_M2, 6);
    expect(ThermalModelService.solarFluxAtDistance(2 * AU)).toBeCloseTo(SOLAR_CONSTANT_AT_1AU_W_M2 / 4, 6);
  });

  it('gives a subsolar equilibrium temperature near 386 K with default parameters', () => {
    const r = ThermalModelService.calculateSurfaceTemperature(
      { sunDistanceMeters: AU, cosineIncidence: 1, isDirectlyIlluminated: true },
      params
    );
    expect(r.regime).toBe('SUNLIT');
    expect(r.surfaceTemperatureK).toBeGreaterThan(380);
    expect(r.surfaceTemperatureK).toBeLessThan(392);
    expect(r.surfaceTemperatureC).toBeCloseTo(r.surfaceTemperatureK - 273.15, 6);
  });

  it('falls back to the night temperature when shadowed or facing away', () => {
    const shadow = ThermalModelService.calculateSurfaceTemperature(
      { sunDistanceMeters: AU, cosineIncidence: 0.8, isDirectlyIlluminated: false },
      params
    );
    expect(shadow.regime).toBe('NIGHT_OR_SHADOW');
    expect(shadow.surfaceTemperatureK).toBe(DEFAULT_THERMAL_PARAMETERS.nightTemperatureK);

    const away = ThermalModelService.calculateSurfaceTemperature(
      { sunDistanceMeters: AU, cosineIncidence: -0.2, isDirectlyIlluminated: true },
      params
    );
    expect(away.regime).toBe('NIGHT_OR_SHADOW');
  });

  it('increases monotonically with cos(incidence) and never drops below the night floor', () => {
    const t = (mu: number) =>
      ThermalModelService.calculateSurfaceTemperature(
        { sunDistanceMeters: AU, cosineIncidence: mu, isDirectlyIlluminated: true },
        params
      ).surfaceTemperatureK;
    expect(t(0.1)).toBeGreaterThan(params.nightTemperatureK);
    expect(t(0.5)).toBeGreaterThan(t(0.1));
    expect(t(1.0)).toBeGreaterThan(t(0.5));
  });

  it('honours a custom night temperature', () => {
    const cold = ThermalModelService.resolveParameters({ nightTemperatureK: 40 });
    const r = ThermalModelService.calculateSurfaceTemperature(
      { sunDistanceMeters: AU, cosineIncidence: 0, isDirectlyIlluminated: false },
      cold
    );
    expect(r.surfaceTemperatureK).toBe(40);
  });

  it('rejects physically invalid parameters', () => {
    expect(() => ThermalModelService.resolveParameters({ bondAlbedo: 1 })).toThrow();
    expect(() => ThermalModelService.resolveParameters({ emissivity: 0 })).toThrow();
    expect(() => ThermalModelService.resolveParameters({ nightTemperatureK: -5 })).toThrow();
    expect(() => ThermalModelService.solarFluxAtDistance(0)).toThrow();
  });
});
