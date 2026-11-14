import { z } from 'zod';
import { landingSiteSchema } from './site.schema';

export const siteComparisonRequestSchema = z
  .object({
    sites: z
      .array(landingSiteSchema)
      .min(1, 'At least one candidate site must be provided')
      .max(50, 'A maximum of 50 candidate sites can be compared per request'),
    requirements: z.object({
      minSunlightHours: z.number().nonnegative().optional(),
      minContinuousSunlightHours: z.number().nonnegative().optional(),
      minEarthVisibilityHours: z.number().nonnegative().optional(),
      minSimultaneousSunEarthHours: z.number().nonnegative().optional(),
      maxSlopeDeg: z.number().nonnegative().max(90.0).optional(),
      weights: z
        .object({
          sunlightDuration: z.number().nonnegative().optional(),
          continuousSunlight: z.number().nonnegative().optional(),
          earthVisibility: z.number().nonnegative().optional(),
          slopeFlatness: z.number().nonnegative().optional(),
        })
        .optional(),
    }),
    startTimeUtc: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'startTimeUtc must be a valid ISO 8601 timestamp string',
      }),
    endTimeUtc: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: 'endTimeUtc must be a valid ISO 8601 timestamp string',
      }),
    stepSeconds: z.number().int().min(60).max(86400).optional().default(600),
    ephemerisProvider: z.enum(['spice', 'analytical', 'mock']).optional(),
    demProvider: z.enum(['geotiff', 'synthetic']).optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startTimeUtc).getTime();
      const end = new Date(data.endTimeUtc).getTime();
      return start < end;
    },
    {
      message: 'startTimeUtc must be strictly before endTimeUtc',
      path: ['endTimeUtc'],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.startTimeUtc).getTime();
      const end = new Date(data.endTimeUtc).getTime();
      const diffDays = (end - start) / (1000 * 86400);
      return diffDays <= 90;
    },
    {
      message: 'Mission comparison interval cannot exceed 90 days',
      path: ['endTimeUtc'],
    }
  );

export type SiteComparisonRequestInput = z.infer<typeof siteComparisonRequestSchema>;
