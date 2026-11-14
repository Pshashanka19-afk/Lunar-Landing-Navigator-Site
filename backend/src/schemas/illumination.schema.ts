import { z } from 'zod';
import { landingSiteSchema } from './site.schema';

export const instantIlluminationRequestSchema = z.object({
  site: landingSiteSchema,
  epochUtc: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'epochUtc must be a valid ISO 8601 timestamp string',
    }),
  searchRadiusMeters: z.number().min(50.0).max(100000.0).optional().default(1000.0),
  azimuthStepDeg: z.number().min(0.5).max(45.0).optional().default(5.0),
  ephemerisProvider: z.enum(['spice', 'analytical', 'mock']).optional(),
  demProvider: z.enum(['geotiff', 'synthetic']).optional(),
});

export type InstantIlluminationRequestInput = z.infer<typeof instantIlluminationRequestSchema>;
