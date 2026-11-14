import { z } from 'zod';
import { landingSiteSchema } from './site.schema';

export const windowCalculationRequestSchema = z
  .object({
    site: landingSiteSchema,
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
    stepSeconds: z.number().int().min(10).max(86400).optional().default(300),
    boundaryToleranceSeconds: z.number().int().min(1).max(300).optional().default(30),
    solarMarginDeg: z.number().optional().default(0.0),
    earthMarginDeg: z.number().optional().default(0.0),
    searchRadiusMeters: z.number().min(50.0).max(100000.0).optional().default(1000.0),
    azimuthStepDeg: z.number().min(0.5).max(45.0).optional().default(5.0),
    includeTimeSeries: z.boolean().optional().default(true),
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
      message: 'Mission interval duration cannot exceed 90 days',
      path: ['endTimeUtc'],
    }
  );

export type WindowCalculationRequestInput = z.infer<typeof windowCalculationRequestSchema>;
