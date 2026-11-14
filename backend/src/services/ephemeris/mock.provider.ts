import {
  IEphemerisProvider,
  EphemerisRequest,
  EphemerisCalculationResult,
  EphemerisProviderReadiness,
} from './ephemeris.interface';
import { azElToEnuVector } from '../../utils/angles';
import { LocalEnuService } from '../coordinates/local-enu.service';
import { TimeConversionService } from './time-conversion.service';
import { scale } from '../../utils/vectors';

export class MockEphemerisProvider implements IEphemerisProvider {
  public readonly name = 'Deterministic Mock Ephemeris Provider (Test Fixture Only)';

  private fixedSunAzEl: { azimuthDeg: number; elevationDeg: number };
  private fixedEarthAzEl: { azimuthDeg: number; elevationDeg: number };

  constructor(
    sunAzEl = { azimuthDeg: 120.0, elevationDeg: 5.0 },
    earthAzEl = { azimuthDeg: 0.0, elevationDeg: 15.0 }
  ) {
    this.fixedSunAzEl = sunAzEl;
    this.fixedEarthAzEl = earthAzEl;
  }

  public setSunPosition(azimuthDeg: number, elevationDeg: number): void {
    this.fixedSunAzEl = { azimuthDeg, elevationDeg };
  }

  public setEarthPosition(azimuthDeg: number, elevationDeg: number): void {
    this.fixedEarthAzEl = { azimuthDeg, elevationDeg };
  }

  public async isReady(): Promise<boolean> {
    return true;
  }

  public async getReadinessDetails(): Promise<EphemerisProviderReadiness> {
    return {
      ready: true,
      providerName: this.name,
      message: 'Deterministic mock ephemeris provider for testing and validation.',
      availableKernels: ['test-mock-kernel'],
      missingKernels: [],
    };
  }

  public async calculateTarget(req: EphemerisRequest): Promise<EphemerisCalculationResult> {
    const etSeconds = TimeConversionService.utcToEphemerisTime(req.epochUtc);
    const { azimuthDeg, elevationDeg } =
      req.target === 'SUN' ? this.fixedSunAzEl : this.fixedEarthAzEl;

    const unitEnu = azElToEnuVector(azimuthDeg, elevationDeg);
    const distanceMeters = req.target === 'SUN' ? 1.496e11 : 3.844e8;
    const enuVector = scale(unitEnu, distanceMeters);

    const topocentricVectorME = LocalEnuService.vectorEnuToME(enuVector, req.siteCoords);

    return {
      target: req.target,
      epochUtc: req.epochUtc,
      ephemerisTimeSeconds: etSeconds,
      targetPositionMoonCenteredME: topocentricVectorME,
      topocentricVectorME,
      localEnuVector: enuVector,
      azimuthDeg,
      elevationDeg,
      distanceMeters,
      frame: 'LOCAL_ENU',
      units: {
        angles: 'degrees',
        distance: 'meters',
      },
      provenance: {
        providerName: this.name,
        ephemerisModel: 'Deterministic Test Fixture (Not for real flight operations)',
        kernels: ['mock-test-kernel'],
        aberrationCorrection: 'NONE',
        referenceFrame: 'MOON_ME',
        timeStandard: 'UTC',
      },
    };
  }
}
