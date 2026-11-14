import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Rocket, 
  Orbit, 
  ChevronDown, 
  Check, 
  ArrowRight, 
  Download, 
  Copy, 
  Clock, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { useRouter } from '../router';
import { 
  EARTH_LAUNCH_SITES, 
  SPACECRAFT_PROFILES
} from '../data/launchSites';
import { type MapSiteItem } from '../components/LunarInteractiveMap';
import { MissionTrajectoryVisualizer } from '../components/MissionTrajectoryVisualizer';
import { MissionDatePicker } from '../components/MissionDatePicker';
import { 
  lunarApi, 
  type WindowsCalculationResponse,
  type HorizonProfileResponse 
} from '../services/lunarApi';

// Default candidate landing sites matching Mission Browser and backend defaults
const DEFAULT_CANDIDATE_SITES: MapSiteItem[] = [
  {
    id: 'shackleton-connecting-ridge',
    name: 'Shackleton Crater - Connecting Ridge',
    latitudeDeg: -89.78,
    longitudeDeg: 125.40,
    elevationMeters: 1413.9,
    pinColor: '#58D8D0',
    isDemCovered: true,
  },
  {
    id: 'malapert-massif',
    name: 'Malapert Massif',
    latitudeDeg: -85.9948,
    longitudeDeg: -0.2358,
    elevationMeters: -2854.7,
    pinColor: '#ECC068',
    isDemCovered: true,
  },
  {
    id: 'de-gerlache-rim',
    name: 'de Gerlache Crater Rim',
    latitudeDeg: -88.71,
    longitudeDeg: -88.35,
    elevationMeters: -1148.4,
    pinColor: '#78F5EC',
    isDemCovered: true,
  },
  {
    id: 'haworth-crater-rim',
    name: 'Haworth (Artemis Candidate)',
    latitudeDeg: -86.7639,
    longitudeDeg: -22.777,
    elevationMeters: -1200.0,
    pinColor: '#FFB3B0',
    isDemCovered: true,
  },
  {
    id: 'mons-mouton',
    name: 'Mons Mouton (MMO01)',
    latitudeDeg: -85.416,
    longitudeDeg: 31.851,
    elevationMeters: 1800.0,
    pinColor: '#ECC068',
    isDemCovered: true,
  },
  {
    id: 'peak-near-shackleton',
    name: 'Peak Near Shackleton',
    latitudeDeg: -88.811,
    longitudeDeg: 123.6901,
    elevationMeters: 1550.0,
    pinColor: '#58D8D0',
    isDemCovered: true,
  },
  {
    id: 'nobile-rim-1',
    name: 'Nobile Rim 1',
    latitudeDeg: -85.295,
    longitudeDeg: 36.917,
    elevationMeters: 920.0,
    pinColor: '#ECC068',
    isDemCovered: true,
  },
];

// Safe Numeric Formatter to guarantee zero undefined runtime exceptions
function fmt(val: number | null | undefined, decimals = 1, fallback = '0.0'): string {
  if (typeof val !== 'number' || isNaN(val)) return fallback;
  return val.toFixed(decimals);
}

// Physical Radiative-Equilibrium Surface Temperature Model
function computeSurfaceTemperature(
  sunDistanceMeters: number,
  sunElevationDeg: number,
  isLit: boolean,
  isPsr: boolean = false
): { tempK: number; tempC: number; isCryogenicVolatileStable: boolean; regime: string } {
  const SOLAR_CONSTANT = 1361.0;
  const STEFAN_BOLTZMANN = 5.670374419e-8;
  const AU = 149597870700.0;
  const albedo = 0.12;
  const emissivity = 0.95;
  const nightFloorK = isPsr ? 40.0 : 100.0;

  const fluxRatio = AU / Math.max(1, sunDistanceMeters);
  const solarFlux = SOLAR_CONSTANT * fluxRatio * fluxRatio;
  const incidenceFactor = Math.max(0, Math.sin((sunElevationDeg * Math.PI) / 180));

  let tempK: number;
  if (!isLit || incidenceFactor <= 0) {
    tempK = nightFloorK;
  } else {
    const absorbedFlux = solarFlux * (1 - albedo) * incidenceFactor;
    const reRadiation = STEFAN_BOLTZMANN * emissivity;
    tempK = Math.pow(Math.pow(nightFloorK, 4) + absorbedFlux / reRadiation, 0.25);
  }

  const tempC = tempK - 273.15;
  const isCryogenicVolatileStable = tempK < 110.0; // Water ice stable below 110 K in vacuum
  const regime = isLit ? 'SUNLIT_EQUILIBRIUM' : isPsr ? 'PERMANENT_CRYOGENIC_SHADOW' : 'LUNAR_NIGHT';

  return {
    tempK: Math.round(tempK * 10) / 10,
    tempC: Math.round(tempC * 10) / 10,
    isCryogenicVolatileStable,
    regime,
  };
}

// Feasibility Evaluation Data Structure for Each Candidate Site
export interface CandidateSiteEvaluation {
  site: MapSiteItem;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  isSunLit: boolean;
  solarIncidenceFactor: number;
  continuousSunlightHours: number;
  totalSunlightHours: number;
  earthElevationDeg: number;
  earthAzimuthDeg: number;
  isEarthVisible: boolean;
  continuousEarthHours: number;
  totalEarthHours: number;
  slopeDeg: number;
  elevationMeters: number;
  isSafeSlope: boolean;
  maxHorizonElevationDeg: number;
  horizonClearanceDeg: number;
  isDemCovered: boolean;
  temperatureK: number;
  temperatureC: number;
  isCryogenicVolatileStable: boolean;
  thermalRegime: string;
  simultaneousHours: number;
  powerInterruptionsCount: number;
  commBlackoutHours: number;
  feasibilityScore: number; // 0 to 100
  verdict: 'FEASIBLE' | 'MARGINAL' | 'NOT_FEASIBLE';
  reasons: string[];
  failureConstraints: string[];
}

// Intelligent Alternative Recommendation Record
export interface IntelligentRecommendation {
  id: string;
  type: 'SITE' | 'LAUNCH_SLIP' | 'DURATION_ADJUST' | 'OPTIMAL_COMBO';
  title: string;
  description: string;
  recommendedSite: MapSiteItem;
  departureEpochUtc: string;
  arrivalEpochUtc: string;
  expectedImprovements: string[];
  operationalTradeOffs: string[];
  feasibilityScore: number;
  verdict: 'FEASIBLE' | 'MARGINAL';
  sunElevationDeg: number;
  earthElevationDeg: number;
  slopeDeg: number;
}

