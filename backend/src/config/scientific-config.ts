export interface DemonstrationLandingSite {
  id: string;
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
  elevationMeters?: number;
  targetRegion: string;
  description: string;
  scientificInterest: string[];
}

export const SCIENTIFIC_CONSTANTS = {
  // IAU / NASA standard lunar reference dimensions
  MOON_MEAN_RADIUS_M: 1737400.0,
  MOON_EQUATORIAL_RADIUS_M: 1738100.0,
  MOON_POLAR_RADIUS_M: 1736000.0,

  // Speed of light in vacuum (m/s)
  SPEED_OF_LIGHT_M_S: 299792458.0,

  // Astronomical Unit (m)
  ASTRONOMICAL_UNIT_M: 149597870700.0,

  // Average Earth-Moon distance (m)
  MEAN_EARTH_MOON_DISTANCE_M: 384400000.0,

  // Mean Sun radius (m)
  SUN_RADIUS_M: 696340000.0,

  // Solar angular radius seen from Moon (approx 0.26 deg / 16 arcmin)
  SOLAR_ANGULAR_RADIUS_DEG: 0.2665,

  // Lunar rotation period (sidereal day in seconds ~ 27.32166 days)
  LUNAR_SIDEREAL_DAY_SECONDS: 2360591.5,

  // Synodic lunar day (seconds ~ 29.53059 days)
  LUNAR_SYNODIC_DAY_SECONDS: 2551442.8,

  // Local horizon maximum computation radius limit (meters, 100 km)
  MAX_HORIZON_RADIUS_M: 100000,
  MIN_HORIZON_RADIUS_M: 100,

  // Default coordinate frames
  FRAME_LUNAR_FIXED_ME: 'MOON_ME', // Mean Earth / Polar Axis frame
  FRAME_LUNAR_FIXED_PA: 'MOON_PA', // Principal Axes frame
  FRAME_LOCAL_ENU: 'LOCAL_ENU',    // East-North-Up local horizontal frame
  FRAME_INERTIAL_ICRF: 'ICRF',     // International Celestial Reference Frame
  FRAME_INERTIAL_J2000: 'J2000',
} as const;

// Candidate-region representative coordinates are taken from published Artemis
// landing-site tables (Wuellner et al., 2025; NASA/USGS references). Statio Shiv
// Shakti uses the IAU/USGS Gazetteer centre coordinate. Coordinates identify
// representative points, not guaranteed touchdown ellipses or safe landing zones.
// DEM-derived terrain metrics are available only where the bundled raster has data.
export const DEFAULT_DEMO_SITES: DemonstrationLandingSite[] = [
  {
    id: 'shackleton-connecting-ridge',
    name: 'Shackleton Crater - Connecting Ridge',
    latitudeDeg: -89.78,
    longitudeDeg: 125.4,
    targetRegion: 'South Pole',
    description: 'Prominent elevated ridge connecting Shackleton and de Gerlache craters with high cumulative sunlight.',
    scientificInterest: ['Solar illumination persistence', 'Direct-to-Earth line of sight', 'Proximity to PSR volatile traps'],
  },
  {
    id: 'malapert-massif',
    name: 'Malapert Massif',
    latitudeDeg: -85.9948,
    longitudeDeg: -0.23578,
    targetRegion: 'Malapert Massif',
    description: 'Representative point for the Malapert Massif south-polar candidate landing region.',
    scientificInterest: ['Highland geology', 'Earth visibility', 'Solar illumination'],
  },
  {
    id: 'de-gerlache-rim',
    name: 'de Gerlache Crater Rim',
    latitudeDeg: -88.71,
    longitudeDeg: -88.35,
    targetRegion: 'South Pole',
    description: 'Narrow rim section providing periodic sunlight and Earth communication opportunities over polar summer.',
    scientificInterest: ['Permanently shadowed region access', 'Volatiles prospecting', 'CLPS lander operations'],
  },
  {
    id: 'haworth-crater-rim',
    name: 'Haworth (Artemis candidate region)',
    latitudeDeg: -86.7639,
    longitudeDeg: -22.777,
    targetRegion: 'Haworth',
    description: 'Representative coordinate for the Haworth Artemis candidate landing region.',
    scientificInterest: ['Permanently shadowed region access', 'Volatile prospecting', 'Terrain characterization'],
  },
  {
    id: 'statio-shiv-shakti',
    name: 'Statio Shiv Shakti',
    latitudeDeg: -69.3734,
    longitudeDeg: 32.3198,
    targetRegion: 'Chandrayaan-3 landing site',
    description: 'IAU-named landing site of Chandrayaan-3 Vikram, included as an Indian lunar landing-site reference. It lies outside the bundled south-polar DEM coverage, so DEM-based terrain results are unavailable for this location.',
    scientificInterest: ['Chandrayaan-3 landing-site reference', 'Lunar surface operations', 'Cross-mission site comparison'],
  },
  {
    id: 'mons-mouton',
    name: 'Mons Mouton (MMO01)',
    latitudeDeg: -85.416,
    longitudeDeg: 31.851,
    targetRegion: 'Mons Mouton',
    description: 'Representative candidate landing point on Mons Mouton, within the lunar south-polar Artemis candidate region.',
    scientificInterest: ['South-polar landing-site assessment', 'Illumination analysis', 'Terrain and slope characterization'],
  },
  {
    id: 'peak-near-shackleton',
    name: 'Peak Near Shackleton',
    latitudeDeg: -88.811,
    longitudeDeg: 123.6901,
    targetRegion: 'Peak Near Shackleton',
    description: 'NASA Artemis candidate landing region near Shackleton crater.',
    scientificInterest: ['South-polar illumination', 'Shackleton crater access', 'Earth communication geometry'],
  },
  {
    id: 'nobile-rim-1',
    name: 'Nobile Rim 1',
    latitudeDeg: -85.295,
    longitudeDeg: 36.917,
    targetRegion: 'Nobile Rim 1',
    description: 'Representative candidate landing point on the Nobile Rim 1 region.',
    scientificInterest: ['Rim terrain characterization', 'Nearby permanently shadowed terrain', 'Solar illumination'],
  },
];
