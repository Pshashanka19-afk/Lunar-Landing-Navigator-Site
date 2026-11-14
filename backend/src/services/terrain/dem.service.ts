import fs from 'fs';
import path from 'path';
import * as GeoTIFF from 'geotiff';
import { IDemProvider, DemMetadata, DemSubgridResult } from './dem.interface';
import { env } from '../../config/env';
import { logger } from '../../middleware/logger';
import { ScientificResourceUnavailableError } from '../../types/errors';
import { degToRad, radToDeg, normalizeDegrees } from '../../utils/angles';
import { SCIENTIFIC_CONSTANTS } from '../../config/scientific-config';
import { SyntheticDemFixture } from './synthetic-dem.fixture';

export class DemService implements IDemProvider {
  public readonly id = 'lola-dem-service';
  public readonly isSynthetic = false;

  private demPath: string;
  private tiffInstance: GeoTIFF.GeoTIFF | null = null;
  private imageInstance: GeoTIFF.GeoTIFFImage | null = null;
  private rasterData: GeoTIFF.TypedArray | null = null;
  private metadata: DemMetadata | null = null;
  private fallbackSyntheticFixture: IDemProvider | null = null;

  constructor(demPath = env.DEM_PATH, fallbackToSynthetic = false) {
    this.demPath = path.resolve(process.cwd(), demPath);
    if (fallbackToSynthetic) {
      this.fallbackSyntheticFixture = SyntheticDemFixture.createFlatDem(0.0);
    }
  }

  public setSyntheticFallback(fixture: IDemProvider | null): void {
    this.fallbackSyntheticFixture = fixture;
  }

  public async isReady(): Promise<boolean> {
    if (this.metadata && this.rasterData) return true;
    if (this.fallbackSyntheticFixture) return true;

    if (!fs.existsSync(this.demPath)) {
      return false;
    }

    try {
      await this.init();
      return true;
    } catch {
      return false;
    }
  }

  public async getMetadata(): Promise<DemMetadata> {
    if (!this.metadata) {
      if (fs.existsSync(this.demPath)) {
        await this.init();
      } else if (this.fallbackSyntheticFixture) {
        return this.fallbackSyntheticFixture.getMetadata();
      } else {
        throw new ScientificResourceUnavailableError(
          `Lunar DEM file not found at ${this.demPath}. Please configure a valid NASA LOLA GeoTIFF file.`,
          {
            demPath: this.demPath,
            sourceRecommendation:
              'Download LOLA South Pole DEM GeoTIFF (e.g. LDEM_80S_20M.TIF) from NASA PDS or USGS Astrogeology.',
          }
        );
      }
    }
    return this.metadata!;
  }

  private async init(): Promise<void> {
    if (this.metadata && this.rasterData) return;

    if (!fs.existsSync(this.demPath)) {
      throw new ScientificResourceUnavailableError(`DEM file does not exist at ${this.demPath}`);
    }

    try {
      const buffer = fs.readFileSync(this.demPath);
      this.tiffInstance = await GeoTIFF.fromArrayBuffer(
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      );
      this.imageInstance = await this.tiffInstance.getImage();

      const width = this.imageInstance.getWidth();
      const height = this.imageInstance.getHeight();
      const origin = this.imageInstance.getOrigin();
      const resolution = this.imageInstance.getResolution();
      const fileDirectory = this.imageInstance.getFileDirectory();

      const pixelScaleX = Math.abs(resolution[0] || 20.0);
      const pixelScaleY = Math.abs(resolution[1] || 20.0);

      const minX = origin[0];
      const maxY = origin[1];
      const maxX = minX + width * pixelScaleX;
      const minY = maxY - height * pixelScaleY;

      // Extract GDAL_NODATA or default to -32767
      const gdalNoData = (fileDirectory as unknown as Record<string, unknown>)?.GDAL_NODATA;
      const noDataValue =
        gdalNoData !== undefined
          ? parseFloat(String(gdalNoData))
          : -32767.0;

      // Read raster bands
      const rasters = await this.imageInstance.readRasters();
      this.rasterData = rasters[0] as GeoTIFF.TypedArray;

      // Compute accurate lat/lon bounds from projected corners
      const corners = [
        this.projectedToLatLon(minX, minY),
        this.projectedToLatLon(minX, maxY),
        this.projectedToLatLon(maxX, minY),
        this.projectedToLatLon(maxX, maxY),
      ];
      const containsPole = minX <= 0 && maxX >= 0 && minY <= 0 && maxY >= 0;
      const minLat = containsPole ? -90.0 : Math.min(...corners.map((c) => c.latDeg));
      const maxLat = Math.max(...corners.map((c) => c.latDeg));

      this.metadata = {
        id: path.basename(this.demPath, path.extname(this.demPath)),
        source: `NASA LOLA Digital Elevation Model (${path.basename(this.demPath)})`,
        type: 'GEOTIFF',
        width,
        height,
        pixelSpacingMeters: { x: pixelScaleX, y: pixelScaleY },
        effectiveResolutionMeters: Math.max(pixelScaleX, pixelScaleY),
        crs: 'Lunar Polar Stereographic (South Pole)',
        elevationUnits: 'meters',
        verticalReference: '1737400m lunar reference radius datum',
        bounds: {
          minX,
          maxX,
          minY,
          maxY,
          minLat,
          maxLat,
          minLon: -180.0,
          maxLon: 180.0,
        },
        noDataValue,
      };

      logger.info({ id: this.metadata.id, width, height }, 'Lunar DEM GeoTIFF loaded successfully');
    } catch (err) {
      logger.error({ err, path: this.demPath }, 'Failed to initialize DEM GeoTIFF');
      throw new ScientificResourceUnavailableError(
        `Failed to parse GeoTIFF DEM file at ${this.demPath}: ${(err as Error).message}`
      );
    }
  }

