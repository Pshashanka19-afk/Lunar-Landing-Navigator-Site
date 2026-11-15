import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Activity,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  ChevronDown,
  X
} from 'lucide-react';
import { type EarthLaunchSite, type SpacecraftProfile } from '../data/launchSites';
import { type MapSiteItem } from './LunarInteractiveMap';
import { IMAGES } from '../data/images';

interface MissionTrajectoryVisualizerProps {
  launchSite: EarthLaunchSite;
  lunarDestination: MapSiteItem;
  spacecraftProfile: SpacecraftProfile;
  departureEpochUtc: string;
  transferDurationHours: number;
  arrivalEpochUtc: string;
  className?: string;
}

export type TrajectoryCameraMode = 'OVERVIEW' | 'FOLLOW_CRAFT' | 'EARTH' | 'MOON';

// Astronomical Visual Calibration Constants
const EARTH_RADIUS_UNITS = 2.6;
const MOON_RADIUS_UNITS = 0.72;
const VISUAL_EARTH_MOON_DISTANCE = 36.0;
const MOON_ORBIT_INCLINATION_RAD = THREE.MathUtils.degToRad(5.14);
const MOON_AXIAL_TILT_DEG = 1.54; // Cassini state 2
const SUN_POSITION = new THREE.Vector3(-75, 24, 45);
const NUM_TRAJ_POINTS = 160;

// Reference South Pole Candidate Sites for Contextual Lunar Cartography
const REFERENCE_LUNAR_SITES = [
  { name: 'Shackleton', lat: -89.78, lon: 125.40 },
  { name: 'Malapert', lat: -86.04, lon: 2.70 },
  { name: 'de Gerlache', lat: -88.71, lon: -68.70 },
  { name: 'Haworth', lat: -87.87, lon: -5.17 },
  { name: 'Nobile Rim', lat: -85.30, lon: 36.92 },
  { name: 'Mons Mouton', lat: -85.42, lon: 31.85 },
];

/**
 * Generates a smooth circular optical flare texture for trajectory beacon points.
 */
function createCircularGlowTexture(colorHex: string = '#00FF9D'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0.0, '#FFFFFF');
    grad.addColorStop(0.35, colorHex);
    grad.addColorStop(0.70, 'rgba(0, 255, 157, 0.35)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Converts Selenographic coordinates (lat, lon in degrees) into 3D Cartesian coordinates
 * on the Moon sphere (Moon local coordinate frame).
 * Lat -90 (South Pole) -> near -Y; Lon 0 (Prime Meridian) -> aligns with +Z (Earth facing).
 */
function selenographicToCartesian(
  latDeg: number,
  lonDeg: number,
  radius: number = MOON_RADIUS_UNITS,
  elevationOffset: number = 0.002
): THREE.Vector3 {
  const r = radius + elevationOffset;
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
 * High-contrast aerospace billboard text sprite for celestial bodies.
 */
function createBillboardSprite(title: string, subtitle: string, accentColor: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 130;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 512, 130);
    ctx.fillStyle = 'rgba(4, 6, 8, 0.88)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.fillRect(4, 4, 504, 122);
    ctx.strokeRect(4, 4, 504, 122);

    ctx.fillStyle = accentColor;
    ctx.fillRect(4, 4, 8, 122);

    ctx.font = 'bold 36px "Space Mono", monospace, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(title, 26, 46);

    ctx.font = '500 20px "Space Mono", monospace, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText(subtitle, 26, 90);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.2, 0.82, 1.0);
  return sprite;
}

/**
 * Compact tactical HUD beacon sprite for touchdown target.
 */
function createTargetSiteSprite(name: string, coords: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 380;
  canvas.height = 90;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 380, 90);
    ctx.fillStyle = 'rgba(4, 6, 8, 0.90)';
    ctx.strokeStyle = '#00FF9D';
    ctx.lineWidth = 2;
    ctx.fillRect(2, 2, 376, 86);
    ctx.strokeRect(2, 2, 376, 86);

    ctx.fillStyle = '#00FF9D';
    ctx.fillRect(2, 2, 6, 86);

    ctx.font = 'bold 24px "Space Mono", monospace, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(name.toUpperCase(), 20, 38);

    ctx.font = 'bold 16px "Space Mono", monospace, sans-serif';
    ctx.fillStyle = '#00FF9D';
    ctx.fillText(coords, 20, 70);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.0, 0.48, 1.0);
  return sprite;
}

