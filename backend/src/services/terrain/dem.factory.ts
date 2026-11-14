import { IDemProvider } from './dem.interface';
import { DemService } from './dem.service';
import { SyntheticDemFixture } from './synthetic-dem.fixture';
import { env } from '../../config/env';

export class DemFactory {
  private static geotiffServiceInstance?: DemService;
  private static syntheticFixtureInstance?: SyntheticDemFixture;

  public static getGeoTiffService(): DemService {
    if (!this.geotiffServiceInstance) {
      // Real GeoTIFF provider without silent fallback to synthetic
      this.geotiffServiceInstance = new DemService(env.DEM_PATH, false);
    }
    return this.geotiffServiceInstance;
  }

  public static getSyntheticFixture(): SyntheticDemFixture {
    if (!this.syntheticFixtureInstance) {
      this.syntheticFixtureInstance = SyntheticDemFixture.createFlatDem(0.0);
    }
    return this.syntheticFixtureInstance;
  }

  /**
   * Resolves the DEM provider based on explicit request parameter or server configuration.
   * STRICT: If 'geotiff' is selected and DEM_PATH does not exist, throws ScientificResourceUnavailableError.
   * Does NOT silently substitute synthetic terrain.
   */
  public static getDemProvider(preference?: 'geotiff' | 'synthetic'): IDemProvider {
    const selected = preference ?? env.DEM_PROVIDER;

    if (selected === 'synthetic') {
      return this.getSyntheticFixture();
    }

    // Default to real GeoTIFF service
    return this.getGeoTiffService();
  }
}
