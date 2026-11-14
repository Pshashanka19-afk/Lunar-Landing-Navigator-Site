import { IDemProvider, DemMetadata, DemSubgridResult } from './dem.interface';
import { degToRad, radToDeg, normalizeDegrees } from '../../utils/angles';
import { SCIENTIFIC_CONSTANTS } from '../../config/scientific-config';

export class SyntheticDemFixture implements IDemProvider {
  public readonly id: string;
  public readonly isSynthetic = true;

  private width = 35000;
  private height = 35000;
  private pixelSpacing = 20.0; // 20m pixel spacing gives 350km radius from South Pole
  private elevationFunc: (x: number, y: number) => number | null;
  private metadataDescription: string;

  constructor(
    id: string,
    metadataDescription: string,
    elevationFunc: (x: number, y: number) => number | null
  ) {
    this.id = id;
    this.metadataDescription = metadataDescription;
    this.elevationFunc = elevationFunc;
  }

  public async isReady(): Promise<boolean> {
    return true;
  }

  public async getMetadata(): Promise<DemMetadata> {
    const halfWidth = (this.width * this.pixelSpacing) / 2;
    const halfHeight = (this.height * this.pixelSpacing) / 2;

    return {
      id: this.id,
      source: `Synthetic Test Fixture (${this.metadataDescription}) - NOT real lunar terrain`,
      type: 'SYNTHETIC_FIXTURE',
      width: this.width,
      height: this.height,
      pixelSpacingMeters: { x: this.pixelSpacing, y: this.pixelSpacing },
      effectiveResolutionMeters: this.pixelSpacing,
      crs: 'Lunar South Pole Polar Stereographic (Center: 90S, 0E)',
      elevationUnits: 'meters',
      verticalReference: '1737400m sphere reference datum',
      bounds: {
        minX: -halfWidth,
        maxX: halfWidth,
        minY: -halfHeight,
        maxY: halfHeight,
        minLat: -90.0,
        maxLat: -80.0,
        minLon: -180.0,
        maxLon: 180.0,
      },
      noDataValue: -32767,
    };
  }

  public async isPointCovered(xMeters: number, yMeters: number): Promise<boolean> {
    const halfWidth = (this.width * this.pixelSpacing) / 2;
    const halfHeight = (this.height * this.pixelSpacing) / 2;
    return (
      xMeters >= -halfWidth &&
      xMeters <= halfWidth &&
      yMeters >= -halfHeight &&
      yMeters <= halfHeight
    );
  }

  public async getElevationAt(xMeters: number, yMeters: number): Promise<number | null> {
    if (!(await this.isPointCovered(xMeters, yMeters))) {
      return null;
    }
    return this.elevationFunc(xMeters, yMeters);
  }

  public async getElevationAtLatLon(latDeg: number, lonDeg: number): Promise<number | null> {
    const { x, y } = this.latLonToProjected(latDeg, lonDeg);
    return this.getElevationAt(x, y);
  }

  /**
   * Lunar South Pole Polar Stereographic projection:
   * Standard for NASA LOLA South Pole products.
   */
  public latLonToProjected(latDeg: number, lonDeg: number): { x: number; y: number } {
    const R = SCIENTIFIC_CONSTANTS.MOON_MEAN_RADIUS_M;
    const colatRad = degToRad(90.0 + latDeg); // colatitude from South Pole
    const lonRad = degToRad(lonDeg);

    const rho = 2.0 * R * Math.tan(colatRad / 2.0);
    const x = rho * Math.sin(lonRad);
    const y = -rho * Math.cos(lonRad);

    return { x, y };
  }

  public projectedToLatLon(x: number, y: number): { latDeg: number; lonDeg: number } {
    const R = SCIENTIFIC_CONSTANTS.MOON_MEAN_RADIUS_M;
    const rho = Math.hypot(x, y);

    if (rho < 1e-12) {
      return { latDeg: -90.0, lonDeg: 0.0 };
    }

    const colatRad = 2.0 * Math.atan(rho / (2.0 * R));
    const latDeg = radToDeg(colatRad) - 90.0;
    const lonDeg = normalizeDegrees(radToDeg(Math.atan2(x, -y)));

    return { latDeg, lonDeg };
  }