  public async isPointCovered(xMeters: number, yMeters: number): Promise<boolean> {
    if (!this.metadata) {
      if (this.fallbackSyntheticFixture) {
        return this.fallbackSyntheticFixture.isPointCovered(xMeters, yMeters);
      }
      await this.init();
    }

    const { minX, maxX, minY, maxY } = this.metadata!.bounds;
    return xMeters >= minX && xMeters <= maxX && yMeters >= minY && yMeters <= maxY;
  }

  public async getElevationAt(xMeters: number, yMeters: number): Promise<number | null> {
    if (!this.metadata || !this.rasterData) {
      if (this.fallbackSyntheticFixture) {
        return this.fallbackSyntheticFixture.getElevationAt(xMeters, yMeters);
      }
      await this.init();
    }

    const meta = this.metadata!;
    if (!(await this.isPointCovered(xMeters, yMeters))) {
      return null;
    }

    // Convert projected meters to raster row and col coordinates
    const colFloat = (xMeters - meta.bounds.minX) / meta.pixelSpacingMeters.x;
    const rowFloat = (meta.bounds.maxY - yMeters) / meta.pixelSpacingMeters.y;

    const col0 = Math.floor(colFloat);
    const row0 = Math.floor(rowFloat);
    const col1 = Math.min(col0 + 1, meta.width - 1);
    const row1 = Math.min(row0 + 1, meta.height - 1);

    if (col0 < 0 || row0 < 0 || col0 >= meta.width || row0 >= meta.height) {
      return null;
    }

    // Bilinear interpolation
    const getVal = (r: number, c: number): number | null => {
      const idx = r * meta.width + c;
      const val = this.rasterData![idx];
      if (val === meta.noDataValue || isNaN(val) || !Number.isFinite(val)) {
        return null;
      }
      return val;
    };

    const z00 = getVal(row0, col0);
    const z10 = getVal(row0, col1);
    const z01 = getVal(row1, col0);
    const z11 = getVal(row1, col1);

    // If any neighboring sample is NoData, do not fabricate values with zero
    if (z00 === null || z10 === null || z01 === null || z11 === null) {
      return z00 ?? z10 ?? z01 ?? z11 ?? null;
    }

    const u = colFloat - col0;
    const v = rowFloat - row0;

    const interpolated =
      (1 - u) * (1 - v) * z00 +
      u * (1 - v) * z10 +
      (1 - u) * v * z01 +
      u * v * z11;

    return interpolated;
  }

  public async getElevationAtLatLon(latDeg: number, lonDeg: number): Promise<number | null> {
    const { x, y } = this.latLonToProjected(latDeg, lonDeg);
    return this.getElevationAt(x, y);
  }

  public latLonToProjected(latDeg: number, lonDeg: number): { x: number; y: number } {
    const R = SCIENTIFIC_CONSTANTS.MOON_MEAN_RADIUS_M;
    const colatRad = degToRad(90.0 + latDeg);
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
    if (!this.metadata || !this.rasterData) {
      if (this.fallbackSyntheticFixture) {
        return this.fallbackSyntheticFixture.getTerrainSubgrid(
          centerX,
          centerY,
          radiusMeters,
          gridDimension
        );
      }
      await this.init();
    }

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
    const totalCount = gridDimension * gridDimension;

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

    const coverageRatio = validCount / totalCount;
    const meanElevation = validCount > 0 ? sumElevation / validCount : 0;

    return {
      grid,
      width: gridDimension,
      height: gridDimension,
      stepMeters,
      bounds: { minX, maxX, minY, maxY },
      minElevation: Number.isFinite(minElevation) ? minElevation : 0,
      maxElevation: Number.isFinite(maxElevation) ? maxElevation : 0,
      meanElevation,
      coverageRatio,
    };
  }
}
