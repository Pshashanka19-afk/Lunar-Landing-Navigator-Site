import { SCIENTIFIC_CONSTANTS } from '../../config/scientific-config';
import { ScientificValidationError } from '../../types/errors';

/**
 * Simple radiative-equilibrium surface temperature model.
 *
 * IMPORTANT: this is a first-order MODEL, not measured data and not a SPICE product.
 * It ignores thermal inertia, subsurface conduction, surface roughness and
 * scattered/thermal radiation from surrounding terrain. Expect large errors near
 * dawn/dusk, in cast shadow and in permanently shadowed regions. For measured
 * lunar surface temperatures use LRO Diviner products.
 */

export const SOLAR_CONSTANT_AT_1AU_W_M2 = 1361.0;
export const STEFAN_BOLTZMANN_W_M2_K4 = 5.670374419e-8;

export const DEFAULT_THERMAL_PARAMETERS = {
  /** Lunar Bond albedo (typical global value) */
  bondAlbedo: 0.12,
  /** Infrared emissivity of regolith */
  emissivity: 0.95,
  /**
   * Temperature assumed when the surface receives no direct sunlight (K).
   * 100 K is a rough low-latitude night value; polar nights and permanently
   * shadowed regions are much colder, so override it for polar sites.
   */
  nightTemperatureK: 100.0,
} as const;

export interface ThermalParameters {
  bondAlbedo: number;
  emissivity: number;
  nightTemperatureK: number;
}

export interface SurfaceTemperatureInput {
  /** Distance from the Sun to the site (m) */
  sunDistanceMeters: number;
  /** cos(incidence angle) between local surface normal and Sun direction */
  cosineIncidence: number;
  /** True only if the Sun clears the terrain horizon AND the surface faces the Sun */
  isDirectlyIlluminated: boolean;
}

export interface SurfaceTemperatureResult {
  surfaceTemperatureK: number;
  surfaceTemperatureC: number;
  solarFluxWm2: number;
  regime: 'SUNLIT' | 'NIGHT_OR_SHADOW';
}

export class ThermalModelService {
  public static resolveParameters(partial?: Partial<ThermalParameters>): ThermalParameters {
    const params: ThermalParameters = {
      bondAlbedo: partial?.bondAlbedo ?? DEFAULT_THERMAL_PARAMETERS.bondAlbedo,
      emissivity: partial?.emissivity ?? DEFAULT_THERMAL_PARAMETERS.emissivity,
      nightTemperatureK: partial?.nightTemperatureK ?? DEFAULT_THERMAL_PARAMETERS.nightTemperatureK,
    };

    if (!(params.bondAlbedo >= 0 && params.bondAlbedo < 1)) {
      throw new ScientificValidationError(`bondAlbedo must be in [0, 1). Received: ${params.bondAlbedo}`);
    }
    if (!(params.emissivity > 0 && params.emissivity <= 1)) {
      throw new ScientificValidationError(`emissivity must be in (0, 1]. Received: ${params.emissivity}`);
    }
    if (!(params.nightTemperatureK > 0)) {
      throw new ScientificValidationError(
        `nightTemperatureK must be > 0 K. Received: ${params.nightTemperatureK}`
      );
    }
    return params;
  }

  /** Solar flux at the given Sun distance (inverse-square scaling from 1 AU). */
  public static solarFluxAtDistance(sunDistanceMeters: number): number {
    if (!Number.isFinite(sunDistanceMeters) || sunDistanceMeters <= 0) {
      throw new ScientificValidationError(`Invalid Sun distance: ${sunDistanceMeters}`);
    }
    const ratio = SCIENTIFIC_CONSTANTS.ASTRONOMICAL_UNIT_M / sunDistanceMeters;
    return SOLAR_CONSTANT_AT_1AU_W_M2 * ratio * ratio;
  }

  /**
   * T = ( T_night^4 + S (1 - A) cos(i) / (eps * sigma) )^(1/4)   when directly illuminated
   * T = T_night                                                  otherwise
   *
   * Adding the night floor in the fourth-power sum keeps the result continuous
   * and never below the floor.
   */
  public static calculateSurfaceTemperature(
    input: SurfaceTemperatureInput,
    params: ThermalParameters
  ): SurfaceTemperatureResult {
    const solarFluxWm2 = this.solarFluxAtDistance(input.sunDistanceMeters);

    if (!input.isDirectlyIlluminated || input.cosineIncidence <= 0) {
      return {
        surfaceTemperatureK: params.nightTemperatureK,
        surfaceTemperatureC: params.nightTemperatureK - 273.15,
        solarFluxWm2,
        regime: 'NIGHT_OR_SHADOW',
      };
    }

    const mu = Math.min(1.0, input.cosineIncidence);
    const absorbed = (solarFluxWm2 * (1.0 - params.bondAlbedo) * mu) /
      (params.emissivity * STEFAN_BOLTZMANN_W_M2_K4);
    const T = Math.pow(Math.pow(params.nightTemperatureK, 4) + absorbed, 0.25);

    return {
      surfaceTemperatureK: T,
      surfaceTemperatureC: T - 273.15,
      solarFluxWm2,
      regime: 'SUNLIT',
    };
  }
}