  public async getTerrainSubgrid(
    centerX: number,
    centerY: number,
    radiusMeters: number,
    gridDimension = 64
  ): Promise<DemSubgridResult> {
    const minX = centerX - radiusMeters;
    const maxX = centerX + radiusMeters;
    const minY = centerY - radiusMeters;
    const maxY = centerY + radiusMeters;
    const stepMeters = (radiusMeters * 2) / Math.max(1, gridDimension - 1);

    const grid: number[][] = [];
    let minElevation = Infinity;
    let maxElevation = -Infinity;
    let sumElevation = 0;
    let validCount = 0;

    for (let r = 0; r < gridDimension; r++) {
      const y = maxY - r * stepMeters;
      const row: number[] = [];
      for (let c = 0; c < gridDimension; c++) {
        const x = minX + c * stepMeters;
        const elev = await this.getElevationAt(x, y);
        if (elev !== null && Number.isFinite(elev)) {
          row.push(elev);
          if (elev < minElevation) minElevation = elev;
          if (elev > maxElevation) maxElevation = elev;
          sumElevation += elev;
          validCount++;
        } else {
          row.push(0);
        }
      }
      grid.push(row);
    }

    const totalCount = gridDimension * gridDimension;
    return {
      grid,
      width: gridDimension,
      height: gridDimension,
      stepMeters,
      bounds: { minX, maxX, minY, maxY },
      minElevation: Number.isFinite(minElevation) ? minElevation : 0,
      maxElevation: Number.isFinite(maxElevation) ? maxElevation : 0,
      meanElevation: validCount > 0 ? sumElevation / validCount : 0,
      coverageRatio: validCount / totalCount,
    };
  }

  /**
   * Factory for a perfectly flat synthetic DEM at elevation z0.
   */
  public static createFlatDem(z0 = 0.0): SyntheticDemFixture {
    return new SyntheticDemFixture('synthetic-flat', `Flat Plane at ${z0}m`, () => z0);
  }

  /**
   * Factory for a planar tilted DEM:
   * z(x, y) = z0 + p*x + q*y
   * where p = dz/dx (Eastward slope) and q = dz/dy (Northward slope).
   */
  public static createTiltedDem(z0 = 0.0, p = 0.1, q = 0.0): SyntheticDemFixture {
    return new SyntheticDemFixture(
      'synthetic-tilted',
      `Tilted Plane (p=${p}, q=${q})`,
      (x, y) => z0 + p * x + q * y
    );
  }

  /**
   * Factory for a synthetic obstacle ridge:
   * At a given azimuth and distance, produces a peak ridge obstacle of given height.
   */
  public static createRidgeDem(
    baseElevation = 0.0,
    ridgeAzimuthDeg = 90.0,
    ridgeDistanceMeters = 500.0,
    ridgeHeightMeters = 100.0,
    ridgeWidthMeters = 50.0
  ): SyntheticDemFixture {
    const azRad = degToRad(ridgeAzimuthDeg);
    const ridgeX = ridgeDistanceMeters * Math.sin(azRad);
    const ridgeY = ridgeDistanceMeters * Math.cos(azRad);

    return new SyntheticDemFixture(
      'synthetic-ridge',
      `Obstacle Ridge at Azimuth ${ridgeAzimuthDeg}° (${ridgeHeightMeters}m high at ${ridgeDistanceMeters}m)`,
      (x, y) => {
        const distFromCenter = Math.hypot(x - ridgeX, y - ridgeY);
        if (distFromCenter < ridgeWidthMeters) {
          const bump = ridgeHeightMeters * Math.cos((distFromCenter / ridgeWidthMeters) * (Math.PI / 2));
          return baseElevation + bump;
        }
        return baseElevation;
      }
    );
  }
}
