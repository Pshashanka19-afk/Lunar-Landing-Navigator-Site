import { z } from 'zod';
import { landingSiteSchema } from './site.schema';

export const instantaneousGeometryRequestSchema = z.object({
  epochUtc: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'epochUtc must be a valid ISO 8601 timestamp string (e.g. "2026-10-29T12:00:00Z")',
    }),
  site: landingSiteSchema,
  observerHeightMeters: z.number().nonnegative().optional().default(2.0),
  ephemerisProvider: z.enum(['spice', 'analytical', 'mock']).optional(),
});

export type InstantaneousGeometryRequestInput = z.infer<typeof instantaneousGeometryRequestSchema>;
