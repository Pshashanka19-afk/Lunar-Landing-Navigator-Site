import { z } from 'zod';
import { landingSiteSchema } from './site.schema';
import { env } from '../config/env';

const isoTimestamp = (field: string) =>
  z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: `${field} must be a valid ISO 8601 timestamp string`,
  });

export const siteSeriesRequestSchema = z
  .object({
    site: landingSiteSchema,
    startTimeUtc: isoTimestamp('startTimeUtc'),
    endTimeUtc: isoTimestamp('endTimeUtc'),
    stepSeconds: z.number().int().min(60).max(86400).optional().default(3600),
    include: z
      .array(z.enum(['moon', 'sunlight', 'temperature']))
      .min(1)
      .optional()
      .default(['moon', 'sunlight', 'temperature']),
    thermal: z
      .object({
        bondAlbedo: z.number().min(0).max(0.95).optional(),
        emissivity: z.number().min(0.5).max(1).optional(),
        nightTemperatureK: z.number().min(10).max(250).optional(),
      })
      .optional(),
    searchRadiusMeters: z.number().min(50.0).max(100000.0).optional().default(1000.0),
    azimuthStepDeg: z.number().min(0.5).max(45.0).optional().default(5.0),
    ephemerisProvider: z.enum(['spice', 'analytical', 'mock']).optional(),
    demProvider: z.enum(['geotiff', 'synthetic']).optional(),
  })
  .refine((d) => new Date(d.startTimeUtc).getTime() < new Date(d.endTimeUtc).getTime(), {
    message: 'startTimeUtc must be strictly before endTimeUtc',
    path: ['endTimeUtc'],
  })
  .refine(
    (d) => (new Date(d.endTimeUtc).getTime() - new Date(d.startTimeUtc).getTime()) / 86400000 <= env.MAX_MISSION_DURATION_DAYS,
    {
      message: `Interval duration cannot exceed ${env.MAX_MISSION_DURATION_DAYS} days`,
      path: ['endTimeUtc'],
    }
  );

export type SiteSeriesRequestInput = z.infer<typeof siteSeriesRequestSchema>;
