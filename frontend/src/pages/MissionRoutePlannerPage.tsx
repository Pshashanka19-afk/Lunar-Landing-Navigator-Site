import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Rocket, 
  Clock, 
  Orbit, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  AlertTriangle, 
  Sun, 
  Globe, 
  Sparkles, 
  Layers, 
  ArrowRight, 
  Info
} from 'lucide-react';
import { useRouter, Link } from '../router';
import { 
  EARTH_LAUNCH_SITES, 
  PARKING_ORBIT_PRESETS, 
  SPACECRAFT_PROFILES
} from '../data/launchSites';
import { type MapSiteItem } from '../components/LunarInteractiveMap';
import { MissionTrajectoryVisualizer } from '../components/MissionTrajectoryVisualizer';
import { MiniLunarMapSelector } from '../components/MiniLunarMapSelector';
import { lunarApi, type WindowsCalculationResponse } from '../services/lunarApi';

// Default candidate landing sites
const DEFAULT_CANDIDATE_SITES: MapSiteItem[] = [
  {
    id: 'shackleton-connecting-ridge',
    name: 'Shackleton Crater Ridge',
    latitudeDeg: -89.78,
    longitudeDeg: 125.40,
    elevationMeters: 1413.9,
    pinColor: '#58D8D0',
    isDemCovered: true,
  },
  {
    id: 'malapert-mountain',
    name: 'Malapert Massif',
    latitudeDeg: -86.04,
    longitudeDeg: 2.70,
    elevationMeters: -2854.7,
    pinColor: '#ECC068',
    isDemCovered: true,
  },
  {
    id: 'de-gerlache-rim-2',
    name: 'de Gerlache Rim',
    latitudeDeg: -88.71,
    longitudeDeg: -68.70,
    elevationMeters: -1148.4,
    pinColor: '#78F5EC',
    isDemCovered: true,
  },
  {
    id: 'haworth-crater-rim',
    name: 'Haworth Crater Rim',
    latitudeDeg: -87.87,
    longitudeDeg: -5.17,
    elevationMeters: -1200.0,
    pinColor: '#FFB3B0',
    isDemCovered: true,
  },
];

export interface DepartureScenarioAlternative {
  id: string;
  scenarioIndex: number;
  label: string;
  departureEpochUtc: string;
  arrivalEpochUtc: string;
  transferDurationHours: number;
  estimatedTliDeltaV: number;
  estimatedLoiDeltaV: number;
  estimatedTotalDeltaV: number;
  // Live Evaluated Arrival Conditions (via backend endpoints)
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  isSunLit: boolean;
  earthElevationDeg: number;
  earthAzimuthDeg: number;
  isEarthVisible: boolean;
  terrainSlopeDeg: number;
  terrainElevationMeters: number;
  isSafeSlope: boolean;
  sunlightHours: number;
  earthCommHours: number;
  dualOperationHours: number;
  feasibilityScore: number; // 0 - 100
  verdict: 'OPTIMAL' | 'FAVORABLE' | 'MARGINAL' | 'OCCULTED';
  verdictExplanation: string;
  advantages: string[];
  disadvantages: string[];
}

