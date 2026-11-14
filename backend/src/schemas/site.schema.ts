import { z } from 'zod';

export const lunarCoordinatesSchema = z.object({
  latitudeDeg: z
    .number()
    .min(-90.0, 'Latitude must be between -90 and +90 degrees')
    .max(90.0, 'Latitude must be between -90 and +90 degrees'),
  longitudeDeg: z
    .number()
    .min(-180.0, 'Longitude must be between -180 and +360 degrees')
    .max(360.0, 'Longitude must be between -180 and +360 degrees'),
  elevationMeters: z.number().optional(),
});

export const landingSiteSchema = lunarCoordinatesSchema.extend({
  id: z.string().optional(),
  name: z.string().optional(),
  observerHeightMeters: z.number().nonnegative().optional().default(2.0),
});

export const validateSiteRequestSchema = z.object({
  site: landingSiteSchema,
});

export const siteAnalysisRequestSchema = z.object({
  site: landingSiteSchema,
  epochUtc: z.string().optional().default(() => new Date().toISOString()),
  observerHeightMeters: z.number().nonnegative().optional().default(2.0),
  searchRadiusMeters: z.number().positive().optional().default(1000.0),
  azimuthStepDeg: z.number().positive().optional().default(10.0),
});

export type LunarCoordinatesInput = z.infer<typeof lunarCoordinatesSchema>;
export type LandingSiteInput = z.infer<typeof landingSiteSchema>;
export type SiteAnalysisRequestInput = z.infer<typeof siteAnalysisRequestSchema>;