export const MissionTrajectoryVisualizer: React.FC<MissionTrajectoryVisualizerProps> = ({
  launchSite,
  lunarDestination,
  spacecraftProfile,
  departureEpochUtc,
  transferDurationHours,
  arrivalEpochUtc,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // 3D Objects
  const craftMeshRef = useRef<THREE.Group | null>(null);
  const craftPointRef = useRef<THREE.Points | null>(null);
  const moonGroupRef = useRef<THREE.Group | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const cloudsMeshRef = useRef<THREE.Mesh | null>(null);
  const trajectoryCurveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const trajectoryLineRef = useRef<THREE.Line | null>(null);
  const trajectoryGlowPointsRef = useRef<THREE.Points | null>(null);
  const enginePlumeRef = useRef<THREE.Mesh | null>(null);
  const beaconLightRef = useRef<THREE.PointLight | null>(null);
  const destTargetRingRef = useRef<THREE.Mesh | null>(null);

  // Playback & Animation State
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0.15); // 0.0 to 1.0 along trajectory
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [cameraMode, setCameraMode] = useState<TrajectoryCameraMode>('OVERVIEW');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [webGlError, setWebGlError] = useState<string | null>(null);
  const [texturesLoaded, setTexturesLoaded] = useState<boolean>(false);
  const [isDossierCollapsed, setIsDossierCollapsed] = useState<boolean>(false);

  // Live Telemetry along Trajectory
  const currentTelemetry = useMemo(() => {
    const totalKm = 384400;
    const currentDistFromEarthKm = Math.round(progress * totalKm);
    const distToMoonKm = Math.max(0, totalKm - currentDistFromEarthKm);
    
    // TLI velocity ~10.9 km/s falling to ~1.0 km/s at apogee, accelerating to ~2.4 km/s at Moon capture
    const v = progress < 0.85
      ? 10.9 - Math.sqrt(progress) * 9.6
      : 1.0 + (progress - 0.85) * 9.3;
    const speedKmS = Number(Math.max(0.9, v).toFixed(2));

    const elapsedHours = progress * transferDurationHours;
    const d = Math.floor(elapsedHours / 24);
    const h = Math.floor(elapsedHours % 24);
    const m = Math.floor((elapsedHours * 60) % 60);
    const metString = `T+ ${d.toString().padStart(2, '0')}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;

    let phase = 'TRANS-LUNAR INJECTION (TLI)';
    if (progress < 0.04) phase = 'EARTH PARKING ORBIT / TLI IGNITION';
    else if (progress < 0.18) phase = 'EARTH ESCAPE & VAN ALLEN TRANSIT';
    else if (progress < 0.70) phase = 'MIDCOURSE CISLUNAR CRUISE';
    else if (progress < 0.90) phase = 'LUNAR SPHERE OF INFLUENCE ENTRY';
    else if (progress < 0.97) phase = 'LUNAR ORBIT INSERTION (LOI)';
    else phase = 'TERMINAL POWERED DESCENT';

    return {
      currentDistFromEarthKm,
      distToMoonKm,
      speedKmS,
      metString,
      phase,
    };
  }, [progress, transferDurationHours]);

  // Build Procedural Trans-Lunar Trajectory Curve
  const trajectoryPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];

    // Departure point on Earth from terrestrial launch site
    const departureLat = launchSite.latitudeDeg;
    const departureLon = launchSite.longitudeDeg;
    const phi = (90 - departureLat) * (Math.PI / 180);
    const theta = (departureLon + 180) * (Math.PI / 180);
    const depPos = new THREE.Vector3(
      -EARTH_RADIUS_UNITS * 1.02 * Math.sin(phi) * Math.cos(theta),
      EARTH_RADIUS_UNITS * 1.02 * Math.cos(phi),
      EARTH_RADIUS_UNITS * 1.02 * Math.sin(phi) * Math.sin(theta)
    );

    // Moon position in its inclined lunar orbital plane
    const moonCenter = new THREE.Vector3(
      VISUAL_EARTH_MOON_DISTANCE * Math.cos(0.24),
      VISUAL_EARTH_MOON_DISTANCE * Math.sin(MOON_ORBIT_INCLINATION_RAD),
      VISUAL_EARTH_MOON_DISTANCE * Math.sin(0.24)
    );

    // 1.54° Cassini state 2 axial tilt quaternion
    const moonTiltRad = THREE.MathUtils.degToRad(MOON_AXIAL_TILT_DEG);
    const moonAxisVec = new THREE.Vector3(0, Math.cos(moonTiltRad), Math.sin(moonTiltRad)).normalize();
    const moonTiltQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), moonAxisVec);

    // Accurate Selenographic Landing Target on Moon
    const localSitePos = selenographicToCartesian(
      lunarDestination.latitudeDeg,
      lunarDestination.longitudeDeg,
      MOON_RADIUS_UNITS,
      0.003
    );
    const tiltedSiteOffset = localSitePos.clone().applyQuaternion(moonTiltQuat);
    const arrPos = moonCenter.clone().add(tiltedSiteOffset);

    // Realistic prograde perturbed trans-lunar hyperbolic ellipse spline
    points.push(depPos);
    
    // TLI Exit point
    const p1 = depPos.clone().multiplyScalar(1.6).add(new THREE.Vector3(2.8, 1.0, -0.8));
    points.push(p1);

    // Midcourse 1
    const p2 = new THREE.Vector3(
      VISUAL_EARTH_MOON_DISTANCE * 0.28,
      1.8,
      VISUAL_EARTH_MOON_DISTANCE * 0.12
    );
    points.push(p2);

    // Midcourse 2 (L1 gravity inflection region)
    const p3 = new THREE.Vector3(
      VISUAL_EARTH_MOON_DISTANCE * 0.64,
      moonCenter.y * 0.72 + 0.5,
      VISUAL_EARTH_MOON_DISTANCE * 0.26
    );
    points.push(p3);

    // Lunar Approach retrograde injection arc (curving down toward South Pole)
    const p4 = arrPos.clone().add(new THREE.Vector3(-2.0, 0.8, 0.6));
    points.push(p4);

    // Final Touchdown exactly at landing site beacon
    points.push(arrPos);

    return {
      points,
      depPos,
      arrPos,
      moonCenter,
      localSitePos,
      moonTiltQuat,
    };
  }, [launchSite, lunarDestination]);

  // Initialize Three.js Scene with Photorealistic NASA Textures
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (err: any) {
      setWebGlError(err?.message || 'WebGL not supported on this device/browser.');
      return;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020305);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1200);
    camera.position.set(16, 22, 38);
    cameraRef.current = camera;

    // 2. Renderer Config
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.20;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.0;
    controls.maxDistance = 160.0;
    controls.target.set(VISUAL_EARTH_MOON_DISTANCE * 0.45, 0, VISUAL_EARTH_MOON_DISTANCE * 0.15);
    controlsRef.current = controls;

    // 4. Lighting Architecture (Sunlight + Earthshine Fill + Balanced Ambient + Lunar Relief)
    const sunLight = new THREE.DirectionalLight(0xfffaea, 3.2);
    sunLight.position.copy(SUN_POSITION);
    scene.add(sunLight);

    // Balanced Deep Space Ambient Light (Moon surface craters & mare basalts clearly visible)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.40);
    scene.add(ambientLight);

    // Authentic Earthshine Fill Light (Radiating from Earth 0,0,0 toward Moon)
    const earthshineLight = new THREE.DirectionalLight(0x94c4ea, 0.85);
    earthshineLight.position.set(0, 0, 0);
    scene.add(earthshineLight);

    // Cislunar Relief Fill Light (Grazing angle illuminating lunar craters & LOLA relief)
    const lunarReliefLight = new THREE.DirectionalLight(0x7890a8, 0.50);
    lunarReliefLight.position.set(
      trajectoryPoints.moonCenter.x - 12,
      trajectoryPoints.moonCenter.y - 18,
      trajectoryPoints.moonCenter.z + 18
    );
    scene.add(lunarReliefLight);

    // Deep starfield
    const starCount = 1400;
    const starGeo = new THREE.BufferGeometry();
    const starPositions: number[] = [];
    const starColors: number[] = [];
    for (let i = 0; i < starCount; i++) {
      const r = 260 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      // Subtle celestial star color temperatures (white, pale blue, warm amber)
      const cType = Math.random();
      if (cType > 0.85) {
        starColors.push(0.9, 0.95, 1.0); // hot blue
      } else if (cType > 0.70) {
        starColors.push(1.0, 0.9, 0.75); // warm amber
      } else {
        starColors.push(1.0, 1.0, 1.0); // pure white
      }
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.9,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 5. Authentic NASA Textures Loading & Maximum Anisotropy
    const textureLoader = new THREE.TextureLoader();
    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= 5) {
        setTexturesLoaded(true);
      }
    };

    const earthDayTex = textureLoader.load(IMAGES.nasaEarthDay, checkLoaded);
    earthDayTex.colorSpace = THREE.SRGBColorSpace;
    const earthNightTex = textureLoader.load(IMAGES.nasaEarthNight, checkLoaded);
    earthNightTex.colorSpace = THREE.SRGBColorSpace;
    const earthCloudsTex = textureLoader.load(IMAGES.nasaEarthClouds, checkLoaded);
    const moonColorTex = textureLoader.load(IMAGES.nasaMoonColor, checkLoaded);
    moonColorTex.colorSpace = THREE.SRGBColorSpace;
    const moonBumpTex = textureLoader.load(IMAGES.nasaMoonBump, checkLoaded);

    // Apply Maximum Hardware Anisotropy and Mipmap Filtering for Crisp Surface Details
    const maxAnisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    [earthDayTex, earthNightTex, earthCloudsTex, moonColorTex, moonBumpTex].forEach((tex) => {
      if (!tex) return;
      tex.anisotropy = maxAnisotropy;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
    });

    // 6. Photorealistic Earth (Day/Night Terminator & Specular Ocean Shader)
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 64, 64);
    const earthShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: earthDayTex },
        uNightMap: { value: earthNightTex },
        uSunPos: { value: SUN_POSITION },
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
        uniform vec3 uSunPos;

        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;

        void main() {
          vec3 sunDir = normalize(uSunPos - vWorldPosition);
          float nDotL = dot(vWorldNormal, sunDir);

          // Terminator transition
          float dayFactor = smoothstep(-0.15, 0.25, nDotL);

          vec3 dayColor = texture2D(uDayMap, vUv).rgb;
          vec3 nightColor = texture2D(uNightMap, vUv).rgb;

          // Day side: illuminated continents and oceans
          vec3 litDay = dayColor * (dayFactor * 1.25 + 0.03);

          // Night side: city lights
          vec3 litNight = nightColor * (1.0 - dayFactor) * 2.2;

          // Realistic specular sun reflection on oceans
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 halfVec = normalize(sunDir + viewDir);
          float specFactor = pow(max(dot(vWorldNormal, halfVec), 0.0), 32.0);
          float isOcean = step(0.04, dayColor.b - dayColor.r);
          vec3 specular = vec3(1.0, 0.95, 0.85) * specFactor * isOcean * dayFactor * 0.8;

          gl_FragColor = vec4(litDay + litNight + specular, 1.0);
        }
      `,
    });

    const earthMesh = new THREE.Mesh(earthGeo, earthShaderMat);
    earthMesh.rotation.z = THREE.MathUtils.degToRad(-23.44); // Earth authentic obliquity
    scene.add(earthMesh);
    earthMeshRef.current = earthMesh;

    // Atmospheric Cloud Layer
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.015, 48, 48);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: earthCloudsTex,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    earthMesh.add(cloudMesh);
    cloudsMeshRef.current = cloudMesh;

    // Atmospheric Scattering Rim Glow
    const atmoGeo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.045, 32, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x4aa8ff,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
    });
    scene.add(new THREE.Mesh(atmoGeo, atmoMat));

    // Terrestrial Departure Marker Pin
    const depPinGroup = new THREE.Group();
    const depPinGeo = new THREE.ConeGeometry(0.05, 0.22, 12);
    const depPinMat = new THREE.MeshBasicMaterial({ color: 0x58D8D0 });
    const depPin = new THREE.Mesh(depPinGeo, depPinMat);
    depPin.rotation.x = Math.PI;
    depPin.position.y = 0.11;
    depPinGroup.add(depPin);
    depPinGroup.position.copy(trajectoryPoints.depPos);
    scene.add(depPinGroup);

    // =========================================================================
    // 7. HIGH-FIDELITY 3D MOON (LROC 4K COLOR, LOLA 4K DEM BUMP, 1.54° CASSINI TILT)
    // =========================================================================
    const moonGroup = new THREE.Group();
    moonGroup.position.copy(trajectoryPoints.moonCenter);
    scene.add(moonGroup);
    moonGroupRef.current = moonGroup;

    // Light targets set to Moon Group
    earthshineLight.target = moonGroup;
    lunarReliefLight.target = moonGroup;

    // Moon Axial Tilt Group: 1.54° inclination relative to the ecliptic normal (Cassini state 2)
    const moonTiltGroup = new THREE.Group();
    moonTiltGroup.quaternion.copy(trajectoryPoints.moonTiltQuat);
    moonGroup.add(moonTiltGroup);

    // High-Resolution 128x128 Sphere Geometry Matching Mission Browser
    const moonGeo = new THREE.SphereGeometry(MOON_RADIUS_UNITS, 128, 128);
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonColorTex,
      bumpMap: moonBumpTex,
      bumpScale: 0.08,
      roughness: 0.92,
      metalness: 0.02,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonTiltGroup.add(moonMesh);

    // 3D Moon Rotational Axis Line (1.54° relative to ecliptic normal)
    const moonAxisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -MOON_RADIUS_UNITS * 1.55, 0),
      new THREE.Vector3(0, MOON_RADIUS_UNITS * 1.55, 0),
    ]);
    const moonAxisMat = new THREE.LineBasicMaterial({
      color: 0x00FF9D,
      transparent: true,
      opacity: 0.65,
      linewidth: 2,
    });
    const moonAxisLine = new THREE.Line(moonAxisGeo, moonAxisMat);
    moonTiltGroup.add(moonAxisLine);

    // Lunar North Pole Arrow
    const moonArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, MOON_RADIUS_UNITS * 1.55, 0),
      MOON_RADIUS_UNITS * 0.40,
      0x00FF9D,
      MOON_RADIUS_UNITS * 0.20,
      MOON_RADIUS_UNITS * 0.12
    );
    moonTiltGroup.add(moonArrow);

    // Lunar Cartographic Graticule (Equator, South Pole LOLA Boundary at -83° & -85°, Meridians)
    const moonGraticuleGroup = new THREE.Group();
    const createParallelRing = (latDeg: number, color: number, opacity: number, linewidth: number = 1) => {
      const phi = (90 - latDeg) * (Math.PI / 180);
      const ringRadius = MOON_RADIUS_UNITS * 1.002 * Math.sin(phi);
      const ringY = MOON_RADIUS_UNITS * 1.002 * Math.cos(phi);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const theta = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(ringRadius * Math.cos(theta), ringY, ringRadius * Math.sin(theta)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, linewidth });
      return new THREE.Line(geo, mat);
    };

    // Lunar Equator (Cyan 0x58D8D0)
    moonGraticuleGroup.add(createParallelRing(0, 0x58D8D0, 0.45, 2));
    // South Pole LOLA Boundary Rings (-83° and -85° Gold 0xECC068)
    moonGraticuleGroup.add(createParallelRing(-83, 0xECC068, 0.50));
    moonGraticuleGroup.add(createParallelRing(-85, 0xECC068, 0.40));
    [-60, -30, 30, 60].forEach((lat) => {
      moonGraticuleGroup.add(createParallelRing(lat, 0xffffff, 0.12));
    });

    // Meridians (Prime meridian 0° in cyan, 90°, 180°, 270° in white)
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
        opacity: isPrime ? 0.45 : 0.12,
      });
      moonGraticuleGroup.add(new THREE.Line(geo, mat));
    });
    moonTiltGroup.add(moonGraticuleGroup);

    // Reference Candidate Site Pins on South Pole
    const refPinsGroup = new THREE.Group();
    REFERENCE_LUNAR_SITES.forEach((site) => {
      const refPos = selenographicToCartesian(site.lat, site.lon, MOON_RADIUS_UNITS, 0.001);
      const dotGeo = new THREE.SphereGeometry(0.012, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xECC068, transparent: true, opacity: 0.65 });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(refPos);
      refPinsGroup.add(dot);
    });
    moonTiltGroup.add(refPinsGroup);

    // Touchdown Target Site Beacon & Normal Radar Beam
    const targetSitePos = trajectoryPoints.localSitePos;
    const targetSiteNormal = targetSitePos.clone().normalize();

    // 1. Beacon Point Sphere
    const beaconSphereGeo = new THREE.SphereGeometry(0.022, 16, 16);
    const beaconSphereMat = new THREE.MeshBasicMaterial({ color: 0x00FF9D });
    const beaconSphere = new THREE.Mesh(beaconSphereGeo, beaconSphereMat);
    beaconSphere.position.copy(targetSitePos);
    moonTiltGroup.add(beaconSphere);

    // 2. Micro Pillar Radar Beam
    const beamGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.22, 8);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x00FF9D, transparent: true, opacity: 0.85 });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.copy(targetSitePos.clone().add(targetSiteNormal.clone().multiplyScalar(0.11)));
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), targetSiteNormal);
    moonTiltGroup.add(beam);

    // 3. Pulsing Target Touchdown Ring
    const targetRingGeo = new THREE.RingGeometry(0.045, 0.085, 24);
    const targetRingMat = new THREE.MeshBasicMaterial({ 
      color: 0x00FF9D, 
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.90
    });
    const targetRing = new THREE.Mesh(targetRingGeo, targetRingMat);
    targetRing.position.copy(targetSitePos.clone().add(targetSiteNormal.clone().multiplyScalar(0.006)));
    targetRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), targetSiteNormal);
    moonTiltGroup.add(targetRing);
    destTargetRingRef.current = targetRing;

    // 4. Floating Tactical HUD Beacon Sprite
    const coordsStr = `${Math.abs(lunarDestination.latitudeDeg).toFixed(2)}°S, ${Math.abs(lunarDestination.longitudeDeg).toFixed(2)}°E`;
    const destTagSprite = createTargetSiteSprite(lunarDestination.name.substring(0, 18), coordsStr);
    destTagSprite.position.copy(targetSitePos.clone().add(targetSiteNormal.clone().multiplyScalar(0.26)));
    moonTiltGroup.add(destTagSprite);

    // 5. Celestial Body Billboard Labels
    const earthLabel = createBillboardSprite('EARTH', '23.44° OBLIQUITY • 1 AU', '#58D8D0');
    earthLabel.position.set(0, EARTH_RADIUS_UNITS * 1.35, 0);
    scene.add(earthLabel);

    const moonLabel = createBillboardSprite('MOON', '1.54° AXIAL TILT • TIDALLY LOCKED', '#00FF9D');
    moonLabel.position.copy(trajectoryPoints.moonCenter.clone().add(new THREE.Vector3(0, MOON_RADIUS_UNITS * 1.70, 0)));
    scene.add(moonLabel);

    // Moon Orbital Plane Guide
    const moonOrbitPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const ang = (i / 128) * Math.PI * 2;
      moonOrbitPts.push(
        new THREE.Vector3(
          VISUAL_EARTH_MOON_DISTANCE * Math.cos(ang),
          VISUAL_EARTH_MOON_DISTANCE * Math.sin(MOON_ORBIT_INCLINATION_RAD) * Math.sin(ang),
          VISUAL_EARTH_MOON_DISTANCE * Math.sin(ang)
        )
      );
    }
    const moonOrbitGeo = new THREE.BufferGeometry().setFromPoints(moonOrbitPts);
    const moonOrbitMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 });
    scene.add(new THREE.Line(moonOrbitGeo, moonOrbitMat));

    // 8. Dynamic Forward Trans-Lunar Trajectory Curve
    // Forward path to Moon is visible; travelled path behind rocket vanishes.
    const curve = new THREE.CatmullRomCurve3(trajectoryPoints.points, false, 'centripetal', 0.5);
    trajectoryCurveRef.current = curve;

    const trajGeo = new THREE.BufferGeometry();
    const trajPositions = new Float32Array(NUM_TRAJ_POINTS * 3);
    const initialP = Math.min(0.999, Math.max(0.0, progress));
    for (let i = 0; i < NUM_TRAJ_POINTS; i++) {
      const u = initialP + (i / (NUM_TRAJ_POINTS - 1)) * (1.0 - initialP);
      const pt = curve.getPointAt(Math.min(1.0, Math.max(0.0, u)));
      trajPositions[i * 3] = pt.x;
      trajPositions[i * 3 + 1] = pt.y;
      trajPositions[i * 3 + 2] = pt.z;
    }
    trajGeo.setAttribute('position', new THREE.BufferAttribute(trajPositions, 3));

    const trajMat = new THREE.LineBasicMaterial({
      color: 0x58D8D0,
      transparent: true,
      opacity: 0.95,
      linewidth: 2,
    });
    const trajLine = new THREE.Line(trajGeo, trajMat);
    scene.add(trajLine);
    trajectoryLineRef.current = trajLine;

    // Guidance Beacon Point that Moves Along Trajectory with Craft (Smooth Optical Flare)
    const craftGlowTex = createCircularGlowTexture('#00FF9D');
    const craftPointGeo = new THREE.BufferGeometry();
    craftPointGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
    const craftPointMat = new THREE.PointsMaterial({
      map: craftGlowTex,
      size: 0.55,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const craftPoint = new THREE.Points(craftPointGeo, craftPointMat);
    scene.add(craftPoint);
    craftPointRef.current = craftPoint;

    // Forward Milestone Waypoint Beads (Ahead of Craft Only; Vanish Once Passed)
    const wpGlowTex = createCircularGlowTexture('#58D8D0');
    const waypointsGeo = new THREE.BufferGeometry();
    const waypointsMat = new THREE.PointsMaterial({
      map: wpGlowTex,
      size: 0.35,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const waypointsPoints = new THREE.Points(waypointsGeo, waypointsMat);
    scene.add(waypointsPoints);
    trajectoryGlowPointsRef.current = waypointsPoints;

    // 9. Spacecraft Module (Artemis / Orion / Lander Representation)
    const craftGroup = new THREE.Group();
    
    // Command Capsule
    const craftCoreGeo = new THREE.ConeGeometry(0.18, 0.36, 12);
    const craftCoreMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f7, roughness: 0.28, metalness: 0.82 });
    const craftCore = new THREE.Mesh(craftCoreGeo, craftCoreMat);
    craftCore.rotation.x = Math.PI / 2;
    craftGroup.add(craftCore);

    // Service Module (Gold Thermal Insulation Foil)
    const svcGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12);
    const svcMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.88, roughness: 0.22 });
    const svc = new THREE.Mesh(svcGeo, svcMat);
    svc.rotation.x = Math.PI / 2;
    svc.position.z = -0.3;
    craftGroup.add(svc);

    // Solar Wings (Photovoltaic Arrays)
    const wingGeo = new THREE.BoxGeometry(0.85, 0.02, 0.16);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x082038, metalness: 0.92, roughness: 0.18 });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.z = -0.26;
    craftGroup.add(wings);

    // High Gain Antenna Dish
    const antGeo = new THREE.ConeGeometry(0.08, 0.05, 10);
    const antMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 });
    const ant = new THREE.Mesh(antGeo, antMat);
    ant.position.set(0.12, 0.14, -0.22);
    ant.rotation.z = Math.PI / 4;
    craftGroup.add(ant);

    // Propulsion Engine Nozzle & Exhaust Plume
    const plumeGeo = new THREE.ConeGeometry(0.08, 0.36, 12);
    const plumeMat = new THREE.MeshBasicMaterial({ color: 0x58D8D0, transparent: true, opacity: 0.85 });
    const plume = new THREE.Mesh(plumeGeo, plumeMat);
    plume.rotation.x = -Math.PI / 2;
    plume.position.z = -0.6;
    craftGroup.add(plume);
    enginePlumeRef.current = plume;

    // Beacon Strobe Light
    const strobe = new THREE.PointLight(0x58D8D0, 1.4, 4.0);
    strobe.position.set(0, 0.14, 0);
    craftGroup.add(strobe);
    beaconLightRef.current = strobe;

    scene.add(craftGroup);
    craftMeshRef.current = craftGroup;

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup Hook
    return () => {
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      earthGeo.dispose();
      earthShaderMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      moonGeo.dispose();
      moonMat.dispose();
      moonAxisGeo.dispose();
      moonAxisMat.dispose();
      moonOrbitGeo.dispose();
      moonOrbitMat.dispose();
      trajGeo.dispose();
      trajMat.dispose();
      craftPointGeo.dispose();
      craftPointMat.dispose();
      craftGlowTex.dispose();
      waypointsGeo.dispose();
      waypointsMat.dispose();
      wpGlowTex.dispose();
      starGeo.dispose();
      starMat.dispose();
      craftCoreGeo.dispose();
      craftCoreMat.dispose();
      svcGeo.dispose();
      svcMat.dispose();
      wingGeo.dispose();
      wingMat.dispose();
      plumeGeo.dispose();
      plumeMat.dispose();
      depPinGeo.dispose();
      depPinMat.dispose();
      beaconSphereGeo.dispose();
      beaconSphereMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      targetRingGeo.dispose();
      targetRingMat.dispose();
      destTagSprite.material.map?.dispose();
      destTagSprite.material.dispose();
      earthLabel.material.map?.dispose();
      earthLabel.material.dispose();
      moonLabel.material.map?.dispose();
      moonLabel.material.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [trajectoryPoints]);

  // Continuous Animation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (t: number) => {
      animId = requestAnimationFrame(loop);
      const delta = (t - lastTime) / 1000;
      lastTime = t;

      // Advance craft progress along transfer trajectory
      if (isPlaying) {
        setProgress((prev) => {
          const step = (delta * simSpeed * 0.035) / Math.max(1, transferDurationHours / 24);
          const next = prev + step;
          return next > 1.0 ? 0.0 : next;
        });
      }

      // Update Craft Position & Tangent Heading
      if (trajectoryCurveRef.current && craftMeshRef.current) {
        const currentP = Math.min(0.999, Math.max(0.001, progress));
        const point = trajectoryCurveRef.current.getPointAt(currentP);
        const tangent = trajectoryCurveRef.current.getTangentAt(currentP).normalize();
        
        craftMeshRef.current.position.copy(point);
        craftMeshRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

        // Move guidance beacon point along with the rocket trajectory
        if (craftPointRef.current) {
          craftPointRef.current.position.copy(point);
          const ptScale = 0.95 + Math.sin(t * 0.008) * 0.25;
          craftPointRef.current.scale.set(ptScale, ptScale, ptScale);
        }

        // Dynamic Forward Trajectory Line:
        // Line starts exactly at the rocket's current position and extends forward to Moon touchdown.
        // The travelled path behind the rocket has completely vanished!
        if (trajectoryLineRef.current) {
          const posAttr = trajectoryLineRef.current.geometry.attributes.position as THREE.BufferAttribute;
          const numPts = posAttr.count;

          for (let i = 0; i < numPts; i++) {
            const u = currentP + (i / (numPts - 1)) * (1.0 - currentP);
            const pt = trajectoryCurveRef.current.getPointAt(Math.min(1.0, Math.max(0.0, u)));
            posAttr.setXYZ(i, pt.x, pt.y, pt.z);
          }
          posAttr.needsUpdate = true;
        }

        // Forward Milestones: Only show waypoints that lie ahead of the craft (completed ones vanish)
        if (trajectoryGlowPointsRef.current) {
          const forwardWps: THREE.Vector3[] = [];
          [0.05, 0.28, 0.64, 0.88, 1.0].forEach((wpU) => {
            if (wpU > currentP + 0.015) {
              forwardWps.push(trajectoryCurveRef.current!.getPointAt(wpU));
            }
          });
          trajectoryGlowPointsRef.current.geometry.setFromPoints(forwardWps);
        }

        // Subtle engine plume flicker
        if (enginePlumeRef.current) {
          const s = 0.9 + Math.sin(t * 0.015) * 0.15;
          enginePlumeRef.current.scale.set(s, s, s);
        }

        // Dynamic Camera Following
        if (cameraMode === 'FOLLOW_CRAFT' && cameraRef.current && controlsRef.current) {
          const camOffset = tangent.clone().multiplyScalar(-3.8).add(new THREE.Vector3(0, 1.5, 0));
          cameraRef.current.position.copy(point.clone().add(camOffset));
          controlsRef.current.target.copy(point);
        }
      }

      // Rotate Earth & Clouds slowly
      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.y += delta * 0.04;
      }
      if (cloudsMeshRef.current) {
        cloudsMeshRef.current.rotation.y += delta * 0.055;
      }

      // Pulse Touchdown Target Ring on Moon
      if (destTargetRingRef.current) {
        const ringScale = 1.0 + Math.sin(t * 0.006) * 0.22;
        destTargetRingRef.current.scale.set(ringScale, ringScale, 1);
      }

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, simSpeed, progress, cameraMode, transferDurationHours]);

  // Camera Mode Quick Presets
  const handleSwitchCameraMode = (mode: TrajectoryCameraMode) => {
    setCameraMode(mode);
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (mode === 'OVERVIEW') {
      camera.position.set(16, 24, 38);
      controls.target.set(VISUAL_EARTH_MOON_DISTANCE * 0.45, 0, VISUAL_EARTH_MOON_DISTANCE * 0.15);
    } else if (mode === 'EARTH') {
      camera.position.set(0, 3.8, 8.0);
      controls.target.set(0, 0, 0);
    } else if (mode === 'MOON') {
      const mc = trajectoryPoints.moonCenter;
      // Intimate, well-illuminated perspective focusing on Moon South Pole region & touchdown beacon
      camera.position.set(mc.x - 2.2, mc.y - 1.3, mc.z + 2.5);
      controls.target.copy(mc);
    }
  };

  // Zoom Helpers
  const handleZoom = (direction: 'IN' | 'OUT') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const target = controlsRef.current.target;
    const dir = new THREE.Vector3().subVectors(target, camera.position).normalize();
    const step = direction === 'IN' ? 4.0 : -4.0;
    camera.position.addScaledVector(dir, step);
  };

  return (
    <div 
      ref={mountRef}
      className={`relative w-full ${isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'h-[460px] sm:h-[520px] lg:h-[560px]'} bg-[#020305] border border-white/20 overflow-hidden flex flex-col select-none rounded-none ${className}`}
    >
      {/* 3D WebGL Canvas */}
      <div ref={canvasMountRef} className="w-full h-full cursor-grab active:cursor-grabbing outline-none" />

      {/* WebGL Fallback if Context Creation Failed */}
      {webGlError && (
        <div className="absolute inset-0 bg-[#08090C] z-30 flex flex-col items-center justify-center p-6 text-center text-white font-mono gap-3">
          <AlertTriangle size={32} className="text-amber-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider">3D WebGL Hardware Context Unavailable</h3>
          <p className="text-xs text-white/60 max-w-md">
            Hardware acceleration is disabled or unsupported by your display driver. 
            All mission planning parameters, SPICE ephemerides, and LOLA DEM calculations remain 100% active.
          </p>
          <div className="p-3 bg-black border border-white/20 text-xs text-left max-w-md w-full">
            <div className="flex justify-between py-0.5 border-b border-white/10">
              <span className="text-white/50">DEPARTURE:</span>
              <span>{launchSite.name}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-white/10">
              <span className="text-white/50">DESTINATION:</span>
              <span className="text-[#00FF9D]">{lunarDestination.name}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-white/50">TRANSFER TIME:</span>
              <span>{transferDurationHours} Hours</span>
            </div>
          </div>
        </div>
      )}

      {/* TOP LEFT BADGE: Methodology Label (Fixed in Top-Left, Never Collides) */}
      <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none font-mono text-[9px]">
        <div className="px-2.5 py-1.5 bg-black/90 border border-white/20 rounded-none flex items-center gap-2 pointer-events-auto shadow-md">
          <span className="w-1.5 h-1.5 bg-[#00FF9D] rounded-none animate-pulse" />
          <span className="font-bold text-white uppercase tracking-wider">
            3D CISLUNAR TRAJECTORY
          </span>
          <span className="text-white/30 hidden sm:inline">|</span>
          <span className="text-amber-300 font-bold hidden sm:inline">
            [KINEMATIC MODEL]
          </span>
          {!texturesLoaded && (
            <span className="text-[8px] text-white/40 animate-pulse hidden md:inline">• 4K Textures...</span>
          )}
        </div>
      </div>

      {/* TOP RIGHT CONTROLS: Camera Presets & Navigation Controls (Fixed in Top-Right) */}
      <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none font-mono text-[9px]">
        <div className="flex items-center gap-1 bg-black/90 border border-white/20 p-1 pointer-events-auto rounded-none shadow-md">
          <button
            type="button"
            onClick={() => handleSwitchCameraMode('OVERVIEW')}
            className={`px-2 py-0.5 uppercase tracking-wider font-bold cursor-pointer rounded-none transition-colors text-[9px] ${
              cameraMode === 'OVERVIEW' ? 'bg-white text-black font-extrabold' : 'text-white/60 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => handleSwitchCameraMode('FOLLOW_CRAFT')}
            className={`px-2 py-0.5 uppercase tracking-wider font-bold cursor-pointer rounded-none transition-colors text-[9px] ${
              cameraMode === 'FOLLOW_CRAFT' ? 'bg-[#58D8D0] text-black font-extrabold' : 'text-white/60 hover:text-white'
            }`}
          >
            Chase
          </button>
          <button
            type="button"
            onClick={() => handleSwitchCameraMode('EARTH')}
            className={`px-2 py-0.5 uppercase tracking-wider font-bold cursor-pointer rounded-none transition-colors text-[9px] ${
              cameraMode === 'EARTH' ? 'bg-white text-black font-extrabold' : 'text-white/60 hover:text-white'
            }`}
          >
            Earth
          </button>
          <button
            type="button"
            onClick={() => handleSwitchCameraMode('MOON')}
            className={`px-2 py-0.5 uppercase tracking-wider font-bold cursor-pointer rounded-none transition-colors text-[9px] ${
              cameraMode === 'MOON' ? 'bg-[#00FF9D] text-black font-extrabold' : 'text-white/60 hover:text-white'
            }`}
          >
            Moon
          </button>
          
          <div className="h-3 w-px bg-white/20 mx-0.5" />
          
          <button
            type="button"
            onClick={() => handleZoom('IN')}
            title="Zoom In"
            className="p-1 text-white/60 hover:text-white cursor-pointer"
          >
            <ZoomIn size={12} />
          </button>
          <button
            type="button"
            onClick={() => handleZoom('OUT')}
            title="Zoom Out"
            className="p-1 text-white/60 hover:text-white cursor-pointer"
          >
            <ZoomOut size={12} />
          </button>

          <div className="h-3 w-px bg-white/20 mx-0.5" />

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Toggle Fullscreen"
            className="p-1 text-white/60 hover:text-white cursor-pointer"
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* TOP LEFT DOSSIER: Spacecraft Flight Dossier & Mission Elapsed Time (Collapsible) */}
      <div className="absolute top-11 sm:top-12 left-2.5 pointer-events-none z-10 flex flex-col gap-1 max-w-[260px] sm:max-w-xs font-mono text-[9px]">
        {isDossierCollapsed ? (
          <button 
            type="button"
            onClick={() => setIsDossierCollapsed(false)}
            className="p-1.5 px-2.5 bg-black/90 border border-white/20 hover:border-[#58D8D0] flex items-center justify-between gap-2.5 text-white shadow-xl pointer-events-auto cursor-pointer transition-all rounded-none group hover:bg-black/95 text-left"
            title="Open Flight Telemetry Details"
          >
            <span className="text-[#58D8D0] font-bold uppercase tracking-wider flex items-center gap-1.5 truncate">
              <Activity size={11} className="shrink-0 text-[#58D8D0]" />
              <span className="truncate">{spacecraftProfile.name}</span>
            </span>
            <span className="text-white/80 font-mono text-[8px] bg-white/10 px-1.5 py-0.5 shrink-0 border border-white/10">
              {(progress * 100).toFixed(1)}%
            </span>
            <span className="flex items-center gap-1 text-[8.5px] tracking-wider text-black bg-[#58D8D0] group-hover:bg-[#6ef5ec] font-bold px-1.5 py-0.5 shrink-0 transition-colors">
              <span>OPEN</span>
              <ChevronDown size={11} />
            </span>
          </button>
        ) : (
          <div className="p-2.5 bg-black/90 border border-white/20 rounded-none flex flex-col gap-1 text-white/80 shadow-2xl pointer-events-auto backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 gap-2">
              <span className="text-[#58D8D0] font-bold uppercase tracking-wider flex items-center gap-1.5 truncate">
                <Activity size={11} className="shrink-0 text-[#58D8D0]" />
                <span className="truncate">{spacecraftProfile.name}</span>
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[8px] px-1.5 py-0.5 bg-white/10 text-white font-bold border border-white/10">
                  {(progress * 100).toFixed(1)}% TRANSIT
                </span>
                <button
                  type="button"
                  onClick={() => setIsDossierCollapsed(true)}
                  className="flex items-center gap-1 px-1.5 py-0.5 bg-white/10 hover:bg-rose-500/80 text-white/80 hover:text-white border border-white/20 hover:border-rose-400 cursor-pointer transition-colors text-[8.5px] font-bold tracking-wider rounded-none"
                  title="Close Flight Details"
                >
                  <span>CLOSE</span>
                  <X size={10} />
                </button>
              </div>
            </div>

            <div className="flex justify-between text-white/70 pt-0.5">
              <span>MISSION PHASE:</span>
              <span className="text-white font-bold truncate max-w-[150px] text-right">{currentTelemetry.phase}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-amber-300 font-bold">ELAPSED TIME (MET):</span>
              <span className="tabular-nums font-bold text-white">{currentTelemetry.metString}</span>
            </div>

            <div className="flex justify-between">
              <span>DIST FROM EARTH:</span>
              <span className="tabular-nums text-white">{currentTelemetry.currentDistFromEarthKm.toLocaleString()} km</span>
            </div>

            <div className="flex justify-between">
              <span>DIST TO MOON:</span>
              <span className="tabular-nums text-emerald-400 font-bold">{currentTelemetry.distToMoonKm.toLocaleString()} km</span>
            </div>

            <div className="flex justify-between border-t border-white/10 pt-1">
              <span>KINEMATIC SPEED:</span>
              <span className="tabular-nums text-[#58D8D0] font-bold">{currentTelemetry.speedKmS} km/s</span>
            </div>

            {/* Departure & Arrival Anchors */}
            <div className="mt-1 pt-1 border-t border-white/10 flex items-center justify-between text-[8px] text-white/60">
              <span className="truncate max-w-[120px]">ORIGIN: {launchSite.name}</span>
              <span className="text-[#00FF9D] font-bold truncate max-w-[120px] text-right">DEST: {lunarDestination.name}</span>
            </div>

            {/* Prominent Footer Close Button */}
            <button
              type="button"
              onClick={() => setIsDossierCollapsed(true)}
              className="mt-1 w-full py-1 text-center bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/30 text-white/70 hover:text-white text-[8px] font-mono tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-colors"
              title="Close Flight Details"
            >
              <X size={9} /> CLOSE DETAILS
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM CONTROLLER: Scrubber, Playback Controls & Speed Multipliers */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 pointer-events-none z-10 flex flex-col gap-1">
        
        {/* Scrubber Range Bar */}
        <div className="w-full flex items-center gap-2.5 p-1.5 px-3 bg-black/90 border border-white/20 pointer-events-auto rounded-none shadow-xl">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause Trajectory' : 'Play Trajectory'}
            className="p-1 text-white hover:text-[#58D8D0] transition-colors cursor-pointer"
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>

          <button
            type="button"
            onClick={() => setProgress(0)}
            title="Reset to Earth Departure"
            className="p-1 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw size={12} />
          </button>

          {/* Interactive Progress Slider */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.002"
            value={progress}
            onChange={(e) => {
              setIsPlaying(false);
              setProgress(parseFloat(e.target.value));
            }}
            className="flex-1 accent-[#58D8D0] h-1.5 bg-white/20 cursor-pointer rounded-none"
          />

          <span className="font-mono text-[9px] text-white/80 tabular-nums w-12 text-right">
            {(progress * 100).toFixed(0)}%
          </span>

          <div className="h-3 w-px bg-white/20 mx-1" />

          {/* Speed Multipliers */}
          <div className="flex items-center gap-0.5 font-mono text-[8.5px]">
            {[1, 5, 20].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSimSpeed(spd)}
                className={`px-1.5 py-0.5 cursor-pointer rounded-none transition-colors ${
                  simSpeed === spd ? 'bg-[#58D8D0] text-black font-bold' : 'text-white/60 hover:text-white'
                }`}
              >
                {spd}×
              </button>
            ))}
          </div>
        </div>

        {/* Departure to Arrival Timestamps */}
        <div className="flex items-center justify-between font-mono text-[8px] text-white/50 px-1">
          <span>EARTH DEPARTURE: {departureEpochUtc}</span>
          <span className="text-white/30 hidden sm:inline">• TRANSFER: {transferDurationHours}h ({(transferDurationHours / 24).toFixed(1)}d) •</span>
          <span className="text-emerald-400 font-bold">PREDICTED ARRIVAL: {arrivalEpochUtc}</span>
        </div>
      </div>
    </div>
  );
};
