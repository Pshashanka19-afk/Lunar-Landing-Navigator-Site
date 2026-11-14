export interface DemonstrationLandingSite {
  id: string;
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
  elevationMeters: number;
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

export const DEFAULT_DEMO_SITES: DemonstrationLandingSite[] = [
  {
    id: 'shackleton-connecting-ridge',
    name: 'Shackleton Crater Ridge',
    latitudeDeg: -89.78,
    longitudeDeg: 125.40,
    elevationMeters: 1413.9,
    targetRegion: 'South Pole Ridge',
    description: 'Prominent elevated ridge near Shackleton with 72h continuous sunlight and 2.94° slope.',
    scientificInterest: ['Continuous solar illumination persistence', 'Direct volatile access', 'Low-slope landing safety'],
  },
  {
    id: 'malapert-mountain',
    name: 'Malapert Massif',
    latitudeDeg: -86.04,
    longitudeDeg: 2.70,
    elevationMeters: -2854.7,
    targetRegion: 'Malapert Massif',
    description: 'Elevated highland massif offering extended Earth visibility (11.5h) and high maximum solar elevation (18.6°).',
    scientificInterest: ['Longest direct Earth communication visibility', 'High solar elevation peak', 'Highland geology'],
  },
  {
    id: 'de-gerlache-rim-2',
    name: 'de Gerlache Rim',
    latitudeDeg: -88.71,
    longitudeDeg: -68.70,
    elevationMeters: -1148.4,
    targetRegion: 'South Pole / de Gerlache',
    description: 'Crater rim section providing periodic illumination and direct Earth visibility opportunities.',
    scientificInterest: ['Permanently shadowed region access', 'Volatiles prospecting', '6.19° rolling terrain'],
  },
  {
    id: 'haworth-crater-rim',
    name: 'Haworth Crater Rim',
    latitudeDeg: -87.87,
    longitudeDeg: -5.17,
    elevationMeters: -1200.0,
    targetRegion: 'Haworth',
    description: 'High-latitude plateau bordering deep cryogenic volatile cold traps in Haworth crater.',
    scientificInterest: ['Cryogenic trap exploration', 'Surface trafficability', 'Direct line of sight to Earth'],
  },
];
