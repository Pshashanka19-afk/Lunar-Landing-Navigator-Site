import { IEphemerisProvider } from './ephemeris.interface';
import { SpiceProvider } from './spice.provider';
import { AnalyticalEphemerisProvider } from './analytical.provider';
import { MockEphemerisProvider } from './mock.provider';
import { env } from '../../config/env';

export class EphemerisFactory {
  private static spiceProviderInstance?: SpiceProvider;
  private static analyticalProviderInstance?: AnalyticalEphemerisProvider;
  private static mockProviderInstance?: MockEphemerisProvider;

  public static getSpiceProvider(): SpiceProvider {
    if (!this.spiceProviderInstance) {
      this.spiceProviderInstance = new SpiceProvider();
    }
    return this.spiceProviderInstance;
  }

  public static getAnalyticalProvider(): AnalyticalEphemerisProvider {
    if (!this.analyticalProviderInstance) {
      this.analyticalProviderInstance = new AnalyticalEphemerisProvider();
    }
    return this.analyticalProviderInstance;
  }

  public static getMockProvider(): MockEphemerisProvider {
    if (!this.mockProviderInstance) {
      this.mockProviderInstance = new MockEphemerisProvider();
    }
    return this.mockProviderInstance;
  }

  /**
   * Resolves the ephemeris provider based on explicit request preference or server environment configuration.
   * STRICT: Does NOT silently fallback from SPICE to analytical or mock if SPICE is requested.
   */
  public static getProvider(preference?: 'spice' | 'analytical' | 'mock'): IEphemerisProvider {
    const selected = preference ?? env.EPHEMERIS_PROVIDER;

    if (selected === 'mock') {
      return this.getMockProvider();
    }

    if (selected === 'spice' || (preference === undefined && env.SPICE_ENABLED)) {
      return this.getSpiceProvider();
    }

    if (selected === 'analytical') {
      return this.getAnalyticalProvider();
    }

    return this.getAnalyticalProvider();
  }
}
