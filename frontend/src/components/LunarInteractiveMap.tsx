import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { 
  Globe, 
  RotateCcw, 
  Sun, 
  Play, 
  Pause, 
  Radio, 
  Clock, 
  Sliders, 
  RefreshCw, 
  AlertTriangle
} from 'lucide-react';
import { lunarApi, type SiteAnalysisData, type MoonTrekLayerMetadata } from '../services/lunarApi';
import { SimulationControlToolbar } from './SimulationControlToolbar';
import { SimulationConfigToolbar } from './SimulationConfigToolbar';

export interface MapSiteItem {
  id: string;
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
  elevationMeters: number;
  isDemCovered?: boolean;
  pinColor?: string;
  isCustom?: boolean;
}

// Retained type exports for backward compatibility across other components
export type CelestialViewMode = 'SOLAR_SYSTEM' | 'EARTH_MOON' | 'LUNAR_MISSION';
export type DatasetLayerType = 
  | 'MOON_TREK_WAC' 
  | 'MOON_TREK_LOLA' 
  | 'MOON_TREK_RELIEF' 
  | 'LROC_IMAGERY' 
  | 'ELEVATION';
export type ObservationMode = 'OBSERVER_SURFACE' | 'OBSERVER_SPACE';
export type VisualizationScaleMode = 'EXPLORATION' | 'SCIENTIFIC_GEOMETRY';
export type SurfaceVantageType = 'APPROACH' | 'MASTCAM' | 'EVA' | 'TACTICAL';

// Camera tracking focus targets in the unified Sun-centric system
export type CameraFocusTarget = 'MOON' | 'EARTH' | 'SUN' | 'SYSTEM';

interface LunarInteractiveMapProps {
  sites: MapSiteItem[];
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
  selectedForCompare: string[];
  isDemCovered?: boolean;
  siteAnalysis?: SiteAnalysisData | null;
  epochDate?: string;
  epochHour?: number;
  onSimulationEpochChange?: (isoUtc: string) => void;
  initialCelestialMode?: CelestialViewMode;
  isAnalyzing?: boolean;
  analysisError?: string | null;
  onSwitchToMoonTrek?: () => void;
}

// -----------------------------------------------------------------------------
// Astronomical Physics & Orientation Constants
// -----------------------------------------------------------------------------
// Documented Physical Axial Tilts (relative to Ecliptic Normal unless noted)
export const SUN_AXIAL_TILT_DEG = 7.25;         // 7.25° relative to the ecliptic normal (ascending node Ω_sun ≈ 75.76°)
export const EARTH_AXIAL_TILT_DEG = 23.44;      // 23.4393° obliquity of ecliptic J2000 (constant vector pointing to Polaris)
export const MOON_AXIAL_TILT_DEG = 1.54;       // 1.5424° relative to the ecliptic normal (Cassini state 2)
export const MOON_ORBIT_INCLINATION_DEG = 5.145; // 5.145° orbital inclination relative to ecliptic

// Rotation Periods (Sidereal / Physical)
export const SUN_CARRINGTON_PERIOD_DAYS = 25.38; // 25.38 days Carrington rotation (equator: 25.05d, poles: 34.4d)
export const EARTH_SIDEREAL_DAY_HOURS = 23.9344696; // 23h 56m 4.09s (86,164.09 seconds)
export const MOON_SIDEREAL_PERIOD_DAYS = 27.321661; // 27.321661 days synchronous rotation (1:1 tidal lock)

// Selenographic Reference Constants
export const MOON_RADIUS_UNITS = 1.25;
export const LUNAR_MEAN_RADIUS_METERS = 1737400;

// Visual Compression Scaling Parameters (Compressed for Human Inspection within Viewport)
export const VISUAL_SCALE_SUN_RADIUS = 8.5;
export const VISUAL_SCALE_EARTH_RADIUS = 2.6;
export const VISUAL_SCALE_MOON_RADIUS = MOON_RADIUS_UNITS; // 1.25
export const VISUAL_SCALE_EARTH_ORBIT_R = 96.0;            // Scaled 1 AU orbit radius
export const VISUAL_SCALE_MOON_ORBIT_R = 14.5;             // Scaled Moon orbit around Earth

// High-Resolution South Pole LOLA Boundary
export const SOUTH_POLE_HIGHRES_LAT_CUTOFF = -83.0;

// Prominent Lunar Landmarks for Selenographic Reference
export interface LunarLandmark {
  name: string;
  lat: number;
  lon: number;
  region: string;
  type?: 'mare' | 'crater' | 'pole' | 'basin';
}

export const GLOBAL_LUNAR_LANDMARKS: LunarLandmark[] = [
  { name: 'APOLLO 11', lat: 0.67, lon: 23.47, region: 'Mare Tranquillitatis', type: 'crater' },
  { name: 'MARE TRANQUILLITATIS', lat: 8.5, lon: 31.4, region: 'Near Side Basalt Patch', type: 'mare' },
  { name: 'MARE SERENITATIS', lat: 28.0, lon: 17.5, region: 'Near Side Basalt Patch', type: 'mare' },
  { name: 'MARE IMBRIUM', lat: 35.0, lon: -16.0, region: 'Near Side Giant Basin', type: 'mare' },
  { name: 'OCEANUS PROCELLARUM', lat: 18.4, lon: -57.4, region: 'Near Side Ocean of Storms', type: 'mare' },
  { name: 'MARE CRISIUM', lat: 17.0, lon: 59.1, region: 'Isolated Circular Mare', type: 'mare' },
  { name: 'COPERNICUS', lat: 9.62, lon: -20.08, region: 'Terraced Crater Patch', type: 'crater' },
  { name: 'TYCHO', lat: -43.3, lon: -11.2, region: 'Highland Ray System', type: 'crater' },
  { name: 'ARISTARCHUS', lat: 23.7, lon: -47.4, region: 'Brightest Albedo Patch', type: 'crater' },
  { name: 'PLATO', lat: 51.6, lon: -9.3, region: 'Dark Flat Floor Crater', type: 'crater' },
  { name: 'SOUTH POLE-AITKEN BASIN', lat: -53.0, lon: 180.0, region: 'Far Side Giant Basin', type: 'basin' },
  { name: 'SHACKLETON CRATER', lat: -89.78, lon: 125.40, region: 'South Pole Artemis Zone', type: 'crater' },
  { name: 'MALAPERT MASSIF', lat: -86.04, lon: 2.70, region: 'Peak of Eternal Light', type: 'crater' },
];

export const formatSiteShortName = (name: string): string => {
  if (!name) return '';
  const lower = name.toLowerCase();
  if (lower.startsWith('de gerlache')) return 'de Gerlache';
  if (lower.startsWith('malapert')) return 'Malapert';
  if (lower.startsWith('shackleton')) return 'Shackleton';
  if (lower.startsWith('haworth')) return 'Haworth';
  return name.replace(' Crater Ridge', '').replace(' Crater Rim', '').replace(' Massif', '');
};

/**
 * Converts Selenographic coordinates (lat, lon in degrees) into 3D Cartesian coordinates
 * on the Moon sphere (Moon local coordinate frame).
 * Lat -90 (South Pole) -> near -Y; Lon 0 (Prime Meridian) -> aligns with +Z (Earth facing).
 */
export function selenographicToCartesian(
  latDeg: number,
  lonDeg: number,
  radius: number = MOON_RADIUS_UNITS,
  elevationMeters: number = 0
): THREE.Vector3 {
  const elevRatio = (elevationMeters / LUNAR_MEAN_RADIUS_METERS) * 0.002;
  const r = radius + elevRatio + 0.001;
  const phi = (90 - latDeg) * (Math.PI / 180);
  const theta = (lonDeg + 180) * (Math.PI / 180);

  const x0 = -r * Math.sin(phi) * Math.cos(theta);
  const y0 = r * Math.cos(phi);
  const z0 = r * Math.sin(phi) * Math.sin(theta);

  // Rotate -90 deg around Y axis so Prime Meridian (0°E) faces +Z (toward Earth)
  const v = new THREE.Vector3(x0, y0, z0);
  v.applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
  return v;
}

/**
 * Inverse conversion: From 3D Cartesian position on Moon sphere back to Selenographic (lat, lon).
 */
export function cartesianToSelenographic(pos: THREE.Vector3): { latDeg: number; lonDeg: number } {
  const p = pos.clone();
  p.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const r = p.length();
  if (r === 0) return { latDeg: 0, lonDeg: 0 };

  const phi = Math.acos(Math.max(-1, Math.min(1, p.y / r)));
  const latDeg = 90 - (phi * 180 / Math.PI);

  const theta = Math.atan2(p.z, -p.x);
  let lonDeg = (theta * 180 / Math.PI) - 180;
  if (lonDeg < -180) lonDeg += 360;
  if (lonDeg > 180) lonDeg -= 360;

  return { latDeg, lonDeg };
}

/**
 * Converts backend MOON_ME Cartesian position (x_me, y_me, z_me) to Three.js coordinates.
 */
export function moonMeToThree(x_me: number, y_me: number, z_me: number): THREE.Vector3 {
  return new THREE.Vector3(y_me, z_me, x_me);
}

/**
 * Generates procedural solar corona radial gradient texture.
 */
function createCoronaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.18, 'rgba(255, 235, 170, 0.95)');
    grad.addColorStop(0.40, 'rgba(255, 180, 50, 0.45)');
    grad.addColorStop(0.70, 'rgba(255, 120, 20, 0.15)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates high-contrast aerospace billboard text sprite for celestial bodies.
 */
function createBillboardSprite(title: string, subtitle: string, accentColor: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 512, 140);
    ctx.fillStyle = 'rgba(4, 6, 8, 0.88)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.fillRect(4, 4, 504, 132);
    ctx.strokeRect(4, 4, 504, 132);

    ctx.fillStyle = accentColor;
    ctx.fillRect(4, 4, 8, 132);

    ctx.font = 'bold 36px "Space Mono", monospace, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(title, 26, 48);

    ctx.font = '500 20px "Space Mono", monospace, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText(subtitle, 26, 92);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(6.8, 1.85, 1.0);
  return sprite;
}

/**
 * Builds an authentic elliptical orbital trail with tangent direction arrows.
 */
function createEllipticalOrbitTrail(
  radiusX: number,
  radiusZ: number,
  inclinationDeg: number,
  color: number,
  segments: number = 256
): THREE.Group {
  const group = new THREE.Group();
  const points: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const x = radiusX * Math.cos(theta);
    const z = radiusZ * Math.sin(theta);
    points.push(new THREE.Vector3(x, 0, z));
  }

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ 
    color, 
    transparent: true, 
    opacity: 0.40,
    linewidth: 1.5,
  });
  const line = new THREE.Line(geo, mat);
  group.add(line);

  // Direction arrows indicating counterclockwise (prograde) motion
  const sampleIndices = [Math.floor(segments * 0.25), Math.floor(segments * 0.75)];
  sampleIndices.forEach((idx) => {
    const p1 = points[idx];
    const p2 = points[(idx + 2) % segments];
    const dir = p2.clone().sub(p1).normalize();
    const arrow = new THREE.ArrowHelper(
      dir,
      p1,
      radiusX * 0.08,
      color,
      radiusX * 0.04,
      radiusX * 0.025
    );
    group.add(arrow);
  });

  group.rotation.x = THREE.MathUtils.degToRad(inclinationDeg);
  return group;
}

