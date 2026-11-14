import fs from 'fs';
import path from 'path';
import {
  IEphemerisProvider,
  EphemerisRequest,
  EphemerisCalculationResult,
  EphemerisProviderReadiness,
} from './ephemeris.interface';
import { ScientificResourceUnavailableError, ScientificValidationError } from '../../types/errors';
import { env } from '../../config/env';
import { TimeConversionService } from './time-conversion.service';
import { LocalEnuService } from '../coordinates/local-enu.service';
import { Vector3D } from '../../utils/vectors';
import { logger } from '../../middleware/logger';

export class SpiceProvider implements IEphemerisProvider {
  public readonly name = 'NASA/NAIF SPICE Toolkit Provider';

  private kernelDir: string;
  private spiceEnabled: boolean;
  private configuredFrame: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private spiceInstance: any = null;
  private spiceInitPromise: Promise<void> | null = null;
  private loadedKernels: string[] = [];

  constructor(
    kernelDir = env.SPICE_KERNEL_DIR,
    spiceEnabled = env.SPICE_ENABLED,
    configuredFrame = env.SPICE_FRAME
  ) {
    this.kernelDir = path.resolve(process.cwd(), kernelDir);
    this.spiceEnabled = spiceEnabled;
    this.configuredFrame = configuredFrame;
  }

  public async isReady(): Promise<boolean> {
    const readiness = await this.getReadinessDetails();
    return readiness.ready;
  }

  public async getReadinessDetails(): Promise<EphemerisProviderReadiness> {
    const requiredKernelTypes = [
      { type: 'LSK (Leapseconds Kernel)', pattern: /\.tls$/i, example: 'naif0012.tls' },
      { type: 'SPK (Ephemeris Kernel)', pattern: /\.bsp$/i, example: 'de421.bsp' },
      { type: 'PCK (Planetary Constants)', pattern: /\.(tpc|bpc)$/i, example: 'pck00010.tpc' },
      { type: 'FK (Lunar Frame Kernel)', pattern: /\.tf$/i, example: 'moon_080317.tf' },
    ];

    const availableKernels: string[] = [];
    const missingKernels: string[] = [];

    if (!fs.existsSync(this.kernelDir)) {
      return {
        ready: false,
        providerName: this.name,
        message: `SPICE kernel directory does not exist: ${this.kernelDir}`,
        availableKernels: [],
        missingKernels: requiredKernelTypes.map((k) => `${k.type} (e.g. ${k.example})`),
      };
    }

    try {
      const dirFiles = fs.readdirSync(this.kernelDir);

      for (const req of requiredKernelTypes) {
        const found = dirFiles.filter((f) => req.pattern.test(f));
        if (found.length > 0) {
          availableKernels.push(...found);
        } else {
          missingKernels.push(`${req.type} (e.g. ${req.example})`);
        }
      }
    } catch (err) {
      return {
        ready: false,
        providerName: this.name,
        message: `Failed to inspect SPICE kernel directory: ${(err as Error).message}`,
        availableKernels: [],
        missingKernels: requiredKernelTypes.map((k) => k.example),
      };
    }

    if (!this.spiceEnabled) {
      return {
        ready: false,
        providerName: this.name,
        message: 'SPICE integration is disabled in configuration (SPICE_ENABLED=false).',
        availableKernels,
        missingKernels,
      };
    }

    if (missingKernels.length > 0) {
      return {
        ready: false,
        providerName: this.name,
        message: `Missing required SPICE kernels in ${this.kernelDir}: ${missingKernels.join(', ')}`,
        availableKernels,
        missingKernels,
      };
    }

    try {
      await this.ensureSpiceInitialized();
      return {
        ready: true,
        providerName: this.name,
        message: 'SPICE kernels present and validated.',
        availableKernels,
        missingKernels: [],
        supportedCoverageYears: { start: 1900, end: 2050 },
      };
    } catch (err) {
      return {
        ready: false,
        providerName: this.name,
        message: `SPICE engine initialization failed: ${(err as Error).message}`,
        availableKernels,
        missingKernels: [],
      };
    }
  }

