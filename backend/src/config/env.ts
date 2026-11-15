import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file (check current dir, then backend/ subfolder)
const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(__dirname, '../../.env'),
];
const activeEnvPath = candidateEnvPaths.find((p) => fs.existsSync(p)) || candidateEnvPaths[0];
dotenv.config({ path: activeEnvPath });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5001),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('*'),

  // Ephemeris Provider Configuration
  EPHEMERIS_PROVIDER: z.enum(['spice', 'analytical', 'mock']).default('analytical'),
  SPICE_ENABLED: z
    .string()
    .transform((val) => val === 'true' || val === '1')
    .default(false),
  SPICE_KERNEL_DIR: z.string().default('./data/kernels'),
  SPICE_FRAME: z.string().default('MOON_ME'),

  // Terrain DEM Configuration
  DEM_PROVIDER: z.enum(['geotiff', 'synthetic']).default('geotiff'),
  DEM_PATH: z.string().default('./data/dem/lunar-south-pole.tif'),

  // Horizon Calculation Defaults
  DEFAULT_HORIZON_RADIUS_METERS: z.coerce.number().positive().default(1000),
  DEFAULT_AZIMUTH_STEP_DEG: z.coerce.number().positive().max(90).default(5),
  DEFAULT_RADIAL_STEP_METERS: z.coerce.number().positive().default(30),

  // Time-dependent Window Defaults
  DEFAULT_TIME_STEP_SECONDS: z.coerce.number().int().positive().default(300),
  BOUNDARY_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(30),
  VISIBILITY_ANGULAR_TOLERANCE_DEG: z.coerce.number().nonnegative().default(0.1),

  // Safety & Resource Limits
  MAX_MISSION_DURATION_DAYS: z.coerce.number().positive().default(90),

  // NASA External Scientific Data Sources Configuration
  QUICKMAP_ENABLED: z
    .union([z.boolean(), z.string().transform((val) => val === 'true' || val === '1')])
    .default(true),
  QUICKMAP_BASE_URL: z.string().default('https://wms.lroc.asu.edu/lroc/wms'),

  MOONTREK_ENABLED: z
    .union([z.boolean(), z.string().transform((val) => val === 'true' || val === '1')])
    .default(true),
  MOONTREK_WMTS_BASE_URL: z.string().default('https://trek.nasa.gov/tiles/Moon'),

  JPL_HORIZONS_ENABLED: z
    .union([z.boolean(), z.string().transform((val) => val === 'true' || val === '1')])
    .default(true),
  JPL_HORIZONS_BASE_URL: z.string().default('https://ssd.jpl.nasa.gov/api/horizons.api'),
  JPL_HORIZONS_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),

  SCIENTIFIC_DATA_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
});

export type EnvConfig = z.infer<typeof envSchema>;

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsedEnv.error.format());
  throw new Error('Environment configuration validation failed');
}

export const env: EnvConfig = parsedEnv.data;