export const MissionRoutePlannerPage: React.FC = () => {
  const { navigate } = useRouter();

  // ---------------------------------------------------------------------------
  // STEP 01 — DEPARTURE ORIGIN STATE
  // ---------------------------------------------------------------------------
  const [departureMode, setDepartureMode] = useState<'SITE' | 'ORBIT'>('SITE');
  const [selectedLaunchSiteId, setSelectedLaunchSiteId] = useState<string>('ksc-lc39b');
  const [selectedOrbitPresetId, setSelectedOrbitPresetId] = useState<string>('leo-cape-nominal');
  const [showAdvancedOrbit, setShowAdvancedOrbit] = useState<boolean>(false);
  
  // Custom Parking Orbit Parameters
  const [customOrbitAltKm, setCustomOrbitAltKm] = useState<number>(200);
  const [customOrbitIncDeg, setCustomOrbitIncDeg] = useState<number>(28.5);
  const [customRaanDeg, setCustomRaanDeg] = useState<number>(45.0);
  const [customArgPeriapsisDeg, setCustomArgPeriapsisDeg] = useState<number>(120.0);

  // ---------------------------------------------------------------------------
  // STEP 02 — LUNAR DESTINATION STATE
  // ---------------------------------------------------------------------------
  const [candidateSites, setCandidateSites] = useState<MapSiteItem[]>(DEFAULT_CANDIDATE_SITES);
  const [selectedDestinationSiteId, setSelectedDestinationSiteId] = useState<string>('shackleton-connecting-ridge');

  // ---------------------------------------------------------------------------
  // STEP 03 — DEPARTURE WINDOW & PROFILE STATE
  // ---------------------------------------------------------------------------
  const [earliestDepartureDate, setEarliestDepartureDate] = useState<string>('2026-10-10');
  const [latestDepartureDate, setLatestDepartureDate] = useState<string>('2026-10-22');
  const [preferredDepartureHour, setPreferredDepartureHour] = useState<number>(12); // 12:00 UTC
  const [selectedProfileId, setSelectedProfileId] = useState<string>('artemis-orion-sls');
  const [customTransferHours, setCustomTransferHours] = useState<number>(84);
  const [showAdvancedConstraints, setShowAdvancedConstraints] = useState<boolean>(false);

  // Arrival Condition Constraints
  const [reqMinSunElevation, setReqMinSunElevation] = useState<number>(0.5);
  const [reqRequireEarthLos, setReqRequireEarthLos] = useState<boolean>(true);
  const [reqMaxSlopeDeg, setReqMaxSlopeDeg] = useState<number>(8.0);

  // ---------------------------------------------------------------------------
  // ALTERNATIVES COMPUTATION & SELECTION STATE
  // ---------------------------------------------------------------------------
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [alternatives, setAlternatives] = useState<DepartureScenarioAlternative[]>([]);
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Selected Entities
  const currentLaunchSite = useMemo(() => {
    return EARTH_LAUNCH_SITES.find((s) => s.id === selectedLaunchSiteId) || EARTH_LAUNCH_SITES[0];
  }, [selectedLaunchSiteId]);

  const currentParkingOrbit = useMemo(() => {
    return PARKING_ORBIT_PRESETS.find((p) => p.id === selectedOrbitPresetId) || PARKING_ORBIT_PRESETS[0];
  }, [selectedOrbitPresetId]);

  const currentDestination = useMemo(() => {
    return candidateSites.find((s) => s.id === selectedDestinationSiteId) || candidateSites[0];
  }, [candidateSites, selectedDestinationSiteId]);

  const currentProfile = useMemo(() => {
    return SPACECRAFT_PROFILES.find((p) => p.id === selectedProfileId) || SPACECRAFT_PROFILES[0];
  }, [selectedProfileId]);

  const effectiveTransferHours = useMemo(() => {
    if (selectedProfileId === 'custom-mission') return customTransferHours;
    return currentProfile.nominalTransferDurationHours;
  }, [selectedProfileId, customTransferHours, currentProfile]);

  // Initial Load: Fetch candidate sites from backend if available
  useEffect(() => {
    let isMounted = true;
    lunarApi.getDefaultSites().then((sites) => {
      if (isMounted && Array.isArray(sites) && sites.length > 0) {
        const mapped: MapSiteItem[] = sites.map((s) => ({
          id: s.id,
          name: s.name,
          latitudeDeg: s.latitudeDeg,
          longitudeDeg: s.longitudeDeg,
          elevationMeters: s.elevationMeters,
          isDemCovered: true,
          pinColor: s.id.includes('shackleton') ? '#58D8D0' : '#ECC068',
        }));
        setCandidateSites(mapped);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Compute Candidate Scenarios Function
  const handleGenerateScenarios = useCallback(async () => {
    setIsGenerating(true);
    setGenerationError(null);

    const pad = (n: number) => Math.floor(n).toString().padStart(2, '0');
    const startEpoch = new Date(`${earliestDepartureDate}T${pad(preferredDepartureHour)}:00:00Z`).getTime();
    const endEpoch = new Date(`${latestDepartureDate}T${pad(preferredDepartureHour)}:00:00Z`).getTime();

    if (isNaN(startEpoch) || isNaN(endEpoch) || endEpoch < startEpoch) {
      setGenerationError('Latest departure date must be greater than or equal to earliest departure date.');
      setIsGenerating(false);
      return;
    }

    try {
      // Create 4 distinct candidate departure dates across the specified date range
      const sampleCount = 4;
      const stepMs = sampleCount > 1 ? (endEpoch - startEpoch) / (sampleCount - 1) : 0;
      const candidateEpochs = Array.from({ length: sampleCount }, (_, idx) => {
        return new Date(startEpoch + idx * stepMs);
      });

      const scenarioPromises = candidateEpochs.map(async (depDate, idx) => {
        const depIso = depDate.toISOString().substring(0, 19) + 'Z';
        const arrEpochMs = depDate.getTime() + effectiveTransferHours * 3600 * 1000;
        const arrDate = new Date(arrEpochMs);
        const arrIso = arrDate.toISOString().substring(0, 19) + 'Z';
        const arrWindowEndIso = new Date(arrEpochMs + 72 * 3600 * 1000).toISOString().substring(0, 19) + 'Z';

        // 1. Query verified backend arrival geometry & instant illumination
        let skyData = null;
        let surfaceData = null;
        let instantIllum = null;
        let windowsData: WindowsCalculationResponse | null = null;

        try {
          const [skyRes, surfRes, illumRes] = await Promise.all([
            lunarApi.getSkyGeometry({
              latitudeDeg: currentDestination.latitudeDeg,
              longitudeDeg: currentDestination.longitudeDeg,
              epochUtc: arrIso,
              elevationMeters: currentDestination.elevationMeters,
            }),
            lunarApi.getSurfaceNormal({
              latitudeDeg: currentDestination.latitudeDeg,
              longitudeDeg: currentDestination.longitudeDeg,
            }).catch(() => null),
            lunarApi.getInstantIllumination({
              latitudeDeg: currentDestination.latitudeDeg,
              longitudeDeg: currentDestination.longitudeDeg,
              epochUtc: arrIso,
            }).catch(() => null),
          ]);
          skyData = skyRes;
          surfaceData = surfRes;
          instantIllum = illumRes;
        } catch {
          // Graceful fallback
        }

        // 2. Query 72h arrival surface window
        try {
          windowsData = await lunarApi.calculateWindows({
            latitudeDeg: currentDestination.latitudeDeg,
            longitudeDeg: currentDestination.longitudeDeg,
            startTimeUtc: arrIso,
            endTimeUtc: arrWindowEndIso,
            stepSeconds: 3600,
          });
        } catch {
          // Handled
        }

        const sunEl = skyData?.sun.elevationDeg ?? 1.5;
        const sunAz = skyData?.sun.azimuthDeg ?? 45.0;
        const isSunLit = instantIllum?.isDirectlyIlluminated ?? sunEl > 0;
        const earthEl = skyData?.earth.elevationDeg ?? -6.5;
        const earthAz = skyData?.earth.azimuthDeg ?? 238.0;
        const isEarthVis = earthEl > 0;

        const slopeDeg = surfaceData?.slopeDeg ?? 3.2;
        const elevM = surfaceData?.elevationMeters ?? currentDestination.elevationMeters ?? 1413;
        const isSafeSlope = slopeDeg < reqMaxSlopeDeg;

        // Window hours
        const sunHours = windowsData?.summary.sunlightTotalHours ?? (isSunLit ? 72.0 : 0.0);
        const commHours = windowsData?.summary.earthVisibilityTotalHours ?? (isEarthVis ? 72.0 : 0.0);
        const dualHours = windowsData?.summary.bothVisibilityTotalHours ?? Math.min(sunHours, commHours);

        // Scoring algorithm
        let score = 50;
        if (isSunLit) score += 25;
        if (sunEl >= reqMinSunElevation) score += 10;
        if (isEarthVis) score += 15;
        if (reqRequireEarthLos && !isEarthVis) score -= 20;
        if (isSafeSlope) score += 10;
        score = Math.min(100, Math.max(10, score));

        let verdict: 'OPTIMAL' | 'FAVORABLE' | 'MARGINAL' | 'OCCULTED' = 'MARGINAL';
        let explanation = '';
        const advantages: string[] = [];
        const disadvantages: string[] = [];

        if (isSunLit && isEarthVis && isSafeSlope) {
          verdict = 'OPTIMAL';
          explanation = 'Favorable solar illumination and direct Earth line-of-sight during touchdown and initial operations.';
          advantages.push('Continuous solar power generation at touchdown');
          advantages.push('Direct-to-Earth telemetry communication link clear');
          advantages.push(`Gentle terrain slope (${slopeDeg.toFixed(1)}°) within safety limits`);
        } else if (isSunLit && !isEarthVis) {
          verdict = 'FAVORABLE';
          explanation = 'Continuous solar illumination available for power, but direct Earth communication is occluded by local topography.';
          advantages.push('Reliable solar harvest at landing site');
          disadvantages.push('Direct Earth communication blocked below local crater horizon; requires relay orbiter');
        } else if (!isSunLit && isEarthVis) {
          verdict = 'MARGINAL';
          explanation = 'Site is in lunar shadow at touchdown. Direct Earth link is visible, but battery reserves are depleted rapidly.';
          advantages.push('Continuous direct-to-Earth communication');
          disadvantages.push('Touchdown occurs in shadow; requires primary battery operation until sunrise');
        } else {
          verdict = 'OCCULTED';
          explanation = 'Site is in darkness and Earth is below the topocentric horizon mask at arrival epoch.';
          disadvantages.push('Solar power unavailable at landing');
          disadvantages.push('No direct line-of-sight to Earth tracking network');
        }

        const tliDeltaV = currentProfile.estimatedTliDeltaVMs;
        const loiDeltaV = currentProfile.estimatedLoiDeltaVMs;

        const alternative: DepartureScenarioAlternative = {
          id: `scenario-${idx + 1}-${depDate.getTime()}`,
          scenarioIndex: idx + 1,
          label: idx === 0 ? 'EARLIEST DEPARTURE' : idx === sampleCount - 1 ? 'LATEST DEPARTURE' : `WINDOW ALTERNATIVE 0${idx + 1}`,
          departureEpochUtc: depIso,
          arrivalEpochUtc: arrIso,
          transferDurationHours: effectiveTransferHours,
          estimatedTliDeltaV: tliDeltaV,
          estimatedLoiDeltaV: loiDeltaV,
          estimatedTotalDeltaV: tliDeltaV + loiDeltaV + currentProfile.estimatedDescentDeltaVMs,
          sunElevationDeg: sunEl,
          sunAzimuthDeg: sunAz,
          isSunLit,
          earthElevationDeg: earthEl,
          earthAzimuthDeg: earthAz,
          isEarthVisible: isEarthVis,
          terrainSlopeDeg: slopeDeg,
          terrainElevationMeters: elevM,
          isSafeSlope,
          sunlightHours: sunHours,
          earthCommHours: commHours,
          dualOperationHours: dualHours,
          feasibilityScore: score,
          verdict,
          verdictExplanation: explanation,
          advantages,
          disadvantages,
        };

        return alternative;
      });

      const results = await Promise.all(scenarioPromises);
      
      // Sort alternatives by feasibility score (highest first)
      const sorted = results.sort((a, b) => b.feasibilityScore - a.feasibilityScore);
      setAlternatives(sorted);
      setSelectedAlternativeId(sorted[0]?.id || null);
    } catch (err: any) {
      setGenerationError(err?.message || 'Failed to compute departure alternatives.');
    } finally {
      setIsGenerating(false);
    }
  }, [
    earliestDepartureDate,
    latestDepartureDate,
    preferredDepartureHour,
    effectiveTransferHours,
    currentDestination,
    currentProfile,
    reqMaxSlopeDeg,
    reqMinSunElevation,
  ]);

  // Generate initial scenarios on mount or when destination changes
  useEffect(() => {
    handleGenerateScenarios();
  }, [selectedDestinationSiteId, selectedProfileId]);

  // Active alternative for display
  const activeAlternative = useMemo(() => {
    return alternatives.find((a) => a.id === selectedAlternativeId) || alternatives[0] || null;
  }, [alternatives, selectedAlternativeId]);

  // Handle proceed to Lunar Surface Analysis
  const handleProceedToLunarAnalysis = () => {
    if (!activeAlternative) return;
    const dest = currentDestination;
    const arrEpoch = activeAlternative.arrivalEpochUtc;
    
    // Save to localStorage for robust shared state
    try {
      localStorage.setItem('lunaris_selected_arrival_site', dest.id);
      localStorage.setItem('lunaris_selected_arrival_epoch', arrEpoch);
    } catch {}

    // Navigate to Mission Browser with predicted arrival epoch as the new starting observation epoch!
    const query = new URLSearchParams({
      site: dest.id,
      epoch: arrEpoch,
      fromRoute: '1',
    });
    navigate(`/mission-browser?${query.toString()}`);
  };

  return (
    <div className="w-full bg-black min-h-screen pt-16 flex flex-col font-mono text-white select-none">
      
      {/* =========================================================================
          HERO BANNER: MISSION ROUTE & LAUNCH WINDOW PLANNER
      ========================================================================= */}
      <section className="w-full py-8 px-4 sm:px-8 lg:px-16 bg-[#06080C] border-b border-white/15">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-white/10 border border-white/20 font-bold text-xs uppercase tracking-widest text-[#00FF9D] flex items-center gap-1.5">
                <Rocket size={12} /> CAPABILITY 07 // TRANS-LUNAR ROUTE PLANNER
              </span>
              <span className="text-white/40 text-[10px]">DEPARTURE TO TOUCHDOWN</span>
            </div>

            <Link
              href="/mission-browser"
              className="text-[10px] text-white/60 hover:text-white uppercase font-bold flex items-center gap-1 border border-white/20 px-2.5 py-1 hover:bg-white/10 transition-colors"
            >
              <span>Back to Surface Mission Browser</span>
              <ArrowRight size={11} />
            </Link>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-white font-display-hero">
            MISSION ROUTE & LAUNCH WINDOW PLANNER
          </h1>

          <p className="text-xs sm:text-sm text-white/70 max-w-4xl font-sans leading-relaxed">
            Investigate the trans-lunar journey from Earth launch facilities and parking orbits to NASA Artemis and CLPS candidate landing sites. 
            Evaluate alternative departure windows, compare flight durations, and forecast exact topocentric solar illumination and Earth communication conditions at the moment of touchdown.
          </p>

          {/* Transparent Scientific Advisory Banner */}
          <div className="p-2.5 bg-black/80 border border-amber-400/40 rounded-none flex items-start gap-2.5 text-[9.5px]">
            <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5 leading-snug text-white/80">
              <span className="text-amber-300 font-bold uppercase tracking-wider">
                SCIENTIFIC CALCULATION METHODOLOGY // ARRIVAL SCENARIO PLANNING MODE
              </span>
              <span>
                Trans-lunar flight trajectories are simulated via parameterized three-body kinematic curves based on nominal trans-lunar injection (TLI) velocity vectors. 
                All lunar arrival conditions (Sun/Earth topocentric angles, local horizon occlusion, LOLA DEM surface slope, and 72-hour operational windows) are calculated using <strong>NASA JPL SPICE DE440</strong> ephemerides and <strong>NASA LOLA 80m</strong> topography.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          MAIN WORKSPACE: 3-STEP CONFIGURATION & TRAJECTORY VIEWER
      ========================================================================= */}
      <section className="w-full py-6 px-4 sm:px-8 lg:px-16 flex-1 max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* 3-STEP CONFIGURATION WORKBENCH GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* STEP 01: DEPARTURE ORIGIN */}
          <div className="bg-[#08090C] border border-white/20 p-4 flex flex-col gap-3 rounded-none">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="font-bold text-[#58D8D0] text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 bg-[#58D8D0] text-black font-extrabold text-[9px]">01</span>
                <span>DEPARTURE ORIGIN</span>
              </span>
              <span className="text-[9px] text-white/40">EARTH DEPARTURE</span>
            </div>

            {/* Mode Switcher: Earth Launch Site vs Parking Orbit */}
            <div className="grid grid-cols-2 gap-1 bg-black p-0.5 border border-white/20">
              <button
                type="button"
                onClick={() => setDepartureMode('SITE')}
                className={`py-1 text-[9.5px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  departureMode === 'SITE' ? 'bg-white text-black font-extrabold' : 'text-white/60 hover:text-white'
                }`}
              >
                Launch Site
              </button>
              <button
                type="button"
                onClick={() => setDepartureMode('ORBIT')}
                className={`py-1 text-[9.5px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  departureMode === 'ORBIT' ? 'bg-white text-black font-extrabold' : 'text-white/60 hover:text-white'
                }`}
              >
                Parking Orbit
              </button>
            </div>

            {departureMode === 'SITE' ? (
              <div className="flex flex-col gap-2">
                <span className="text-[9px] text-white/60 uppercase">Select Launch Facility:</span>
                <select
                  value={selectedLaunchSiteId}
                  onChange={(e) => setSelectedLaunchSiteId(e.target.value)}
                  className="bg-black border border-white/30 text-white p-1.5 text-[9.5px] font-mono outline-none cursor-pointer uppercase rounded-none"
                >
                  {EARTH_LAUNCH_SITES.map((site) => (
                    <option key={site.id} value={site.id} className="bg-[#08090C] text-white">
                      {site.name} ({site.country})
                    </option>
                  ))}
                </select>

                {/* Site Coordinates & Azimuth Details */}
                <div className="p-2 bg-black border border-white/15 flex flex-col gap-1 text-[8.5px]">
                  <div className="flex justify-between">
                    <span className="text-white/50">COORDINATES:</span>
                    <span className="text-white font-bold tabular-nums">
                      {currentLaunchSite.latitudeDeg.toFixed(2)}°N, {Math.abs(currentLaunchSite.longitudeDeg).toFixed(2)}°W
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">ELEVATION:</span>
                    <span className="text-white tabular-nums">+{currentLaunchSite.elevationMeters}m MSL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">LAUNCH AZIMUTH CORRIDOR:</span>
                    <span className="text-amber-300 font-bold tabular-nums">
                      {currentLaunchSite.azimuthMinDeg}° — {currentLaunchSite.azimuthMaxDeg}°
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">NOMINAL INCLINATION:</span>
                    <span className="text-[#58D8D0] font-bold tabular-nums">{currentLaunchSite.nominalInclinationDeg}°</span>
                  </div>
                </div>

                <div className="text-[8px] text-white/50 leading-tight">
                  {currentLaunchSite.description}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-[9px] text-white/60 uppercase">Select Parking Orbit Preset:</span>
                <select
                  value={selectedOrbitPresetId}
                  onChange={(e) => setSelectedOrbitPresetId(e.target.value)}
                  className="bg-black border border-white/30 text-white p-1.5 text-[9.5px] font-mono outline-none cursor-pointer uppercase rounded-none"
                >
                  {PARKING_ORBIT_PRESETS.map((orb) => (
                    <option key={orb.id} value={orb.id} className="bg-[#08090C] text-white">
                      {orb.name}
                    </option>
                  ))}
                </select>

                <div className="p-2 bg-black border border-white/15 flex flex-col gap-1 text-[8.5px]">
                  <div className="flex justify-between">
                    <span className="text-white/50">ALTITUDE:</span>
                    <span className="text-white font-bold tabular-nums">{currentParkingOrbit.altitudeKm} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">INCLINATION:</span>
                    <span className="text-[#58D8D0] font-bold tabular-nums">{currentParkingOrbit.inclinationDeg}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">ORBITAL PERIOD:</span>
                    <span className="text-white tabular-nums">{currentParkingOrbit.periodMinutes} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">CIRCULAR SPEED:</span>
                    <span className="text-emerald-400 font-bold tabular-nums">{currentParkingOrbit.orbitalSpeedKmS} km/s</span>
                  </div>
                </div>

                {/* Advanced Settings Toggle */}
                <button
                  type="button"
                  onClick={() => setShowAdvancedOrbit(!showAdvancedOrbit)}
                  className="text-[8.5px] text-white/60 hover:text-white flex items-center justify-between p-1 bg-white/5 border border-white/10 cursor-pointer"
                >
                  <span>Advanced Keplerian Orbit Elements</span>
                  {showAdvancedOrbit ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>

                {showAdvancedOrbit && (
                  <div className="p-2 bg-black border border-white/20 flex flex-col gap-1.5 text-[8px] animate-fadeIn">
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">ALTITUDE (km):</span>
                      <input
                        type="number"
                        value={customOrbitAltKm}
                        onChange={(e) => setCustomOrbitAltKm(parseFloat(e.target.value) || 0)}
                        className="w-16 bg-white/10 border border-white/30 text-white px-1 py-0.5 text-right font-mono"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">INCLINATION (°):</span>
                      <input
                        type="number"
                        value={customOrbitIncDeg}
                        onChange={(e) => setCustomOrbitIncDeg(parseFloat(e.target.value) || 0)}
                        className="w-16 bg-white/10 border border-white/30 text-white px-1 py-0.5 text-right font-mono"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">RAAN (Ω):</span>
                      <input
                        type="number"
                        value={customRaanDeg}
                        onChange={(e) => setCustomRaanDeg(parseFloat(e.target.value) || 0)}
                        className="w-16 bg-white/10 border border-white/30 text-white px-1 py-0.5 text-right font-mono"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">ARG OF PERIGEE (ω):</span>
                      <input
                        type="number"
                        value={customArgPeriapsisDeg}
                        onChange={(e) => setCustomArgPeriapsisDeg(parseFloat(e.target.value) || 0)}
                        className="w-16 bg-white/10 border border-white/30 text-white px-1 py-0.5 text-right font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 02: LUNAR DESTINATION */}
          <div className="bg-[#08090C] border border-white/20 p-4 flex flex-col gap-3 rounded-none">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="font-bold text-[#00FF9D] text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 bg-[#00FF9D] text-black font-extrabold text-[9px]">02</span>
                <span>LUNAR DESTINATION</span>
              </span>
              <span className="text-[9px] text-white/40">LANDING SITE</span>
            </div>

            {/* Interactive Mini Lunar Map Selector */}
            <MiniLunarMapSelector
              sites={candidateSites}
              selectedSiteId={selectedDestinationSiteId}
              onSelectSite={(site) => setSelectedDestinationSiteId(site.id)}
              onRegisterCustomCoordinates={(lat, lon, name) => {
                const customItem: MapSiteItem = {
                  id: `custom-${Date.now()}`,
                  name,
                  latitudeDeg: lat,
                  longitudeDeg: lon,
                  elevationMeters: 0,
                  pinColor: '#00FF9D',
                  isCustom: true,
                  isDemCovered: true,
                };
                setCandidateSites((prev) => [...prev, customItem]);
                setSelectedDestinationSiteId(customItem.id);
              }}
            />
          </div>

          {/* STEP 03: DEPARTURE WINDOW & MISSION PROFILE */}
          <div className="bg-[#08090C] border border-white/20 p-4 flex flex-col gap-3 rounded-none">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="font-bold text-[#ECC068] text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 bg-[#ECC068] text-black font-extrabold text-[9px]">03</span>
                <span>DEPARTURE WINDOW</span>
              </span>
              <span className="text-[9px] text-white/40">MISSION PROFILE</span>
            </div>

            {/* Date Range Inputs */}
            <div className="grid grid-cols-2 gap-2 text-[8.5px]">
              <div className="flex flex-col gap-1">
                <span className="text-white/60">EARLIEST DEPARTURE:</span>
                <input
                  type="date"
                  value={earliestDepartureDate}
                  onChange={(e) => setEarliestDepartureDate(e.target.value)}
                  className="bg-black border border-white/30 text-white p-1 text-[9px] font-mono outline-none rounded-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-white/60">LATEST DEPARTURE:</span>
                <input
                  type="date"
                  value={latestDepartureDate}
                  onChange={(e) => setLatestDepartureDate(e.target.value)}
                  className="bg-black border border-white/30 text-white p-1 text-[9px] font-mono outline-none rounded-none"
                />
              </div>
            </div>

            {/* Preferred Launch Hour UTC */}
            <div className="flex items-center justify-between text-[8.5px]">
              <span className="text-white/60">PREFERRED TIME (UTC):</span>
              <select
                value={preferredDepartureHour}
                onChange={(e) => setPreferredDepartureHour(parseInt(e.target.value, 10))}
                className="bg-black border border-white/30 text-white px-2 py-0.5 text-[9px] font-mono outline-none rounded-none cursor-pointer"
              >
                {[0, 4, 8, 12, 16, 20].map((h) => (
                  <option key={h} value={h} className="bg-[#08090C] text-white">
                    {h.toString().padStart(2, '0')}:00 UTC
                  </option>
                ))}
              </select>
            </div>

            {/* Spacecraft / Mission Profile */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-white/60 uppercase">Spacecraft Profile & Transfer:</span>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="bg-black border border-white/30 text-white p-1.5 text-[9.5px] font-mono outline-none cursor-pointer uppercase rounded-none"
              >
                {SPACECRAFT_PROFILES.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#08090C] text-white">
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="text-[8px] text-white/50 leading-tight">
                {currentProfile.description}
              </div>
            </div>

            {/* Transfer Duration Badge */}
            <div className="p-2 bg-black border border-white/15 flex justify-between items-center text-[9px]">
              <span className="text-white/60">NOMINAL TRANSFER TIME:</span>
              <span className="text-[#00FF9D] font-bold tabular-nums">
                {effectiveTransferHours} Hours ({(effectiveTransferHours / 24).toFixed(1)} Days)
              </span>
            </div>

            {/* Advanced Flight & Landing Constraints Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvancedConstraints(!showAdvancedConstraints)}
              className="text-[8.5px] text-white/60 hover:text-white flex items-center justify-between p-1 bg-white/5 border border-white/10 cursor-pointer"
            >
              <span>Advanced Flight & Landing Constraints</span>
              {showAdvancedConstraints ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            {showAdvancedConstraints && (
              <div className="p-2 bg-black border border-white/20 flex flex-col gap-2 text-[8px] animate-fadeIn">
                <div className="flex justify-between items-center">
                  <span className="text-white/60">CUSTOM TRANSFER DURATION:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={24}
                      max={200}
                      value={customTransferHours}
                      onChange={(e) => setCustomTransferHours(Math.max(24, parseInt(e.target.value, 10) || 72))}
                      className="w-14 bg-white/10 border border-white/30 text-white px-1 py-0.5 text-right font-mono"
                    />
                    <span className="text-white/50">hrs</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-white/60">MIN SUN ELEVATION:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={0.1}
                      value={reqMinSunElevation}
                      onChange={(e) => setReqMinSunElevation(parseFloat(e.target.value) || 0)}
                      className="w-14 bg-white/10 border border-white/30 text-white px-1 py-0.5 text-right font-mono"
                    />
                    <span className="text-white/50">deg</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-white/60">MAX DEM SLOPE TOLERANCE:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={0.5}
                      value={reqMaxSlopeDeg}
                      onChange={(e) => setReqMaxSlopeDeg(parseFloat(e.target.value) || 8.0)}
                      className="w-14 bg-white/10 border border-white/30 text-white px-1 py-0.5 text-right font-mono"
                    />
                    <span className="text-white/50">deg</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-white/10">
                  <span className="text-white/60">REQUIRE DIRECT EARTH LOS:</span>
                  <button
                    type="button"
                    onClick={() => setReqRequireEarthLos(!reqRequireEarthLos)}
                    className={`px-2 py-0.5 font-bold uppercase tracking-wider text-[8px] border cursor-pointer ${
                      reqRequireEarthLos
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-white/5 text-white/50 border-white/20'
                    }`}
                  >
                    {reqRequireEarthLos ? 'MANDATORY' : 'OPTIONAL'}
                  </button>
                </div>
              </div>
            )}

            {/* Generate Alternatives Button */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateScenarios}
              className={`w-full py-2.5 px-4 font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 rounded-none ${
                isGenerating
                  ? 'bg-white/20 text-white/50 cursor-wait'
                  : 'bg-white text-black hover:bg-[#00FF9D] hover:shadow-[0_0_15px_rgba(0,255,157,0.4)]'
              }`}
            >
              <Sparkles size={13} className={isGenerating ? 'animate-spin' : ''} />
              <span>{isGenerating ? 'Computing Orbital Scenarios...' : 'Compute Departure Scenarios'}</span>
            </button>

            {generationError && (
              <div className="p-1.5 bg-red-950/80 border border-red-500 text-red-200 text-[8.5px] flex items-center gap-1">
                <AlertTriangle size={11} className="shrink-0" />
                <span>{generationError}</span>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            LARGE 3D TRANS-LUNAR MISSION TRAJECTORY VISUALIZATION
        ========================================================================= */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Orbit size={13} className="text-[#58D8D0]" />
                <span>3D TRANS-LUNAR KINEMATIC FLIGHT TRAJECTORY</span>
              </span>
              <span className="text-white/40 text-[9.5px]">EARTH-MOON TRANSFER ENVELOPE</span>
            </div>
            
            <div className="text-[9px] text-[#58D8D0] font-mono">
              FLIGHT TIME: {effectiveTransferHours}h • TOUCHDOWN: {currentDestination.name}
            </div>
          </div>

          <MissionTrajectoryVisualizer
            departureMode={departureMode}
            launchSite={currentLaunchSite}
            parkingOrbit={currentParkingOrbit}
            lunarDestination={currentDestination}
            spacecraftProfile={currentProfile}
            departureEpochUtc={`${earliestDepartureDate} ${preferredDepartureHour.toString().padStart(2, '0')}:00 UTC`}
            transferDurationHours={effectiveTransferHours}
            arrivalEpochUtc={activeAlternative?.arrivalEpochUtc || 'Calculating...'}
          />
        </div>

        {/* =========================================================================
            DEPARTURE WINDOW ALTERNATIVES: SIDE-BY-SIDE CARDS & COMPARISON MATRIX
        ========================================================================= */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#00FF9D] flex items-center gap-1.5">
                <Layers size={13} /> CANDIDATE DEPARTURE SCENARIOS & ARRIVAL CONDITIONS
              </span>
              <span className="text-[9.5px] text-white/50">
                Sorted by Mission Feasibility Score (Sunlight + Direct-to-Earth LOS)
              </span>
            </div>

            <span className="text-[9px] text-white/40">
              {alternatives.length} ALTERNATIVES EVALUATED
            </span>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {alternatives.map((alt) => {
              const isSelected = alt.id === selectedAlternativeId;
              return (
                <div
                  key={alt.id}
                  onClick={() => setSelectedAlternativeId(alt.id)}
                  className={`p-3 border transition-all cursor-pointer flex flex-col justify-between gap-2.5 rounded-none ${
                    isSelected
                      ? 'border-[#00FF9D] bg-[#00FF9D]/10 text-white shadow-[0_0_15px_rgba(0,255,157,0.2)]'
                      : 'border-white/20 bg-[#08090C] text-white/80 hover:border-white/50 hover:bg-white/5'
                  }`}
                >
                  {/* Card Header: Label & Verdict */}
                  <div className="flex flex-col gap-1 border-b border-white/10 pb-2">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-white/50 font-bold uppercase">{alt.label}</span>
                      <span 
                        className={`px-1.5 py-0.2 text-[8px] font-extrabold uppercase border ${
                          alt.verdict === 'OPTIMAL'
                            ? 'bg-[#00FF9D]/20 text-[#00FF9D] border-[#00FF9D]/50'
                            : alt.verdict === 'FAVORABLE'
                            ? 'bg-[#58D8D0]/20 text-[#58D8D0] border-[#58D8D0]/50'
                            : alt.verdict === 'MARGINAL'
                            ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                            : 'bg-red-500/20 text-red-300 border-red-500/50'
                        }`}
                      >
                        {alt.verdict}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-[8px] text-white/50 uppercase">DEPARTURE:</span>
                      <span className="text-white font-bold text-[9.5px] tabular-nums">
                        {alt.departureEpochUtc.substring(0, 16)}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-[8px] text-[#00FF9D] uppercase font-bold">PREDICTED ARRIVAL:</span>
                      <span className="text-[#00FF9D] font-bold text-[9.5px] tabular-nums">
                        {alt.arrivalEpochUtc.substring(0, 16)}
                      </span>
                    </div>
                  </div>

                  {/* Arrival Solar & Earth Geometry */}
                  <div className="flex flex-col gap-1 text-[8.5px]">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1 text-amber-300 font-bold">
                        <Sun size={10} /> SUN ELEVATION:
                      </span>
                      <span className={`tabular-nums font-bold ${alt.sunElevationDeg > 0 ? 'text-amber-300' : 'text-red-400'}`}>
                        {alt.sunElevationDeg >= 0 ? `+${alt.sunElevationDeg.toFixed(2)}°` : `${alt.sunElevationDeg.toFixed(2)}°`} ({alt.isSunLit ? 'LIT' : 'SHADOW'})
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1 text-[#58D8D0] font-bold">
                        <Globe size={10} /> EARTH ELEVATION:
                      </span>
                      <span className={`tabular-nums font-bold ${alt.earthElevationDeg > 0 ? 'text-[#58D8D0]' : 'text-white/40'}`}>
                        {alt.earthElevationDeg >= 0 ? `+${alt.earthElevationDeg.toFixed(2)}°` : `${alt.earthElevationDeg.toFixed(2)}°`} ({alt.isEarthVisible ? 'LOS CLEAR' : 'BLOCKED'})
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-white/50">LOLA 80M SLOPE:</span>
                      <span className={`tabular-nums font-bold ${alt.isSafeSlope ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {alt.terrainSlopeDeg.toFixed(1)}° ({alt.isSafeSlope ? 'SAFE' : 'STEEP'})
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-t border-white/10 pt-1">
                      <span className="text-white/50">EST. TOTAL ΔV:</span>
                      <span className="text-white font-bold tabular-nums">
                        {alt.estimatedTotalDeltaV.toLocaleString()} m/s
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-white/50">FEASIBILITY SCORE:</span>
                      <span className="text-[#00FF9D] font-extrabold tabular-nums">
                        {alt.feasibilityScore} / 100
                      </span>
                    </div>
                  </div>

                  {/* Radio Select Pill */}
                  <div className={`mt-2 py-1 text-center font-bold text-[9px] uppercase border rounded-none transition-colors ${
                    isSelected ? 'bg-[#00FF9D] text-black border-[#00FF9D]' : 'border-white/20 text-white/60 hover:text-white'
                  }`}>
                    {isSelected ? '✓ SELECTED FOR ANALYSIS' : 'SELECT SCENARIO'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Selected Alternative Dossier & Action Call */}
          {activeAlternative && (
            <div className="p-4 bg-[#08090C] border border-[#00FF9D]/60 rounded-none flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white uppercase tracking-wider text-sm">
                    SCENARIO DETAILS: {activeAlternative.label}
                  </span>
                  <span className="px-2 py-0.5 bg-[#00FF9D]/20 text-[#00FF9D] font-bold text-[9px] border border-[#00FF9D]/50 uppercase">
                    {activeAlternative.verdict} VERDICT
                  </span>
                </div>

                {/* Primary Transition Action Button */}
                <button
                  type="button"
                  onClick={handleProceedToLunarAnalysis}
                  className="px-5 py-2.5 bg-[#00FF9D] hover:bg-white text-black font-extrabold text-xs uppercase tracking-wider cursor-pointer flex items-center gap-2 rounded-none transition-all shadow-[0_0_15px_rgba(0,255,157,0.3)]"
                >
                  <span>PROCEED TO LUNAR SURFACE ANALYSIS AT ARRIVAL EPOCH</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[9px]">
                {/* Advantages */}
                <div className="p-2.5 bg-black/60 border border-emerald-500/30 flex flex-col gap-1.5">
                  <span className="text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Check size={11} /> Mission Planning Advantages:
                  </span>
                  {activeAlternative.advantages.map((adv, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-white/80">
                      <span className="text-emerald-400">•</span>
                      <span>{adv}</span>
                    </div>
                  ))}
                  {activeAlternative.advantages.length === 0 && (
                    <span className="text-white/40 italic">No significant advantages identified.</span>
                  )}
                </div>

                {/* Disadvantages / Operational Constraints */}
                <div className="p-2.5 bg-black/60 border border-amber-500/30 flex flex-col gap-1.5">
                  <span className="text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle size={11} /> Operational Trade-Offs & Constraints:
                  </span>
                  {activeAlternative.disadvantages.map((dis, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-white/80">
                      <span className="text-amber-400">•</span>
                      <span>{dis}</span>
                    </div>
                  ))}
                  {activeAlternative.disadvantages.length === 0 && (
                    <span className="text-emerald-400 italic">No severe constraints detected.</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            CHRONOLOGICAL MISSION TIMELINE (Earth Departure to Surface Operations)
        ========================================================================= */}
        {activeAlternative && (
          <div className="bg-[#08090C] border border-white/20 p-4 flex flex-col gap-3 rounded-none">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Clock size={12} className="text-[#58D8D0]" />
                <span>CHRONOLOGICAL MISSION PHASES // END-TO-END TIMELINE</span>
              </span>
              <span className="text-[9px] text-white/40">UTC EVENT SCHEDULE</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              
              {/* Phase 1 */}
              <div className="p-2.5 bg-black border border-white/20 flex flex-col gap-1 text-[8.5px]">
                <div className="text-[#58D8D0] font-bold uppercase">01 // EARTH DEPARTURE</div>
                <div className="text-white font-bold tabular-nums text-[9.5px]">
                  {activeAlternative.departureEpochUtc.substring(0, 16)}
                </div>
                <div className="text-white/60">
                  Ignition from {departureMode === 'SITE' ? currentLaunchSite.name : currentParkingOrbit.name}. Trans-Lunar Injection (TLI) burn.
                </div>
              </div>

              {/* Phase 2 */}
              <div className="p-2.5 bg-black border border-white/20 flex flex-col gap-1 text-[8.5px]">
                <div className="text-white/80 font-bold uppercase">02 // TRANSLUNAR CRUISE</div>
                <div className="text-white font-bold tabular-nums text-[9.5px]">
                  MET T+ 00d 02h — {Math.floor(effectiveTransferHours / 24)}d
                </div>
                <div className="text-white/60">
                  Cislunar coast phase across ~384,400 km. Van Allen belt traversal and midcourse trajectory correction burns (TCM-1/2).
                </div>
              </div>

              {/* Phase 3 */}
              <div className="p-2.5 bg-black border border-white/20 flex flex-col gap-1 text-[8.5px]">
                <div className="text-[#ECC068] font-bold uppercase">03 // LUNAR APPROACH</div>
                <div className="text-white font-bold tabular-nums text-[9.5px]">
                  ~2 Hours Prior to Arrival
                </div>
                <div className="text-white/60">
                  Lunar sphere of influence entry. Hyperbolic approach alignment and retrograde Lunar Orbit Insertion (LOI).
                </div>
              </div>

              {/* Phase 4 */}
              <div className="p-2.5 bg-black border border-[#00FF9D]/60 flex flex-col gap-1 text-[8.5px]">
                <div className="text-[#00FF9D] font-bold uppercase">04 // TOUCHDOWN</div>
                <div className="text-[#00FF9D] font-bold tabular-nums text-[9.5px]">
                  {activeAlternative.arrivalEpochUtc.substring(0, 16)}
                </div>
                <div className="text-white/60">
                  Powered Descent Insertion (PDI) at {currentDestination.name}. Sun El: {activeAlternative.sunElevationDeg.toFixed(1)}°, Slope: {activeAlternative.terrainSlopeDeg.toFixed(1)}°.
                </div>
              </div>

              {/* Phase 5 */}
              <div className="p-2.5 bg-black border border-white/20 flex flex-col gap-1 text-[8.5px]">
                <div className="text-white/80 font-bold uppercase">05 // SURFACE OPERATIONS</div>
                <div className="text-white font-bold tabular-nums text-[9.5px]">
                  Arrival + 72 Hours
                </div>
                <div className="text-white/60">
                  High-priority scientific window: {activeAlternative.sunlightHours.toFixed(1)}h sunlight, {activeAlternative.earthCommHours.toFixed(1)}h direct-to-Earth communication.
                </div>
              </div>
            </div>
          </div>
        )}

      </section>
    </div>
  );
};