  private async ensureSpiceInitialized(): Promise<void> {
    if (this.spiceInstance) return;
    if (this.spiceInitPromise) return this.spiceInitPromise;

    this.spiceInitPromise = (async () => {
      try {
        const { Spice } = await import('timecraftjs');
        const instance = await new Spice().init();
        instance.erract('SET', 'RETURN');
        instance.errprt('SET', 'NONE');

        if (fs.existsSync(this.kernelDir)) {
          const files = fs.readdirSync(this.kernelDir);
          const kernelOrder = (filename: string): number => {
            if (/\.tls$/i.test(filename)) return 1;
            if (/\.tpc$/i.test(filename)) return 2;
            if (/\.bpc$/i.test(filename)) return 3;
            if (/\.bsp$/i.test(filename)) return 4;
            if (/\.tf$/i.test(filename)) return 5;
            return 6;
          };
          const sortedFiles = files
            .filter((f) => /\.(tls|tpc|bpc|bsp|tf)$/i.test(f))
            .sort((a, b) => kernelOrder(a) - kernelOrder(b));

          for (const file of sortedFiles) {
            const filePath = path.join(this.kernelDir, file);
            const buf = fs.readFileSync(filePath);
            instance.loadKernel(buf, file);
            if (instance.failed()) {
              const errMsg = instance.getmsg('LONG');
              instance.reset();
              logger.warn({ file, errMsg }, 'Warning during SPICE kernel load');
            } else {
              this.loadedKernels.push(file);
            }
          }
        }
        this.spiceInstance = instance;
      } catch (err) {
        this.spiceInitPromise = null;
        throw err;
      }
    })();

    return this.spiceInitPromise;
  }

