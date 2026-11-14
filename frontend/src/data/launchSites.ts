/**
 * Authentic Earth Launch Sites, Parking Orbit Presets & Spacecraft Profiles
 * For LUNARIS Mission Route & Launch Window Planner
 */

export interface EarthLaunchSite {
  id: string;
  name: string;
  facility: string;
  country: string;
  latitudeDeg: number;
  longitudeDeg: number;
  elevationMeters: number;
  azimuthMinDeg: number;
  azimuthMaxDeg: number;
  nominalInclinationDeg: number;
  historicalLunarMissions: string[];
  description: string;
}

export interface EarthParkingOrbitPreset {
  id: string;
  name: string;
  altitudeKm: number;
  inclinationDeg: number;
  eccentricity: number;
  periodMinutes: number;
  orbitalSpeedKmS: number;
  description: string;
}

export interface SpacecraftProfile {
  id: string;
  name: string;
  category: 'CREWED_HEAVY' | 'CLPS_ROBOTIC' | 'LOW_ENERGY_BLT' | 'CUSTOM';
  vehicleExample: string;
  nominalTransferDurationHours: number;
  minTransferHours: number;
  maxTransferHours: number;
  estimatedTliDeltaVMs: number; // Trans-Lunar Injection Delta-V (~3150 m/s nominal)
  estimatedLoiDeltaVMs: number; // Lunar Orbit Insertion Delta-V (~850 m/s nominal)
  estimatedDescentDeltaVMs: number; // Powered Descent & Landing (~1800 m/s nominal)
  description: string;
}

export const EARTH_LAUNCH_SITES: EarthLaunchSite[] = [
  {
    id: 'ksc-lc39b',
    name: 'Kennedy Space Center (LC-39B)',
    facility: 'NASA John F. Kennedy Space Center',
    country: 'United States',
    latitudeDeg: 28.6272,
    longitudeDeg: -80.6208,
    elevationMeters: 3,
    azimuthMinDeg: 35,
    azimuthMaxDeg: 120,
    nominalInclinationDeg: 28.5,
    historicalLunarMissions: ['Apollo 10', 'Apollo 11-17 (LC-39A/B)', 'Artemis I', 'Artemis II'],
    description: 'Premier heavy-lift spaceport for NASA Apollo and Artemis Space Launch System (SLS) lunar architectures.',
  },
  {
    id: 'ccsfs-slc40',
    name: 'Cape Canaveral Space Force Station (SLC-40 / 41)',
    facility: 'Cape Canaveral SFS / Eastern Range',
    country: 'United States',
    latitudeDeg: 28.5621,
    longitudeDeg: -80.5772,
    elevationMeters: 4,
    azimuthMinDeg: 35,
    azimuthMaxDeg: 110,
    nominalInclinationDeg: 28.5,
    historicalLunarMissions: ['Surveyor 1-7 (Atlas-Centaur)', 'CLPS Nova-C (Falcon 9)', 'Astrobotic Peregrine (Vulcan)'],
    description: 'High-cadence commercial launch complex hosting Falcon 9 and Vulcan Centaur CLPS lunar lander missions.',
  },
  {
    id: 'starbase-boca-chica',
    name: 'Starbase (Boca Chica Pad A)',
    facility: 'SpaceX Starbase Launch Facility',
    country: 'United States',
    latitudeDeg: 25.9972,
    longitudeDeg: -97.1561,
    elevationMeters: 2,
    azimuthMinDeg: 90,
    azimuthMaxDeg: 115,
    nominalInclinationDeg: 26.0,
    historicalLunarMissions: ['Starship HLS (Artemis III/IV candidate)'],
    description: 'Heavy orbital launch site for Starship Human Landing System (HLS) propellant transfer and lunar architecture.',
  },
  {
    id: 'vsfb-slc4e',
    name: 'Vandenberg Space Force Base (SLC-4E)',
    facility: 'Western Range Launch Complex',
    country: 'United States',
    latitudeDeg: 34.6321,
    longitudeDeg: -120.6106,
    elevationMeters: 112,
    azimuthMinDeg: 140,
    azimuthMaxDeg: 220,
    nominalInclinationDeg: 70.0,
    historicalLunarMissions: ['Clementine (DSPSE / Titan II3)'],
    description: 'Western coastal spaceport primarily utilized for high-inclination, retrograde, and polar injection orbits.',
  },
  {
    id: 'csg-kourou',
    name: 'Guiana Space Centre (CSG ELA-4)',
    facility: 'Centre Spatial Guyanais (ESA / CNES)',
    country: 'France / French Guiana',
    latitudeDeg: 5.2372,
    longitudeDeg: -52.7606,
    elevationMeters: 15,
    azimuthMinDeg: -10,
    azimuthMaxDeg: 105,
    nominalInclinationDeg: 5.2,
    historicalLunarMissions: ['SMART-1 (Ariane 5)'],
    description: 'Equatorial spaceport offering maximum Earth rotational velocity boost for high-efficiency GTO/TLI injections.',
  },
  {
    id: 'tanegashima-la1',
    name: 'Tanegashima Space Center (Yoshinobu LA-1)',
    facility: 'JAXA Tanegashima Space Center',
    country: 'Japan',
    latitudeDeg: 30.4011,
    longitudeDeg: 130.9781,
    elevationMeters: 38,
    azimuthMinDeg: 60,
    azimuthMaxDeg: 110,
    nominalInclinationDeg: 30.4,
    historicalLunarMissions: ['SELENE / Kaguya (H-IIA)', 'SLIM Moon Sniper (H-IIA)'],
    description: 'Coastal Japanese spaceport that launched the SLIM precision lunar lander and SELENE orbiter.',
  },
  {
    id: 'sdsc-shar-slp',
    name: 'Satish Dhawan Space Centre (SDSC SHAR)',
    facility: 'ISRO Sriharikota Launch Complex',
    country: 'India',
    latitudeDeg: 13.7199,
    longitudeDeg: 80.2304,
    elevationMeters: 6,
    azimuthMinDeg: 85,
    azimuthMaxDeg: 120,
    nominalInclinationDeg: 19.5,
    historicalLunarMissions: ['Chandrayaan-1', 'Chandrayaan-2', 'Chandrayaan-3 (LVM3-M4)'],
    description: 'Spaceport for India’s Chandrayaan missions that achieved historical soft landing at the lunar southern high latitudes.',
  },
];

