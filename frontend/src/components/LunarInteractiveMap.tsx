import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { 
  RotateCcw, 
  Play, 
  Pause, 
  Radio, 
  Clock, 
  Sliders, 
  RefreshCw, 
  AlertTriangle,
  Calendar,
  ChevronUp,
  X,
  Check
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
  siteType?: string;
  targetRegion?: string;
  description?: string;
  source?: string;
  coordinateReference?: string;
  uncertaintyKm?: number;
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
  onEpochDateChange?: (date: string, hour: number) => void;
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
  return name
    .replace(' Crater - Connecting Ridge', ' Conn. Ridge')
    .replace(' Crater Rim 1', ' Rim 1')
    .replace(' Crater Rim 2', ' Rim 2')
    .replace(' Crater Rim', ' Rim')
    .replace(' (Peak)', '')
    .replace(' (MMO01)', '')
    .replace(' (MMO02)', '')
    .replace(' (Site SP07)', '')
    .replace(' (Artemis Candidate Region)', '')
    .replace(' (NASA PRIME-1 / CLPS IM-2)', ' (PRIME-1)')
    .replace(' (CLPS IM-1 Odysseus)', ' (IM-1)')
    .replace(' (Chandrayaan-3)', ' (CH-3)')
    .replace(' Crater', '');
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
  onEpochDateChange,
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const hasLoadedOnceRef = useRef<boolean>(false);
  useEffect(() => {
    if (!isLoading) {
      hasLoadedOnceRef.current = true;
    }
  }, [isLoading]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hoveredSite, setHoveredSite] = useState<MapSiteItem | null>(null);

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

  // Stable references for high-performance 60 FPS animation loop
  const siteAnalysisRef = useRef(siteAnalysis);
  siteAnalysisRef.current = siteAnalysis;
  const lastSunlightStateUpdateTimeRef = useRef<number>(0);
  const updateMarkerProjectionsRef = useRef<() => void>(() => {});
  const lastProjectedMarkerRef = useRef<{
    siteId: string;
    screenX: number;
    screenY: number;
    isVisible: boolean;
  }>({ siteId: '', screenX: -9999, screenY: -9999, isVisible: false });
  // Toggle state to show details card ONLY when clicking on the location point
  const [showDetailsCard, setShowDetailsCard] = useState<boolean>(false);
  const markerContainerRef = useRef<HTMLDivElement>(null);

  // Live topocentric sunlight simulation state evaluated continuously at selected landing site
  const [liveSunlightStatus, setLiveSunlightStatus] = useState<{
    isIlluminated: boolean;
    solarElevationDeg: number;
    incidenceAngleDeg: number;
    statusText: string;
  }>({
    isIlluminated: true,
    solarElevationDeg: 1.5,
    incidenceAngleDeg: 88.5,
    statusText: 'ILLUMINATED',
  });

  // Textures Cache Ref
  const texturesRef = useRef<{
    lrocColor: THREE.Texture | null;
    elevation: THREE.Texture | null;
    bumpMap: THREE.Texture | null;
    earthDay: THREE.Texture | null;
    earthNight: THREE.Texture | null;
    earthClouds: THREE.Texture | null;
    sunPhotosphere: THREE.Texture | null;
    lolaColor: THREE.Texture | null;
  }>({
    lrocColor: null,
    elevation: null,
    bumpMap: null,
    earthDay: null,
    earthNight: null,
    earthClouds: null,
    sunPhotosphere: null,
    lolaColor: null,
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
    viewer.scene.globe.maximumScreenSpaceError = 2.0;
    viewer.scene.globe.tileCacheSize = 300;
    viewer.scene.globe.preloadAncestors = true;
    viewer.scene.globe.preloadSiblings = true;
    viewer.scene.globe.depthTestAgainstTerrain = false;

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

    // Only add a Cesium entity for the currently selected site.
    // This prevents overlapping labels/pins in the embedded Cesium overlay.
    const selectedSite = sites.find((s) => s.id === selectedSiteId);
    if (!selectedSite) return;

    const lunarEllipsoid = new Cesium.Ellipsoid(
      LUNAR_MEAN_RADIUS_METERS,
      LUNAR_MEAN_RADIUS_METERS,
      LUNAR_MEAN_RADIUS_METERS
    );

    const position = Cesium.Cartesian3.fromDegrees(
      selectedSite.longitudeDeg,
      selectedSite.latitudeDeg,
      selectedSite.elevationMeters || 0,
      lunarEllipsoid
    );

    // Keep entity for click selection without duplicate visual rendering
    viewer.entities.add({
      id: selectedSite.id,
      name: selectedSite.name,
      position: position,
      point: {
        pixelSize: 4,
        color: Cesium.Color.TRANSPARENT,
      },
    });
  }, [sites, selectedSiteId]);

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
    controls.addEventListener('change', () => {
      updateMarkerProjectionsRef.current?.();
    });
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
    const lolaColor = textureLoader.load('/textures/moon/lola_color_altimetry_4k.jpg', (tex) => {
      checkLoaded();
      if (moonMeshRef.current && activeLayerRef.current === 'MOON_TREK_LOLA') {
        const mat = moonMeshRef.current.material as THREE.MeshStandardMaterial;
        mat.map = tex;
        mat.bumpScale = 0.04;
        mat.needsUpdate = true;
      }
    });
    lolaColor.colorSpace = THREE.SRGBColorSpace;
    const bumpMap = textureLoader.load('/textures/moon/ldem_4k_bump.jpg', checkLoaded);

    const earthDay = textureLoader.load('/textures/earth/2k_earth_daymap.jpg', checkLoaded);
    earthDay.colorSpace = THREE.SRGBColorSpace;
    const earthNight = textureLoader.load('/textures/earth/2k_earth_nightmap.jpg', checkLoaded);
    earthNight.colorSpace = THREE.SRGBColorSpace;
    const earthClouds = textureLoader.load('/textures/earth/2k_earth_clouds.jpg', checkLoaded);

    const sunPhotosphere = textureLoader.load('/textures/sun/sun_photosphere_2k.jpg', checkLoaded);
    sunPhotosphere.colorSpace = THREE.SRGBColorSpace;

    const maxAnisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    [lrocColor, elevation, bumpMap, earthDay, earthNight, earthClouds, sunPhotosphere, lolaColor].forEach((tex) => {
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
      sunPhotosphere,
      lolaColor,
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
    const initialMap = activeLayerRef.current === 'MOON_TREK_LOLA' ? lolaColor : lrocColor;
    const moonMat = new THREE.MeshStandardMaterial({
      map: initialMap,
      bumpMap: bumpMap,
      bumpScale: activeLayerRef.current === 'MOON_TREK_LOLA' ? 0.04 : 0.08,
      roughness: 0.92,
      metalness: 0.02,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    // Align texture Prime Meridian (u=0.5, originally +X) with +Z (Earth-facing Selenographic frame)
    moonMesh.rotation.y = Math.PI / 2;
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
    moonGraticuleGroup.rotation.y = Math.PI / 2;
    moonTiltGroup.add(moonGraticuleGroup);
    moonGraticuleGroupRef.current = moonGraticuleGroup;

    // 3D Physical Pins & Markers for South Pole Candidate Landing Sites on Moon Sphere
    // Start with an empty group — the update useEffect below populates it
    // based on the currently selected site only.
    const moonSitesGroup = new THREE.Group();
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
      layerUrl = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_ClrShade_Global_128ppd_v04/1.0.0/default/default028mm/{z}/{y}/{x}.png';
      attribution = 'NASA LOLA Global Color Altimetry Hillshade (237m/px)';
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
    }

    // Synchronize Three.js 3D Moon sphere texture with the chosen map layer
    if (texturesRef.current && moonMeshRef.current) {
      const textures = texturesRef.current;
      let targetTex: THREE.Texture | null = textures.lrocColor;
      let targetBumpScale = 0.08;

      if (activeLayer === 'MOON_TREK_LOLA') {
        targetTex = textures.lolaColor || textures.elevation || textures.lrocColor;
        targetBumpScale = 0.04;
      } else if (activeLayer === 'MOON_TREK_RELIEF') {
        targetTex = textures.elevation || textures.lrocColor;
        targetBumpScale = 0.12;
      } else if (activeLayer === 'ELEVATION') {
        targetTex = textures.elevation;
        targetBumpScale = 0.10;
      } else {
        targetTex = textures.lrocColor;
        targetBumpScale = 0.08;
      }

      if (targetTex) {
        const mat = moonMeshRef.current.material as THREE.MeshStandardMaterial;
        mat.map = targetTex;
        mat.bumpScale = targetBumpScale;
        mat.needsUpdate = true;
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

  // Update 3D Physical Pins & Beacon Markers on Moon Sphere whenever sites or selectedSiteId changes
  useEffect(() => {
    const group = moonSitesGroupRef.current;
    if (!group) return;

    // Clear existing pin meshes
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
      if ((child as any).material) {
        if (Array.isArray((child as any).material)) {
          (child as any).material.forEach((m: any) => m.dispose());
        } else {
          (child as any).material.dispose();
        }
      }
    }

    // Only build a 3D marker for the currently selected site.
    // All other sites have no 3D mesh — this prevents overlapping pins.
    const selectedSite = sites.find((s) => s.id === selectedSiteId);
    if (!selectedSite) return;

    const sitePos = selenographicToCartesian(selectedSite.latitudeDeg, selectedSite.longitudeDeg, MOON_RADIUS_UNITS, selectedSite.elevationMeters || 0);
    const normal = sitePos.clone().normalize();

    // High-Visibility Selected Landing Site Reticle Flush to Moon Surface
    // Outer Target Reticle Ring (flush with lunar crust)
    const ringGeo = new THREE.RingGeometry(0.032, 0.046, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x58D8D0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(sitePos.clone().add(normal.clone().multiplyScalar(0.003)));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    group.add(ring);

    // Inner Target Reticle Ring (precision landing bullseye)
    const innerRingGeo = new THREE.RingGeometry(0.012, 0.020, 24);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.position.copy(sitePos.clone().add(normal.clone().multiplyScalar(0.004)));
    innerRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    group.add(innerRing);

    // Surface Landing Dot (flush on the ground)
    const dotGeo = new THREE.SphereGeometry(0.010, 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0x58D8D0,
      depthTest: true,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.position.copy(sitePos.clone().add(normal.clone().multiplyScalar(0.004)));
    group.add(dot);
  }, [sites, selectedSiteId]);

  // 2D Projected candidate site markers on Moon surface (smoothly synchronized with camera & globe)
  const updateMarkerProjections = useCallback(() => {
    const camera = cameraRef.current;
    const container = canvasMountRef.current || mountRef.current;
    if (!camera || !container) return;

    const cWidth = container.clientWidth;
    const cHeight = container.clientHeight;
    if (cWidth === 0 || cHeight === 0) return;
    const halfW = cWidth / 2;
    const halfH = cHeight / 2;

    if (moonGroupRef.current) {
      moonGroupRef.current.updateWorldMatrix(true, true);
    }
    if (moonTiltGroupRef.current) {
      moonTiltGroupRef.current.updateWorldMatrix(true, false);
    }
    camera.updateMatrixWorld();

    const posMoonSolar = getMoonWorldPosition();

    const selectedSite = sites.find((s) => s.id === selectedSiteId);
    if (!selectedSite) {
      setProjectedMarkers([]);
      return;
    }

    const localSitePos = selenographicToCartesian(
      selectedSite.latitudeDeg,
      selectedSite.longitudeDeg,
      MOON_RADIUS_UNITS,
      selectedSite.elevationMeters || 0
    );

    const worldPos = localSitePos.clone();
    if (moonTiltGroupRef.current) {
      worldPos.applyMatrix4(moonTiltGroupRef.current.matrixWorld);
    } else {
      worldPos.add(posMoonSolar);
    }

    const cesiumViewer = cesiumViewerRef.current;
    const isMoonTrekActive = activeLayerRef.current.startsWith('MOON_TREK_');
    const distUnits = camera.position.distanceTo(posMoonSolar);

    let screenX = 0;
    let screenY = 0;
    let isVisible = false;

    // If Cesium Moon Trek is active at close range, compute screen projection strictly from Cesium's scene
    if (isMoonTrekActive && distUnits <= 120.0 && cesiumViewer && !cesiumViewer.isDestroyed()) {
      const lunarEllipsoid = new Cesium.Ellipsoid(
        LUNAR_MEAN_RADIUS_METERS,
        LUNAR_MEAN_RADIUS_METERS,
        LUNAR_MEAN_RADIUS_METERS
      );
      const cesiumPos = Cesium.Cartesian3.fromDegrees(
        selectedSite.longitudeDeg,
        selectedSite.latitudeDeg,
        selectedSite.elevationMeters || 0,
        lunarEllipsoid
      );

      const camPosCesium = cesiumViewer.camera.positionWC;
      const surfaceNormalCesium = Cesium.Cartesian3.normalize(cesiumPos, new Cesium.Cartesian3());
      const toCamCesium = Cesium.Cartesian3.subtract(camPosCesium, cesiumPos, new Cesium.Cartesian3());
      Cesium.Cartesian3.normalize(toCamCesium, toCamCesium);
      const dotCesium = Cesium.Cartesian3.dot(surfaceNormalCesium, toCamCesium);

      if (dotCesium > 0.05) {
        const winPos = Cesium.SceneTransforms.worldToWindowCoordinates(cesiumViewer.scene, cesiumPos);
        if (winPos) {
          screenX = winPos.x;
          screenY = winPos.y;
          isVisible = true;
        }
      }
    } else {
      // Three.js Projection when in global view or base texture mode
      const surfaceNormal = worldPos.clone().sub(posMoonSolar).normalize();
      const camToPoint = camera.position.clone().sub(worldPos).normalize();
      const dot = surfaceNormal.dot(camToPoint);
      const distToCam = camera.position.distanceTo(worldPos);
      const screenVec = worldPos.clone().project(camera);
      isVisible = dot > 0.05 && screenVec.z > -1.0 && screenVec.z < 1.0 && distToCam < 80.0;
      screenX = screenVec.x * halfW + halfW;
      screenY = -(screenVec.y * halfH) + halfH;
    }

    const isWithinScreen = screenX >= -50 && screenX <= cWidth + 50 && screenY >= -50 && screenY <= cHeight + 50;
    const finalVisible = isVisible && isWithinScreen;

    // Direct synchronous DOM update for zero frame latency during mouse rotation
    if (markerContainerRef.current) {
      markerContainerRef.current.style.transition = 'none';
      if (finalVisible) {
        markerContainerRef.current.style.display = 'block';
        markerContainerRef.current.style.transform = `translate3d(${screenX}px, ${screenY}px, 0)`;
      } else {
        markerContainerRef.current.style.display = 'none';
      }
    }

    const prev = lastProjectedMarkerRef.current;
    if (
      prev.siteId === selectedSite.id &&
      prev.isVisible === finalVisible &&
      Math.abs(prev.screenX - screenX) < 0.25 &&
      Math.abs(prev.screenY - screenY) < 0.25
    ) {
      return; // Skip React re-render when marker coordinate change is sub-pixel
    }

    lastProjectedMarkerRef.current = {
      siteId: selectedSite.id,
      screenX,
      screenY,
      isVisible: finalVisible,
    };

    setProjectedMarkers([{
      site: selectedSite,
      screenX,
      screenY,
      isVisible: finalVisible,
      isSelected: true,
    }]);
  }, [sites, selectedSiteId, getMoonWorldPosition]);

  useEffect(() => {
    updateMarkerProjectionsRef.current = updateMarkerProjections;
    updateMarkerProjections();
  }, [updateMarkerProjections]);

  // ---------------------------------------------------------------------------
  // CONTINUOUS 60 FPS HELIOCENTRIC SIMULATION & DYNAMIC CAMERA TRACKING LOOP
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let animationFrameId: number;
    let lastRealTime = performance.now();
    let lastEpochNotifyTime = 0;

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

      // Synchronize live timeline cursor with simulation clock progression (~10 FPS throttle)
      if (isPlayingRef.current || isLiveRef.current) {
        if (time - lastEpochNotifyTime >= 100) {
          lastEpochNotifyTime = time;
          onSimulationEpochChangeRef.current?.(new Date(currentSimTime).toISOString());
        }
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

      // Synchronize Moon world matrix hierarchy before projections or camera tracking
      if (moonGroupRef.current) {
        moonGroupRef.current.updateWorldMatrix(true, true);
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
          // When Moon Trek Cesium overlay is active at close range, hide underlying base mesh to avoid z-fighting;
          // otherwise keep Three.js 4K mesh visible so celestial bodies never disappear or blink.
          if (isMoonTrekActive && distUnits <= 120.0) {
            if (moonMeshRef.current) moonMeshRef.current.visible = false;
          } else {
            if (moonMeshRef.current) moonMeshRef.current.visible = true;
          }

          if (isMoonTrekActive && distUnits <= 120.0 && cesiumMountRef.current) {
            cesiumMountRef.current.style.opacity = '1';

            // Match Cesium camera frustum FOV exactly to Three.js camera FOV (eliminates parallax drift)
            const frustum = cesiumViewer.camera.frustum as any;
            if (frustum && typeof frustum.fov === 'number') {
              const targetFovRad = THREE.MathUtils.degToRad(cam.fov);
              if (
                Math.abs(frustum.fov - targetFovRad) > 1e-4 ||
                Math.abs(frustum.aspectRatio - cam.aspect) > 1e-4
              ) {
                frustum.fov = targetFovRad;
                frustum.aspectRatio = cam.aspect;
              }
            }

            const moonWorldQuat = new THREE.Quaternion();
            if (moonTiltGroupRef.current) {
              moonTiltGroupRef.current.getWorldQuaternion(moonWorldQuat);
            }

            // Express camera position and orientation in Moon local coordinates
            const invMoonQuat = moonWorldQuat.clone().invert();
            const camPosLocal = vWorld.clone().applyQuaternion(invMoonQuat);
            const camForwardLocal = cam.getWorldDirection(new THREE.Vector3()).applyQuaternion(invMoonQuat);
            const camUpLocal = cam.up.clone().applyQuaternion(cam.quaternion).applyQuaternion(invMoonQuat);

            // Permute Three.js Selenographic frame (X=90°E, Y=North, Z=Prime Meridian)
            // to Cesium MCMF frame (X=Prime Meridian, Y=90°E, Z=North) with authentic radius scaling
            const scale = LUNAR_MEAN_RADIUS_METERS / MOON_RADIUS_UNITS;
            const destCesium = new Cesium.Cartesian3(
              camPosLocal.z * scale,
              camPosLocal.x * scale,
              camPosLocal.y * scale
            );
            const dirCesium = new Cesium.Cartesian3(
              camForwardLocal.z,
              camForwardLocal.x,
              camForwardLocal.y
            );
            const upCesium = new Cesium.Cartesian3(
              camUpLocal.z,
              camUpLocal.x,
              camUpLocal.y
            );

            // Closed-form orthonormal transformation: dirCesium and upCesium are strictly orthogonal everywhere.
            // Completely eliminates South Pole collinearity, camera roll gimbal lock, and 180° flipping.
            cesiumViewer.camera.setView({
              destination: destCesium,
              orientation: {
                direction: dirCesium,
                up: upCesium,
              },
            });

            try {
              const julianDate = Cesium.JulianDate.fromIso8601(new Date(currentSimTime).toISOString());
              cesiumViewer.clock.currentTime = julianDate;
            } catch {
              // ignore
            }
          } else if (distUnits > 120.0 && cesiumMountRef.current) {
            cesiumMountRef.current.style.opacity = '0';
          }
        } catch {
          // Guard against any Cesium camera/math exception interrupting WebGL render
        }
      }

      // =======================================================================
      // 7. COMPUTE LIVE TOPOCENTRIC SUNLIGHT ILLUMINATION AT SELECTED LANDING SITE
      // =======================================================================
      const targetSite = sitesRef.current.find((s) => s.id === selectedSiteIdRef.current) || sitesRef.current[0];
      if (targetSite && moonTiltGroupRef.current) {
        const localSitePos = selenographicToCartesian(targetSite.latitudeDeg, targetSite.longitudeDeg, MOON_RADIUS_UNITS, targetSite.elevationMeters || 0);
        const localNormal = localSitePos.clone().normalize();
        const moonWorldQuat = new THREE.Quaternion();
        moonTiltGroupRef.current.getWorldQuaternion(moonWorldQuat);
        const worldNormal = localNormal.applyQuaternion(moonWorldQuat).normalize();
        const toSun = posMoonSolar.clone().negate().normalize();
        const dotSun = worldNormal.dot(toSun);
        const solarElevationDeg = Math.asin(Math.max(-1, Math.min(1, dotSun))) * (180 / Math.PI);
        const incidenceAngleDeg = Math.acos(Math.max(-1, Math.min(1, dotSun))) * (180 / Math.PI);

        const horizonDeg = (targetSite.isDemCovered !== false && siteAnalysisRef.current?.sun?.horizonElevationDeg !== undefined)
          ? siteAnalysisRef.current.sun.horizonElevationDeg
          : 0.0;
        const isIlluminated = solarElevationDeg > horizonDeg;
        const statusText = isIlluminated
          ? 'ILLUMINATED'
          : (solarElevationDeg > 0 ? 'SHADOWED_BY_TERRAIN' : 'SELF_SHADOWED');

        if (time - lastSunlightStateUpdateTimeRef.current > 200) {
          lastSunlightStateUpdateTimeRef.current = time;
          setLiveSunlightStatus({
            isIlluminated,
            solarElevationDeg: Number(solarElevationDeg.toFixed(2)),
            incidenceAngleDeg: Number(incidenceAngleDeg.toFixed(2)),
            statusText,
          });
        }
      }

      // =======================================================================
      // 8. UPDATE 2D SURFACE-ATTACHED MARKER PROJECTIONS SYNCHRONOUSLY
      // =======================================================================
      updateMarkerProjectionsRef.current?.();

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
    setShowDetailsCard(true);
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const moonPos = getMoonWorldPosition();

    setCameraFocusTarget('MOON');
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);

    // Ensure Moon world matrix is fully up to date
    if (moonGroupRef.current) {
      moonGroupRef.current.updateWorldMatrix(true, true);
    }

    // Compute surface vector for site in Moon local frame
    const siteLocal = selenographicToCartesian(site.latitudeDeg, site.longitudeDeg, MOON_RADIUS_UNITS, site.elevationMeters || 0);
    const siteWorld = siteLocal.clone();
    if (moonTiltGroupRef.current) {
      siteWorld.applyMatrix4(moonTiltGroupRef.current.matrixWorld);
    } else {
      siteWorld.add(moonPos);
    }

    const normal = siteWorld.clone().sub(moonPos).normalize();
    // Regional zoom: ~2.1 distance from Moon center along normal vector directly facing candidate landing site
    const camOffset = normal.clone().multiplyScalar(2.1);
    const camPos = moonPos.clone().add(camOffset);

    // Target the center of the Moon so OrbitControls pivots smoothly and consistently around the Moon without jumping
    gsap.to(controls.target, {
      x: moonPos.x,
      y: moonPos.y,
      z: moonPos.z,
      duration: 1.2,
      ease: 'power2.inOut',
    });
    gsap.to(camera.position, {
      x: camPos.x,
      y: camPos.y,
      z: camPos.z,
      duration: 1.2,
      ease: 'power2.inOut',
      onUpdate: () => {
        controls.update();
        updateMarkerProjectionsRef.current?.();
      },
    });
  }, [getMoonWorldPosition, onSelectSite]);

  // Smoothly orient camera to focus on selected landing site when selectedSiteId changes
  const prevSelectedSiteIdRef = useRef<string>(selectedSiteId);
  useEffect(() => {
    if (!selectedSiteId || selectedSiteId === prevSelectedSiteIdRef.current) return;
    prevSelectedSiteIdRef.current = selectedSiteId;
    const targetSite = sites.find((s) => s.id === selectedSiteId);
    if (!targetSite) return;
    handleFocusCandidateSite(targetSite);
  }, [selectedSiteId, sites, handleFocusCandidateSite]);

  // ---------------------------------------------------------------------------
  // Dynamic Date & Time Popover State & Handlers
  // ---------------------------------------------------------------------------
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const datePickerContainerRef = useRef<HTMLDivElement>(null);
  const syncParentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close Date & Time Popover on Click Outside or Escape Key
  useEffect(() => {
    if (!showDatePicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerContainerRef.current && !datePickerContainerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDatePicker(false);
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDatePicker]);

  // Close candidate site details card on Escape key
  useEffect(() => {
    if (!showDetailsCard) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDetailsCard(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDetailsCard]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (syncParentTimeoutRef.current) {
        clearTimeout(syncParentTimeoutRef.current);
      }
    };
  }, []);

  const debouncedSyncParent = useCallback((dateStr: string, hour: number) => {
    if (syncParentTimeoutRef.current) {
      clearTimeout(syncParentTimeoutRef.current);
    }
    syncParentTimeoutRef.current = setTimeout(() => {
      onEpochDateChange?.(dateStr, hour);
    }, 250);
  }, [onEpochDateChange]);

  const currentSimDateObj = useMemo(() => new Date(simTimeMs), [simTimeMs]);

  const curSimDateString = useMemo(() => {
    const d = currentSimDateObj;
    if (isNaN(d.getTime())) return '2026-10-14';
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, [currentSimDateObj]);

  const curSimHour = isNaN(currentSimDateObj.getTime()) ? 12 : currentSimDateObj.getUTCHours();
  const curSimMinute = isNaN(currentSimDateObj.getTime()) ? 0 : currentSimDateObj.getUTCMinutes();
  const curSimSecond = isNaN(currentSimDateObj.getTime()) ? 0 : currentSimDateObj.getUTCSeconds();
  const curSimSecondsOfDay = curSimHour * 3600 + curSimMinute * 60 + curSimSecond;

  const setSimDateTime = useCallback((
    year: number,
    monthIndex: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    syncParent = true
  ) => {
    const newMs = Date.UTC(year, monthIndex, day, hour, minute, second);
    if (isNaN(newMs)) return;

    simTimeRef.current = newMs;
    setSimTimeMs(newMs);
    setIsLive(false);

    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    lastProcessedDatePropRef.current = dateStr;
    lastProcessedHourPropRef.current = hour;

    if (syncParent) {
      debouncedSyncParent(dateStr, hour);
    }
    onSimulationEpochChangeRef.current?.(new Date(newMs).toISOString());
  }, [debouncedSyncParent]);

  const handleDateInputChange = useCallback((dateStr: string) => {
    if (!dateStr) return;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return;
    setSimDateTime(parts[0], parts[1] - 1, parts[2], curSimHour, curSimMinute, curSimSecond, true);
  }, [curSimHour, curSimMinute, curSimSecond, setSimDateTime]);

  const handleTimeInputChange = useCallback((timeStr: string) => {
    if (!timeStr) return;
    const parts = timeStr.split(':').map(Number);
    if (parts.length < 2 || parts.some(isNaN)) return;
    const h = THREE.MathUtils.clamp(parts[0], 0, 23);
    const m = THREE.MathUtils.clamp(parts[1], 0, 59);
    const s = parts.length > 2 ? THREE.MathUtils.clamp(parts[2], 0, 59) : 0;
    const d = currentSimDateObj;
    setSimDateTime(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, s, true);
  }, [currentSimDateObj, setSimDateTime]);

  const handleTimeScrubberChange = useCallback((totalSeconds: number) => {
    const clamped = THREE.MathUtils.clamp(totalSeconds, 0, 86399);
    const h = Math.floor(clamped / 3600);
    const m = Math.floor((clamped % 3600) / 60);
    const s = clamped % 60;
    const d = currentSimDateObj;
    setSimDateTime(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, s, true);
  }, [currentSimDateObj, setSimDateTime]);

  const handleStepDays = useCallback((daysDelta: number) => {
    const targetMs = simTimeRef.current + daysDelta * 86400 * 1000;
    const d = new Date(targetMs);
    setSimDateTime(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), true);
  }, [setSimDateTime]);

  const handleApplyPresetDate = useCallback((dateStr: string, hour = 12) => {
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3) return;
    setSimDateTime(parts[0], parts[1] - 1, parts[2], hour, 0, 0, true);
  }, [setSimDateTime]);

  const handleApplyPresetHour = useCallback((h: number) => {
    const d = currentSimDateObj;
    setSimDateTime(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, 0, 0, true);
  }, [currentSimDateObj, setSimDateTime]);

  const handleSetToTodayUtc = useCallback(() => {
    const now = new Date();
    setSimDateTime(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), true);
  }, [setSimDateTime]);

  const handleStepTime = useCallback((hours: number) => {
    setIsLive(false);
    simTimeRef.current += hours * 3600 * 1000;
    setSimTimeMs(simTimeRef.current);
    const d = new Date(simTimeRef.current);
    const dateStr = d.toISOString().substring(0, 10);
    lastProcessedDatePropRef.current = dateStr;
    lastProcessedHourPropRef.current = d.getUTCHours();
    debouncedSyncParent(dateStr, d.getUTCHours());
    onSimulationEpochChangeRef.current?.(d.toISOString());
  }, [debouncedSyncParent]);

  const handleStepMinutes = useCallback((minutes: number) => {
    setIsLive(false);
    simTimeRef.current += minutes * 60 * 1000;
    setSimTimeMs(simTimeRef.current);
    const d = new Date(simTimeRef.current);
    const dateStr = d.toISOString().substring(0, 10);
    lastProcessedDatePropRef.current = dateStr;
    lastProcessedHourPropRef.current = d.getUTCHours();
    debouncedSyncParent(dateStr, d.getUTCHours());
    onSimulationEpochChangeRef.current?.(d.toISOString());
  }, [debouncedSyncParent]);

  const handleResetTimeToLive = useCallback(() => {
    setIsLive(true);
    setIsPlaying(true);
    setPlaybackSpeed(1);
    const now = Date.now();
    simTimeRef.current = now;
    setSimTimeMs(now);
    const d = new Date(now);
    const dateStr = d.toISOString().substring(0, 10);
    lastProcessedDatePropRef.current = dateStr;
    lastProcessedHourPropRef.current = d.getUTCHours();
    debouncedSyncParent(dateStr, d.getUTCHours());
    onSimulationEpochChangeRef.current?.(d.toISOString());
  }, [debouncedSyncParent]);

  const handleResetToMissionEpoch = useCallback(() => {
    setIsLive(false);
    setIsPlaying(false);
    setPlaybackSpeed(1);
    const targetMs = new Date(`${epochDate}T${epochHour.toString().padStart(2, '0')}:00:00Z`).getTime();
    if (!isNaN(targetMs)) {
      simTimeRef.current = targetMs;
      setSimTimeMs(targetMs);
      lastProcessedDatePropRef.current = epochDate;
      lastProcessedHourPropRef.current = epochHour;
      debouncedSyncParent(epochDate, epochHour);
      onSimulationEpochChangeRef.current?.(new Date(targetMs).toISOString());
    }
  }, [epochDate, epochHour, debouncedSyncParent]);

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
          2D PROJECTED CANDIDATE SITE MARKERS (OVERLAY ON MOON SURFACE)
      ========================================================================= */}
      {showLabels && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {projectedMarkers
            .filter(({ isSelected }) => isSelected)
            .map(({ site, screenX, screenY, isVisible }) => {
            if (!isVisible) return null;

            return (
              <div
                key={site.id}
                ref={markerContainerRef}
                style={{
                  transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transition: 'none',
                }}
                className="pointer-events-none select-none z-20"
              >
                {/* Surface Reticle Point [■] on Location (Clickable to Toggle Details) */}
                <button 
                  type="button"
                  className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center pointer-events-auto cursor-pointer group/pin focus:outline-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetailsCard((prev) => !prev);
                  }}
                  onMouseEnter={() => setHoveredSite(site)}
                  onMouseLeave={() => setHoveredSite(null)}
                  title={showDetailsCard ? "Click to hide details" : "Click to view landing site details"}
                >
                  {/* Point reticle [■] */}
                  <div className="w-3.5 h-3.5 border border-[#58D8D0] bg-black/90 flex items-center justify-center shadow-[0_0_12px_#58D8D0] group-hover/pin:scale-125 transition-transform duration-100">
                    <div className="w-1.5 h-1.5 bg-white" />
                  </div>
                  {/* Pulsing ring */}
                  <div className="absolute w-5 h-5 border border-[#58D8D0]/60 rounded-full animate-ping pointer-events-none" />
                </button>

                {/* Details Card (Shown ONLY when the user clicks the point) */}
                {showDetailsCard && (
                  <div 
                    className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto cursor-default z-30 animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="font-mono select-none bg-black/95 border border-[#58D8D0] shadow-[0_0_20px_rgba(88,216,208,0.5)] p-2 min-w-[195px] rounded-none">
                      <div className="flex items-center justify-between gap-2 border-b border-white/20 pb-1 mb-1.5">
                        <span className="font-bold uppercase tracking-wider text-[#58D8D0] text-[10px]">
                          {formatSiteShortName(site.name)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-[#58D8D0] rounded-full shrink-0" />
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDetailsCard(false);
                            }}
                            className="text-white/60 hover:text-white text-[11px] leading-none px-1 py-0.5 rounded-none cursor-pointer ml-1"
                            title="Close details"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 text-[8.5px] text-white/90">
                        <div className="flex items-center justify-between font-mono tabular-nums text-slate-300">
                          <span>LAT: {Math.abs(site.latitudeDeg).toFixed(2)}°S</span>
                          <span>LON: {site.longitudeDeg >= 0 ? `${site.longitudeDeg.toFixed(2)}°E` : `${Math.abs(site.longitudeDeg).toFixed(2)}°W`}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>ELEV: {site.elevationMeters ? `${site.elevationMeters > 0 ? '+' : ''}${site.elevationMeters.toFixed(0)}m` : '0m'}</span>
                          <span className={`px-1.5 py-0.5 font-bold uppercase text-[8px] border ${
                            liveSunlightStatus.isIlluminated
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                              : 'bg-rose-500/20 text-rose-300 border-rose-400/50'
                          }`}>
                            {liveSunlightStatus.isIlluminated ? '☀️ ILLUMINATED' : '🌑 IN SHADOW'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Micro connector line from card to surface reticle */}
                    <div className="w-px h-2 bg-[#58D8D0]" />
                  </div>
                )}
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


          {/* Monospace Clock Display with Synchronization Status & Interactive Popover Trigger */}
          <div className="relative" ref={datePickerContainerRef}>
            <button
              type="button"
              onClick={() => setShowDatePicker((prev) => !prev)}
              title="Click to select simulation Date & Time (UTC)"
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 bg-black border font-mono text-[9.5px] sm:text-[10.5px] font-bold tracking-wider flex items-center gap-1 sm:gap-1.5 rounded-none tabular-nums cursor-pointer transition-all ${
                showDatePicker
                  ? 'border-[#58D8D0] text-[#58D8D0] shadow-[0_0_15px_rgba(88,216,208,0.3)] bg-[#58D8D0]/10'
                  : 'border-white/20 text-white hover:border-[#58D8D0]/70 hover:bg-white/5'
              }`}
            >
              <Calendar size={11} className={isLive ? "text-emerald-400 animate-pulse" : "text-[#58D8D0]"} />
              <Clock size={10} className="text-white/40 hidden sm:inline" />
              <span className="truncate max-w-[140px] sm:max-w-none">{formattedSimUtc}</span>
              <span className={`text-[8.5px] px-1 py-0.2 font-mono uppercase tracking-widest hidden sm:inline-block ${
                isLive
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                  : 'bg-[#58D8D0]/15 text-[#58D8D0] border border-[#58D8D0]/40'
              }`}>
                {isLive ? 'LIVE' : 'SYNCED'}
              </span>
              <ChevronUp size={10} className={`transition-transform duration-200 text-white/50 ${showDatePicker ? 'rotate-180 text-[#58D8D0]' : ''}`} />
            </button>

            {/* Dynamic Date & Time Selector Popover */}
            {showDatePicker && (
              <div 
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[340px] sm:w-[410px] max-w-[95vw] bg-[#070A0E]/98 backdrop-blur-xl border border-[#58D8D0]/40 p-3 sm:p-4 flex flex-col gap-3 z-40 font-mono shadow-[0_0_50px_rgba(0,0,0,0.95),0_0_25px_rgba(88,216,208,0.2)] rounded-none text-left select-text"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-white/15">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-[#58D8D0]" />
                    <span className="text-[10.5px] font-bold text-white uppercase tracking-wider">
                      SIMULATION EPOCH SELECTOR (UTC)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(false)}
                    className="text-white/40 hover:text-white p-0.5 transition-colors cursor-pointer"
                    title="Close Epoch Selector"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Live Status Readout */}
                <div className="flex items-center justify-between bg-black/60 border border-white/10 px-2.5 py-1.5 text-[10px]">
                  <span className="text-white/50 uppercase">ACTIVE SIMULATION TIME:</span>
                  <span className="font-bold text-[#58D8D0] tabular-nums tracking-wide">{formattedSimUtc}</span>
                </div>

                {/* Date Selection */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <label htmlFor="sim-date-picker-input" className="text-white/60 uppercase font-semibold flex items-center gap-1.5">
                      <Calendar size={11} className="text-[#ECC068]" />
                      <span>MISSION DATE (UTC)</span>
                    </label>
                    <div className="flex items-center gap-1 text-[9px]">
                      <button
                        type="button"
                        onClick={() => handleStepDays(-1)}
                        className="px-1.5 py-0.5 bg-white/5 hover:bg-white/15 border border-white/15 text-white/70 hover:text-white cursor-pointer"
                        title="Step Backward -1 Day"
                      >
                        -1d
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStepDays(1)}
                        className="px-1.5 py-0.5 bg-white/5 hover:bg-white/15 border border-white/15 text-white/70 hover:text-white cursor-pointer"
                        title="Step Forward +1 Day"
                      >
                        +1d
                      </button>
                    </div>
                  </div>
                  <input
                    id="sim-date-picker-input"
                    type="date"
                    value={curSimDateString}
                    min="1969-01-01"
                    max="2050-01-01"
                    onChange={(e) => handleDateInputChange(e.target.value)}
                    className="w-full bg-black/80 border border-white/25 focus:border-[#58D8D0] focus:ring-1 focus:ring-[#58D8D0]/50 px-2.5 py-1.5 text-xs text-white font-mono tracking-wider outline-none transition-all cursor-pointer rounded-none [color-scheme:dark]"
                  />
                </div>

                {/* Quick Date Epoch Presets */}
                <div className="flex flex-wrap items-center gap-1 text-[9px]">
                  <span className="text-white/40 uppercase mr-0.5">PRESETS:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetDate('2026-10-14', 12)}
                    className={`px-2 py-0.5 border cursor-pointer transition-colors ${
                      curSimDateString === '2026-10-14'
                        ? 'bg-[#58D8D0]/20 text-[#58D8D0] border-[#58D8D0]/50 font-bold'
                        : 'bg-white/5 text-white/70 border-white/15 hover:text-white hover:bg-white/10'
                    }`}
                    title="Artemis III Target Reference Epoch (2026-10-14 12:00 UTC)"
                  >
                    Artemis III
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetDate('2027-03-15', 12)}
                    className={`px-2 py-0.5 border cursor-pointer transition-colors ${
                      curSimDateString === '2027-03-15'
                        ? 'bg-[#ECC068]/20 text-[#ECC068] border-[#ECC068]/50 font-bold'
                        : 'bg-white/5 text-white/70 border-white/15 hover:text-white hover:bg-white/10'
                    }`}
                    title="Future Mission Candidate Epoch (2027-03-15 12:00 UTC)"
                  >
                    Future 2027
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetDate('1969-07-20', 20)}
                    className={`px-2 py-0.5 border cursor-pointer transition-colors ${
                      curSimDateString === '1969-07-20'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 font-bold'
                        : 'bg-white/5 text-white/70 border-white/15 hover:text-white hover:bg-white/10'
                    }`}
                    title="Apollo 11 Historical Landing (1969-07-20 20:00 UTC)"
                  >
                    Apollo 11
                  </button>
                  <button
                    type="button"
                    onClick={handleSetToTodayUtc}
                    className="px-2 py-0.5 bg-white/5 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-500/15 cursor-pointer font-bold"
                    title="Current Today UTC"
                  >
                    Today
                  </button>
                </div>

                {/* Time of Day Control & Scrubber */}
                <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-[10px]">
                    <label htmlFor="sim-time-picker-input" className="text-white/60 uppercase font-semibold flex items-center gap-1.5">
                      <Clock size={11} className="text-[#58D8D0]" />
                      <span>TIME OF DAY (UTC)</span>
                    </label>
                    <input
                      id="sim-time-picker-input"
                      type="time"
                      step="1"
                      value={`${String(curSimHour).padStart(2, '0')}:${String(curSimMinute).padStart(2, '0')}:${String(curSimSecond).padStart(2, '0')}`}
                      onChange={(e) => handleTimeInputChange(e.target.value)}
                      className="bg-black/90 border border-white/25 focus:border-[#58D8D0] px-1.5 py-0.5 text-[10.5px] text-[#58D8D0] font-mono outline-none cursor-pointer rounded-none"
                    />
                  </div>

                  {/* 24-Hour Interactive Dynamic Scrubber Slider */}
                  <div className="flex flex-col gap-1">
                    <input
                      type="range"
                      min="0"
                      max="86399"
                      step="60"
                      value={curSimSecondsOfDay}
                      onChange={(e) => handleTimeScrubberChange(Number(e.target.value))}
                      className="w-full accent-[#58D8D0] bg-white/20 h-1.5 cursor-pointer rounded-none"
                      title="Scrub time across the lunar day"
                    />
                    <div className="flex justify-between text-[8px] text-white/40 font-mono">
                      <span>00:00</span>
                      <span>06:00</span>
                      <span>12:00</span>
                      <span>18:00</span>
                      <span>24:00</span>
                    </div>
                  </div>

                  {/* Quick Time Presets */}
                  <div className="grid grid-cols-4 gap-1 text-[9px] font-mono">
                    {[
                      { label: '00:00 UTC', h: 0 },
                      { label: '06:00 UTC', h: 6 },
                      { label: '12:00 UTC', h: 12 },
                      { label: '18:00 UTC', h: 18 },
                    ].map(({ label, h }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleApplyPresetHour(h)}
                        className={`py-1 text-center border cursor-pointer transition-colors ${
                          curSimHour === h && curSimMinute === 0
                            ? 'bg-[#58D8D0]/20 text-[#58D8D0] border-[#58D8D0]/50 font-bold'
                            : 'bg-white/5 text-white/70 border-white/10 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-white/15 text-[9.5px]">
                  <button
                    type="button"
                    onClick={handleResetTimeToLive}
                    className="flex items-center gap-1 px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-bold cursor-pointer transition-colors"
                    title="Resume live real-time simulation"
                  >
                    <Radio size={10} className="animate-pulse" />
                    <span>RESUME LIVE</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDatePicker(false)}
                    className="flex items-center gap-1 px-3 py-1 bg-[#58D8D0] hover:bg-[#48c2ba] text-black font-extrabold cursor-pointer transition-colors"
                  >
                    <Check size={11} />
                    <span>DONE</span>
                  </button>
                </div>
              </div>
            )}
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
