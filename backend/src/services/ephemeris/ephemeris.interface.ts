import { Vector3D } from '../../utils/vectors';
import { LunarSiteCoordinates } from '../coordinates/lunar-frame.service';

export type EphemerisTarget = 'SUN' | 'EARTH';

export interface EphemerisRequest {
  target: EphemerisTarget;
  epochUtc: string;
  siteCoords: LunarSiteCoordinates;
  observerHeightMeters?: number;
}

export interface EphemerisCalculationProvenance {
  providerName: string;
  ephemerisModel: string;
  kernels?: string[];
  aberrationCorrection: string;
  referenceFrame: string;
  timeStandard: string;
}

export interface EphemerisCalculationResult {
  target: EphemerisTarget;
  epochUtc: string;
  ephemerisTimeSeconds: number;
  targetPositionMoonCenteredME: Vector3D;
  targetVelocityMoonCenteredME?: Vector3D;
  topocentricVectorME: Vector3D;
  topocentricVelocityME?: Vector3D;
  earthRotationAngleDeg?: number;
  localEnuVector: Vector3D;
  azimuthDeg: number;
  elevationDeg: number;
  distanceMeters: number;
  frame: string;
  units: {
    angles: 'degrees';
    distance: 'meters';
    velocity?: 'meters_per_second';
  };
  provenance: EphemerisCalculationProvenance;
}

export interface EphemerisProviderReadiness {
  ready: boolean;
  providerName: string;
  message: string;
  availableKernels: string[];
  missingKernels: string[];
  supportedCoverageYears?: { start: number; end: number };
}

export interface IEphemerisProvider {
  readonly name: string;
  isReady(): Promise<boolean>;
  getReadinessDetails(): Promise<EphemerisProviderReadiness>;
  calculateTarget(req: EphemerisRequest): Promise<EphemerisCalculationResult>;
}