export const PARKING_ORBIT_PRESETS: EarthParkingOrbitPreset[] = [
  {
    id: 'leo-cape-nominal',
    name: 'Cape Canaveral LEO Parking Orbit (185 km, 28.5°)',
    altitudeKm: 185,
    inclinationDeg: 28.5,
    eccentricity: 0.001,
    periodMinutes: 88.2,
    orbitalSpeedKmS: 7.79,
    description: 'Standard Apollo / Artemis parking orbit for staging checkout before Trans-Lunar Injection (TLI).',
  },
  {
    id: 'leo-iss-plane',
    name: 'ISS-Aligned Parking Orbit (400 km, 51.6°)',
    altitudeKm: 400,
    inclinationDeg: 51.6,
    eccentricity: 0.0005,
    periodMinutes: 92.6,
    orbitalSpeedKmS: 7.67,
    description: 'Higher-inclination orbit suitable for cooperative staging from the International Space Station.',
  },
  {
    id: 'leo-equatorial',
    name: 'Equatorial Circular Orbit (300 km, 0.0°)',
    altitudeKm: 300,
    inclinationDeg: 0.0,
    eccentricity: 0.0,
    periodMinutes: 90.5,
    orbitalSpeedKmS: 7.73,
    description: 'Theoretical zero-plane-change orbit maximizing Earth eastward rotational velocity boost.',
  },
  {
    id: 'leo-starship-staging',
    name: 'Starbase Staging Orbit (250 km, 26.0°)',
    altitudeKm: 250,
    inclinationDeg: 26.0,
    eccentricity: 0.001,
    periodMinutes: 89.5,
    orbitalSpeedKmS: 7.76,
    description: 'Nominal parking and propellant depot rendezvous orbit for commercial lunar architectures.',
  },
];

export const SPACECRAFT_PROFILES: SpacecraftProfile[] = [
  {
    id: 'artemis-orion-sls',
    name: 'NASA Artemis (Orion + SLS Block 1)',
    category: 'CREWED_HEAVY',
    vehicleExample: 'Space Launch System (SLS) & Orion Spacecraft',
    nominalTransferDurationHours: 84.0, // 3.5 days
    minTransferHours: 72.0, // 3.0 days
    maxTransferHours: 108.0, // 4.5 days
    estimatedTliDeltaVMs: 3150,
    estimatedLoiDeltaVMs: 850,
    estimatedDescentDeltaVMs: 1850,
    description: 'High-energy crewed direct transfer trajectory maximizing astronaut safety and rapid transit through Van Allen radiation belts.',
  },
  {
    id: 'clps-robotic-lander',
    name: 'Commercial CLPS Robotic Lander',
    category: 'CLPS_ROBOTIC',
    vehicleExample: 'Intuitive Machines Nova-C / Astrobotic / Firefly Blue Ghost',
    nominalTransferDurationHours: 120.0, // 5.0 days
    minTransferHours: 96.0, // 4.0 days
    maxTransferHours: 168.0, // 7.0 days
    estimatedTliDeltaVMs: 3140,
    estimatedLoiDeltaVMs: 820,
    estimatedDescentDeltaVMs: 1780,
    description: 'Propellant-optimized direct transfer trajectory designed for commercial science payloads and polar CLPS landing craft.',
  },
  {
    id: 'ballistic-lunar-transfer',
    name: 'Ballistic Lunar Transfer (BLT / WSB)',
    category: 'LOW_ENERGY_BLT',
    vehicleExample: 'CAPSTONE / KPLO Danuri / Lunar Gateway Resupply',
    nominalTransferDurationHours: 2160.0, // 90 days
    minTransferHours: 1800.0, // 75 days
    maxTransferHours: 2880.0, // 120 days
    estimatedTliDeltaVMs: 3220,
    estimatedLoiDeltaVMs: 15, // Extremely low capture delta-v via Weak Stability Boundary
    estimatedDescentDeltaVMs: 1800,
    description: 'Low-energy three-body ballistic transfer through Sun-Earth Lagrange points (L1/L2) with near-zero lunar orbital insertion burn.',
  },
  {
    id: 'custom-mission',
    name: 'Custom Parameterized Mission Profile',
    category: 'CUSTOM',
    vehicleExample: 'User-specified parameters',
    nominalTransferDurationHours: 96.0, // 4.0 days
    minTransferHours: 48.0, // 2.0 days
    maxTransferHours: 360.0, // 15.0 days
    estimatedTliDeltaVMs: 3150,
    estimatedLoiDeltaVMs: 840,
    estimatedDescentDeltaVMs: 1800,
    description: 'Interactive mission architecture permitting customizable transfer durations and delta-v constraints.',
  },
];

