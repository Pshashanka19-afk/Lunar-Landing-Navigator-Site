export interface DemMetadata {
  id: string;
  source: string;
  type: 'GEOTIFF' | 'SYNTHETIC_FIXTURE';
  width: number;
  height: number;
  pixelSpacingMeters: { x: number; y: number };
  effectiveResolutionMeters: number;
  crs: string;
  elevationUnits: 'meters';
  verticalReference: string;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minLat?: number;
    maxLat?: number;
    minLon?: number;
    maxLon?: number;
  };
  noDataValue: number;
}

export interface DemGridSample {
  centerX: number;
  centerY: number;
  stepMeters: number;
  rows: number;
  cols: number;
  elevations: (number | null)[][];
  isComplete: boolean;
}

export interface DemSubgridResult {
  grid: number[][];
  width: number;
  height: number;
  stepMeters: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  minElevation: number;
  maxElevation: number;
  meanElevation: number;
  coverageRatio: number;
}

export interface IDemProvider {
  readonly id: string;
  readonly isSynthetic: boolean;
  isReady(): Promise<boolean>;
  getMetadata(): Promise<DemMetadata>;
  getElevationAt(xMeters: number, yMeters: number): Promise<number | null>;
  getElevationAtLatLon(latDeg: number, lonDeg: number): Promise<number | null>;
  latLonToProjected(latDeg: number, lonDeg: number): { x: number; y: number };
  projectedToLatLon(x: number, y: number): { latDeg: number; lonDeg: number };
  isPointCovered(xMeters: number, yMeters: number): Promise<boolean>;
  getTerrainSubgrid(
    centerX: number,
    centerY: number,
    radiusMeters: number,
    gridDimension?: number
  ): Promise<DemSubgridResult>;
}