  public async calculateTarget(req: EphemerisRequest): Promise<EphemerisCalculationResult> {
    const readiness = await this.getReadinessDetails();

    if (!readiness.ready) {
      throw new ScientificResourceUnavailableError(
        `SPICE calculations unavailable: ${readiness.message}. Please configure valid NASA/NAIF SPICE kernels in ${this.kernelDir}.`,
        {
          provider: this.name,
          availableKernels: readiness.availableKernels,
          missingKernels: readiness.missingKernels,
          requiredKernelsNotice:
            'Obtain naif0012.tls, de421.bsp, pck00010.tpc, and moon_080317.tf from https://naif.jpl.nasa.gov/pub/naif/generic_kernels/',
        }
      );
    }

    await this.ensureSpiceInitialized();

    // Convert epoch to Ephemeris Time
    const etSeconds = this.convertEpochToEt(req.epochUtc);

    // Validate target
    if (req.target !== 'SUN' && req.target !== 'EARTH') {
      throw new ScientificValidationError(`Unsupported ephemeris target: ${req.target}`);
    }

    // When SPICE kernels are installed, calculate positions using CSPICE kernel integration
    // Note: Here we perform the topocentric geometry transformation using local-enu service
    const targetVectorME = await this.computeSpiceVectorME(req.target, etSeconds);
    const geometry = LocalEnuService.calculateTargetGeometry(
      targetVectorME,
      req.siteCoords,
      req.observerHeightMeters ?? 2.0
    );

    // Calculate instantaneous velocity vector in MOON_ME frame (meters/second) via central difference
    const dt = 1.0;
    const [vecMinus, vecPlus] = await Promise.all([
      this.computeSpiceVectorME(req.target, etSeconds - dt),
      this.computeSpiceVectorME(req.target, etSeconds + dt),
    ]);
    const targetVelocityMoonCenteredME: Vector3D = {
      x: (vecPlus.x - vecMinus.x) / (2.0 * dt),
      y: (vecPlus.y - vecMinus.y) / (2.0 * dt),
      z: (vecPlus.z - vecMinus.z) / (2.0 * dt),
    };

    // Calculate Greenwich Mean Sidereal Time / Earth Rotation Angle at epoch
    const jd = TimeConversionService.utcToJulianDate(req.epochUtc);
    const d = jd - 2451545.0;
    const earthRotationAngleDeg = ((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360;

    return {
      target: req.target,
      epochUtc: req.epochUtc,
      ephemerisTimeSeconds: etSeconds,
      targetPositionMoonCenteredME: targetVectorME,
      targetVelocityMoonCenteredME,
      topocentricVectorME: LocalEnuService.vectorEnuToME(geometry.enuVector, req.siteCoords),
      earthRotationAngleDeg,
      localEnuVector: geometry.enuVector,
      azimuthDeg: geometry.azimuthDeg,
      elevationDeg: geometry.elevationDeg,
      distanceMeters: geometry.rangeMeters,
      frame: 'LOCAL_ENU',
      units: {
        angles: 'degrees',
        distance: 'meters',
        velocity: 'meters_per_second',
      },
      provenance: {
        providerName: this.name,
        ephemerisModel: 'NASA/NAIF SPICE (DE421/DE440 + Lunar Frame Kernel)',
        kernels: readiness.availableKernels,
        aberrationCorrection: 'LT+S (Light-Time and Stellar Aberration)',
        referenceFrame: this.configuredFrame,
        timeStandard: 'TDB',
      },
    };
  }

  private convertEpochToEt(epochUtc: string): number {
    if (this.spiceInstance) {
      try {
        const spiceUtcStr = epochUtc.replace('T', ' ').replace('Z', ' UTC');
        const et = this.spiceInstance.str2et(spiceUtcStr);
        if (!this.spiceInstance.failed() && Number.isFinite(et)) {
          return et;
        }
        this.spiceInstance.reset();
      } catch {
        // Fall back to TimeConversionService
      }
    }
    return TimeConversionService.utcToEphemerisTime(epochUtc);
  }

  /**
   * Moon position relative to Earth centre in the J2000 inertial frame, in meters.
   * Used by the site time-series endpoint; only the SPICE provider offers this.
   */
  public async computeMoonFromEarthJ2000(etSeconds: number): Promise<Vector3D> {
    await this.ensureSpiceInitialized();

    if (!this.spiceInstance) {
      throw new ScientificResourceUnavailableError('CSPICE runtime engine not mounted for MOON.');
    }

    const res = this.spiceInstance.spkpos('MOON', etSeconds, 'J2000', 'LT+S', 'EARTH');
    if (this.spiceInstance.failed()) {
      const errMsg = this.spiceInstance.getmsg('LONG');
      this.spiceInstance.reset();
      if (errMsg.includes('Insufficient ephemeris data') || errMsg.includes('SPKINSUFFDATA')) {
        throw new ScientificResourceUnavailableError(
          'Requested date is outside NASA SPICE kernel ephemeris coverage (1900-01-01 to 2050-01-01). Please choose a mission epoch within this supported interval.'
        );
      }
      throw new ScientificResourceUnavailableError(`SPICE calculation failed for MOON: ${errMsg}`);
    }

    return {
      x: res.ptarg[0] * 1000.0,
      y: res.ptarg[1] * 1000.0,
      z: res.ptarg[2] * 1000.0,
    };
  }

  public async computeSpiceVectorME(target: 'SUN' | 'EARTH', etSeconds: number): Promise<Vector3D> {
    await this.ensureSpiceInitialized();

    if (!this.spiceInstance) {
      throw new ScientificResourceUnavailableError(`CSPICE runtime engine not mounted for ${target}.`);
    }

    const res = this.spiceInstance.spkpos(target, etSeconds, this.configuredFrame, 'LT+S', 'MOON');
    if (this.spiceInstance.failed()) {
      const errMsg = this.spiceInstance.getmsg('LONG');
      this.spiceInstance.reset();
      if (errMsg.includes('Insufficient ephemeris data') || errMsg.includes('SPKINSUFFDATA')) {
        throw new ScientificResourceUnavailableError(
          'Requested date is outside NASA SPICE kernel ephemeris coverage (1900-01-01 to 2050-01-01). Please choose a mission epoch within this supported interval.'
        );
      }
      throw new ScientificResourceUnavailableError(`SPICE calculation failed for ${target}: ${errMsg}`);
    }

    // SPICE spkpos returns position in kilometers; convert to meters for topocentric ENU reduction
    return {
      x: res.ptarg[0] * 1000.0,
      y: res.ptarg[1] * 1000.0,
      z: res.ptarg[2] * 1000.0,
    };
  }
}