export const LunarInteractiveMap: React.FC<LunarInteractiveMapProps> = ({
  sites,
  selectedSiteId,
  onSelectSite,
  selectedForCompare: _selectedForCompare,
  isDemCovered: _isDemCovered = true,
  siteAnalysis,
  epochDate = '2026-10-14',
  epochHour = 12,
  onSimulationEpochChange,
  isAnalyzing = false,
  analysisError = null,
  onSwitchToMoonTrek: _onSwitchToMoonTrek,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Celestial Object References (Unified Sun-Centric Scene)
  const sunGroupRef = useRef<THREE.Group | null>(null);
  const sunTiltGroupRef = useRef<THREE.Group | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const sunPointLightRef = useRef<THREE.PointLight | null>(null);
  const sunAxisLineRef = useRef<THREE.Line | null>(null);

  const earthOrbitGroupRef = useRef<THREE.Group | null>(null);
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const earthTiltGroupRef = useRef<THREE.Group | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const earthCloudsMeshRef = useRef<THREE.Mesh | null>(null);
  const earthAxisLineRef = useRef<THREE.Line | null>(null);
  const polarisArrowRef = useRef<THREE.ArrowHelper | null>(null);
  const earthGraticuleGroupRef = useRef<THREE.Group | null>(null);

  const moonOrbitGroupRef = useRef<THREE.Group | null>(null);
  const moonGroupRef = useRef<THREE.Group | null>(null);
  const moonTiltGroupRef = useRef<THREE.Group | null>(null);
  const moonMeshRef = useRef<THREE.Mesh | null>(null);
  const moonAxisLineRef = useRef<THREE.Line | null>(null);
  const moonGraticuleGroupRef = useRef<THREE.Group | null>(null);
  const moonSitesGroupRef = useRef<THREE.Group | null>(null);

  // CesiumJS NASA Moon Trek Hybrid Layer References
  const cesiumMountRef = useRef<HTMLDivElement | null>(null);
  const cesiumViewerRef = useRef<Cesium.Viewer | null>(null);
  const cesiumTrekLayersRef = useRef<MoonTrekLayerMetadata[]>([]);

  // Celestial Billboard Labels
  const celestialLabelsGroupRef = useRef<THREE.Group | null>(null);
  const sunLabelRef = useRef<THREE.Sprite | null>(null);
  const earthLabelRef = useRef<THREE.Sprite | null>(null);
  const moonLabelRef = useRef<THREE.Sprite | null>(null);

  // Dynamic Positions Cache (for smooth camera tracking without jitter)
  const lastMoonWorldPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const lastEarthWorldPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const hasInitializedCameraRef = useRef<boolean>(false);

  // Camera Focus Target & Zoom State (Zoom target is ALWAYS the Moon in Sun-centric space)
  const [cameraFocusTarget, setCameraFocusTarget] = useState<CameraFocusTarget>('MOON');
  const cameraFocusTargetRef = useRef<CameraFocusTarget>('MOON');
  useEffect(() => {
    cameraFocusTargetRef.current = cameraFocusTarget;
  }, [cameraFocusTarget]);

  // Dataset Layer & Visual Element Toggles
  const [activeLayer, setActiveLayer] = useState<DatasetLayerType>('MOON_TREK_WAC');
  const activeLayerRef = useRef<DatasetLayerType>('MOON_TREK_WAC');
  useEffect(() => {
    activeLayerRef.current = activeLayer;
  }, [activeLayer]);
  const [showOrbits, setShowOrbits] = useState<boolean>(true);
  const [showAxialTilts, setShowAxialTilts] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showHud, setShowHud] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const hasLoadedOnceRef = useRef<boolean>(false);
  useEffect(() => {
    if (!isLoading) {
      hasLoadedOnceRef.current = true;
    }
  }, [isLoading]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hoveredSite, setHoveredSite] = useState<MapSiteItem | null>(null);

  // Camera Distance & Zoom Range Telemetry
  const [cameraDistanceToTarget, setCameraDistanceToTarget] = useState<number>(3.2);

  // Helper to obtain Moon's exact current world-space position in Sun-centric space
  const getMoonWorldPosition = useCallback((): THREE.Vector3 => {
    const worldPos = new THREE.Vector3();
    if (moonMeshRef.current) {
      moonMeshRef.current.getWorldPosition(worldPos);
    } else if (moonGroupRef.current) {
      moonGroupRef.current.getWorldPosition(worldPos);
    } else {
      worldPos.copy(lastMoonWorldPosRef.current);
    }
    return worldPos;
  }, []);

  // Computes wide overview camera offset from the Moon such that the Sun at (0,0,0),
  // Earth, and Moon orbits are all visible, while the camera strictly targets the Moon
  const getSystemOverviewOffset = useCallback((moonPos: THREE.Vector3): THREE.Vector3 => {
    const rXZ = Math.hypot(moonPos.x, moonPos.z);
    const sunToMoonDir = rXZ > 0.001 
      ? new THREE.Vector3(moonPos.x / rXZ, 0, moonPos.z / rXZ) 
      : new THREE.Vector3(1, 0, 0);
    const tangentDir = new THREE.Vector3(-sunToMoonDir.z, 0, sunToMoonDir.x);
    return sunToMoonDir.clone().multiplyScalar(75)
      .add(tangentDir.clone().multiplyScalar(60))
      .add(new THREE.Vector3(0, 110, 0));
  }, []);

  // ---------------------------------------------------------------------------
  // TRUE REAL-TIME SIMULATION CLOCK STATE
  // ---------------------------------------------------------------------------
  const initialTimeMs = useMemo(() => {
    const t = new Date(`${epochDate}T${epochHour.toString().padStart(2, '0')}:00:00Z`).getTime();
    return isNaN(t) ? Date.now() : t;
  }, [epochDate, epochHour]);

  const [simTimeMs, setSimTimeMs] = useState<number>(initialTimeMs);
  const simTimeRef = useRef<number>(initialTimeMs);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [customSpeed, setCustomSpeed] = useState<number>(3600);
  const [showCustomSpeed, setShowCustomSpeed] = useState<boolean>(false);
  const [showAdvancedSpeeds, setShowAdvancedSpeeds] = useState<boolean>(false);
  const [lastEphemSyncTime, setLastEphemSyncTime] = useState<string>('NASA SPICE DE440');
  const [isExactSample, setIsExactSample] = useState<boolean>(true);

  // Synchronized refs for high-frequency 60 FPS animation loop without re-triggering effect
  const isLiveRef = useRef<boolean>(isLive);
  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  const isPlayingRef = useRef<boolean>(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const playbackSpeedRef = useRef<number>(playbackSpeed);
  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  const sitesRef = useRef<MapSiteItem[]>(sites);
  useEffect(() => {
    sitesRef.current = sites;
  }, [sites]);

  const selectedSiteIdRef = useRef<string>(selectedSiteId);
  useEffect(() => {
    selectedSiteIdRef.current = selectedSiteId;
  }, [selectedSiteId]);

  const onSimulationEpochChangeRef = useRef(onSimulationEpochChange);
  useEffect(() => {
    onSimulationEpochChangeRef.current = onSimulationEpochChange;
  }, [onSimulationEpochChange]);

  const showLabelsRef = useRef<boolean>(showLabels);
  useEffect(() => {
    showLabelsRef.current = showLabels;
  }, [showLabels]);

  // Synchronize 3D simulation clock whenever Candidate Site date/hour changes from user input.
  // CRITICAL: Prevent feedback loop where simulation playback updates parent, parent echoes back,
  // and overwrites the continuous clock with truncated :00:00.000Z!
  const lastProcessedDatePropRef = useRef<string>(epochDate);
  const lastProcessedHourPropRef = useRef<number>(epochHour);

  useEffect(() => {
    if (lastProcessedDatePropRef.current === epochDate && lastProcessedHourPropRef.current === epochHour) {
      return;
    }
    lastProcessedDatePropRef.current = epochDate;
    lastProcessedHourPropRef.current = epochHour;

    const targetMs = new Date(`${epochDate}T${epochHour.toString().padStart(2, '0')}:00:00Z`).getTime();
    if (isNaN(targetMs)) return;

    // Check if this prop change is just an echo of the simulation's own playback advancement
    const currentSimDate = new Date(simTimeRef.current);
    const curYMD = `${currentSimDate.getUTCFullYear()}-${String(currentSimDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentSimDate.getUTCDate()).padStart(2, '0')}`;
    const curH = currentSimDate.getUTCHours();

    if ((isPlayingRef.current || isLiveRef.current) && curYMD === epochDate && curH === epochHour) {
      // It's an internal playback echo! Do not overwrite continuous simTimeRef!
      return;
    }

    setSimTimeMs(targetMs);
    simTimeRef.current = targetMs;
    setIsLive(false); // Candidate Site date selection drives simulation
  }, [epochDate, epochHour]);

  // Real-Time Ephemeris Distances & Planetary Parameters (from backend SPICE/IAU)
  const [sunEarthDistanceKm, setSunEarthDistanceKm] = useState<number>(149597870);
  const [earthMoonDistanceKm, setEarthMoonDistanceKm] = useState<number>(384400);

  // STEM Astronomical Mechanics State
  const [celestialMechanics, setCelestialMechanics] = useState<{
    phaseName: string;
    phaseIcon: string;
    phaseAngleDeg: number;
    illuminationPct: number;
    synodicDay: number;
    seasonNorth: string;
    seasonSouth: string;
    tideType: string;
    tideExplanation: string;
    sunTiltDeg: number;
    earthTiltDeg: number;
    moonTiltDeg: number;
    moonOrbitTiltDeg: number;
  }>({
    phaseName: 'FULL MOON',
    phaseIcon: '🌕',
    phaseAngleDeg: 180,
    illuminationPct: 100,
    synodicDay: 14.8,
    seasonNorth: 'AUTUMN (EQUINOX)',
    seasonSouth: 'SPRING',
    tideType: 'SPRING TIDE (MAXIMUM RANGE)',
    tideExplanation: 'Sun, Earth, and Moon are aligned (syzygy), causing maximum gravitational tide.',
    sunTiltDeg: SUN_AXIAL_TILT_DEG,
    earthTiltDeg: EARTH_AXIAL_TILT_DEG,
    moonTiltDeg: MOON_AXIAL_TILT_DEG,
    moonOrbitTiltDeg: MOON_ORBIT_INCLINATION_DEG,
  });

  // Authoritative STEM Astronomical Mechanics for Selected Mission Epoch (Strictly read-only during playback)
  useEffect(() => {
    const epochMs = new Date(`${epochDate}T${epochHour.toString().padStart(2, '0')}:00:00Z`).getTime();
    if (isNaN(epochMs)) return;

    const jd = 2440587.5 + epochMs / 86400000.0;
    const T = (jd - 2451545.0) / 36525.0;

    const L0 = ((280.46646 + 36000.76983 * T) % 360 + 360) % 360;
    const M0 = ((357.52911 + 35999.05029 * T) % 360 + 360) % 360;
    const radM0 = (M0 * Math.PI) / 180;
    const C_deg =
      (1.914602 - 0.004817 * T) * Math.sin(radM0) +
      (0.019993 - 0.000101 * T) * Math.sin(2 * radM0) +
      0.000289 * Math.sin(3 * radM0);
    const sunGeocentricLonDeg = ((L0 + C_deg) % 360 + 360) % 360;
    const earthHeliocentricLonRad = ((sunGeocentricLonDeg + 180.0) * Math.PI) / 180;

    const e_earth = 0.016708634 - 0.000042037 * T;
    const v_earth = radM0 + (C_deg * Math.PI) / 180;
    const R_earthAU = (1.000001018 * (1 - e_earth * e_earth)) / (1 + e_earth * Math.cos(v_earth));
    const sunEarthDistMeters = R_earthAU * 149597870700;

    const currentEarthOrbitR = VISUAL_SCALE_EARTH_ORBIT_R * R_earthAU;
    const posEarthSolar = new THREE.Vector3(
      currentEarthOrbitR * Math.cos(earthHeliocentricLonRad),
      0,
      currentEarthOrbitR * Math.sin(earthHeliocentricLonRad)
    );

    const Lp = ((218.3164477 + 481267.88123421 * T) % 360 + 360) % 360;
    const D = ((297.8501921 + 445267.11140340 * T) % 360 + 360) % 360;
    const M_lunar = ((357.5291092 + 35999.05029090 * T) % 360 + 360) % 360;
    const Mp = ((134.9633964 + 477198.86750550 * T) % 360 + 360) % 360;
    const F = ((93.2720950 + 483202.01752330 * T) % 360 + 360) % 360;

    const radD = (D * Math.PI) / 180;
    const radM = (M_lunar * Math.PI) / 180;
    const radMp = (Mp * Math.PI) / 180;
    const radF = (F * Math.PI) / 180;

    const deltaLonDeg =
      6.288774 * Math.sin(radMp) +
      1.274027 * Math.sin(2 * radD - radMp) +
      0.658314 * Math.sin(2 * radD) +
      0.213618 * Math.sin(2 * radMp) -
      0.185116 * Math.sin(radM) -
      0.114332 * Math.sin(2 * radF);

    const deltaLatDeg =
      5.128154 * Math.sin(radF) +
      0.280602 * Math.sin(radMp + radF) +
      0.277693 * Math.sin(radMp - radF) +
      0.173237 * Math.sin(2 * radD - radF);

    const rMoonKm =
      385000.56 -
      20905.355 * Math.cos(radMp) -
      3699.111 * Math.cos(2 * radD - radMp) -
      2955.968 * Math.cos(2 * radD) -
      569.925 * Math.cos(2 * radMp);
    const earthMoonDistMeters = rMoonKm * 1000;

    setSunEarthDistanceKm(Math.round(sunEarthDistMeters / 1000));
    setEarthMoonDistanceKm(Math.round(earthMoonDistMeters / 1000));

    const moonEclipticLonRad = (((Lp + deltaLonDeg) % 360 + 360) * Math.PI) / 180;
    const moonEclipticLatRad = (deltaLatDeg * Math.PI) / 180;
    const currentMoonOrbitR = VISUAL_SCALE_MOON_ORBIT_R * (rMoonKm / 384400.0);

    const moonRelEarthVec = new THREE.Vector3(
      currentMoonOrbitR * Math.cos(moonEclipticLatRad) * Math.cos(moonEclipticLonRad),
      currentMoonOrbitR * Math.sin(moonEclipticLatRad),
      currentMoonOrbitR * Math.cos(moonEclipticLatRad) * Math.sin(moonEclipticLonRad)
    );
    const posMoonSolar = posEarthSolar.clone().add(moonRelEarthVec);

    const dirToSun = new THREE.Vector3(0, 0, 0).sub(posEarthSolar).normalize();
    const dirToMoon = posMoonSolar.clone().sub(posEarthSolar).normalize();
    const dotSM = THREE.MathUtils.clamp(dirToSun.dot(dirToMoon), -1, 1);
    const crossSM = new THREE.Vector3().crossVectors(dirToSun, dirToMoon);
    let synodicAngleDeg = THREE.MathUtils.radToDeg(Math.acos(dotSM));
    if (crossSM.y < 0) synodicAngleDeg = 360 - synodicAngleDeg;

    const illuminationPct = Math.round(((1 - Math.cos(THREE.MathUtils.degToRad(synodicAngleDeg))) / 2) * 100);
    const synodicDay = Number(((synodicAngleDeg / 360) * 29.53059).toFixed(1));

    let phaseName = 'NEW MOON';
    let phaseIcon = '🌑';
    if (synodicAngleDeg >= 348.75 || synodicAngleDeg < 11.25) {
      phaseName = 'NEW MOON';
      phaseIcon = '🌑';
    } else if (synodicAngleDeg >= 11.25 && synodicAngleDeg < 78.75) {
      phaseName = 'WAXING CRESCENT';
      phaseIcon = '🌒';
    } else if (synodicAngleDeg >= 78.75 && synodicAngleDeg < 101.25) {
      phaseName = 'FIRST QUARTER';
      phaseIcon = '🌓';
    } else if (synodicAngleDeg >= 101.25 && synodicAngleDeg < 168.75) {
      phaseName = 'WAXING GIBBOUS';
      phaseIcon = '🌔';
    } else if (synodicAngleDeg >= 168.75 && synodicAngleDeg < 191.25) {
      phaseName = 'FULL MOON';
      phaseIcon = '🌕';
    } else if (synodicAngleDeg >= 191.25 && synodicAngleDeg < 258.75) {
      phaseName = 'WANING GIBBOUS';
      phaseIcon = '🌖';
    } else if (synodicAngleDeg >= 258.75 && synodicAngleDeg < 281.25) {
      phaseName = 'THIRD QUARTER';
      phaseIcon = '🌗';
    } else {
      phaseName = 'WANING CRESCENT';
      phaseIcon = '🌘';
    }

    let tideType = 'TRANSITIONAL TIDE';
    let tideExplanation = 'Moderate gravitational alignment between Sun, Earth, and Moon.';
    const alignmentDelta = Math.min(Math.abs(synodicAngleDeg - 0), Math.abs(synodicAngleDeg - 180), Math.abs(synodicAngleDeg - 360));
    const quadratureDelta = Math.min(Math.abs(synodicAngleDeg - 90), Math.abs(synodicAngleDeg - 270));

    if (alignmentDelta <= 24.0) {
      tideType = 'SPRING TIDE (MAX RANGE)';
      tideExplanation = 'Sun, Earth, and Moon in syzygy produce maximum tidal range.';
    } else if (quadratureDelta <= 24.0) {
      tideType = 'NEAP TIDE (MIN RANGE)';
      tideExplanation = 'Sun and Moon at 90° quadrature partially cancel gravitational bulge.';
    }

    const simDate = new Date(epochMs);
    const startOfYear = new Date(Date.UTC(simDate.getUTCFullYear(), 0, 1));
    const dayOfYear = Math.floor((simDate.getTime() - startOfYear.getTime()) / 86400000);
    let seasonNorth = 'SPRING (TRANSITION)';
    let seasonSouth = 'AUTUMN (TRANSITION)';
    if (dayOfYear >= 79 && dayOfYear < 172) {
      seasonNorth = 'SPRING (TILT SHIFTING NORTH)';
      seasonSouth = 'AUTUMN (TILT SHIFTING SOUTH)';
    } else if (dayOfYear >= 172 && dayOfYear < 265) {
      seasonNorth = 'SUMMER (NORTH TILTED TO SUN)';
      seasonSouth = 'WINTER (SOUTH TILTED AWAY)';
    } else if (dayOfYear >= 265 && dayOfYear < 355) {
      seasonNorth = 'AUTUMN (EQUINOX SHIFT)';
      seasonSouth = 'SPRING (EQUINOX SHIFT)';
    } else {
      seasonNorth = 'WINTER (NORTH TILTED AWAY)';
      seasonSouth = 'SUMMER (SOUTH TILTED TO SUN)';
    }

    setCelestialMechanics({
      phaseName,
      phaseIcon,
      phaseAngleDeg: Math.round(synodicAngleDeg),
      illuminationPct,
      synodicDay,
      seasonNorth,
      seasonSouth,
      tideType,
      tideExplanation,
      sunTiltDeg: SUN_AXIAL_TILT_DEG,
      earthTiltDeg: EARTH_AXIAL_TILT_DEG,
      moonTiltDeg: MOON_AXIAL_TILT_DEG,
      moonOrbitTiltDeg: MOON_ORBIT_INCLINATION_DEG,
    });
  }, [epochDate, epochHour]);

  // SPICE Ephemeris Anchor Reference (Dual-sample NLERP interpolation)
  const ephemAnchorRef = useRef<{
    sample0: {
      epochMs: number;
      sunPosME: THREE.Vector3;
      earthPosME: THREE.Vector3;
    };
    sample1: {
      epochMs: number;
      sunPosME: THREE.Vector3;
      earthPosME: THREE.Vector3;
    };
    isFetching: boolean;
  }>({
    sample0: {
      epochMs: initialTimeMs,
      sunPosME: new THREE.Vector3(-110745137108, 99537685656, -3288986482),
      earthPosME: new THREE.Vector3(398091625, 18186446, 46191528),
    },
    sample1: {
      epochMs: initialTimeMs + 600000,
      sunPosME: new THREE.Vector3(-110745137108 + 245405 * 600, 99537685656 + 273185 * 600, -3288986482 - 413 * 600),
      earthPosME: new THREE.Vector3(398091625 - 45 * 600, 18186446 + 980 * 600, 46191528 + 210 * 600),
    },
    isFetching: false,
  });

  // Current Active Selected Site
  const currentActiveSite = useMemo(() => {
    return sites.find((s) => s.id === selectedSiteId) || sites[0] || null;
  }, [sites, selectedSiteId]);

  // Screen projections for 2D HTML/SVG markers overlay on Moon surface
  const [projectedMarkers, setProjectedMarkers] = useState<
    Array<{
      site: MapSiteItem;
      screenX: number;
      screenY: number;
      isVisible: boolean;
      isSelected: boolean;
    }>
  >([]);

  // Textures Cache Ref
  const texturesRef = useRef<{
    lrocColor: THREE.Texture | null;
    elevation: THREE.Texture | null;
    bumpMap: THREE.Texture | null;
    earthDay: THREE.Texture | null;
    earthNight: THREE.Texture | null;
    earthClouds: THREE.Texture | null;
    sunCorona: THREE.Texture | null;
    sunPhotosphere: THREE.Texture | null;
  }>({
    lrocColor: null,
    elevation: null,
    bumpMap: null,
    earthDay: null,
    earthNight: null,
    earthClouds: null,
    sunCorona: null,
    sunPhotosphere: null,
  });

  // Fullscreen Management
  const toggleFullscreen = useCallback(() => {
    if (!mountRef.current) return;
    if (!document.fullscreenElement) {
      mountRef.current.requestFullscreen().catch((err) => console.warn(err));
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === mountRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Sync Authoritative Backend SPICE Vectors when siteAnalysis changes
  useEffect(() => {
    if (!siteAnalysis) return;
    const epochMs = new Date(initialTimeMs).getTime();

    if (siteAnalysis.sun?.targetPositionMoonCenteredME && siteAnalysis.earth?.targetPositionMoonCenteredME) {
      const sp = siteAnalysis.sun.targetPositionMoonCenteredME;
      const ep = siteAnalysis.earth.targetPositionMoonCenteredME;
      const vSun = siteAnalysis.sun.targetVelocityMoonCenteredME || { x: 245405, y: 273185, z: -413 };
      const vEarth = siteAnalysis.earth.targetVelocityMoonCenteredME || { x: -45, y: 980, z: 210 };
      const dt = 600;

      ephemAnchorRef.current.sample0 = {
        epochMs: epochMs,
        sunPosME: new THREE.Vector3(sp.x, sp.y, sp.z),
        earthPosME: new THREE.Vector3(ep.x, ep.y, ep.z),
      };
      ephemAnchorRef.current.sample1 = {
        epochMs: epochMs + dt * 1000,
        sunPosME: new THREE.Vector3(sp.x + vSun.x * dt, sp.y + vSun.y * dt, sp.z + vSun.z * dt),
        earthPosME: new THREE.Vector3(ep.x + vEarth.x * dt, ep.y + vEarth.y * dt, ep.z + vEarth.z * dt),
      };

      setLastEphemSyncTime(`SPICE DE440 • ${new Date(epochMs).toISOString().substring(11, 19)} UTC`);
      setIsExactSample(true);
      setTimeout(() => setIsExactSample(false), 3000);
    }
  }, [siteAnalysis, initialTimeMs]);

  // ---------------------------------------------------------------------------
  // Initialize CesiumJS NASA Moon Trek Lunar Globe (Transparent Overlay Layer)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const cesiumMount = cesiumMountRef.current;
    if (!cesiumMount) return;

    // Define Selenographic Ellipsoid (Moon Sphere with mean radius 1,737,400 m)
    const lunarEllipsoid = new Cesium.Ellipsoid(
      LUNAR_MEAN_RADIUS_METERS,
      LUNAR_MEAN_RADIUS_METERS,
      LUNAR_MEAN_RADIUS_METERS
    );

    (window as any).CESIUM_BASE_URL = '/cesium';

    const lunarTilingScheme = new Cesium.GeographicTilingScheme({
      ellipsoid: lunarEllipsoid,
      numberOfLevelZeroTilesX: 2,
      numberOfLevelZeroTilesY: 1,
    });

    // Base NASA Moon Trek LROC WAC 100m Global Mosaic WMTS Provider
    const lrocProvider = new Cesium.UrlTemplateImageryProvider({
      url: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
      tilingScheme: lunarTilingScheme,
      ellipsoid: lunarEllipsoid,
      minimumLevel: 0,
      maximumLevel: 8,
      credit: new Cesium.Credit('NASA / GSFC / ASU (LROC) - NASA Moon Trek WMTS', true),
    });

    const viewer = new Cesium.Viewer(cesiumMount, {
      globe: new Cesium.Globe(lunarEllipsoid),
      baseLayer: new Cesium.ImageryLayer(lrocProvider),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      animation: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      vrButton: false,
      skyBox: false as any,
      skyAtmosphere: false as any,
      contextOptions: {
        webgl: {
          alpha: true,
        },
      },
    });

    cesiumViewerRef.current = viewer;

    // Transparent background allowing Three.js Sun & Earth to be visible
    viewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#14171a');
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.highDynamicRange = true;

    // Synchronize simulation time with Candidate Site Date & Hour
    const simIso = `${epochDate}T${epochHour.toString().padStart(2, '0')}:00:00Z`;
    try {
      const julianDate = Cesium.JulianDate.fromIso8601(simIso);
      viewer.clock.currentTime = julianDate;
      viewer.clock.shouldAnimate = false;
    } catch {
      // ignore
    }

    // Screen-space click handler for selecting pins directly on globe
    const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction((click: any) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.id) {
        onSelectSite(pickedObject.id.id);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Load available layer catalog from backend
    lunarApi.getMoonTrekLayers().then((loaded) => {
      if (loaded && loaded.length > 0) {
        cesiumTrekLayersRef.current = loaded;
      }
    });

    return () => {
      clickHandler.destroy();
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
      cesiumViewerRef.current = null;
    };
  }, [onSelectSite]);

  // Synchronize Candidate Landing Site Beacons on Cesium globe without tearing down viewer
  useEffect(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    viewer.entities.removeAll();

    const lunarEllipsoid = new Cesium.Ellipsoid(
      LUNAR_MEAN_RADIUS_METERS,
      LUNAR_MEAN_RADIUS_METERS,
      LUNAR_MEAN_RADIUS_METERS
    );

    sites.forEach((site) => {
      const isSelected = site.id === selectedSiteId;
      const isCompared = _selectedForCompare?.includes(site.id);
      const pinColor = isSelected
        ? Cesium.Color.fromCssColorString('#00FF9D')
        : isCompared
        ? Cesium.Color.fromCssColorString('#58D8D0')
        : site.id.includes('shackleton')
        ? Cesium.Color.fromCssColorString('#58D8D0')
        : site.id.includes('malapert')
        ? Cesium.Color.fromCssColorString('#ECC068')
        : site.id.includes('gerlache')
        ? Cesium.Color.fromCssColorString('#78F5EC')
        : Cesium.Color.fromCssColorString('#FFB3B0');

      const position = Cesium.Cartesian3.fromDegrees(
        site.longitudeDeg,
        site.latitudeDeg,
        site.elevationMeters || 0,
        lunarEllipsoid
      );

      viewer.entities.add({
        id: site.id,
        name: site.name,
        position: position,
        point: {
          pixelSize: isSelected ? 14 : isCompared ? 10 : 8,
          color: pinColor,
          outlineColor: isSelected ? Cesium.Color.BLACK : Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: 500000.0,
        },
        label: {
          text: ` ${formatSiteShortName(site.name)}${isSelected ? ' [ACTIVE]' : isCompared ? ' [COMPARE]' : ''} `,
          font: isSelected ? 'bold 12px "Space Mono", monospace' : '11px "Space Mono", monospace',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: isSelected ? Cesium.Color.fromCssColorString('#00FF9D') : Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          disableDepthTestDistance: 500000.0,
        },
      });
    });
  }, [sites, selectedSiteId, _selectedForCompare]);

  // Synchronize Cesium sunlight orientation with Candidate Site Date & Hour
  useEffect(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const simIso = `${epochDate}T${epochHour.toString().padStart(2, '0')}:00:00Z`;
    try {
      const julianDate = Cesium.JulianDate.fromIso8601(simIso);
      viewer.clock.currentTime = julianDate;
    } catch {
      // ignore
    }
  }, [epochDate, epochHour]);

  // ---------------------------------------------------------------------------
  // Initialize Three.js Unified Sun-Centric 3D Celestial Scene
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040608);
    sceneRef.current = scene;

    // Perspective camera with wide depth range covering Moon close-up (0.02) to full solar system (5000)
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 5000);
    // Initial framing: start focused near the Moon so user immediately sees the lunar mission target
    camera.position.set(0, 1.2, 3.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. OrbitControls (Configured to target the Moon's world-space position)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = MOON_RADIUS_UNITS + 0.20; // Inspect surface craters without passing through Moon
    controls.maxDistance = 550.0;                   // Full Sun-centric system overview
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.85;
    controlsRef.current = controls;

    // 3. Ambient & Fill Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.22);
    scene.add(ambientLight);

    // Deep space fill light
    const fillLight = new THREE.DirectionalLight(0x708899, 0.15);
    fillLight.position.set(-50, -30, -50);
    scene.add(fillLight);

    // 4. Load Authentic NASA Textures
    const textureLoader = new THREE.TextureLoader();
    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= 3) setIsLoading(false);
    };

    const lrocColor = textureLoader.load('/textures/moon/lroc_color_4k.jpg', checkLoaded);
    lrocColor.colorSpace = THREE.SRGBColorSpace;
    const elevation = textureLoader.load('/textures/moon/lunar_elevation_4k.jpg', checkLoaded);
    elevation.colorSpace = THREE.SRGBColorSpace;
    const bumpMap = textureLoader.load('/textures/moon/ldem_4k_bump.jpg', checkLoaded);

    const earthDay = textureLoader.load('/textures/earth/2k_earth_daymap.jpg', checkLoaded);
    earthDay.colorSpace = THREE.SRGBColorSpace;
    const earthNight = textureLoader.load('/textures/earth/2k_earth_nightmap.jpg', checkLoaded);
    earthNight.colorSpace = THREE.SRGBColorSpace;
    const earthClouds = textureLoader.load('/textures/earth/2k_earth_clouds.jpg', checkLoaded);

    const sunPhotosphere = textureLoader.load('/textures/sun/sun_photosphere_2k.jpg', checkLoaded);
    sunPhotosphere.colorSpace = THREE.SRGBColorSpace;

    const sunCorona = createCoronaTexture();

    const maxAnisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    [lrocColor, elevation, bumpMap, earthDay, earthNight, earthClouds, sunPhotosphere].forEach((tex) => {
      if (!tex) return;
      tex.anisotropy = maxAnisotropy;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
    });

    texturesRef.current = {
      lrocColor,
      elevation,
      bumpMap,
      earthDay,
      earthNight,
      earthClouds,
      sunCorona,
      sunPhotosphere,
    };

    // =========================================================================
    // 5. SUN AT (0,0,0) — CENTRAL HELIOCENTRIC REFERENCE BODY
    // =========================================================================
    const sunGroup = new THREE.Group();
    sunGroup.position.set(0, 0, 0); // Sun is at origin in Sun-centric frame
    scene.add(sunGroup);
    sunGroupRef.current = sunGroup;

    // Sun Axial Tilt Group: Tilted by 7.25° relative to the ecliptic normal
    // Ascending node of solar equator on ecliptic Ω_sun ≈ 75.76° J2000
    const sunTiltGroup = new THREE.Group();
    const sunTiltRad = THREE.MathUtils.degToRad(SUN_AXIAL_TILT_DEG);
    const sunNodeRad = THREE.MathUtils.degToRad(75.76);
    // Construct Sun spin axis vector tilted 7.25° to ecliptic normal (0,1,0)
    const sunAxisVec = new THREE.Vector3(
      Math.sin(sunTiltRad) * Math.sin(sunNodeRad),
      Math.cos(sunTiltRad),
      -Math.sin(sunTiltRad) * Math.cos(sunNodeRad)
    ).normalize();
    sunTiltGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sunAxisVec);
    sunGroup.add(sunTiltGroup);
    sunTiltGroupRef.current = sunTiltGroup;

    // High-Resolution Solar Photosphere Sphere Geometry & Material
    const sunGeo = new THREE.SphereGeometry(VISUAL_SCALE_SUN_RADIUS, 64, 64);
    const sunShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunMap: { value: sunPhotosphere },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D uSunMap;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 texColor = texture2D(uSunMap, vUv);
          float mu = max(dot(vNormal, vViewDir), 0.0);
          // Eddington solar limb darkening: I(mu) = I0 * [1 - 0.60 * (1 - mu)]
          float limbDarkening = 0.40 + 0.60 * pow(mu, 0.65);
          float flare = sin(vUv.x * 60.0 + uTime * 0.4) * cos(vUv.y * 60.0 + uTime * 0.3) * 0.035;
          vec3 finalColor = texColor.rgb * (limbDarkening + flare) * 1.35;
          float rim = pow(1.0 - mu, 3.2);
          finalColor += vec3(1.0, 0.72, 0.32) * rim * 0.95;
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunShaderMat);
    sunTiltGroup.add(sunMesh);
    sunMeshRef.current = sunMesh;

    // Inner Corona Sprite
    const coronaMat = new THREE.SpriteMaterial({
      map: sunCorona,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const coronaSprite = new THREE.Sprite(coronaMat);
    coronaSprite.scale.set(40, 40, 1);
    sunGroup.add(coronaSprite);

    // Outer Solar Glow Halo
    const outerHaloMat = new THREE.SpriteMaterial({
      map: sunCorona,
      color: 0xffeedd,
      transparent: true,
      opacity: 0.40,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const outerHaloSprite = new THREE.Sprite(outerHaloMat);
    outerHaloSprite.scale.set(85, 85, 1);
    sunGroup.add(outerHaloSprite);

    // 3D Sun Rotational Axis Indicator (7.25° tilt to ecliptic)
    const sunAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -VISUAL_SCALE_SUN_RADIUS * 1.55, 0),
      new THREE.Vector3(0, VISUAL_SCALE_SUN_RADIUS * 1.55, 0),
    ]);
    const sunAxisMat = new THREE.LineBasicMaterial({
      color: 0xECC068,
      transparent: true,
      opacity: 0.75,
      linewidth: 2,
    });
    const sunAxisLine = new THREE.Line(sunAxisGeo, sunAxisMat);
    sunTiltGroup.add(sunAxisLine);
    sunAxisLineRef.current = sunAxisLine;

    // Sun North Pole pointer arrow
    const sunArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, VISUAL_SCALE_SUN_RADIUS * 1.55, 0),
      VISUAL_SCALE_SUN_RADIUS * 0.45,
      0xECC068,
      VISUAL_SCALE_SUN_RADIUS * 0.22,
      VISUAL_SCALE_SUN_RADIUS * 0.14
    );
    sunTiltGroup.add(sunArrow);

    // Heliocentric Solar Illuminator Lights radiating from (0,0,0)
    const sunLight = new THREE.DirectionalLight(0xfffaea, 2.3);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    const sunPointLight = new THREE.PointLight(0xfffaea, 2.0, 1500, 0.4);
    sunPointLight.position.set(0, 0, 0);
    scene.add(sunPointLight);
    sunPointLightRef.current = sunPointLight;

    // =========================================================================
    // 6. EARTH ON HELIOCENTRIC ORBIT
    // =========================================================================
    // Earth Heliocentric Orbit Line in Ecliptic Plane (eccentricity e = 0.0167)
    const earthOrbitGroup = createEllipticalOrbitTrail(
      VISUAL_SCALE_EARTH_ORBIT_R,
      VISUAL_SCALE_EARTH_ORBIT_R * 0.99986,
      0, // in ecliptic plane (0° inclination)
      0x58D8D0,
      256
    );
    scene.add(earthOrbitGroup);
    earthOrbitGroupRef.current = earthOrbitGroup;

    // Earth Group
    const earthGroup = new THREE.Group();
    earthGroup.position.set(VISUAL_SCALE_EARTH_ORBIT_R, 0, 0);
    scene.add(earthGroup);
    earthGroupRef.current = earthGroup;

    // Earth Tilt Group: Fixed 23.44° inclination relative to ecliptic normal pointing constantly to Polaris
    const earthTiltGroup = new THREE.Group();
    const earthTiltRad = THREE.MathUtils.degToRad(EARTH_AXIAL_TILT_DEG);
    const earthAxisVec = new THREE.Vector3(0, Math.cos(earthTiltRad), -Math.sin(earthTiltRad)).normalize();
    earthTiltGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), earthAxisVec);
    earthGroup.add(earthTiltGroup);
    earthTiltGroupRef.current = earthTiltGroup;

    // Earth Sphere Geometry & Day/Night Shader Material
    const earthGeo = new THREE.SphereGeometry(VISUAL_SCALE_EARTH_RADIUS, 64, 64);
    const earthShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: earthDay },
        uNightMap: { value: earthNight },
        uSunDir: { value: new THREE.Vector3(-1, 0, 0).normalize() },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
          vUv = uv;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D uDayMap;
        uniform sampler2D uNightMap;
        uniform vec3 uSunDir;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;

        void main() {
          float nDotL = dot(vWorldNormal, uSunDir);
          float dayFactor = smoothstep(-0.12, 0.18, nDotL);
          vec3 dayColor = texture2D(uDayMap, vUv).rgb;
          vec3 nightColor = texture2D(uNightMap, vUv).rgb;

          vec3 litDay = dayColor * (dayFactor * 1.25 + 0.04);
          vec3 litNight = nightColor * (1.0 - dayFactor) * 2.8;

          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float limb = pow(1.0 - max(dot(viewDir, vWorldNormal), 0.0), 3.0);
          vec3 atmosphere = vec3(0.18, 0.52, 0.98) * limb * (dayFactor * 0.85 + 0.15);

          gl_FragColor = vec4(litDay + litNight + atmosphere, 1.0);
        }
      `,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthShaderMat);
    earthTiltGroup.add(earthMesh);
    earthMeshRef.current = earthMesh;

    // Earth Atmospheric Clouds Layer
    const cloudGeo = new THREE.SphereGeometry(VISUAL_SCALE_EARTH_RADIUS * 1.025, 64, 64);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: earthClouds,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      roughness: 1.0,
      depthWrite: false,
    });
    const earthCloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
    earthMesh.add(earthCloudsMesh);
    earthCloudsMeshRef.current = earthCloudsMesh;

    // 3D Earth 23.44° Rotational Axis Indicator Line & Polaris Arrow
    const earthAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -VISUAL_SCALE_EARTH_RADIUS * 1.6, 0),
      new THREE.Vector3(0, VISUAL_SCALE_EARTH_RADIUS * 1.6, 0),
    ]);
    const earthAxisMat = new THREE.LineBasicMaterial({
      color: 0x58D8D0,
      transparent: true,
      opacity: 0.75,
      linewidth: 2,
    });
    const earthAxisLine = new THREE.Line(earthAxisGeo, earthAxisMat);
    earthTiltGroup.add(earthAxisLine);
    earthAxisLineRef.current = earthAxisLine;

    const polarisArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, VISUAL_SCALE_EARTH_RADIUS * 1.6, 0),
      VISUAL_SCALE_EARTH_RADIUS * 0.45,
      0x58D8D0,
      VISUAL_SCALE_EARTH_RADIUS * 0.22,
      VISUAL_SCALE_EARTH_RADIUS * 0.14
    );
    earthTiltGroup.add(polarisArrow);
    polarisArrowRef.current = polarisArrow;

    // Earth Cartographic Graticule (Equator, Tropics ±23.44°, Polar Circles ±66.56°, Meridians)
    const earthGraticuleGroup = new THREE.Group();
    const createEarthParallel = (latDeg: number, color: number, opacity: number, linewidth: number = 1) => {
      const phi = (90 - latDeg) * (Math.PI / 180);
      const ringRadius = VISUAL_SCALE_EARTH_RADIUS * 1.003 * Math.sin(phi);
      const ringY = VISUAL_SCALE_EARTH_RADIUS * 1.003 * Math.cos(phi);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 128; i++) {
        const theta = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(ringRadius * Math.cos(theta), ringY, ringRadius * Math.sin(theta)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, linewidth });
      return new THREE.Line(geo, mat);
    };

    earthGraticuleGroup.add(createEarthParallel(0, 0x58D8D0, 0.55, 2));         // Equator
    earthGraticuleGroup.add(createEarthParallel(23.44, 0xECC068, 0.45));        // Tropic of Cancer
    earthGraticuleGroup.add(createEarthParallel(-23.44, 0xECC068, 0.45));       // Tropic of Capricorn
    earthGraticuleGroup.add(createEarthParallel(66.56, 0x58D8D0, 0.40));        // Arctic Circle
    earthGraticuleGroup.add(createEarthParallel(-66.56, 0x58D8D0, 0.40));       // Antarctic Circle

    [0, 45, 90, 135, 180, 225, 270, 315].forEach((lonDeg) => {
      const isPrime = lonDeg === 0 || lonDeg === 180;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 128; i++) {
        const phi = (i / 128) * Math.PI;
        const theta = lonDeg * (Math.PI / 180);
        const x = VISUAL_SCALE_EARTH_RADIUS * 1.003 * Math.sin(phi) * Math.cos(theta);
        const y = VISUAL_SCALE_EARTH_RADIUS * 1.003 * Math.cos(phi);
        const z = VISUAL_SCALE_EARTH_RADIUS * 1.003 * Math.sin(phi) * Math.sin(theta);
        pts.push(new THREE.Vector3(x, y, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: isPrime ? 0x58D8D0 : 0xffffff,
        transparent: true,
        opacity: isPrime ? 0.45 : 0.12,
      });
      earthGraticuleGroup.add(new THREE.Line(geo, mat));
    });
    earthTiltGroup.add(earthGraticuleGroup);
    earthGraticuleGroupRef.current = earthGraticuleGroup;

    // Moon Geocentric Orbital Trail (Centered on Earth, Inclined by 5.145° to Ecliptic)
    const moonOrbitGroup = createEllipticalOrbitTrail(
      VISUAL_SCALE_MOON_ORBIT_R,
      VISUAL_SCALE_MOON_ORBIT_R * 0.9985, // eccentricity e_moon ≈ 0.0549
      MOON_ORBIT_INCLINATION_DEG,
      0xECC068,
      192
    );
    scene.add(moonOrbitGroup);
    moonOrbitGroupRef.current = moonOrbitGroup;

    // =========================================================================
    // 7. MOON REVOLVING AROUND EARTH (TIDALLY LOCKED, 1.54° AXIAL TILT)
    // =========================================================================
    const moonGroup = new THREE.Group();
    scene.add(moonGroup);
    moonGroupRef.current = moonGroup;

    // Moon Axial Tilt Group: 1.54° inclination relative to the ecliptic normal (Cassini state 2)
    const moonTiltGroup = new THREE.Group();
    const moonTiltRad = THREE.MathUtils.degToRad(MOON_AXIAL_TILT_DEG);
    const moonAxisVec = new THREE.Vector3(0, Math.cos(moonTiltRad), Math.sin(moonTiltRad)).normalize();
    moonTiltGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), moonAxisVec);
    moonGroup.add(moonTiltGroup);
    moonTiltGroupRef.current = moonTiltGroup;

    // Moon Sphere Mesh
    const moonGeo = new THREE.SphereGeometry(MOON_RADIUS_UNITS, 128, 128);
    const moonMat = new THREE.MeshStandardMaterial({
      map: lrocColor,
      bumpMap: bumpMap,
      bumpScale: 0.08,
      roughness: 0.92,
      metalness: 0.02,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonTiltGroup.add(moonMesh);
    moonMeshRef.current = moonMesh;

    // 3D Moon Rotational Axis Line (1.54° relative to ecliptic normal)
    const moonAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -MOON_RADIUS_UNITS * 1.55, 0),
      new THREE.Vector3(0, MOON_RADIUS_UNITS * 1.55, 0),
    ]);
    const moonAxisMat = new THREE.LineBasicMaterial({
      color: 0x00FF9D,
      transparent: true,
      opacity: 0.75,
      linewidth: 2,
    });
    const moonAxisLine = new THREE.Line(moonAxisGeo, moonAxisMat);
    moonTiltGroup.add(moonAxisLine);
    moonAxisLineRef.current = moonAxisLine;

    // Lunar North Pole Arrow
    const moonArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, MOON_RADIUS_UNITS * 1.55, 0),
      MOON_RADIUS_UNITS * 0.45,
      0x00FF9D,
      MOON_RADIUS_UNITS * 0.22,
      MOON_RADIUS_UNITS * 0.14
    );
    moonTiltGroup.add(moonArrow);

    // Lunar Cartographic Graticule (Equator, Polar Boundary -83°, Prime Meridian)
    const moonGraticuleGroup = new THREE.Group();
    const createParallelRing = (latDeg: number, color: number = 0xffffff, opacity: number = 0.15) => {
      const phi = (90 - latDeg) * (Math.PI / 180);
      const ringRadius = MOON_RADIUS_UNITS * 1.002 * Math.sin(phi);
      const ringY = MOON_RADIUS_UNITS * 1.002 * Math.cos(phi);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const theta = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(ringRadius * Math.cos(theta), ringY, ringRadius * Math.sin(theta)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
      return new THREE.Line(geo, mat);
    };

    moonGraticuleGroup.add(createParallelRing(0, 0x58D8D0, 0.40));
    moonGraticuleGroup.add(createParallelRing(-83, 0xECC068, 0.45)); // South Pole LOLA Boundary
    moonGraticuleGroup.add(createParallelRing(-85, 0xECC068, 0.35));
    [-60, -30, 30, 60].forEach((lat) => {
      moonGraticuleGroup.add(createParallelRing(lat, 0xffffff, 0.12));
    });

    [0, 90, 180, 270].forEach((lonDeg) => {
      const isPrime = lonDeg === 0;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const phi = (i / 96) * Math.PI;
        const theta = lonDeg * (Math.PI / 180);
        const x = MOON_RADIUS_UNITS * 1.002 * Math.sin(phi) * Math.cos(theta);
        const y = MOON_RADIUS_UNITS * 1.002 * Math.cos(phi);
        const z = MOON_RADIUS_UNITS * 1.002 * Math.sin(phi) * Math.sin(theta);
        pts.push(new THREE.Vector3(x, y, z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: isPrime ? 0x58D8D0 : 0xffffff,
        transparent: true,
        opacity: isPrime ? 0.40 : 0.12,
      });
      moonGraticuleGroup.add(new THREE.Line(geo, mat));
    });
    moonTiltGroup.add(moonGraticuleGroup);
    moonGraticuleGroupRef.current = moonGraticuleGroup;

    // 3D Physical Pins & Markers for South Pole Candidate Landing Sites on Moon Sphere
    const moonSitesGroup = new THREE.Group();
    sites.forEach((site) => {
      const sitePos = selenographicToCartesian(site.latitudeDeg, site.longitudeDeg, MOON_RADIUS_UNITS);
      const pinColor = site.id.includes('shackleton')
        ? 0x58D8D0
        : site.id.includes('malapert')
        ? 0xECC068
        : site.id.includes('gerlache')
        ? 0x78F5EC
        : 0xFFB3B0;

      // Small 3D Pin Beacon
      const dotGeo = new THREE.SphereGeometry(0.02, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: pinColor });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(sitePos);
      moonSitesGroup.add(dot);

      // Micro Pillar Beacon
      const normal = sitePos.clone().normalize();
      const beamGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.09, 8);
      const beamMat = new THREE.MeshBasicMaterial({ color: pinColor, transparent: true, opacity: 0.8 });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.copy(sitePos.clone().add(normal.clone().multiplyScalar(0.045)));
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      moonSitesGroup.add(beam);
    });
    moonTiltGroup.add(moonSitesGroup);
    moonSitesGroupRef.current = moonSitesGroup;

    // =========================================================================
    // 8. CELESTIAL BILLBOARD LABELS
    // =========================================================================
    const labelsGroup = new THREE.Group();
    const sunLabel = createBillboardSprite('SUN', '7.25° AXIAL TILT • 25.38D CARRINGTON', '#ECC068');
    const earthLabel = createBillboardSprite('EARTH', '23.44° OBLIQUITY • 24.0H DAY • 1 AU', '#58D8D0');
    const moonLabel = createBillboardSprite('MOON', '1.54° AXIAL TILT • 27.3D TIDALLY LOCKED', '#00FF9D');

    labelsGroup.add(sunLabel);
    labelsGroup.add(earthLabel);
    labelsGroup.add(moonLabel);
    scene.add(labelsGroup);
    celestialLabelsGroupRef.current = labelsGroup;
    sunLabelRef.current = sunLabel;
    earthLabelRef.current = earthLabel;
    moonLabelRef.current = moonLabel;

    // =========================================================================
    // 9. RESIZE OBSERVER & CLEANUP
    // =========================================================================
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
      if (cesiumViewerRef.current && !cesiumViewerRef.current.isDestroyed()) {
        cesiumViewerRef.current.resize();
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      renderer.dispose();
      sunGeo.dispose();
      sunShaderMat.dispose();
      earthGeo.dispose();
      earthShaderMat.dispose();
      cloudGeo.dispose();
      moonGeo.dispose();
      moonMat.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [sites]);

  // Switch NASA Moon Trek WMTS Layer on Cesium Globe & Three.js Fallback
  useEffect(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const lunarEllipsoid = new Cesium.Ellipsoid(
      LUNAR_MEAN_RADIUS_METERS,
      LUNAR_MEAN_RADIUS_METERS,
      LUNAR_MEAN_RADIUS_METERS
    );
    const lunarTilingScheme = new Cesium.GeographicTilingScheme({
      ellipsoid: lunarEllipsoid,
      numberOfLevelZeroTilesX: 2,
      numberOfLevelZeroTilesY: 1,
    });

    let layerUrl = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg';
    let attribution = 'NASA / GSFC / ASU (LROC) - NASA Moon Trek WMTS';
    let maxZoom = 8;

    if (activeLayer === 'MOON_TREK_LOLA') {
      layerUrl = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_ClrShade_Global_128ppd_v04/1.0.0/default/default028mm/{z}/{y}/{x}.jpg';
      attribution = 'NASA / GSFC / Barker et al. (LOLA Altimetry)';
      maxZoom = 7;
    } else if (activeLayer === 'MOON_TREK_RELIEF') {
      layerUrl = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLAKaguya_Hillshade_60N60S_512ppd/1.0.0/default/default028mm/{z}/{y}/{x}.png';
      attribution = 'NASA / JAXA SELENE (Kaguya Grayscale Relief)';
      maxZoom = 8;
    }

    if (activeLayer.startsWith('MOON_TREK_')) {
      if (cesiumMountRef.current) cesiumMountRef.current.style.opacity = '1';
      if (moonMeshRef.current) moonMeshRef.current.visible = true;

      const imageryLayers = viewer.imageryLayers;
      imageryLayers.removeAll();
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: layerUrl,
        tilingScheme: lunarTilingScheme,
        ellipsoid: lunarEllipsoid,
        minimumLevel: 0,
        maximumLevel: maxZoom,
        credit: new Cesium.Credit(attribution, true),
      });
      imageryLayers.addImageryProvider(provider);
    } else {
      // Fallback Three.js lunar texture mode
      if (cesiumMountRef.current) cesiumMountRef.current.style.opacity = '0';
      if (moonMeshRef.current) moonMeshRef.current.visible = true;

      if (texturesRef.current && moonMeshRef.current) {
        const textures = texturesRef.current;
        const targetTex = activeLayer === 'ELEVATION' ? textures.elevation : textures.lrocColor;
        if (targetTex) {
          const mat = moonMeshRef.current.material as THREE.MeshStandardMaterial;
          mat.map = targetTex;
          mat.needsUpdate = true;
        }
      }
    }
  }, [activeLayer]);

  // Visibility Toggles Effect
  useEffect(() => {
    if (earthOrbitGroupRef.current) earthOrbitGroupRef.current.visible = showOrbits;
    if (moonOrbitGroupRef.current) moonOrbitGroupRef.current.visible = showOrbits;
    if (sunAxisLineRef.current) sunAxisLineRef.current.visible = showAxialTilts;
    if (earthAxisLineRef.current) earthAxisLineRef.current.visible = showAxialTilts;
    if (polarisArrowRef.current) polarisArrowRef.current.visible = showAxialTilts;
    if (moonAxisLineRef.current) moonAxisLineRef.current.visible = showAxialTilts;
    if (earthGraticuleGroupRef.current) earthGraticuleGroupRef.current.visible = showAxialTilts;
    if (moonGraticuleGroupRef.current) moonGraticuleGroupRef.current.visible = showAxialTilts;
    if (celestialLabelsGroupRef.current) celestialLabelsGroupRef.current.visible = showLabels;
  }, [showOrbits, showAxialTilts, showLabels]);

  // 2D Projected candidate site markers on Moon surface (calculated statically upon site selection)
  useEffect(() => {
    const camera = cameraRef.current;
    const container = canvasMountRef.current || mountRef.current;
    if (!camera || !container) return;

    const cWidth = container.clientWidth;
    const cHeight = container.clientHeight;
    const halfW = cWidth / 2;
    const halfH = cHeight / 2;

    const posMoonSolar = lastMoonWorldPosRef.current;

    const projections = sites.map((site) => {
      const localSitePos = selenographicToCartesian(site.latitudeDeg, site.longitudeDeg, MOON_RADIUS_UNITS);
      const worldPos = localSitePos.clone();
      if (moonTiltGroupRef.current) {
        worldPos.applyMatrix4(moonTiltGroupRef.current.matrixWorld);
      } else {
        worldPos.add(posMoonSolar);
      }

      const surfaceNormal = worldPos.clone().sub(posMoonSolar).normalize();
      const camToPoint = camera.position.clone().sub(worldPos).normalize();
      const dot = surfaceNormal.dot(camToPoint);

      const distToCam = camera.position.distanceTo(worldPos);
      const isVisible = dot > 0.10 && distToCam < 45.0;

      const screenVec = worldPos.clone().project(camera);
      const screenX = screenVec.x * halfW + halfW;
      const screenY = -(screenVec.y * halfH) + halfH;

      return {
        site,
        screenX,
        screenY,
        isVisible,
        isSelected: site.id === selectedSiteId,
      };
    });

    setProjectedMarkers(projections);
  }, [sites, selectedSiteId]);

  // ---------------------------------------------------------------------------
  // CONTINUOUS 60 FPS HELIOCENTRIC SIMULATION & DYNAMIC CAMERA TRACKING LOOP
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let animationFrameId: number;
    let lastRealTime = performance.now();

    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const deltaRealMs = Math.min(100, Math.max(0, time - lastRealTime));
      lastRealTime = time;

      // 1. Advance Simulation Clock continuously using high-resolution monotonic elapsed time
      let currentSimTime = simTimeRef.current;
      if (isLiveRef.current) {
        currentSimTime = Date.now();
        simTimeRef.current = currentSimTime;
      } else if (isPlayingRef.current) {
        currentSimTime = simTimeRef.current + deltaRealMs * playbackSpeedRef.current;
        simTimeRef.current = currentSimTime;
      }

      if (!Number.isFinite(currentSimTime)) {
        currentSimTime = Date.now();
        simTimeRef.current = currentSimTime;
      }

      // =======================================================================
      // 2. MATHEMATICALLY RIGOROUS HELIOCENTRIC INERTIAL EPHEMERIS
      // Sun: Fixed stationary at (0, 0, 0) [Central Reference Body]
      // Earth: Revolves around the Sun in Ecliptic Plane (365.256d period)
      // Moon: Revolves around Earth with 5.145° orbital inclination (27.322d period)
      // =======================================================================
      const jd = 2440587.5 + currentSimTime / 86400000.0;
      const T = (jd - 2451545.0) / 36525.0;

      // A. Earth Heliocentric Orbit around the stationary Sun (IAU / Meeus)
      const L0 = ((280.46646 + 36000.76983 * T) % 360 + 360) % 360;
      const M0 = ((357.52911 + 35999.05029 * T) % 360 + 360) % 360;
      const radM0 = (M0 * Math.PI) / 180;
      const C_deg =
        (1.914602 - 0.004817 * T) * Math.sin(radM0) +
        (0.019993 - 0.000101 * T) * Math.sin(2 * radM0) +
        0.000289 * Math.sin(3 * radM0);
      const sunGeocentricLonDeg = ((L0 + C_deg) % 360 + 360) % 360;
      // Earth heliocentric longitude is opposite the geocentric Sun longitude (λ_Earth = λ_Sun + 180°)
      const earthHeliocentricLonRad = ((sunGeocentricLonDeg + 180.0) * Math.PI) / 180;

      const e_earth = 0.016708634 - 0.000042037 * T;
      const v_earth = radM0 + (C_deg * Math.PI) / 180;
      const R_earthAU = (1.000001018 * (1 - e_earth * e_earth)) / (1 + e_earth * Math.cos(v_earth));

      // Earth's position revolving around the stationary Sun at (0, 0, 0)
      const currentEarthOrbitR = VISUAL_SCALE_EARTH_ORBIT_R * R_earthAU;
      const posEarthSolar = new THREE.Vector3(
        currentEarthOrbitR * Math.cos(earthHeliocentricLonRad),
        0,
        currentEarthOrbitR * Math.sin(earthHeliocentricLonRad)
      );

      // B. Moon Geocentric Orbit around Earth (Brown / ELP-2000)
      const Lp = ((218.3164477 + 481267.88123421 * T) % 360 + 360) % 360;
      const D = ((297.8501921 + 445267.11140340 * T) % 360 + 360) % 360;
      const M_lunar = ((357.5291092 + 35999.05029090 * T) % 360 + 360) % 360;
      const Mp = ((134.9633964 + 477198.86750550 * T) % 360 + 360) % 360;
      const F = ((93.2720950 + 483202.01752330 * T) % 360 + 360) % 360;

      const radD = (D * Math.PI) / 180;
      const radM = (M_lunar * Math.PI) / 180;
      const radMp = (Mp * Math.PI) / 180;
      const radF = (F * Math.PI) / 180;

      const deltaLonDeg =
        6.288774 * Math.sin(radMp) +
        1.274027 * Math.sin(2 * radD - radMp) +
        0.658314 * Math.sin(2 * radD) +
        0.213618 * Math.sin(2 * radMp) -
        0.185116 * Math.sin(radM) -
        0.114332 * Math.sin(2 * radF);

      const deltaLatDeg =
        5.128154 * Math.sin(radF) +
        0.280602 * Math.sin(radMp + radF) +
        0.277693 * Math.sin(radMp - radF) +
        0.173237 * Math.sin(2 * radD - radF);

      const rMoonKm =
        385000.56 -
        20905.355 * Math.cos(radMp) -
        3699.111 * Math.cos(2 * radD - radMp) -
        2955.968 * Math.cos(2 * radD) -
        569.925 * Math.cos(2 * radMp);

      const moonEclipticLonRad = (((Lp + deltaLonDeg) % 360 + 360) * Math.PI) / 180;
      const moonEclipticLatRad = (deltaLatDeg * Math.PI) / 180;
      const currentMoonOrbitR = VISUAL_SCALE_MOON_ORBIT_R * (rMoonKm / 384400.0);

      // Moon relative to Earth (with authentic 5.145° orbital inclination to ecliptic)
      const moonRelEarthVec = new THREE.Vector3(
        currentMoonOrbitR * Math.cos(moonEclipticLatRad) * Math.cos(moonEclipticLonRad),
        currentMoonOrbitR * Math.sin(moonEclipticLatRad),
        currentMoonOrbitR * Math.cos(moonEclipticLatRad) * Math.sin(moonEclipticLonRad)
      );

      // Moon Heliocentric Position = Earth Position + Moon relative to Earth
      const posMoonSolar = posEarthSolar.clone().add(moonRelEarthVec);

      // Update Earth Group position
      if (earthGroupRef.current) {
        earthGroupRef.current.position.copy(posEarthSolar);
      }

      // Update Moon Orbit Group position (stays centered on Earth)
      if (moonOrbitGroupRef.current) {
        moonOrbitGroupRef.current.position.copy(posEarthSolar);
      }

      // Update Moon Group position (revolving around Earth)
      if (moonGroupRef.current) {
        moonGroupRef.current.position.copy(posMoonSolar);
      }

      // Sun lighting targets Earth and Moon
      if (sunLightRef.current) {
        sunLightRef.current.target.position.copy(posEarthSolar);
      }

      // =======================================================================
      // 3. SCIENTIFIC AXIAL ROTATIONS & PHYSICAL ORIENTATIONS
      // =======================================================================
      const d = jd - 2451545.0;

      // A. Sun Carrington Continuous Rotation around its 7.25° tilted axis
      // Carrington period ≈ 25.38 days
      const sunRotationAngleRad = THREE.MathUtils.degToRad(((360.0 / SUN_CARRINGTON_PERIOD_DAYS) * d) % 360);
      if (sunMeshRef.current) {
        sunMeshRef.current.rotation.y = sunRotationAngleRad;
        const mat = sunMeshRef.current.material as THREE.ShaderMaterial;
        if (mat.uniforms && mat.uniforms.uTime) {
          mat.uniforms.uTime.value = (time * 0.001) % 1000;
        }
      }

      // B. Earth Axial Rotation around its 23.44° tilted axis (fixed to Polaris)
      // Greenwich Mean Sidereal Time / Earth Rotation Angle
      const earthRotationAngleRad = THREE.MathUtils.degToRad(((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360);
      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.y = earthRotationAngleRad;
        // Earth day/night shader terminator faces Sun at (0,0,0)
        const mat = earthMeshRef.current.material as THREE.ShaderMaterial;
        if (mat.uniforms && mat.uniforms.uSunDir) {
          mat.uniforms.uSunDir.value = posEarthSolar.clone().negate().normalize();
        }
      }

      // C. Moon Synchronous Tidal Locking to Earth (1:1 lock, 1.54° axial tilt)
      // The lunar near side (+Z in selenographic frame) continuously faces Earth
      if (moonTiltGroupRef.current) {
        const toEarth = posEarthSolar.clone().sub(posMoonSolar).normalize();
        // Align local +Z toward Earth while local +Y maintains 1.54° tilt
        const rotMat = new THREE.Matrix4();
        const upAxis = new THREE.Vector3(0, 1, 0);
        rotMat.lookAt(new THREE.Vector3(0, 0, 0), toEarth.clone().negate(), upAxis);
        moonTiltGroupRef.current.quaternion.setFromRotationMatrix(rotMat);
      }

      // =======================================================================
      // 4. UPDATE CELESTIAL BILLBOARD LABELS
      // =======================================================================
      if (celestialLabelsGroupRef.current && showLabelsRef.current) {
        if (sunLabelRef.current) sunLabelRef.current.position.set(0, VISUAL_SCALE_SUN_RADIUS + 4.5, 0);
        if (earthLabelRef.current) earthLabelRef.current.position.set(posEarthSolar.x, posEarthSolar.y + VISUAL_SCALE_EARTH_RADIUS + 3.5, posEarthSolar.z);
        if (moonLabelRef.current) moonLabelRef.current.position.set(posMoonSolar.x, posMoonSolar.y + MOON_RADIUS_UNITS + 2.5, posMoonSolar.z);
      }

      // =======================================================================
      // 5. CONTINUOUS DYNAMIC CAMERA TRACKING (ZOOM TARGET ALWAYS LOCKS TO MOON)
      // =======================================================================
      const controls = controlsRef.current;
      const camera = cameraRef.current;

      if (controls && camera) {
        if (!hasInitializedCameraRef.current) {
          // Initial Frame: Set OrbitControls target strictly to the Moon's world-space position
          // and position camera at the overview offset so Sun, Earth and Moon orbits are in view
          controls.target.copy(posMoonSolar);
          const initialOffset = getSystemOverviewOffset(posMoonSolar);
          camera.position.copy(posMoonSolar).add(initialOffset);
          controls.update();
          lastMoonWorldPosRef.current.copy(posMoonSolar);
          hasInitializedCameraRef.current = true;
        } else {
          // Dynamic tracking: displace camera & controls target by Moon's orbital motion delta
          const prevMoonPos = lastMoonWorldPosRef.current;
          if (prevMoonPos.lengthSq() > 0.001) {
            const deltaMoon = posMoonSolar.clone().sub(prevMoonPos);
            if (Number.isFinite(deltaMoon.x) && Number.isFinite(deltaMoon.y) && Number.isFinite(deltaMoon.z)) {
              if (deltaMoon.lengthSq() < 10000) {
                // Lock controls.target directly to Moon's current world position
                if (!gsap.isTweening(controls.target)) {
                  controls.target.copy(posMoonSolar);
                }
                // Displace camera along with the Moon to maintain constant relative framing without jitter
                if (!gsap.isTweening(camera.position)) {
                  camera.position.add(deltaMoon);
                }
              } else {
                // If a large discontinuous jump occurred (e.g. user selected distant year),
                // preserve relative offset to Moon without snapping camera to infinity
                const camOffset = camera.position.clone().sub(prevMoonPos);
                controls.target.copy(posMoonSolar);
                camera.position.copy(posMoonSolar).add(camOffset);
              }
            }
          }
          controls.update();
        }
      }

      // Store positions for next frame delta
      lastMoonWorldPosRef.current.copy(posMoonSolar);
      lastEarthWorldPosRef.current.copy(posEarthSolar);

      // =======================================================================
      // 6. SYNCHRONIZE CESIUM GLOBE IN LOCKSTEP WITH THREE.JS CAMERA & MOON
      // =======================================================================
      const cesiumViewer = cesiumViewerRef.current;
      if (cesiumViewer && !cesiumViewer.isDestroyed() && cameraRef.current) {
        try {
          const cam = cameraRef.current;
          const vWorld = cam.position.clone().sub(posMoonSolar);
          const distUnits = vWorld.length();

          const isMoonTrekActive = activeLayerRef.current.startsWith('MOON_TREK_');
          // When Moon Trek Cesium overlay is active at close range during static inspection,
          // hide underlying base mesh to avoid z-fighting; during high-speed orbital playback (1h/s, 1d/s),
          // keep Three.js 4K mesh visible so celestial bodies never disappear or blink.
          if (isMoonTrekActive && distUnits <= 120.0 && (!isPlayingRef.current || playbackSpeedRef.current <= 10)) {
            if (moonMeshRef.current) moonMeshRef.current.visible = false;
          } else {
            if (moonMeshRef.current) moonMeshRef.current.visible = true;
          }

          if (isMoonTrekActive && distUnits <= 120.0 && cesiumMountRef.current) {
            cesiumMountRef.current.style.opacity = '1';

            const moonWorldQuat = new THREE.Quaternion();
            if (moonTiltGroupRef.current) {
              moonTiltGroupRef.current.getWorldQuaternion(moonWorldQuat);
            }

            const vLocal = vWorld.clone().applyQuaternion(moonWorldQuat.clone().invert());
            const { latDeg, lonDeg } = cartesianToSelenographic(vLocal);

            if (Number.isFinite(latDeg) && Number.isFinite(lonDeg)) {
              const altitudeMeters = Math.max(
                30000.0,
                (distUnits - MOON_RADIUS_UNITS) * (LUNAR_MEAN_RADIUS_METERS / MOON_RADIUS_UNITS)
              );

              const lunarEllipsoid = new Cesium.Ellipsoid(
                LUNAR_MEAN_RADIUS_METERS,
                LUNAR_MEAN_RADIUS_METERS,
                LUNAR_MEAN_RADIUS_METERS
              );

              const destCesium = Cesium.Cartesian3.fromDegrees(
                lonDeg,
                latDeg,
                altitudeMeters,
                lunarEllipsoid
              );

              const upWorld = cam.up.clone().applyQuaternion(cam.quaternion);
              const upLocal = upWorld.applyQuaternion(moonWorldQuat.clone().invert());
              const upCesium = new Cesium.Cartesian3(upLocal.z, -upLocal.x, upLocal.y);

              cesiumViewer.camera.setView({
                destination: destCesium,
                orientation: {
                  direction: Cesium.Cartesian3.negate(
                    Cesium.Cartesian3.normalize(destCesium, new Cesium.Cartesian3()),
                    new Cesium.Cartesian3()
                  ),
                  up: upCesium,
                },
              });

              try {
                const julianDate = Cesium.JulianDate.fromIso8601(new Date(currentSimTime).toISOString());
                cesiumViewer.clock.currentTime = julianDate;
              } catch {
                // ignore
              }
            }
          } else if (distUnits > 120.0 && cesiumMountRef.current) {
            cesiumMountRef.current.style.opacity = '0';
          }
        } catch {
          // Guard against any Cesium camera/math exception interrupting WebGL render
        }
      }

      // =======================================================================
      // 10. RENDER HELIOCENTRIC THREE.JS SCENE AT FULL 60 FPS
      // =======================================================================
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []); // Mounted once: dynamic values are tracked via stable refs

  // ---------------------------------------------------------------------------
  // Camera Navigation & Zoom Transition Controls (Always Moon-Targeted)
  // ---------------------------------------------------------------------------
  const handleFocusMoon = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const moonPos = getMoonWorldPosition();

    setCameraFocusTarget('MOON');
    setCameraDistanceToTarget(3.2);
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);

    // Smoothly fly camera to inspect Moon close-up
    gsap.to(controls.target, {
      x: moonPos.x,
      y: moonPos.y,
      z: moonPos.z,
      duration: 1.4,
      ease: 'power2.inOut',
    });
    gsap.to(camera.position, {
      x: moonPos.x + 0.8,
      y: moonPos.y + 1.2,
      z: moonPos.z + 2.8,
      duration: 1.4,
      ease: 'power2.inOut',
      onUpdate: () => controls.update(),
    });
  }, [getMoonWorldPosition]);

  const handleZoomMoonClose = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const moonPos = getMoonWorldPosition();

    setCameraFocusTarget('MOON');
    setCameraDistanceToTarget(2.0);
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);

    // Tight zoom on Moon surface (South Pole candidate landing sites)
    gsap.to(controls.target, {
      x: moonPos.x,
      y: moonPos.y,
      z: moonPos.z,
      duration: 1.3,
      ease: 'power2.inOut',
    });
    gsap.to(camera.position, {
      x: moonPos.x + 0.35,
      y: moonPos.y - 0.75,
      z: moonPos.z + 1.85,
      duration: 1.3,
      ease: 'power2.inOut',
      onUpdate: () => controls.update(),
    });
  }, [getMoonWorldPosition]);

  const handleZoomEarthMoon = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const moonPos = getMoonWorldPosition();

    setCameraFocusTarget('MOON');
    setCameraDistanceToTarget(31.0);
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);

    // Medium framing: Earth and Moon revolving together, targeting the Moon
    gsap.to(controls.target, {
      x: moonPos.x,
      y: moonPos.y,
      z: moonPos.z,
      duration: 1.5,
      ease: 'power2.inOut',
    });
    gsap.to(camera.position, {
      x: moonPos.x + 8.0,
      y: moonPos.y + 16.0,
      z: moonPos.z + 26.0,
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => controls.update(),
    });
  }, [getMoonWorldPosition]);

  const handleZoomSystemOverview = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const moonPos = getMoonWorldPosition();
    const overviewOffset = getSystemOverviewOffset(moonPos);

    setCameraFocusTarget('MOON');
    setCameraDistanceToTarget(146.0);
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);

    // Wide perspective: Sun at origin, Earth & Moon orbits visible, targeting the Moon
    gsap.to(controls.target, {
      x: moonPos.x,
      y: moonPos.y,
      z: moonPos.z,
      duration: 1.6,
      ease: 'power2.inOut',
    });
    gsap.to(camera.position, {
      x: moonPos.x + overviewOffset.x,
      y: moonPos.y + overviewOffset.y,
      z: moonPos.z + overviewOffset.z,
      duration: 1.6,
      ease: 'power2.inOut',
      onUpdate: () => controls.update(),
    });
  }, [getMoonWorldPosition, getSystemOverviewOffset]);

  const handleStepZoom = useCallback((factor: number) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const moonPos = getMoonWorldPosition();

    // Lock controls target to the Moon
    controls.target.copy(moonPos);

    const offset = camera.position.clone().sub(moonPos);
    const newDist = THREE.MathUtils.clamp(
      offset.length() * factor,
      controls.minDistance,
      controls.maxDistance
    );
    offset.setLength(newDist);
    setCameraDistanceToTarget(newDist);

    gsap.killTweensOf(camera.position);
    gsap.to(camera.position, {
      x: moonPos.x + offset.x,
      y: moonPos.y + offset.y,
      z: moonPos.z + offset.z,
      duration: 0.45,
      ease: 'power1.out',
      onUpdate: () => controls.update(),
    });
  }, [getMoonWorldPosition]);

  const handleFocusCandidateSite = useCallback((site: MapSiteItem) => {
    onSelectSite(site.id);
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const moonPos = getMoonWorldPosition();

    setCameraFocusTarget('MOON');
    setCameraDistanceToTarget(2.6);
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);

    // Compute surface vector for site in Moon local frame
    const siteLocal = selenographicToCartesian(site.latitudeDeg, site.longitudeDeg, MOON_RADIUS_UNITS);
    const siteWorld = siteLocal.clone();
    if (moonTiltGroupRef.current) {
      siteWorld.applyMatrix4(moonTiltGroupRef.current.matrixWorld);
    } else {
      siteWorld.add(moonPos);
    }

    const camOffset = siteWorld.clone().sub(moonPos).normalize().multiplyScalar(2.6);

    gsap.to(controls.target, {
      x: moonPos.x,
      y: moonPos.y,
      z: moonPos.z,
      duration: 1.3,
      ease: 'power2.inOut',
    });
    gsap.to(camera.position, {
      x: moonPos.x + camOffset.x,
      y: moonPos.y + camOffset.y + 0.35,
      z: moonPos.z + camOffset.z,
      duration: 1.3,
      ease: 'power2.inOut',
      onUpdate: () => controls.update(),
    });
  }, [getMoonWorldPosition, onSelectSite]);

  // Smoothly orient camera to focus on selected landing site when selectedSiteId changes
  const prevSelectedSiteIdRef = useRef<string>(selectedSiteId);
  useEffect(() => {
    if (!selectedSiteId || selectedSiteId === prevSelectedSiteIdRef.current) return;
    prevSelectedSiteIdRef.current = selectedSiteId;
    const targetSite = sites.find((s) => s.id === selectedSiteId);
    if (!targetSite) return;
    if (cameraFocusTarget === 'MOON') {
      handleFocusCandidateSite(targetSite);
    }
  }, [selectedSiteId, sites, cameraFocusTarget, handleFocusCandidateSite]);

  // ---------------------------------------------------------------------------
  // Time Stepping Handlers (Affects 3D visual clock only; never mutates mission configuration)
  // ---------------------------------------------------------------------------
  const handleStepTime = useCallback((hours: number) => {
    setIsLive(false);
    simTimeRef.current += hours * 3600 * 1000;
    setSimTimeMs(simTimeRef.current);
  }, []);

  const handleStepMinutes = useCallback((minutes: number) => {
    setIsLive(false);
    simTimeRef.current += minutes * 60 * 1000;
    setSimTimeMs(simTimeRef.current);
  }, []);

  const handleResetTimeToLive = useCallback(() => {
    setIsLive(true);
    setIsPlaying(true);
    setPlaybackSpeed(1);
    const now = Date.now();
    simTimeRef.current = now;
    setSimTimeMs(now);
  }, []);

  const handleResetToMissionEpoch = useCallback(() => {
    setIsLive(false);
    setIsPlaying(false);
    setPlaybackSpeed(1);
    const targetMs = new Date(`${epochDate}T${epochHour.toString().padStart(2, '0')}:00:00Z`).getTime();
    if (!isNaN(targetMs)) {
      simTimeRef.current = targetMs;
      setSimTimeMs(targetMs);
    }
  }, [epochDate, epochHour]);

  const formattedSimUtc = useMemo(() => {
    const d = new Date(simTimeMs);
    return isNaN(d.getTime()) ? '2026-10-14 12:00:00 UTC' : d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  }, [simTimeMs]);

  return (
    <div 
      ref={mountRef}
      className={`${isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'relative w-full h-[520px] sm:h-[600px] md:h-[660px] lg:h-[720px]'} bg-[#040608] border border-white/20 overflow-hidden flex flex-col select-none group rounded-none`}
    >
      {/* 3D Three.js WebGL Canvas Mount */}
      <div 
        ref={canvasMountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing outline-none" 
      />

      {/* CesiumJS NASA Moon Trek Transparent Overlay Layer */}
      <div 
        ref={cesiumMountRef} 
        className="cesium-viewer-transparent absolute inset-0 w-full h-full pointer-events-none z-10 overflow-hidden" 
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-[#040608]/90 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-30 transition-opacity duration-500">
          <div className="w-9 h-9 border-2 border-white/20 border-t-[#58D8D0] rounded-full animate-spin" />
          <div className="font-mono text-xs text-white/70 tracking-widest uppercase">
            Initializing Unified Heliocentric 3D Engine (Sun → Earth → Moon)...
          </div>
        </div>
      )}

      {/* =========================================================================
          TOP COMMAND BAR: UNIFIED SUN-CENTRIC NAVIGATION & CONFIGURATION TOOLBARS
      ========================================================================= */}
      <div className="absolute top-2 left-2 right-2 flex flex-col gap-1 pointer-events-none z-20">
        <SimulationControlToolbar
          cameraFocusTarget={cameraFocusTarget}
          onFocusMoon={handleFocusMoon}
          onZoomMoonClose={handleZoomMoonClose}
          onZoomEarthMoon={handleZoomEarthMoon}
          onZoomSystemOverview={handleZoomSystemOverview}
          onStepZoom={handleStepZoom}
          showOrbits={showOrbits}
          onToggleOrbits={() => setShowOrbits((prev) => !prev)}
          showAxialTilts={showAxialTilts}
          onToggleAxialTilts={() => setShowAxialTilts((prev) => !prev)}
          showLabels={showLabels}
          onToggleLabels={() => setShowLabels((prev) => !prev)}
          showHud={showHud}
          onToggleHud={() => setShowHud((prev) => !prev)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          isLoading={isLoading && !hasLoadedOnceRef.current}
        />

        <SimulationConfigToolbar
          sites={sites}
          selectedSiteId={selectedSiteId}
          onSelectSite={(site) => handleFocusCandidateSite(site)}
          activeLayer={activeLayer}
          onSelectLayer={(layer) => setActiveLayer(layer)}
          isLoading={isLoading && !hasLoadedOnceRef.current}
        />
      </div>

      {/* Floating Non-disruptive Ephemeris Calculation Status Overlay (Never shifts toolbars) */}
      {isAnalyzing && (
        <div className="absolute top-[86px] left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 bg-black/95 border border-[#58D8D0]/80 text-[#58D8D0] font-mono text-[10px] uppercase tracking-wider shadow-[0_0_20px_rgba(88,216,208,0.25)] pointer-events-auto z-30 animate-in fade-in select-none">
          <RefreshCw size={11} className="animate-spin text-[#58D8D0] shrink-0" />
          <span className="whitespace-nowrap">RECALCULATING SPICE DE440 EPHEMERIS FOR {epochDate}...</span>
        </div>
      )}

      {/* Floating Non-disruptive Ephemeris Warning Overlay (Never shifts toolbars) */}
      {analysisError && (
        <div className="absolute top-[86px] left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-red-950/95 border border-red-500 text-red-200 font-mono text-[10px] tracking-wide shadow-2xl max-w-md text-center pointer-events-auto z-30 animate-in fade-in select-none">
          <AlertTriangle size={12} className="text-red-400 shrink-0" />
          <span>{analysisError}</span>
        </div>
      )}

      {/* =========================================================================
          AEROSPACE SCIENTIFIC TELEMETRY DOSSIER (Section 8 Requirements)
      ========================================================================= */}
      {showHud && (
        <div className="absolute top-[86px] left-2 flex flex-col gap-1 z-10 pointer-events-none max-w-xs sm:max-w-sm">
          
          {/* Header Card: Active Target Tracking & Framing Distance */}
          <div className="px-2.5 py-1 bg-black/95 border border-white/20 rounded-none flex items-center justify-between font-mono text-[9.5px]">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-none ${isLive ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
              <span className="font-bold text-white uppercase tracking-wider">
                ZOOM TARGET: MOON ({formatSiteShortName(currentActiveSite?.name || 'South Pole')})
              </span>
            </div>
            <span className="text-[#58D8D0] font-bold tabular-nums">
              RANGE: {cameraDistanceToTarget < 5.0 ? `${cameraDistanceToTarget.toFixed(2)}u [SURFACE INSPECT]` : cameraDistanceToTarget < 50.0 ? `${cameraDistanceToTarget.toFixed(1)}u [EARTH-MOON]` : `${cameraDistanceToTarget.toFixed(0)}u [FULL SYSTEM]`}
            </span>
          </div>

          {/* Scientific Ephemeris & Axial Tilt Dossier (Actual values & constants) */}
          <div className="px-2.5 py-1.5 bg-black/95 border border-white/20 rounded-none flex flex-col gap-1 font-mono text-[9px] text-white/85">
            
            {/* SUN PARAMETERS */}
            <div className="flex flex-col gap-0.5 pb-1 border-b border-white/10">
              <div className="flex items-center justify-between text-amber-300 font-bold">
                <span className="flex items-center gap-1">
                  <Sun size={10} /> SUN (CENTRAL REFERENCE AT 0,0,0):
                </span>
                <span className="text-white text-[8px] uppercase">G2V YELLOW DWARF</span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-white/70">
                <span>Axial Tilt:</span>
                <span className="text-white font-bold">{SUN_AXIAL_TILT_DEG}° to Ecliptic Normal</span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-white/70">
                <span>Rotation Period:</span>
                <span className="text-white font-bold">{SUN_CARRINGTON_PERIOD_DAYS}d (Carrington) • 25.05d Equator</span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-white/70">
                <span>Sun–Earth Distance:</span>
                <span className="text-amber-300 font-bold tabular-nums">
                  {(sunEarthDistanceKm / 1e6).toFixed(2)}M km ({(sunEarthDistanceKm / 149597870.7).toFixed(4)} AU)
                </span>
              </div>
            </div>

            {/* EARTH PARAMETERS */}
            <div className="flex flex-col gap-0.5 pb-1 border-b border-white/10">
              <div className="flex items-center justify-between text-[#58D8D0] font-bold">
                <span className="flex items-center gap-1">
                  <Globe size={10} /> EARTH (HELIOCENTRIC REVOLUTION):
                </span>
                <span className="text-white text-[8px] uppercase">1.000 AU ORBIT</span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-white/70">
                <span>Axial Tilt (Obliquity):</span>
                <span className="text-white font-bold">{EARTH_AXIAL_TILT_DEG}° to Ecliptic (Fixed to Polaris)</span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-white/70">
                <span>Rotation Period:</span>
                <span className="text-white font-bold">23.9345h Sidereal (24.00h Solar Day)</span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-white/70">
                <span>Terminator Day/Night:</span>
                <span className="text-emerald-400 font-bold">Active Facing Sun at (0,0,0)</span>
              </div>
            </div>

            {/* MOON PARAMETERS */}
            <div className="flex flex-col gap-0.5 pb-1 border-b border-white/10">
              <div className="flex items-center justify-between text-[#00FF9D] font-bold">
                <span className="flex items-center gap-1">
                  <span>🌕</span> MOON (GEOCENTRIC REVOLUTION):
                </span>
                <span className="text-white text-[8px] uppercase">TIDALLY LOCKED</span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-white/70">
                <span>Axial Tilt (Cassini State 2):</span>
                <span className="text-white font-bold">{MOON_AXIAL_TILT_DEG}° to Ecliptic Normal</span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-white/70">
                <span>Orbital Inclination:</span>
                <span className="text-white font-bold">{MOON_ORBIT_INCLINATION_DEG}° relative to Ecliptic</span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-white/70">
                <span>Rotation & Orbit Period:</span>
                <span className="text-white font-bold">{MOON_SIDEREAL_PERIOD_DAYS}d Sidereal (1:1 Synchronous)</span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-white/70">
                <span>Earth–Moon Distance:</span>
                <span className="text-[#58D8D0] font-bold tabular-nums">
                  {earthMoonDistanceKm.toLocaleString()} km
                </span>
              </div>
              <div className="flex items-center justify-between text-[8px] text-white/70">
                <span>Orientation to Earth:</span>
                <span className="text-white font-bold">Near-Side (0°E, 0°N) Earth-Facing</span>
              </div>
            </div>

            {/* LIVE SYNODIC PHASE & GRAVITATIONAL TIDE */}
            <div className="p-1 bg-black/60 border border-white/15 flex flex-col gap-0.5">
              <div className="flex items-center justify-between text-[8.5px]">
                <span className="text-amber-300 font-bold flex items-center gap-1">
                  <span>{celestialMechanics.phaseIcon}</span>
                  <span>{celestialMechanics.phaseName}</span>
                </span>
                <span className="text-white font-bold bg-amber-500/20 px-1 py-0.2 border border-amber-500/40">
                  {celestialMechanics.illuminationPct}% LIT
                </span>
              </div>
              <div className="flex items-center justify-between text-[7.5px] text-white/60">
                <span>SYNODIC DAY: {celestialMechanics.synodicDay} / 29.5d</span>
                <span className="text-[#58D8D0] font-bold">{celestialMechanics.tideType}</span>
              </div>
            </div>

            {/* Ephemeris Sync Status */}
            <div className="text-[7.5px] text-white/50 pt-0.5 flex items-center justify-between">
              <span>SYNC: {lastEphemSyncTime}</span>
              <span className={isExactSample ? 'text-emerald-400 font-bold' : 'text-[#58D8D0]'}>
                {isExactSample ? 'EXACT SPICE SAMPLE' : '60 FPS NLERP INTERPOLATED'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          2D PROJECTED CANDIDATE SITE MARKERS (OVERLAY ON MOON SURFACE)
      ========================================================================= */}
      {showLabels && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {projectedMarkers.map(({ site, screenX, screenY, isVisible, isSelected }) => {
            if (!isVisible) return null;

            return (
              <div
                key={site.id}
                style={{
                  transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
                className="pointer-events-auto cursor-pointer -translate-x-1/2 -translate-y-full flex flex-col items-center group/marker transition-transform duration-100 hover:scale-105"
                onClick={() => handleFocusCandidateSite(site)}
                onMouseEnter={() => setHoveredSite(site)}
                onMouseLeave={() => setHoveredSite(null)}
              >
                {/* Site Label Badge */}
                <div 
                  className={`px-1.5 py-0.5 rounded-none font-mono text-[9px] font-bold uppercase tracking-wider whitespace-nowrap border flex items-center gap-1 mb-1 transition-all ${
                    isSelected
                      ? 'bg-[#58D8D0] text-black border-white shadow-[0_0_8px_rgba(88,216,208,0.6)]'
                      : 'bg-black/90 text-white/90 border-white/30 group-hover/marker:border-white'
                  }`}
                >
                  <span>{formatSiteShortName(site.name)}</span>
                  {isSelected && <span className="w-1.5 h-1.5 bg-black" />}
                </div>

                {/* Pin Target Box */}
                <div className="relative flex items-center justify-center">
                  <div 
                    className={`w-3.5 h-3.5 border border-white/80 bg-black/60 flex items-center justify-center rounded-none ${
                      isSelected ? 'border-white bg-[#58D8D0]/20' : ''
                    }`}
                  >
                    <div 
                      className="w-1.5 h-1.5 rounded-none" 
                      style={{ backgroundColor: isSelected ? '#FFFFFF' : (site.pinColor || '#58D8D0') }} 
                    />
                  </div>
                </div>

                <div className="w-px h-2 bg-white/40" />
              </div>
            );
          })}
        </div>
      )}

      {/* Hovered Site Info Tooltip Overlay */}
      {hoveredSite && (
        <div className="absolute top-44 left-3 p-2 bg-black/95 border border-[#58D8D0]/60 rounded-none text-xs text-white z-20 pointer-events-none flex items-center gap-2 animate-fadeIn font-mono">
          <div 
            className="w-2 h-2 rounded-none shrink-0" 
            style={{ backgroundColor: hoveredSite.pinColor || '#58D8D0' }} 
          />
          <div className="flex flex-col">
            <span className="font-bold text-[#58D8D0] uppercase tracking-wider">{hoveredSite.name}</span>
            <span className="text-[9.5px] text-white/70 tabular-nums">
              {hoveredSite.latitudeDeg >= 0 ? `${hoveredSite.latitudeDeg.toFixed(2)}°N` : `${Math.abs(hoveredSite.latitudeDeg).toFixed(2)}°S`}, {hoveredSite.longitudeDeg >= 0 ? `${hoveredSite.longitudeDeg.toFixed(2)}°E` : `${Math.abs(hoveredSite.longitudeDeg).toFixed(2)}°W`} | Elev: {typeof hoveredSite.elevationMeters === 'number' ? `${hoveredSite.elevationMeters > 0 ? '+' : ''}${hoveredSite.elevationMeters.toFixed(0)}m` : '0m'}
            </span>
          </div>
        </div>
      )}

      {/* =========================================================================
          TIME ACCELERATION CONTROLLER TOOLBAR (Bottom Center)
      ========================================================================= */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center pointer-events-none z-20">
        <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 p-1 px-2 sm:px-2.5 bg-black/95 border border-white/20 pointer-events-auto max-w-full rounded-none">
          
          {/* LIVE Mode Button (1x Real-Time UTC) */}
          <button
            type="button"
            onClick={() => {
              if (isLive) {
                setIsLive(false);
              } else {
                handleResetTimeToLive();
              }
            }}
            title="Toggle Live Real-Time 1× UTC Simulation"
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 text-[9.5px] sm:text-[10px] font-mono font-bold transition-all cursor-pointer rounded-none ${
              isLive
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                : 'text-white/60 hover:text-white border border-white/20 hover:bg-white/10'
            }`}
          >
            <Radio size={10} className={isLive ? 'text-emerald-400 animate-pulse' : 'text-white/50'} />
            <span>LIVE (1×)</span>
          </button>

          <div className="h-3.5 sm:h-4 w-px bg-white/20" />

          {/* Stepping & Play/Pause Controls */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* Step -1h */}
            <button
              type="button"
              onClick={() => handleStepTime(-1)}
              title="Step Backward -1 Hour"
              className="px-1.5 py-0.5 text-[9px] font-mono text-white/70 hover:text-white hover:bg-white/10 cursor-pointer border border-white/15 rounded-none"
            >
              -1h
            </button>

            {/* Step -10m */}
            <button
              type="button"
              onClick={() => handleStepMinutes(-10)}
              title="Step Backward -10 Minutes"
              className="px-1.5 py-0.5 text-[9px] font-mono text-white/70 hover:text-white hover:bg-white/10 cursor-pointer border border-white/15 rounded-none"
            >
              -10m
            </button>

            {/* Play / Pause */}
            <button
              type="button"
              onClick={() => {
                setIsPlaying(!isPlaying);
                if (isLive) setIsLive(false);
              }}
              title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
              className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-white bg-white/15 hover:bg-white/25 cursor-pointer transition-colors rounded-none"
            >
              {isPlaying ? <Pause size={11} /> : <Play size={11} className="ml-0.5 text-emerald-400" />}
            </button>

            {/* Step +10m */}
            <button
              type="button"
              onClick={() => handleStepMinutes(10)}
              title="Step Forward +10 Minutes"
              className="px-1.5 py-0.5 text-[9px] font-mono text-white/70 hover:text-white hover:bg-white/10 cursor-pointer border border-white/15 rounded-none"
            >
              +10m
            </button>

            {/* Step +1h */}
            <button
              type="button"
              onClick={() => handleStepTime(1)}
              title="Step Forward +1 Hour"
              className="px-1.5 py-0.5 text-[9px] font-mono text-white/70 hover:text-white hover:bg-white/10 cursor-pointer border border-white/15 rounded-none"
            >
              +1h
            </button>
          </div>

          {/* Reset Time Button */}
          <button
            type="button"
            onClick={isLive ? handleResetTimeToLive : handleResetToMissionEpoch}
            title={isLive ? "Reset Simulation Time to Current Live UTC" : `Reset Simulation Time to Selected Mission Epoch (${epochDate} ${String(epochHour).padStart(2, '0')}:00 UTC)`}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300 hover:text-white hover:bg-white/10 cursor-pointer border border-cyan-400/30 rounded-none"
          >
            <RotateCcw size={10} />
            <span>RESET</span>
          </button>

          {/* Monospace Clock Display with Synchronization Status */}
          <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-black border border-white/20 font-mono text-[9.5px] sm:text-[10.5px] text-white font-bold tracking-wider flex items-center gap-1 sm:gap-1.5 rounded-none tabular-nums">
            <Clock size={10} className={isLive ? "text-emerald-400" : "text-[#58D8D0]"} />
            <span className="truncate max-w-[140px] sm:max-w-none">{formattedSimUtc}</span>
            <span className={`text-[8.5px] px-1 py-0.2 font-mono uppercase tracking-widest hidden sm:inline-block ${
              isLive
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                : 'bg-[#58D8D0]/15 text-[#58D8D0] border border-[#58D8D0]/40'
            }`}>
              {isLive ? 'LIVE' : 'SYNCED'}
            </span>
          </div>

          {/* Speed Presets: 1×, 10×, 1000×, 1h/s, 1d/s, CUSTOM */}
          <div className="flex items-center gap-0.5 pl-1 border-l border-white/20">
            {[
              { label: '1×', val: 1 },
              { label: '10×', val: 10 },
              { label: '1000×', val: 1000 },
              { label: '1h/s', val: 3600 },
              { label: '1d/s', val: 86400 },
            ].map(({ label, val }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setPlaybackSpeed(val);
                  setIsLive(false);
                  setIsPlaying(true);
                  setShowCustomSpeed(false);
                }}
                className={`px-1.5 py-0.5 text-[9.5px] font-mono cursor-pointer transition-all rounded-none ${
                  playbackSpeed === val && !isLive && !showCustomSpeed
                    ? 'bg-white text-black font-extrabold border border-white'
                    : 'text-white/50 hover:text-white hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}

            {/* Custom Speed Toggle & Popup */}
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setShowCustomSpeed(!showCustomSpeed)}
                className={`px-1.5 py-0.5 text-[9.5px] font-mono cursor-pointer transition-all rounded-none ${
                  showCustomSpeed || (![1, 10, 60, 600, 1000, 3600, 86400].includes(playbackSpeed) && !isLive)
                    ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-400/50'
                    : 'text-white/50 hover:text-white hover:bg-white/10'
                }`}
              >
                {showCustomSpeed || (![1, 10, 60, 600, 1000, 3600, 86400].includes(playbackSpeed) && !isLive) ? `${playbackSpeed}×` : 'CUSTOM'}
              </button>
              {showCustomSpeed && (
                <div className="absolute bottom-full mb-1 left-0 bg-black border border-white/25 p-2 flex items-center gap-1.5 z-30 font-mono text-[9.5px] rounded-none">
                  <span className="text-white/60">SPEED:</span>
                  <input
                    type="number"
                    min="1"
                    max="500000"
                    value={customSpeed}
                    onChange={(e) => setCustomSpeed(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 bg-white/10 border border-white/30 text-white px-1.5 py-0.5 font-mono text-center outline-none rounded-none"
                  />
                  <span className="text-white/60">×</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaybackSpeed(customSpeed);
                      setIsLive(false);
                      setIsPlaying(true);
                      setShowCustomSpeed(false);
                    }}
                    className="px-2 py-0.5 bg-[#58D8D0] text-black font-bold uppercase hover:bg-white cursor-pointer rounded-none"
                  >
                    SET
                  </button>
                </div>
              )}
            </div>

            {/* Advanced Speeds Menu (60×, 600×) */}
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setShowAdvancedSpeeds(!showAdvancedSpeeds)}
                title="Advanced Speed Menu (60×, 600×)"
                className="px-1 py-0.5 text-[8.5px] font-mono text-white/40 hover:text-white/80 cursor-pointer"
              >
                <Sliders size={10} />
              </button>
              {showAdvancedSpeeds && (
                <div className="absolute bottom-full mb-1 right-0 bg-black border border-white/25 p-1 flex flex-col gap-1 z-30 font-mono text-[9px] min-w-[70px] rounded-none">
                  <button
                    type="button"
                    onClick={() => {
                      setPlaybackSpeed(60);
                      setIsLive(false);
                      setIsPlaying(true);
                      setShowAdvancedSpeeds(false);
                    }}
                    className={`px-2 py-0.5 text-left cursor-pointer hover:bg-white/10 ${playbackSpeed === 60 ? 'text-[#58D8D0] font-bold' : 'text-white/70'}`}
                  >
                    60×
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaybackSpeed(600);
                      setIsLive(false);
                      setIsPlaying(true);
                      setShowAdvancedSpeeds(false);
                    }}
                    className={`px-2 py-0.5 text-left cursor-pointer hover:bg-white/10 ${playbackSpeed === 600 ? 'text-[#58D8D0] font-bold' : 'text-white/70'}`}
                  >
                    600×
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
