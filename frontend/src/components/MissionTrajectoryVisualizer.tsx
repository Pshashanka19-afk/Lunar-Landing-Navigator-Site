import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Activity
} from 'lucide-react';
import { type EarthLaunchSite, type EarthParkingOrbitPreset, type SpacecraftProfile } from '../data/launchSites';
import { type MapSiteItem } from './LunarInteractiveMap';

interface MissionTrajectoryVisualizerProps {
  departureMode: 'SITE' | 'ORBIT';
  launchSite: EarthLaunchSite | null;
  parkingOrbit: EarthParkingOrbitPreset | null;
  lunarDestination: MapSiteItem;
  spacecraftProfile: SpacecraftProfile;
  departureEpochUtc: string;
  transferDurationHours: number;
  arrivalEpochUtc: string;
  className?: string;
}

export type TrajectoryCameraMode = 'OVERVIEW' | 'FOLLOW_CRAFT' | 'EARTH' | 'MOON';

// Astronomical Visual Calibration Constants
const EARTH_RADIUS_UNITS = 2.4;
const MOON_RADIUS_UNITS = 0.65;
const VISUAL_EARTH_MOON_DISTANCE = 34.0;
const MOON_ORBIT_INCLINATION_RAD = THREE.MathUtils.degToRad(5.14);