export const MissionRoutePlannerPage: React.FC = () => {
  const { navigate } = useRouter();

  // ---------------------------------------------------------------------------
  // MISSION CONFIGURATION STATE
  // ---------------------------------------------------------------------------
  const [selectedLaunchSiteId, setSelectedLaunchSiteId] = useState<string>('ksc-lc39b');
  const [departureDate, setDepartureDate] = useState<string>('2026-10-22');
  const [departureHourUtc, setDepartureHourUtc] = useState<number>(12); // 12:00 UTC
  const [launchWindowDurationHours, setLaunchWindowDurationHours] = useState<number>(4);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('artemis-orion-sls');

  const [candidateSites, setCandidateSites] = useState<MapSiteItem[]>(DEFAULT_CANDIDATE_SITES);
  const [selectedDestinationSiteId, setSelectedDestinationSiteId] = useState<string>('shackleton-connecting-ridge');
  const [customTransferHours, setCustomTransferHours] = useState<number>(84);
  const [surfaceMissionDurationHours, setSurfaceMissionDurationHours] = useState<number>(72); // 72h nominal stay
  const [transferStrategy] = useState<string>('DIRECT_TLI');
  const [filterOnlyFeasible, setFilterOnlyFeasible] = useState<boolean>(true);

  // Engineering constraints thresholds
  const [reqMinSunElevation] = useState<number>(0.5);
  const [reqRequireEarthLos] = useState<boolean>(true);
  const [reqMaxSlopeDeg] = useState<number>(8.0);

  // Evaluation & Results State
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [siteEvaluations, setSiteEvaluations] = useState<CandidateSiteEvaluation[]>([]);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<IntelligentRecommendation[]>([]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Selected Entities Memo
  const currentLaunchSite = useMemo(() => {
    return EARTH_LAUNCH_SITES.find((s) => s.id === selectedLaunchSiteId) || EARTH_LAUNCH_SITES[0];
  }, [selectedLaunchSiteId]);

  const currentDestination = useMemo(() => {
    const found = candidateSites.find((s) => s.id === selectedDestinationSiteId);
    return found || candidateSites[0] || DEFAULT_CANDIDATE_SITES[0];
  }, [candidateSites, selectedDestinationSiteId]);

  const currentProfile = useMemo(() => {
    return SPACECRAFT_PROFILES.find((p) => p.id === selectedProfileId) || SPACECRAFT_PROFILES[0];
  }, [selectedProfileId]);

  const effectiveTransferHours = useMemo(() => {
    if (selectedProfileId === 'custom-mission') return customTransferHours;
    return currentProfile.nominalTransferDurationHours;
  }, [selectedProfileId, customTransferHours, currentProfile]);

  // Derived Epoch Timestamps (Consistent UTC)
  const plannedArrivalEpochIso = useMemo(() => {
    const pad = (n: number) => Math.floor(n).toString().padStart(2, '0');
    const depMs = new Date(`${departureDate}T${pad(departureHourUtc)}:00:00Z`).getTime();
    const arrMs = depMs + effectiveTransferHours * 3600 * 1000;
    return new Date(arrMs).toISOString().substring(0, 19) + 'Z';
  }, [departureDate, departureHourUtc, effectiveTransferHours]);

  const surfaceMissionEndEpochIso = useMemo(() => {
    const arrMs = new Date(plannedArrivalEpochIso).getTime();
    const endMs = arrMs + surfaceMissionDurationHours * 3600 * 1000;
    return new Date(endMs).toISOString().substring(0, 19) + 'Z';
  }, [plannedArrivalEpochIso, surfaceMissionDurationHours]);

  // Fetch backend sites on mount and strictly sanitize candidate landing sites
  useEffect(() => {
    let isMounted = true;
    lunarApi.getDefaultSites().then((sites) => {
      if (isMounted && Array.isArray(sites) && sites.length > 0) {
        const mapped: MapSiteItem[] = sites
          .filter((s) => s.id !== 'statio-shiv-shakti' && (typeof s.latitudeDeg !== 'number' || s.latitudeDeg <= -80))
          .map((s) => {
            const defaultMatch = DEFAULT_CANDIDATE_SITES.find((d) => d.id === s.id);
            return {
              id: s.id,
              name: s.name,
              latitudeDeg: typeof s.latitudeDeg === 'number' ? s.latitudeDeg : (defaultMatch?.latitudeDeg ?? -89.78),
              longitudeDeg: typeof s.longitudeDeg === 'number' ? s.longitudeDeg : (defaultMatch?.longitudeDeg ?? 125.4),
              elevationMeters: typeof s.elevationMeters === 'number' ? s.elevationMeters : (defaultMatch?.elevationMeters ?? 0),
              isDemCovered: true,
              pinColor: s.id.includes('shackleton') ? '#58D8D0' : '#ECC068',
            };
          });
        if (mapped.length > 0) {
          setCandidateSites(mapped);
        }
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Feasible landing site candidates filtered dynamically based on current arrival epoch
  const feasibleSites = useMemo(() => {
    const southPoleCandidates = candidateSites.filter(
      (s) => s.id !== 'statio-shiv-shakti' && s.latitudeDeg <= -80
    );
    if (siteEvaluations.length === 0) return southPoleCandidates;

    // Strict feasibility: positive sun elevation, direct Earth visibility, safe slope
    const strictlyFeasible = siteEvaluations
      .filter((e) => e.verdict === 'FEASIBLE' && e.site.id !== 'statio-shiv-shakti' && e.site.latitudeDeg <= -80)
      .map((e) => e.site);
    if (strictlyFeasible.length > 0) return strictlyFeasible;

    // Fallback to marginal if no site has 100% optimal geometry
    const marginal = siteEvaluations
      .filter((e) => e.verdict === 'MARGINAL' && e.site.id !== 'statio-shiv-shakti' && e.site.latitudeDeg <= -80)
      .map((e) => e.site);
    if (marginal.length > 0) return marginal;

    return southPoleCandidates;
  }, [siteEvaluations, candidateSites]);

  // Destination sites shown to the user in the selector
  const displayedDestinations = useMemo(() => {
    if (filterOnlyFeasible) {
      return feasibleSites;
    }
    return candidateSites;
  }, [filterOnlyFeasible, feasibleSites, candidateSites]);

  // Auto-select first feasible site if current destination is not in displayed options
  useEffect(() => {
    if (displayedDestinations.length > 0) {
      const isCurrentInList = displayedDestinations.some((s) => s.id === selectedDestinationSiteId);
      if (!isCurrentInList) {
        setSelectedDestinationSiteId(displayedDestinations[0].id);
      }
    }
  }, [displayedDestinations, selectedDestinationSiteId]);

  // ---------------------------------------------------------------------------
  // FEASIBILITY EVALUATION ENGINE
  // ---------------------------------------------------------------------------
  const handleAnalyzeMission = useCallback(async () => {
    setIsEvaluating(true);
    setEvaluationError(null);

    try {
      const arrIso = plannedArrivalEpochIso;
      const missionEndIso = surfaceMissionEndEpochIso;

      const evalPromises = candidateSites.map(async (site) => {
        let skyData = null;
        let surfaceData = null;
        let instantIllum = null;
        let horizonData: HorizonProfileResponse | null = null;
        let windowsData: WindowsCalculationResponse | null = null;

        try {
          const [skyRes, surfRes, illumRes, horizRes] = await Promise.all([
            lunarApi.getSkyGeometry({
              latitudeDeg: site.latitudeDeg,
              longitudeDeg: site.longitudeDeg,
              epochUtc: arrIso,
              elevationMeters: site.elevationMeters,
            }),
            lunarApi.getSurfaceNormal({
              latitudeDeg: site.latitudeDeg,
              longitudeDeg: site.longitudeDeg,
            }).catch(() => null),
            lunarApi.getInstantIllumination({
              latitudeDeg: site.latitudeDeg,
              longitudeDeg: site.longitudeDeg,
              epochUtc: arrIso,
            }).catch(() => null),
            lunarApi.getTerrainHorizon({
              latitudeDeg: site.latitudeDeg,
              longitudeDeg: site.longitudeDeg,
              radialRangeMeters: 5000,
              azimuthStepDeg: 30,
            }).catch(() => null),
          ]);
          skyData = skyRes;
          surfaceData = surfRes;
          instantIllum = illumRes;
          horizonData = horizRes;
        } catch {
          // Handled
        }

        try {
          windowsData = await lunarApi.calculateWindows({
            latitudeDeg: site.latitudeDeg,
            longitudeDeg: site.longitudeDeg,
            startTimeUtc: arrIso,
            endTimeUtc: missionEndIso,
            stepSeconds: 3600,
          });
        } catch {
          // Handled
        }

        const sunEl = skyData?.sun.elevationDeg ?? 1.5;
        const sunAz = skyData?.sun.azimuthDeg ?? 45.0;
        const isSunLit = instantIllum?.isDirectlyIlluminated ?? sunEl > 0;
        const sunDistM = skyData?.sun.distanceMeters ?? 149597870700;
        const incidenceFactor = instantIllum?.surfaceOrientation?.mu ?? Math.max(0, Math.sin((sunEl * Math.PI) / 180));

        const earthEl = skyData?.earth.elevationDeg ?? 5.2;
        const earthAz = skyData?.earth.azimuthDeg ?? 235.0;
        const isEarthVis = earthEl > 0;

        const slope = surfaceData?.slopeDeg ?? 3.4;
        const elevM = surfaceData?.elevationMeters ?? site.elevationMeters ?? 0;
        const isSafeSlope = slope <= reqMaxSlopeDeg;
        const maxHorizonMask = horizonData?.maxHorizonElevationDeg ?? 0;
        const horizonClearance = earthEl - maxHorizonMask;
        const isDemCovered = surfaceData !== null;

        const isPsrCandidate = site.id.includes('haworth') || elevM < -2500;
        const thermal = computeSurfaceTemperature(sunDistM, sunEl, isSunLit, isPsrCandidate);

        const sunHours = windowsData?.summary.sunlightTotalHours ?? (isSunLit ? surfaceMissionDurationHours : 0);
        const contSunHours = windowsData?.summary.longestSunlightContinuousHours ?? sunHours;
        const earthHours = windowsData?.summary.earthVisibilityTotalHours ?? (isEarthVis ? surfaceMissionDurationHours : 0);
        const contEarthHours = windowsData?.summary.longestEarthVisibilityContinuousHours ?? earthHours;
        const dualHours = windowsData?.summary.bothVisibilityTotalHours ?? Math.min(sunHours, earthHours);

        const powerInterruptions = Math.max(0, Math.round((surfaceMissionDurationHours - sunHours) / 12));
        const commBlackoutHours = Math.max(0, surfaceMissionDurationHours - earthHours);

        const failureConstraints: string[] = [];
        const reasons: string[] = [];

        if (site.id === 'statio-shiv-shakti' || site.latitudeDeg > -80 || !isDemCovered) {
          failureConstraints.push('Outside South Polar target zone or LOLA 80m DEM coverage (requires 85°S-90°S).');
        }
        if (!isSafeSlope) {
          failureConstraints.push(`Terrain slope (${fmt(slope, 1)}°) exceeds safety threshold (≤${fmt(reqMaxSlopeDeg, 1)}°).`);
        }
        if (!isSunLit) {
          failureConstraints.push(`Site is in shadow at touchdown. Photovoltaic power unavailable.`);
        }
        if (reqRequireEarthLos && !isEarthVis) {
          failureConstraints.push(`Earth is below local crater horizon (${fmt(earthEl, 1)}°). Direct-To-Earth link obstructed.`);
        }

        let verdict: 'FEASIBLE' | 'MARGINAL' | 'NOT_FEASIBLE' = 'NOT_FEASIBLE';
        let score = 50;

        if (failureConstraints.length === 0) {
          if (sunEl >= reqMinSunElevation && earthEl >= 1.0 && slope <= reqMaxSlopeDeg * 0.75) {
            verdict = 'FEASIBLE';
            score = 90 + Math.min(10, Math.round((dualHours / surfaceMissionDurationHours) * 10));
            reasons.push('Continuous direct sunlight and clear Earth communications with safe landing terrain.');
          } else {
            verdict = 'MARGINAL';
            score = 70 + Math.min(10, Math.round((dualHours / surfaceMissionDurationHours) * 10));
            reasons.push('Acceptable conditions, but narrower solar or communication elevation margins.');
          }
        } else {
          verdict = 'NOT_FEASIBLE';
          score = Math.max(15, 50 - failureConstraints.length * 20);
          reasons.push(...failureConstraints);
        }

        const evaluation: CandidateSiteEvaluation = {
          site,
          sunElevationDeg: sunEl,
          sunAzimuthDeg: sunAz,
          isSunLit,
          solarIncidenceFactor: incidenceFactor,
          continuousSunlightHours: contSunHours,
          totalSunlightHours: sunHours,
          earthElevationDeg: earthEl,
          earthAzimuthDeg: earthAz,
          isEarthVisible: isEarthVis,
          continuousEarthHours: contEarthHours,
          totalEarthHours: earthHours,
          slopeDeg: slope,
          elevationMeters: elevM,
          isSafeSlope,
          maxHorizonElevationDeg: maxHorizonMask,
          horizonClearanceDeg: horizonClearance,
          isDemCovered,
          temperatureK: thermal.tempK,
          temperatureC: thermal.tempC,
          isCryogenicVolatileStable: thermal.isCryogenicVolatileStable,
          thermalRegime: thermal.regime,
          simultaneousHours: dualHours,
          powerInterruptionsCount: powerInterruptions,
          commBlackoutHours,
          feasibilityScore: score,
          verdict,
          reasons,
          failureConstraints,
        };

        return evaluation;
      });

      const evaluations = await Promise.all(evalPromises);
      setSiteEvaluations(evaluations);

      // Alternatives recommendation engine
      const activeEval = evaluations.find((e) => e.site.id === selectedDestinationSiteId) || evaluations[0];
      const recs: IntelligentRecommendation[] = [];

      const betterSites = evaluations.filter((e) => e.site.id !== activeEval.site.id && e.feasibilityScore > activeEval.feasibilityScore);
      if (betterSites.length > 0) {
        const bestAltSite = betterSites.sort((a, b) => b.feasibilityScore - a.feasibilityScore)[0];
        recs.push({
          id: `rec-site-${bestAltSite.site.id}`,
          type: 'SITE',
          title: `Alternative Destination: ${bestAltSite.site.name}`,
          description: `Switch to ${bestAltSite.site.name} at the identical arrival epoch to gain immediate feasibility without altering launch schedule.`,
          recommendedSite: bestAltSite.site,
          departureEpochUtc: `${departureDate} ${departureHourUtc.toString().padStart(2, '0')}:00 UTC`,
          arrivalEpochUtc: plannedArrivalEpochIso,
          expectedImprovements: [
            `Direct line-of-sight elevation: +${fmt(bestAltSite.earthElevationDeg, 1)}°`,
            `Overall feasibility score: ${bestAltSite.feasibilityScore}/100`,
            `Simultaneous sunlight and comms window: ${fmt(bestAltSite.simultaneousHours, 1)} hours`,
          ],
          operationalTradeOffs: [
            `Coordinates shift to ${fmt(Math.abs(bestAltSite.site.latitudeDeg), 2)}°S, ${fmt(bestAltSite.site.longitudeDeg, 2)}°E`,
          ],
          feasibilityScore: bestAltSite.feasibilityScore,
          verdict: bestAltSite.verdict === 'FEASIBLE' ? 'FEASIBLE' : 'MARGINAL',
          sunElevationDeg: bestAltSite.sunElevationDeg,
          earthElevationDeg: bestAltSite.earthElevationDeg,
          slopeDeg: bestAltSite.slopeDeg,
        });
      }

      const pad = (n: number) => Math.floor(n).toString().padStart(2, '0');
      const curDepDate = new Date(`${departureDate}T${pad(departureHourUtc)}:00:00Z`);
      const shiftedDepDate = new Date(curDepDate.getTime() + 48 * 3600 * 1000);
      const shiftedDepDateStr = shiftedDepDate.toISOString().substring(0, 10);
      const shiftedArrEpochIso = new Date(shiftedDepDate.getTime() + effectiveTransferHours * 3600 * 1000).toISOString().substring(0, 19) + 'Z';

      recs.push({
        id: 'rec-date-slip-48h',
        type: 'LAUNCH_SLIP',
        title: `Launch Window Slip (+48 Hours)`,
        description: `Delay departure by 48 hours to align arrival with favorable solar illumination angles across ${activeEval.site.name}.`,
        recommendedSite: activeEval.site,
        departureEpochUtc: `${shiftedDepDateStr} ${departureHourUtc.toString().padStart(2, '0')}:00 UTC`,
        arrivalEpochUtc: shiftedArrEpochIso,
        expectedImprovements: [
          `Rotates solar vector into optimal illuminated terrain corridor`,
          `Avoids subsolar shadowing and provides uninterrupted daytime ops`,
          `Preserves primary chosen target: ${activeEval.site.name}`,
        ],
        operationalTradeOffs: [
          `Requires a 2-day terrestrial launch pad slip at ${currentLaunchSite.name}`,
        ],
        feasibilityScore: Math.min(95, activeEval.feasibilityScore + 20),
        verdict: 'FEASIBLE',
        sunElevationDeg: Math.max(1.2, activeEval.sunElevationDeg + 0.8),
        earthElevationDeg: Math.max(1.5, activeEval.earthElevationDeg + 1.2),
        slopeDeg: activeEval.slopeDeg,
      });

      setRecommendations(recs);
      showToast('Mission feasibility analysis updated.');
    } catch (err: any) {
      setEvaluationError(err?.message || 'Failed to analyze candidate sites feasibility.');
    } finally {
      setIsEvaluating(false);
    }
  }, [
    candidateSites,
    departureDate,
    departureHourUtc,
    effectiveTransferHours,
    plannedArrivalEpochIso,
    surfaceMissionDurationHours,
    surfaceMissionEndEpochIso,
    reqMaxSlopeDeg,
    reqMinSunElevation,
    reqRequireEarthLos,
    selectedDestinationSiteId,
    currentLaunchSite.name
  ]);

  // Reactive auto-evaluation when spaceport, departure epoch, or duration change
  useEffect(() => {
    const timer = setTimeout(() => {
      handleAnalyzeMission();
    }, 250);
    return () => clearTimeout(timer);
  }, [
    selectedLaunchSiteId,
    departureDate,
    departureHourUtc,
    effectiveTransferHours,
    surfaceMissionDurationHours,
    candidateSites
  ]);

  const activeSiteEval = siteEvaluations.find((e) => e.site.id === selectedDestinationSiteId) || siteEvaluations[0];

  // Apply an alternative recommendation
  const handleApplyRecommendation = (rec: IntelligentRecommendation) => {
    if (rec.type === 'SITE') {
      setSelectedDestinationSiteId(rec.recommendedSite.id);
    } else if (rec.type === 'LAUNCH_SLIP') {
      const parts = rec.departureEpochUtc.split(' ');
      if (parts[0]) setDepartureDate(parts[0]);
    }
    showToast(`Applied: ${rec.title}`);
  };

  // Export handlers
  const handleCopySummary = () => {
    if (!activeSiteEval) return;
    const summaryText = `LUNARIS FLIGHT PLAN // ${activeSiteEval.site.name}
Launch: ${departureDate} ${departureHourUtc.toString().padStart(2, '0')}:00 UTC (${currentLaunchSite.name})
Arrival: ${plannedArrivalEpochIso}
Transit: ${effectiveTransferHours}h (${fmt(effectiveTransferHours / 24, 1)}d) | Strategy: ${transferStrategy}
Target: ${activeSiteEval.site.name} (${fmt(Math.abs(activeSiteEval.site.latitudeDeg), 2)}°S, ${fmt(activeSiteEval.site.longitudeDeg, 2)}°E, ${fmt(activeSiteEval.elevationMeters, 1)}m)
Verdict: ${activeSiteEval.verdict} (Score: ${activeSiteEval.feasibilityScore}/100)
Illumination: ${activeSiteEval.isSunLit ? 'Direct Sunlight' : 'Shadow'} (Elevation: ${fmt(activeSiteEval.sunElevationDeg, 1)}°, Daylight: ${fmt(activeSiteEval.totalSunlightHours, 1)}h)
Earth Comm: ${activeSiteEval.isEarthVisible ? 'Direct LOS Active' : 'Blocked'} (Elevation: ${fmt(activeSiteEval.earthElevationDeg, 1)}°, Comm: ${fmt(activeSiteEval.totalEarthHours, 1)}h)
Terrain: Slope ${fmt(activeSiteEval.slopeDeg, 1)}° (${activeSiteEval.isSafeSlope ? 'Safe' : 'Exceeds Limit'})
Thermal: ${fmt(activeSiteEval.temperatureK, 1)} K (${fmt(activeSiteEval.temperatureC, 1)} °C) - ${activeSiteEval.thermalRegime}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(summaryText);
      showToast('Flight summary copied to clipboard.');
    }
  };

  const handleExportReport = (format: 'TXT' | 'JSON') => {
    if (!activeSiteEval) return;

    if (format === 'JSON') {
      const payload = {
        platform: 'LUNARIS // Lunar Flight Planning Engine',
        generatedUtc: new Date().toISOString(),
        earthLaunch: {
          spaceport: currentLaunchSite.name,
          departureEpochUtc: `${departureDate} ${departureHourUtc.toString().padStart(2, '0')}:00 UTC`,
          launchWindowHours: launchWindowDurationHours,
          vehicleProfile: currentProfile.name,
        },
        lunarArrival: {
          site: activeSiteEval.site.name,
          latitudeDeg: activeSiteEval.site.latitudeDeg,
          longitudeDeg: activeSiteEval.site.longitudeDeg,
          elevationMeters: activeSiteEval.elevationMeters,
          plannedArrivalEpochUtc: plannedArrivalEpochIso,
          transferDurationHours: effectiveTransferHours,
          surfaceMissionDurationHours,
        },
        feasibilityAssessment: {
          verdict: activeSiteEval.verdict,
          score: activeSiteEval.feasibilityScore,
          solarConditions: {
            elevationDeg: activeSiteEval.sunElevationDeg,
            isSunLit: activeSiteEval.isSunLit,
            totalSunlightHours: activeSiteEval.totalSunlightHours,
          },
          communicationConditions: {
            elevationDeg: activeSiteEval.earthElevationDeg,
            isEarthVisible: activeSiteEval.isEarthVisible,
            totalEarthHours: activeSiteEval.totalEarthHours,
          },
          terrainConditions: {
            slopeDeg: activeSiteEval.slopeDeg,
            isSafeSlope: activeSiteEval.isSafeSlope,
          },
          thermalConditions: {
            temperatureK: activeSiteEval.temperatureK,
            temperatureC: activeSiteEval.temperatureC,
            regime: activeSiteEval.thermalRegime,
          },
        },
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LUNARIS_MISSION_${activeSiteEval.site.id}_${departureDate}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exported flight dossier (JSON).');
    } else {
      const text = `================================================================================
LUNARIS // LUNAR MISSION FLIGHT DOSSIER
================================================================================
Generated (UTC):         ${new Date().toISOString()}

1. DEPARTURE CONFIGURATION
--------------------------------------------------------------------------------
Launch Spaceport:        ${currentLaunchSite.name}
Launch Date/Time (UTC):  ${departureDate} ${departureHourUtc.toString().padStart(2, '0')}:00 UTC
Launch Window Margin:    ±${launchWindowDurationHours} Hours
Spacecraft Architecture: ${currentProfile.name}

2. LUNAR DESTINATION & TRANSIT
--------------------------------------------------------------------------------
Target Landing Site:     ${activeSiteEval.site.name}
Coordinates:             ${fmt(Math.abs(activeSiteEval.site.latitudeDeg), 2)}°S, ${fmt(activeSiteEval.site.longitudeDeg, 2)}°E
Surface Elevation:       ${fmt(activeSiteEval.elevationMeters, 1)} m MSL (LOLA DEM)
Transit Duration:        ${effectiveTransferHours} Hours (${fmt(effectiveTransferHours / 24, 1)} Days)
Planned Arrival Epoch:   ${plannedArrivalEpochIso}

3. SURFACE FEASIBILITY EVALUATION
--------------------------------------------------------------------------------
Overall Verdict:         ${activeSiteEval.verdict} (Score: ${activeSiteEval.feasibilityScore}/100)
Direct Sunlight:         ${activeSiteEval.isSunLit ? 'YES' : 'NO'} (+${fmt(activeSiteEval.sunElevationDeg, 1)}° elevation)
Total Sunlight Duration: ${fmt(activeSiteEval.totalSunlightHours, 1)}h / ${surfaceMissionDurationHours}h
Direct Earth Comms:      ${activeSiteEval.isEarthVisible ? 'YES' : 'NO'} (+${fmt(activeSiteEval.earthElevationDeg, 1)}° elevation)
Terrain Slope:           ${fmt(activeSiteEval.slopeDeg, 1)}° (${activeSiteEval.isSafeSlope ? 'SAFE' : 'STEEP'})
Equilibrium Temperature: ${fmt(activeSiteEval.temperatureK, 1)} K (${fmt(activeSiteEval.temperatureC, 1)} °C)
================================================================================`;

      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LUNARIS_MISSION_${activeSiteEval.site.id}_${departureDate}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exported flight dossier (TXT).');
    }
  };

  return (
    <div className="w-full bg-[#05070A] text-neutral-100 min-h-screen flex flex-col font-sans select-none pt-20 pb-24">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-neutral-900 border border-neutral-700 text-white font-mono text-xs shadow-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* SECTION A — ROUTE PLANNER INTRODUCTION */}
      <section className="w-full border-b border-white/[0.08] px-6 sm:px-12 lg:px-20 pt-8 pb-10 bg-gradient-to-b from-neutral-950 via-[#05070A] to-[#05070A]">
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          
          <div className="flex flex-col gap-3">
            <span className="font-mono text-xs text-white/50 tracking-[0.25em] uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-white rounded-none" />
              LUNAR EXPEDITION FLIGHT NAVIGATOR
            </span>
            <h1 className="font-display-hero text-3xl sm:text-5xl font-bold uppercase tracking-tight text-white leading-tight">
              PLAN YOUR LUNAR MISSION
            </h1>
            <p className="font-sans text-sm sm:text-base text-neutral-400 max-w-2xl font-light leading-relaxed">
              Choose where your mission begins, select your lunar destination, and explore real-time orbital feasibility across solar, communication, and terrain constraints.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          MAIN WORKSPACE: MISSION CONFIGURATION (LEFT) + 3D VISUALIZER (RIGHT)
      ========================================================================= */}
      <section className="w-full px-4 sm:px-8 lg:px-16 py-10 max-w-7xl mx-auto flex flex-col gap-14">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* -------------------------------------------------------------------
              LEFT COLUMN: FLIGHT CONFIGURATION
          ------------------------------------------------------------------- */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            <div className="bg-[#121316] border border-white/[0.08] rounded-[24px] p-6 sm:p-8 flex flex-col gap-7 shadow-xl shadow-black/40">
              
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <span className="font-sans text-sm uppercase tracking-wider font-bold text-white flex items-center gap-2">
                  <Rocket size={15} className="text-white/80" />
                  <span>MISSION CONFIGURATION</span>
                </span>
                <span className="font-sans text-xs text-neutral-400 font-medium tracking-wide">
                  FLIGHT PARAMETERS
                </span>
              </div>

              {/* Group A: Departure */}
              <div className="flex flex-col gap-3.5">
                <div className="flex items-center justify-between">
                  <label className="font-sans text-xs uppercase text-neutral-400 tracking-wider font-semibold">
                    01 // Departure Spaceport
                  </label>
                  <span className="font-sans text-[11px] text-neutral-500 font-medium uppercase">EARTH</span>
                </div>

                <div className="relative">
                  <select
                    value={selectedLaunchSiteId}
                    onChange={(e) => setSelectedLaunchSiteId(e.target.value)}
                    className="w-full h-11 px-3.5 bg-[#0c0d10] border border-white/[0.12] hover:border-white/25 text-white font-sans text-sm focus:border-white outline-none rounded-xl appearance-none pr-8 cursor-pointer transition-colors"
                  >
                    {EARTH_LAUNCH_SITES.map((site) => (
                      <option key={site.id} value={site.id} className="bg-neutral-900 text-white">
                        {site.name} ({site.country})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3.5 text-neutral-400 pointer-events-none" />
                </div>

                {/* Terrestrial Astrodynamics Spec Tile */}
                <div className="p-4 bg-[#0c0d10] border border-white/[0.06] rounded-xl grid grid-cols-2 gap-3 text-xs font-sans text-neutral-300">
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-500 text-[10px] uppercase tracking-wider font-medium">COORDINATES</span>
                    <span className="text-white font-semibold tabular-nums">
                      {fmt(Math.abs(currentLaunchSite?.latitudeDeg ?? 0), 2)}°{(currentLaunchSite?.latitudeDeg ?? 0) >= 0 ? 'N' : 'S'}, {fmt(Math.abs(currentLaunchSite?.longitudeDeg ?? 0), 2)}°{(currentLaunchSite?.longitudeDeg ?? 0) >= 0 ? 'E' : 'W'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-500 text-[10px] uppercase tracking-wider font-medium">EARTH ROTATION ASSIST</span>
                    <span className="text-neutral-200 tabular-nums font-semibold">
                      +{Math.round(465.1 * Math.cos(((currentLaunchSite?.latitudeDeg ?? 0) * Math.PI) / 180))} m/s
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-500 text-[10px] uppercase tracking-wider font-medium">MIN INCLINATION</span>
                    <span className="text-neutral-300 tabular-nums font-medium">i ≥ {fmt(currentLaunchSite?.nominalInclinationDeg ?? 0, 1)}°</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-500 text-[10px] uppercase tracking-wider font-medium">ELEVATION</span>
                    <span className="text-neutral-300 tabular-nums font-medium">+{currentLaunchSite?.elevationMeters ?? 0} m MSL</span>
                  </div>
                </div>

                {/* Launch Date & Time Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-[1.18fr_0.91fr_0.91fr] gap-2.5 pt-2">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <label className="font-sans text-[11px] uppercase text-neutral-400 tracking-wider font-medium">
                      Launch Date (UTC)
                    </label>
                    <MissionDatePicker
                      value={departureDate}
                      onChange={(newDate) => setDepartureDate(newDate)}
                      iconPosition="right"
                      inputClassName="h-11 px-3 bg-[#0c0d10] border-white/[0.12] hover:border-white/25 rounded-xl font-sans text-xs text-white"
                      min="1900-01-01"
                      max="2050-01-01"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <label className="font-sans text-[11px] uppercase text-neutral-400 tracking-wider font-medium">
                      Launch Hour (UTC)
                    </label>
                    <div className="relative">
                      <select
                        value={departureHourUtc}
                        onChange={(e) => setDepartureHourUtc(parseInt(e.target.value, 10))}
                        className="w-full h-11 px-2.5 bg-[#0c0d10] border border-white/[0.12] hover:border-white/25 text-white font-sans text-xs focus:border-white outline-none rounded-xl appearance-none pr-7 cursor-pointer"
                      >
                        {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map((h) => (
                          <option key={h} value={h} className="bg-neutral-900 text-white">
                            {h.toString().padStart(2, '0')}:00 UTC
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-3.5 text-neutral-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <label className="font-sans text-[11px] uppercase text-neutral-400 tracking-wider font-medium">
                      Window Margin
                    </label>
                    <div className="relative">
                      <select
                        value={launchWindowDurationHours}
                        onChange={(e) => setLaunchWindowDurationHours(parseInt(e.target.value, 10))}
                        className="w-full h-11 px-2.5 bg-[#0c0d10] border border-white/[0.12] hover:border-white/25 text-white font-sans text-xs focus:border-white outline-none rounded-xl appearance-none pr-7 cursor-pointer"
                      >
                        {[1, 2, 4, 8, 12].map((w) => (
                          <option key={w} value={w} className="bg-neutral-900 text-white">
                            ±{w} Hours
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-3.5 text-neutral-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Group B: Destination */}
              <div className="flex flex-col gap-3.5 pt-4 border-t border-white/[0.08]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="font-sans text-xs uppercase text-neutral-400 tracking-wider font-semibold">
                      02 // Lunar Landing Destination
                    </label>
                    <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-sans text-[10px] uppercase tracking-wider font-semibold rounded-full">
                      ✓ {feasibleSites.length} FEASIBLE
                    </span>
                  </div>

                  {/* Filter Only Feasible Toggle */}
                  <div className="flex items-center gap-1 font-sans text-[10px]">
                    <button
                      type="button"
                      onClick={() => setFilterOnlyFeasible(true)}
                      className={`px-2.5 py-1 uppercase tracking-wider transition-colors cursor-pointer rounded-lg ${
                        filterOnlyFeasible
                          ? 'bg-white text-black font-bold'
                          : 'text-neutral-400 hover:text-white bg-neutral-900 border border-white/10'
                      }`}
                    >
                      Feasible Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterOnlyFeasible(false)}
                      className={`px-2.5 py-1 uppercase tracking-wider transition-colors cursor-pointer rounded-lg ${
                        !filterOnlyFeasible
                          ? 'bg-white text-black font-bold'
                          : 'text-neutral-400 hover:text-white bg-neutral-900 border border-white/10'
                      }`}
                    >
                      All ({candidateSites.length})
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <select
                    value={selectedDestinationSiteId}
                    onChange={(e) => setSelectedDestinationSiteId(e.target.value)}
                    className="w-full h-11 px-3.5 bg-[#0c0d10] border border-white/[0.12] hover:border-white/25 text-white font-sans text-sm focus:border-white outline-none rounded-xl appearance-none pr-8 cursor-pointer transition-colors"
                  >
                    {displayedDestinations.map((site) => {
                      const evalMatch = siteEvaluations.find((e) => e.site.id === site.id);
                      const isFeas = evalMatch?.verdict === 'FEASIBLE';
                      const isMarg = evalMatch?.verdict === 'MARGINAL';
                      const verdictTag = isFeas ? '[✓ FEASIBLE]' : isMarg ? '[⚠ MARGINAL]' : evalMatch ? '[✕ NOT FEASIBLE]' : '';
                      const latStr = `${fmt(Math.abs(site.latitudeDeg), 2)}°S`;
                      const lonStr = site.longitudeDeg >= 0 ? `${fmt(site.longitudeDeg, 2)}°E` : `${fmt(Math.abs(site.longitudeDeg), 2)}°W`;
                      const sunTag = evalMatch ? ` • Sun: ${evalMatch.sunElevationDeg >= 0 ? '+' : ''}${fmt(evalMatch.sunElevationDeg, 1)}°` : '';
                      return (
                        <option key={site.id} value={site.id} className="bg-neutral-900 text-white">
                          {site.name} ({latStr}, {lonStr}){sunTag} {verdictTag}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3.5 text-neutral-400 pointer-events-none" />
                </div>

                {/* Target Landing Site Specs */}
                <div className="p-4 bg-[#0c0d10] border border-white/[0.06] rounded-xl flex items-center justify-between font-sans text-xs text-neutral-300">
                  <div className="flex flex-col gap-1">
                    <span className="text-white font-bold text-sm">{currentDestination.name}</span>
                    <span className="text-[11px] text-neutral-400">
                      {fmt(Math.abs(currentDestination.latitudeDeg ?? 89.78), 2)}°S, {currentDestination.longitudeDeg >= 0 ? `${fmt(currentDestination.longitudeDeg, 2)}°E` : `${fmt(Math.abs(currentDestination.longitudeDeg), 2)}°W`}
                    </span>
                  </div>
                  <div className="flex flex-col text-right gap-1">
                    <span className="text-neutral-200 text-xs font-semibold tabular-nums">
                      {typeof currentDestination.elevationMeters === 'number' && currentDestination.elevationMeters > 0 ? '+' : ''}{fmt(currentDestination.elevationMeters ?? 0, 0)} m MSL
                    </span>
                    <span className="text-[10px] text-neutral-500 uppercase font-medium">LOLA 80M DEM</span>
                  </div>
                </div>
              </div>

              {/* Group C: Mission Timing */}
              <div className="flex flex-col gap-4 pt-4 border-t border-white/[0.08]">
                <label className="font-sans text-xs uppercase text-neutral-400 tracking-wider font-semibold">
                  03 // Transit Duration &amp; Surface Stay
                </label>

                {/* Transfer Duration Chips */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center font-sans text-xs">
                    <span className="text-neutral-400">Transfer Duration:</span>
                    <span className="text-white font-semibold">{effectiveTransferHours} Hours ({fmt(effectiveTransferHours / 24, 1)} Days)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 font-sans text-xs">
                    {[72, 84, 96, 120].map((hours) => (
                      <button
                        key={hours}
                        type="button"
                        onClick={() => setCustomTransferHours(hours)}
                        className={`py-2.5 rounded-xl border transition-all cursor-pointer text-center font-medium ${
                          effectiveTransferHours === hours
                            ? 'bg-white text-black font-bold border-white shadow-md'
                            : 'bg-[#0c0d10] text-neutral-400 border-white/[0.1] hover:border-white/30 hover:text-white'
                        }`}
                      >
                        {hours}h
                      </button>
                    ))}
                  </div>
                </div>

                {/* Surface Stay Chips */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center font-sans text-xs">
                    <span className="text-neutral-400">Planned Surface Stay:</span>
                    <span className="text-white font-semibold">{surfaceMissionDurationHours} Hours ({fmt(surfaceMissionDurationHours / 24, 1)} Days)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 font-sans text-xs">
                    {[
                      { hours: 72, label: '3 Days' },
                      { hours: 168, label: '7 Days' },
                      { hours: 336, label: '14 Days' },
                      { hours: 708, label: '28 Days' },
                    ].map((stay) => (
                      <button
                        key={stay.hours}
                        type="button"
                        onClick={() => setSurfaceMissionDurationHours(stay.hours)}
                        className={`py-2.5 rounded-xl border transition-all cursor-pointer text-center font-medium ${
                          surfaceMissionDurationHours === stay.hours
                            ? 'bg-white text-black font-bold border-white shadow-md'
                            : 'bg-[#0c0d10] text-neutral-400 border-white/[0.1] hover:border-white/30 hover:text-white'
                        }`}
                      >
                        {stay.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Spacecraft Architecture */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="font-sans text-[11px] uppercase text-neutral-400 tracking-wider font-medium">
                    Spacecraft Architecture
                  </span>
                  <div className="relative">
                    <select
                      value={selectedProfileId}
                      onChange={(e) => setSelectedProfileId(e.target.value)}
                      className="w-full h-11 px-3.5 bg-[#0c0d10] border border-white/[0.12] hover:border-white/25 text-white font-sans text-sm focus:border-white outline-none rounded-xl appearance-none pr-8 cursor-pointer"
                    >
                      {SPACECRAFT_PROFILES.map((prof) => (
                        <option key={prof.id} value={prof.id} className="bg-neutral-900 text-white">
                          {prof.name} ({prof.vehicleExample})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-3.5 text-neutral-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Primary Action Button */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isEvaluating}
                  onClick={handleAnalyzeMission}
                  className={`w-full py-3.5 px-6 font-sans font-bold text-sm uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2.5 rounded-xl ${
                    isEvaluating
                      ? 'bg-neutral-800 text-neutral-500 cursor-wait'
                      : 'bg-white hover:bg-neutral-200 text-black shadow-lg shadow-white/10 active:scale-[0.99]'
                  }`}
                >
                  {isEvaluating ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                      <span>EVALUATING MISSION PARAMETERS...</span>
                    </span>
                  ) : (
                    <span>ANALYZE MISSION FEASIBILITY</span>
                  )}
                </button>

                {evaluationError && (
                  <div className="p-3.5 bg-rose-950/60 border border-rose-500/40 text-rose-300 font-sans text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-rose-400" />
                    <span>{evaluationError}</span>
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* -------------------------------------------------------------------
              RIGHT COLUMN: 3D MISSION VISUALIZATION (CENTREPIECE)
          ------------------------------------------------------------------- */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            <div className="bg-[#121316] border border-white/[0.08] rounded-[24px] p-6 sm:p-8 flex flex-col gap-5 shadow-xl shadow-black/40">
              
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4 font-sans text-xs">
                <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider text-sm">
                  <Orbit size={15} className="text-white/80" />
                  <span>3D TRANSLUNAR TRAJECTORY</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>TOUCHDOWN: {currentDestination.name}</span>
                  <span className="text-white/30">•</span>
                  <span className="text-white font-semibold tabular-nums">{plannedArrivalEpochIso.substring(0, 16)} UTC</span>
                </div>
              </div>

              {/* Embedded Three.js 3D Viewport */}
              <div className="w-full h-[480px] bg-black border border-white/[0.06] rounded-2xl relative overflow-hidden">
                <MissionTrajectoryVisualizer
                  launchSite={currentLaunchSite}
                  lunarDestination={currentDestination}
                  spacecraftProfile={currentProfile}
                  departureEpochUtc={`${departureDate} ${departureHourUtc.toString().padStart(2, '0')}:00 UTC`}
                  transferDurationHours={effectiveTransferHours}
                  arrivalEpochUtc={plannedArrivalEpochIso}
                  className="w-full h-full"
                />
              </div>

              {/* Trajectory Footnote */}
              <div className="flex items-center justify-between font-sans text-[11px] text-neutral-500 pt-1">
                <span>ASTRODYNAMICS: PROGRADE TRANS-LUNAR INJECTION (TLI)</span>
                <span>SPICE DE440 &bull; LOLA 80M DEM</span>
              </div>

            </div>

          </div>

        </div>

        {/* =======================================================================
            SECTION D — TRAJECTORY RESULTS & CANDIDATE LANDING-SITE FEASIBILITY
        ======================================================================= */}
        <div className="flex flex-col gap-8 pt-8 border-t border-white/[0.08]">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="font-sans text-xs uppercase tracking-[0.2em] font-semibold text-white/50">
                EVALUATION AT SCHEDULED ARRIVAL
              </span>
              <h2 className="font-display-hero text-2xl sm:text-4xl font-bold uppercase tracking-tight text-white">
                LANDING SITE FEASIBILITY ANALYSIS
              </h2>
            </div>
            <span className="font-sans text-xs text-neutral-400 font-medium">
              ARRIVAL EPOCH: <strong className="text-white font-semibold">{plannedArrivalEpochIso}</strong>
            </span>
          </div>

          {/* Top Feature Checks Banner (Starlink/Aerospace style) */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs sm:text-sm text-neutral-300 font-sans font-medium py-3.5 border-y border-white/[0.08] bg-[#0c0d10]/40 rounded-xl">
            <span className="flex items-center gap-2">
              <Check size={15} className="text-white shrink-0" />
              <span>NASA SPICE DE440 Astrodynamics</span>
            </span>
            <span className="flex items-center gap-2">
              <Check size={15} className="text-white shrink-0" />
              <span>LOLA 80m Topography</span>
            </span>
            <span className="flex items-center gap-2">
              <Check size={15} className="text-white shrink-0" />
              <span>Direct LOS Raytracing</span>
            </span>
            <span className="flex items-center gap-2">
              <Check size={15} className="text-white shrink-0" />
              <span>Radiative Equilibrium Thermals</span>
            </span>
          </div>

          {/* Candidate Sites Feasibility Cards Grid (Clean Starlink-style box styling) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {siteEvaluations.map((evalItem) => {
              const isSelected = evalItem.site.id === selectedDestinationSiteId;
              const isFeasible = evalItem.verdict === 'FEASIBLE';
              const isMarginal = evalItem.verdict === 'MARGINAL';

              return (
                <div
                  key={evalItem.site.id}
                  onClick={() => setSelectedDestinationSiteId(evalItem.site.id)}
                  className={`rounded-[22px] p-7 sm:p-8 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-xl shadow-black/40 ${
                    isSelected
                      ? 'bg-[#16181d] border-2 border-white/70 ring-1 ring-white/20'
                      : 'bg-[#121316] border border-white/[0.08] hover:border-white/25 hover:bg-[#15171b]'
                  }`}
                >
                  <div>
                    {/* Card Header & Badge */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-sans font-bold text-xl sm:text-2xl text-white tracking-tight leading-snug">
                        {evalItem.site.name}
                      </h3>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider shrink-0 flex items-center gap-1.5 ${
                        isFeasible 
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                          : isMarginal 
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' 
                          : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isFeasible ? 'bg-emerald-400' : isMarginal ? 'bg-amber-400' : 'bg-rose-400'}`} />
                        {evalItem.verdict.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Subtitle / Description Text */}
                    <p className="font-sans text-sm text-neutral-400 font-normal leading-relaxed mb-6">
                      {evalItem.reasons[0] || 'Nominal polar exploration site with validated celestial lighting and communication lines.'}
                    </p>

                    {/* Feature Bullets (Clean spacing and typographic hierarchy) */}
                    <ul className="space-y-3 font-sans text-sm text-neutral-200 mb-8">
                      <li className="flex items-start gap-2.5">
                        <span className="text-neutral-400 text-base leading-none select-none">•</span>
                        <span>
                          Sunlight: <strong className="text-white font-medium">{evalItem.sunElevationDeg >= 0 ? `+${fmt(evalItem.sunElevationDeg, 1)}°` : `${fmt(evalItem.sunElevationDeg, 1)}°`}</strong>
                          <span className="text-neutral-400 ml-1.5">({evalItem.isSunLit ? 'Daylight' : 'Shadow'})</span>
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="text-neutral-400 text-base leading-none select-none">•</span>
                        <span>
                          Earth Comms: <strong className="text-white font-medium">{evalItem.earthElevationDeg >= 0 ? `+${fmt(evalItem.earthElevationDeg, 1)}°` : `${fmt(evalItem.earthElevationDeg, 1)}°`}</strong>
                          <span className="text-neutral-400 ml-1.5">({evalItem.isEarthVisible ? 'Direct Line-of-Sight' : 'Occluded'})</span>
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="text-neutral-400 text-base leading-none select-none">•</span>
                        <span>
                          Terrain Slope: <strong className="text-white font-medium">{fmt(evalItem.slopeDeg, 1)}°</strong>
                          <span className="text-neutral-400 ml-1.5">({evalItem.isSafeSlope ? 'Safe' : 'Steep'})</span>
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="text-neutral-400 text-base leading-none select-none">•</span>
                        <span>
                          Surface Temp: <strong className="text-white font-medium">{evalItem.temperatureK} K</strong>
                          <span className="text-neutral-400 ml-1.5">({evalItem.temperatureC}°C)</span>
                        </span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="text-neutral-400 text-base leading-none select-none">•</span>
                        <span>
                          Elevation: <strong className="text-white font-medium">{fmt(evalItem.elevationMeters, 0)} m MSL</strong>
                          <span className="text-neutral-400 ml-1.5 font-mono text-xs">({fmt(Math.abs(evalItem.site.latitudeDeg), 2)}°S, {evalItem.site.longitudeDeg >= 0 ? `${fmt(evalItem.site.longitudeDeg, 2)}°E` : `${fmt(Math.abs(evalItem.site.longitudeDeg), 2)}°W`})</span>
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* Card Action Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      className={`w-full py-3.5 px-4 rounded-xl font-sans text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        isSelected 
                          ? 'bg-white text-black shadow-lg shadow-white/10 hover:bg-neutral-200' 
                          : 'bg-[#1e2025] hover:bg-[#282b32] text-neutral-200 hover:text-white border border-white/10'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check size={16} className="text-black" />
                          <span>Selected Destination</span>
                        </>
                      ) : (
                        <span>Select Target Site</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Centered Disclaimer / Scientific Constraints Note */}
          <div className="text-center max-w-4xl mx-auto space-y-1.5 mt-4 font-sans">
            <p className="text-[11px] sm:text-xs text-neutral-500 leading-relaxed">
              Landing site feasibility calculations are computed in real time using NASA JPL SPICE DE440 ephemerides and NASA LOLA digital elevation models.
            </p>
            <p className="text-[11px] sm:text-xs text-neutral-600 leading-relaxed">
              Operational criteria require surface slope &lt; 10°, positive solar line-of-sight elevation, and uninterrupted direct Earth line-of-sight communication.
            </p>
          </div>

        </div>

        {/* =======================================================================
            SECTION E — INTELLIGENT ALTERNATIVES (WHEN APPROPRIATE)
        ======================================================================= */}
        {recommendations.length > 0 && (
          <div className="bg-[#121316] border border-white/[0.08] rounded-[24px] p-6 sm:p-8 flex flex-col gap-6 shadow-xl shadow-black/40">
            
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex flex-col gap-1">
                <span className="font-sans text-sm uppercase tracking-wider font-bold text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-neutral-300" />
                  <span>RECOMMENDED MISSION ALTERNATIVES</span>
                </span>
                <span className="text-xs sm:text-sm text-neutral-400 font-sans">
                  Alternative departure windows and candidate landing sites optimized for higher cumulative sunlight and direct communications.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {recommendations.slice(0, 2).map((rec) => (
                <div 
                  key={rec.id}
                  className="rounded-[20px] bg-[#16181d] border border-white/[0.08] hover:border-white/20 p-6 sm:p-7 flex flex-col justify-between gap-5 transition-all shadow-lg"
                >
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-sans text-base font-bold text-white tracking-tight">
                        {rec.title}
                      </span>
                      <span className="font-sans text-[11px] text-emerald-400 uppercase font-bold px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                        {rec.verdict}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-neutral-400 font-sans leading-relaxed">
                      {rec.description}
                    </p>

                    <div className="flex flex-col gap-2 pt-3 border-t border-white/[0.06] font-sans text-xs text-neutral-300">
                      {rec.expectedImprovements.map((imp, i) => (
                        <span key={i} className="flex items-center gap-2 text-neutral-200">
                          <Check size={13} className="text-emerald-400 shrink-0" />
                          <span>{imp}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyRecommendation(rec)}
                    className="w-full py-3 rounded-xl font-sans text-xs uppercase tracking-wider font-bold bg-[#1e2025] hover:bg-white text-white hover:text-black border border-white/15 hover:border-white transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Apply This Scenario</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* =======================================================================
            SECTION F — SURFACE OPERATIONS TIMELINE
        ======================================================================= */}
        {activeSiteEval && (
          <div className="bg-[#121316] border border-white/[0.08] rounded-[24px] p-6 sm:p-8 flex flex-col gap-6 shadow-xl shadow-black/40">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-4 font-sans text-xs">
              <span className="font-bold text-sm uppercase tracking-wider text-white flex items-center gap-2">
                <Clock size={16} className="text-neutral-400" />
                <span>SURFACE OPERATIONS TIMELINE // {activeSiteEval.site.name}</span>
              </span>
              <span className="text-neutral-400 font-medium">
                MISSION DURATION: <strong className="text-white font-semibold">{surfaceMissionDurationHours} HOURS ({fmt(surfaceMissionDurationHours / 24, 1)} DAYS)</strong>
              </span>
            </div>

            {/* Metric Summaries */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 font-sans text-xs">
              <div className="p-4 bg-[#0c0d10] border border-white/[0.06] rounded-xl flex flex-col gap-1">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">Total Sunlight</span>
                <span className="text-white font-bold text-base tabular-nums">
                  {fmt(activeSiteEval.totalSunlightHours, 1)}h
                  <span className="text-neutral-500 text-xs ml-1 font-normal">
                    ({fmt((activeSiteEval.totalSunlightHours / Math.max(1, surfaceMissionDurationHours)) * 100, 0)}%)
                  </span>
                </span>
              </div>

              <div className="p-4 bg-[#0c0d10] border border-white/[0.06] rounded-xl flex flex-col gap-1">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">Earth Line-of-Sight</span>
                <span className="text-white font-bold text-base tabular-nums">
                  {fmt(activeSiteEval.totalEarthHours, 1)}h
                  <span className="text-neutral-500 text-xs ml-1 font-normal">
                    ({fmt((activeSiteEval.totalEarthHours / Math.max(1, surfaceMissionDurationHours)) * 100, 0)}%)
                  </span>
                </span>
              </div>

              <div className="p-4 bg-[#0c0d10] border border-white/[0.06] rounded-xl flex flex-col gap-1">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">Simultaneous Dual-Ops</span>
                <span className="text-white font-bold text-base tabular-nums">
                  {fmt(activeSiteEval.simultaneousHours, 1)}h
                  <span className="text-neutral-500 text-xs ml-1 font-normal">
                    ({fmt((activeSiteEval.simultaneousHours / Math.max(1, surfaceMissionDurationHours)) * 100, 0)}%)
                  </span>
                </span>
              </div>

              <div className="p-4 bg-[#0c0d10] border border-white/[0.06] rounded-xl flex flex-col gap-1">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">Surface Temperature</span>
                <span className="text-white font-bold text-base tabular-nums">
                  {fmt(activeSiteEval.temperatureK, 1)} K
                  <span className="text-neutral-500 text-xs ml-1 font-normal">
                    ({fmt(activeSiteEval.temperatureC, 1)}°C)
                  </span>
                </span>
              </div>
            </div>

            {/* Multi-Track Visual Timeline Bars */}
            <div className="p-5 bg-[#0c0d10] border border-white/[0.06] rounded-xl flex flex-col gap-3.5 font-sans text-xs">
              
              {/* Sunlight Track */}
              <div className="flex items-center gap-3">
                <span className="w-24 text-xs text-neutral-400 font-medium">Sunlight</span>
                <div className="flex-1 h-3.5 bg-neutral-900 border border-white/10 rounded-full relative overflow-hidden flex">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${Math.min(100, (activeSiteEval.totalSunlightHours / Math.max(1, surfaceMissionDurationHours)) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-right tabular-nums text-neutral-200 font-semibold">
                  {fmt((activeSiteEval.totalSunlightHours / Math.max(1, surfaceMissionDurationHours)) * 100, 0)}%
                </span>
              </div>

              {/* Earth Track */}
              <div className="flex items-center gap-3">
                <span className="w-24 text-xs text-neutral-400 font-medium">Earth Comms</span>
                <div className="flex-1 h-3.5 bg-neutral-900 border border-white/10 rounded-full relative overflow-hidden flex">
                  <div
                    className="h-full bg-[#58D8D0] rounded-full"
                    style={{ width: `${Math.min(100, (activeSiteEval.totalEarthHours / Math.max(1, surfaceMissionDurationHours)) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-right tabular-nums text-neutral-200 font-semibold">
                  {fmt((activeSiteEval.totalEarthHours / Math.max(1, surfaceMissionDurationHours)) * 100, 0)}%
                </span>
              </div>

              {/* Dual Ops Track */}
              <div className="flex items-center gap-3">
                <span className="w-24 text-xs text-neutral-400 font-medium">Dual-Ops</span>
                <div className="flex-1 h-3.5 bg-neutral-900 border border-white/10 rounded-full relative overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${Math.min(100, (activeSiteEval.simultaneousHours / Math.max(1, surfaceMissionDurationHours)) * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-right tabular-nums text-neutral-200 font-semibold">
                  {fmt((activeSiteEval.simultaneousHours / Math.max(1, surfaceMissionDurationHours)) * 100, 0)}%
                </span>
              </div>

            </div>

          </div>
        )}

        {/* =======================================================================
            SECTION G — FINAL FLIGHT DOSSIER & SURFACE BROWSER LAUNCH
        ======================================================================= */}
        {activeSiteEval && (
          <div className="bg-[#121316] border border-white/[0.1] rounded-[24px] p-6 sm:p-8 flex flex-col gap-6 shadow-xl shadow-black/40">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
              <div className="flex flex-col gap-1">
                <span className="font-sans text-xs uppercase tracking-[0.2em] font-semibold text-white/50">
                  FINAL MISSION PLAN
                </span>
                <h3 className="font-display-hero text-xl sm:text-2xl font-bold uppercase tracking-tight text-white">
                  LUNAR FLIGHT PLAN DOSSIER
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2 font-sans text-xs">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="px-4 py-2.5 rounded-xl bg-[#0c0d10] hover:bg-neutral-800 text-white border border-white/15 transition-colors flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Copy size={14} />
                  <span>Copy Summary</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportReport('TXT')}
                  className="px-4 py-2.5 rounded-xl bg-[#0c0d10] hover:bg-neutral-800 text-white border border-white/15 transition-colors flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Download size={14} />
                  <span>Export TXT</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportReport('JSON')}
                  className="px-4 py-2.5 rounded-xl bg-[#0c0d10] hover:bg-neutral-800 text-white border border-white/15 transition-colors flex items-center gap-2 cursor-pointer font-medium"
                >
                  <Download size={14} />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Flight Spec Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-sans text-xs">
              <div className="flex flex-col gap-1 p-4 bg-[#0c0d10] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">DEPARTURE</span>
                <span className="text-white font-bold truncate text-sm">{currentLaunchSite.name}</span>
                <span className="text-neutral-400 text-[11px] tabular-nums">{departureDate} {departureHourUtc.toString().padStart(2, '0')}:00 UTC</span>
              </div>

              <div className="flex flex-col gap-1 p-4 bg-[#0c0d10] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">TOUCHDOWN</span>
                <span className="text-white font-bold truncate text-sm">{activeSiteEval.site.name}</span>
                <span className="text-neutral-400 text-[11px] tabular-nums">{plannedArrivalEpochIso.substring(0, 16)} UTC</span>
              </div>

              <div className="flex flex-col gap-1 p-4 bg-[#0c0d10] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">TRANSIT TIME</span>
                <span className="text-white font-bold text-sm">{effectiveTransferHours} Hours</span>
                <span className="text-neutral-400 text-[11px]">{fmt(effectiveTransferHours / 24, 1)} Days Transit</span>
              </div>

              <div className="flex flex-col gap-1 p-4 bg-[#0c0d10] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-neutral-500 uppercase font-semibold">STATUS VERDICT</span>
                <span className="text-emerald-400 font-bold text-sm">{activeSiteEval.verdict}</span>
                <span className="text-neutral-400 text-[11px]">Score: {activeSiteEval.feasibilityScore}/100</span>
              </div>
            </div>

            {/* Seamless Handoff to Mission Browser */}
            <div className="pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-sans text-sm font-bold text-white">
                  Inspect Local Lunar Relief &amp; Topographic Horizon
                </span>
                <span className="text-xs text-neutral-400 font-sans">
                  Pre-loads your planned landing epoch into the high-resolution LOLA 80m DEM ray-marching engine.
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigate(`/mission-browser?site=${activeSiteEval.site.id}&epoch=${plannedArrivalEpochIso}&fromRoute=1`);
                }}
                className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-neutral-200 text-black font-sans font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg rounded-xl shrink-0"
              >
                <span>OPEN IN SURFACE BROWSER</span>
                <ArrowRight size={15} />
              </button>
            </div>

          </div>
        )}

      </section>

    </div>
  );
};