export const MissionTrajectoryVisualizer: React.FC<MissionTrajectoryVisualizerProps> = ({
  departureMode,
  launchSite,
  parkingOrbit,
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
  const moonGroupRef = useRef<THREE.Group | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const trajectoryCurveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const trajectoryLineRef = useRef<THREE.Line | null>(null);

  // Playback & Animation State
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0.25); // 0.0 to 1.0 along trajectory
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [cameraMode, setCameraMode] = useState<TrajectoryCameraMode>('OVERVIEW');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

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
    if (progress < 0.05) phase = 'EARTH PARKING ORBIT / TLI IGNITION';
    else if (progress < 0.20) phase = 'EARTH ESCAPE & VAN ALLEN TRANSIT';
    else if (progress < 0.70) phase = 'MIDCOURSE CISLUNAR CRUISE';
    else if (progress < 0.92) phase = 'LUNAR SPHERE OF INFLUENCE ENTRY';
    else if (progress < 0.98) phase = 'LUNAR ORBIT INSERTION (LOI)';
    else phase = 'POWERED DESCENT & TOUCHDOWN';

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

    // Departure point near Earth
    let depPos = new THREE.Vector3(EARTH_RADIUS_UNITS * 1.15, 0, 0);
    if (departureMode === 'SITE' && launchSite) {
      const phi = (90 - launchSite.latitudeDeg) * (Math.PI / 180);
      const theta = (launchSite.longitudeDeg + 180) * (Math.PI / 180);
      depPos = new THREE.Vector3(
        -EARTH_RADIUS_UNITS * 1.02 * Math.sin(phi) * Math.cos(theta),
        EARTH_RADIUS_UNITS * 1.02 * Math.cos(phi),
        EARTH_RADIUS_UNITS * 1.02 * Math.sin(phi) * Math.sin(theta)
      );
    } else if (parkingOrbit) {
      const incRad = THREE.MathUtils.degToRad(parkingOrbit.inclinationDeg);
      depPos = new THREE.Vector3(
        EARTH_RADIUS_UNITS * 1.12 * Math.cos(incRad),
        EARTH_RADIUS_UNITS * 1.12 * Math.sin(incRad),
        0
      );
    }

    // Moon position
    const moonCenter = new THREE.Vector3(
      VISUAL_EARTH_MOON_DISTANCE * Math.cos(0.2),
      VISUAL_EARTH_MOON_DISTANCE * Math.sin(MOON_ORBIT_INCLINATION_RAD),
      VISUAL_EARTH_MOON_DISTANCE * Math.sin(0.2)
    );

    // Target touchdown location on Moon
    const latRad = THREE.MathUtils.degToRad(lunarDestination.latitudeDeg);
    const lonRad = THREE.MathUtils.degToRad(lunarDestination.longitudeDeg);
    const localSiteOffset = new THREE.Vector3(
      MOON_RADIUS_UNITS * Math.cos(latRad) * Math.sin(lonRad),
      MOON_RADIUS_UNITS * Math.sin(latRad),
      MOON_RADIUS_UNITS * Math.cos(latRad) * Math.cos(lonRad)
    );
    const arrPos = moonCenter.clone().add(localSiteOffset);

    // Realistic prograde perturbed trans-lunar hyperbolic ellipse spline
    points.push(depPos);
    
    // TLI Exit point
    const p1 = depPos.clone().multiplyScalar(1.8).add(new THREE.Vector3(2.5, 0.8, -1.2));
    points.push(p1);

    // Midcourse 1
    const p2 = new THREE.Vector3(
      VISUAL_EARTH_MOON_DISTANCE * 0.28,
      1.6,
      VISUAL_EARTH_MOON_DISTANCE * 0.12
    );
    points.push(p2);

    // Midcourse 2 (L1 gravity inflection point)
    const p3 = new THREE.Vector3(
      VISUAL_EARTH_MOON_DISTANCE * 0.62,
      moonCenter.y * 0.72 + 0.4,
      VISUAL_EARTH_MOON_DISTANCE * 0.26
    );
    points.push(p3);

    // Lunar Approach retrograde injection arc
    const p4 = moonCenter.clone().add(new THREE.Vector3(-1.8, 0.4, 0.6));
    points.push(p4);

    // Final Touchdown
    points.push(arrPos);

    return {
      points,
      depPos,
      arrPos,
      moonCenter,
    };
  }, [departureMode, launchSite, parkingOrbit, lunarDestination]);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040608);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(16, 22, 38);
    cameraRef.current = camera;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4.0;
    controls.maxDistance = 140.0;
    controls.target.set(VISUAL_EARTH_MOON_DISTANCE * 0.45, 0, VISUAL_EARTH_MOON_DISTANCE * 0.15);
    controlsRef.current = controls;

    // 4. Lighting Architecture
    const sunLight = new THREE.DirectionalLight(0xfffaea, 2.5);
    sunLight.position.set(-60, 25, 45);
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x223040, 0.85);
    scene.add(ambientLight);

    // Deep starfield
    const starCount = 1200;
    const starGeo = new THREE.BufferGeometry();
    const starPositions: number[] = [];
    for (let i = 0; i < starCount; i++) {
      const r = 240 + Math.random() * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0.65 });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // 5. Earth Model
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 48, 48);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x1e3f66,
      roughness: 0.6,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.rotation.z = THREE.MathUtils.degToRad(-23.44); // Axial tilt
    scene.add(earthMesh);
    earthMeshRef.current = earthMesh;

    // Earth Atmosphere Glow Halo
    const atmoGeo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.035, 32, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x58D8D0,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
    });
    scene.add(new THREE.Mesh(atmoGeo, atmoMat));

    // 6. Moon Model & Destination Group
    const moonGroup = new THREE.Group();
    moonGroup.position.copy(trajectoryPoints.moonCenter);

    const moonGeo = new THREE.SphereGeometry(MOON_RADIUS_UNITS, 36, 36);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0x8a929a,
      roughness: 0.88,
      metalness: 0.05,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moonMesh);

    // Destination Pin on Moon
    const pinGroup = new THREE.Group();
    const pinGeo = new THREE.ConeGeometry(0.04, 0.18, 12);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x00FF9D });
    const pin = new THREE.Mesh(pinGeo, pinMat);
    pin.rotation.x = Math.PI;
    pin.position.y = 0.09;
    pinGroup.add(pin);

    // Destination Target Ring
    const targetRingGeo = new THREE.RingGeometry(0.05, 0.08, 16);
    const targetRingMat = new THREE.MeshBasicMaterial({ color: 0x00FF9D, side: THREE.DoubleSide });
    const targetRing = new THREE.Mesh(targetRingGeo, targetRingMat);
    targetRing.rotation.x = Math.PI / 2;
    pinGroup.add(targetRing);

    // Position pin at relative lunar landing site
    const relDestOffset = trajectoryPoints.arrPos.clone().sub(trajectoryPoints.moonCenter);
    pinGroup.position.copy(relDestOffset);
    moonGroup.add(pinGroup);

    scene.add(moonGroup);
    moonGroupRef.current = moonGroup;

    // Moon Orbit Trail around Earth
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
    const moonOrbitMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14 });
    scene.add(new THREE.Line(moonOrbitGeo, moonOrbitMat));

    // 7. Trans-Lunar Trajectory Curve
    const curve = new THREE.CatmullRomCurve3(trajectoryPoints.points, false, 'centripetal', 0.5);
    trajectoryCurveRef.current = curve;

    const curvePoints = curve.getPoints(140);
    const trajGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const trajMat = new THREE.LineBasicMaterial({
      color: 0x58D8D0,
      transparent: true,
      opacity: 0.85,
      linewidth: 2,
    });
    const trajLine = new THREE.Line(trajGeo, trajMat);
    scene.add(trajLine);
    trajectoryLineRef.current = trajLine;

    // 8. Spacecraft Module (Artemis / Orion / Lander Representation)
    const craftGroup = new THREE.Group();
    
    // Command Capsule
    const craftCoreGeo = new THREE.ConeGeometry(0.18, 0.35, 12);
    const craftCoreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.8 });
    const craftCore = new THREE.Mesh(craftCoreGeo, craftCoreMat);
    craftCore.rotation.x = Math.PI / 2;
    craftGroup.add(craftCore);

    // Service Module (Gold Foil)
    const svcGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.28, 12);
    const svcMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
    const svc = new THREE.Mesh(svcGeo, svcMat);
    svc.rotation.x = Math.PI / 2;
    svc.position.z = -0.28;
    craftGroup.add(svc);

    // Solar Wings
    const wingGeo = new THREE.BoxGeometry(0.75, 0.02, 0.14);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x0c2540, metalness: 0.9, roughness: 0.2 });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.z = -0.24;
    craftGroup.add(wings);

    // Ion / Chemical Engine Plume
    const plumeGeo = new THREE.ConeGeometry(0.08, 0.32, 12);
    const plumeMat = new THREE.MeshBasicMaterial({ color: 0x58D8D0, transparent: true, opacity: 0.75 });
    const plume = new THREE.Mesh(plumeGeo, plumeMat);
    plume.rotation.x = -Math.PI / 2;
    plume.position.z = -0.55;
    craftGroup.add(plume);

    // Beacon Strobe Light
    const strobe = new THREE.PointLight(0x58D8D0, 1.2, 3.5);
    strobe.position.set(0, 0.12, 0);
    craftGroup.add(strobe);

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
      earthMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      moonGeo.dispose();
      moonMat.dispose();
      trajGeo.dispose();
      trajMat.dispose();
      craftCoreGeo.dispose();
      craftCoreMat.dispose();
      svcGeo.dispose();
      svcMat.dispose();
      wingGeo.dispose();
      wingMat.dispose();
      plumeGeo.dispose();
      plumeMat.dispose();
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
          const step = (delta * simSpeed * 0.04) / Math.max(1, transferDurationHours / 24);
          const next = prev + step;
          return next > 1.0 ? 0.0 : next;
        });
      }

      // Update Craft Position & Tangent Heading
      if (trajectoryCurveRef.current && craftMeshRef.current) {
        const point = trajectoryCurveRef.current.getPointAt(Math.min(0.999, Math.max(0.001, progress)));
        const tangent = trajectoryCurveRef.current.getTangentAt(Math.min(0.999, Math.max(0.001, progress))).normalize();
        
        craftMeshRef.current.position.copy(point);
        craftMeshRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

        // Dynamic Camera Following
        if (cameraMode === 'FOLLOW_CRAFT' && cameraRef.current && controlsRef.current) {
          const camOffset = tangent.clone().multiplyScalar(-3.5).add(new THREE.Vector3(0, 1.4, 0));
          cameraRef.current.position.copy(point.clone().add(camOffset));
          controlsRef.current.target.copy(point);
        }
      }

      // Rotate Earth slowly
      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.y += delta * 0.05;
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
      camera.position.set(0, 3.5, 7.5);
      controls.target.set(0, 0, 0);
    } else if (mode === 'MOON') {
      const mc = trajectoryPoints.moonCenter;
      camera.position.set(mc.x - 2.8, mc.y + 2.2, mc.z + 3.4);
      controls.target.copy(mc);
    }
  };

  return (
    <div 
      ref={mountRef}
      className={`relative w-full ${isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'h-[440px] sm:h-[500px] lg:h-[540px]'} bg-[#040608] border border-white/20 overflow-hidden flex flex-col select-none rounded-none ${className}`}
    >
      {/* 3D WebGL Canvas */}
      <div ref={canvasMountRef} className="w-full h-full cursor-grab active:cursor-grabbing outline-none" />

      {/* TOP HEADER: Transparent Scientific Trajectory Status Pill */}
      <div className="absolute top-2 left-2 right-2 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10 font-mono text-[9.5px]">
        
        {/* Left Badge: Official Methodology Label */}
        <div className="px-2.5 py-1 bg-black/95 border border-white/25 rounded-none flex items-center gap-2 pointer-events-auto">
          <span className="w-1.5 h-1.5 bg-[#00FF9D] rounded-none animate-pulse" />
          <span className="font-bold text-white uppercase tracking-wider">
            TRANS-LUNAR INJECTION TRAJECTORY
          </span>
          <span className="text-white/30">|</span>
          <span className="text-amber-300 font-bold">
            [ARRIVAL SCENARIO PLANNING // ESTIMATED KINEMATICS]
          </span>
        </div>

        {/* Right Controls: Camera Presets & Fullscreen */}
        <div className="flex items-center gap-1 bg-black/95 border border-white/20 p-0.5 pointer-events-auto rounded-none">
          <button
            type="button"
            onClick={() => handleSwitchCameraMode('OVERVIEW')}
            className={`px-2 py-0.5 uppercase tracking-wider font-bold cursor-pointer rounded-none transition-colors ${
              cameraMode === 'OVERVIEW' ? 'bg-white text-black font-extrabold' : 'text-white/60 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => handleSwitchCameraMode('FOLLOW_CRAFT')}
            className={`px-2 py-0.5 uppercase tracking-wider font-bold cursor-pointer rounded-none transition-colors ${
              cameraMode === 'FOLLOW_CRAFT' ? 'bg-[#58D8D0] text-black font-extrabold' : 'text-white/60 hover:text-white'
            }`}
          >
            Chase Craft
          </button>
          <button
            type="button"
            onClick={() => handleSwitchCameraMode('EARTH')}
            className={`px-2 py-0.5 uppercase tracking-wider font-bold cursor-pointer rounded-none transition-colors ${
              cameraMode === 'EARTH' ? 'bg-white text-black font-extrabold' : 'text-white/60 hover:text-white'
            }`}
          >
            Earth Launch
          </button>
          <button
            type="button"
            onClick={() => handleSwitchCameraMode('MOON')}
            className={`px-2 py-0.5 uppercase tracking-wider font-bold cursor-pointer rounded-none transition-colors ${
              cameraMode === 'MOON' ? 'bg-white text-black font-extrabold' : 'text-white/60 hover:text-white'
            }`}
          >
            Lunar Arrival
          </button>
          <div className="h-3 w-px bg-white/20 mx-0.5" />
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Toggle Fullscreen"
            className="p-1 text-white/60 hover:text-white cursor-pointer"
          >
            {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
        </div>
      </div>

      {/* TOP LEFT: Spacecraft Flight Dossier & Mission Elapsed Time (MET) */}
      <div className="absolute top-11 left-2 pointer-events-none z-10 flex flex-col gap-1 max-w-xs font-mono text-[9px]">
        <div className="p-2 bg-black/95 border border-white/20 rounded-none flex flex-col gap-1 text-white/80">
          <div className="flex items-center justify-between border-b border-white/10 pb-0.5">
            <span className="text-[#58D8D0] font-bold uppercase tracking-wider flex items-center gap-1">
              <Activity size={10} /> {spacecraftProfile.name}
            </span>
            <span className="text-[8px] px-1 py-0.2 bg-white/10 text-white font-bold">
              {(progress * 100).toFixed(1)}% TRANSIT
            </span>
          </div>

          <div className="flex justify-between text-white/70">
            <span>MISSION PHASE:</span>
            <span className="text-white font-bold">{currentTelemetry.phase}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-amber-300 font-bold">ELAPSED TIME (MET):</span>
            <span className="tabular-nums font-bold text-white">{currentTelemetry.metString}</span>
          </div>

          <div className="flex justify-between">
            <span>DISTANCE FROM EARTH:</span>
            <span className="tabular-nums text-white">{currentTelemetry.currentDistFromEarthKm.toLocaleString()} km</span>
          </div>

          <div className="flex justify-between">
            <span>DISTANCE TO MOON:</span>
            <span className="tabular-nums text-emerald-400 font-bold">{currentTelemetry.distToMoonKm.toLocaleString()} km</span>
          </div>

          <div className="flex justify-between border-t border-white/10 pt-0.5">
            <span>KINEMATIC SPEED:</span>
            <span className="tabular-nums text-[#58D8D0] font-bold">{currentTelemetry.speedKmS} km/s</span>
          </div>
        </div>

        {/* Departure & Arrival Anchors */}
        <div className="px-2 py-1 bg-black/90 border border-white/15 rounded-none flex items-center justify-between text-[8px] text-white/60">
          <span>ORIGIN: {departureMode === 'SITE' && launchSite ? launchSite.name : parkingOrbit?.name || 'LEO Parking Orbit'}</span>
          <span>DEST: {lunarDestination.name}</span>
        </div>
      </div>

      {/* BOTTOM CONTROLLER: Scrubber, Playback Controls & Speed Multipliers */}
      <div className="absolute bottom-2 left-2 right-2 pointer-events-none z-10 flex flex-col gap-1">
        
        {/* Scrubber Range Bar */}
        <div className="w-full flex items-center gap-2 p-1 px-2.5 bg-black/95 border border-white/20 pointer-events-auto rounded-none">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause Trajectory' : 'Play Trajectory'}
            className="p-1 text-white hover:text-[#58D8D0] transition-colors cursor-pointer"
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>

          <button
            type="button"
            onClick={() => setProgress(0)}
            title="Reset to Earth Departure"
            className="p-1 text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw size={11} />
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

          <span className="font-mono text-[9px] text-white/70 tabular-nums w-12 text-right">
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
          <span className="text-white/30">• TRANSFER: {transferDurationHours}h ({(transferDurationHours / 24).toFixed(1)}d) •</span>
          <span className="text-emerald-400 font-bold">PREDICTED ARRIVAL: {arrivalEpochUtc}</span>
        </div>
      </div>
    </div>
  );
};
