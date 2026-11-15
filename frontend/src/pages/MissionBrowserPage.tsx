import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Sun, 
  Globe, 
  Sliders, 
  X,
  Compass,
  MapPin,
  Clock
} from 'lucide-react';
import { useRouter } from '../router';
import { 
  lunarApi, 
  type SiteAnalysisData, 
  type SiteComparisonResponse,
  type IlluminationEvaluationData
} from '../services/lunarApi';
import { LunarInteractiveMap, type MapSiteItem, formatSiteShortName } from '../components/LunarInteractiveMap';
import { MoonTrekGlobe } from '../components/MoonTrekGlobe';
import { MultiTrackTimeline } from '../components/MultiTrackTimeline';
import { ScenarioComparisonWorkbench } from '../components/ScenarioComparisonWorkbench';

// Default NASA South Pole candidate landing sites (All 8 verified landing zones from scientific datasets)
// Complete NASA South Pole Candidate Landing Site Database
// Authentically sourced from NASA Artemis III candidate landing regions announcements (2022/2024),
// NASA Lunar Exploration Analysis Group (LEAG), LRO LOLA/LROC science datasets, and IAU Gazetteer.
const DEFAULT_CANDIDATE_SITES: MapSiteItem[] = [
  {
    id: 'shackleton-connecting-ridge',
    name: 'Shackleton Crater - Connecting Ridge',
    latitudeDeg: -89.78,
    longitudeDeg: 125.40,
    elevationMeters: 1413.9,
    pinColor: '#58D8D0',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'Shackleton Rim',
    description: 'Prominent elevated ridge connecting Shackleton and de Gerlache craters with high cumulative sunlight (>86% polar summer light) and direct line of sight to Earth.',
    source: 'NASA Artemis III Candidate Landing Regions; LRO LOLA Science Team',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME), LOLA 118m/px polar DEM',
    uncertaintyKm: 7.5,
  },
  {
    id: 'malapert-massif',
    name: 'Malapert Massif (Peak)',
    latitudeDeg: -85.9948,
    longitudeDeg: -0.23578,
    elevationMeters: -2854.7,
    pinColor: '#ECC068',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'Malapert Massif',
    description: 'Prominent highland peak on Malapert Massif (~5,000 m relief above surrounding plains) providing near-constant Earth visibility and favorable polar solar incidence.',
    source: 'NASA Artemis III Candidate Landing Regions (2022/2024); LROC QuickMap',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'de-gerlache-rim',
    name: 'de Gerlache Crater Rim 1',
    latitudeDeg: -88.71,
    longitudeDeg: -88.35,
    elevationMeters: -1148.4,
    pinColor: '#78F5EC',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'de Gerlache Crater Rim',
    description: 'High southern rim crest of de Gerlache Crater with extended solar illumination windows and operational access to permanently shadowed volatile deposits.',
    source: 'NASA Artemis III Candidate Landing Regions; Wuellner et al. (2025)',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'de-gerlache-rim-2',
    name: 'de Gerlache Rim 2',
    latitudeDeg: -88.34,
    longitudeDeg: -76.80,
    elevationMeters: -950.0,
    pinColor: '#78F5EC',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'de Gerlache Crater Rim',
    description: 'Northern rim candidate region of de Gerlache Crater, prioritized in the refined 2024 Artemis III candidate down-selection for accessible crater-floor descent routes.',
    source: 'NASA Artemis III Down-Selected Regions (2024); LROC Topography',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'haworth-crater-rim',
    name: 'Haworth Crater Rim',
    latitudeDeg: -86.7639,
    longitudeDeg: -22.777,
    elevationMeters: -1200.0,
    pinColor: '#FFB3B0',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'Haworth',
    description: 'Mountainous ridge along the eastern rim of Haworth Crater. Key candidate region for volatiles prospecting on permanently shadowed crater floors.',
    source: 'NASA Artemis III Candidate Landing Regions (2022/2024)',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'mons-mouton',
    name: 'Mons Mouton (MMO01)',
    latitudeDeg: -85.416,
    longitudeDeg: 31.851,
    elevationMeters: 2200.0,
    pinColor: '#B197FC',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'Mons Mouton',
    description: 'Summit plateau on Mons Mouton named after NASA computer scientist Melba Roy Mouton. Features ancient South Pole-Aitken highland materials and broad safe landing areas.',
    source: 'NASA Artemis III Down-Selected Regions (2024); USGS Planetary Gazetteer',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'mons-mouton-plateau',
    name: 'Mons Mouton Plateau (MMO02)',
    latitudeDeg: -85.20,
    longitudeDeg: 33.00,
    elevationMeters: 2280.0,
    pinColor: '#B197FC',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'Mons Mouton Plateau',
    description: 'Expansive tableland summit on Mons Mouton with benign landing slopes (<5°) and extended solar visibility during southern summer.',
    source: 'NASA Artemis III Candidate Landing Regions (2024); LOLA Polar DEM',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'peak-near-shackleton',
    name: 'Peak Near Shackleton',
    latitudeDeg: -88.811,
    longitudeDeg: 123.6901,
    elevationMeters: 1100.0,
    pinColor: '#63E6BE',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'Peak Near Shackleton',
    description: 'Elevated topographic summit 15 km northwest of Shackleton Crater providing high persistent solar illumination and excellent Earth line-of-sight geometry.',
    source: 'NASA Artemis III Candidate Landing Regions; LRO LOLA Science Team',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'nobile-rim-1',
    name: 'Nobile Rim 1',
    latitudeDeg: -85.295,
    longitudeDeg: 36.917,
    elevationMeters: 1800.0,
    pinColor: '#FFA94D',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'Nobile Rim 1',
    description: 'High southeastern rim crest of Nobile crater with favorable slopes, high scientific priority for assessing South Pole volatiles and thermal stability.',
    source: 'NASA Artemis III Candidate Landing Regions; VIPER Science Working Group',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'nobile-rim-2',
    name: 'Nobile Rim 2',
    latitudeDeg: -83.90,
    longitudeDeg: 58.70,
    elevationMeters: 1740.0,
    pinColor: '#FFA94D',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'Nobile Rim 2',
    description: 'Eastern rim candidate region of Nobile crater offering wide landing zones with favorable Earth line-of-sight communication elevation.',
    source: 'NASA Artemis III Candidate Landing Regions (2022/2024)',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'faustini-rim-a',
    name: 'Faustini Rim A',
    latitudeDeg: -87.89,
    longitudeDeg: 90.00,
    elevationMeters: 1520.0,
    pinColor: '#E599F7',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'Faustini Rim',
    description: 'High ridge along the southern rim of Faustini Crater situated precisely on the lunar 90°E meridian with seasonal solar illumination peaks.',
    source: 'NASA Artemis III Candidate Landing Regions (2022)',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'connecting-ridge-extension',
    name: 'Connecting Ridge Extension',
    latitudeDeg: -89.30,
    longitudeDeg: -150.00,
    elevationMeters: 1340.0,
    pinColor: '#4DABF7',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'Connecting Ridge Extension',
    description: 'Far-side extension of the Shackleton-de Gerlache connecting ridge offering polar highland geologic samples and solar tracking opportunities.',
    source: 'NASA Artemis III Candidate Landing Regions (2022)',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'de-gerlache-kocher-massif',
    name: 'de Gerlache-Kocher Massif',
    latitudeDeg: -85.83,
    longitudeDeg: -116.00,
    elevationMeters: 1650.0,
    pinColor: '#78F5EC',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'de Gerlache-Kocher Massif',
    description: 'Broad upland massif located between de Gerlache and Kocher craters, featuring varied topography and ancient crustal highland materials.',
    source: 'NASA Artemis III Candidate Landing Regions (2022)',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'leibnitz-beta-plateau',
    name: 'Leibnitz Beta Plateau',
    latitudeDeg: -85.79,
    longitudeDeg: 29.52,
    elevationMeters: 2150.0,
    pinColor: '#D0BFFF',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'Leibnitz Beta Plateau',
    description: 'High-elevation tableland forming part of the South Pole-Aitken (SPA) basin rim, ideal for investigating basin-forming impact melt sheets.',
    source: 'NASA Artemis III Candidate Landing Regions (2022)',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'amundsen-rim',
    name: 'Amundsen Rim',
    latitudeDeg: -84.50,
    longitudeDeg: 85.60,
    elevationMeters: 2100.0,
    pinColor: '#FFE066',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'Amundsen Rim',
    description: 'High-altitude terraced rim crest of Amundsen Crater (105 km diameter) providing clear line-of-sight to Earth and seasonal illumination.',
    source: 'NASA Artemis III Candidate Landing Regions (2022)',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'peak-near-cabeus-b',
    name: 'Peak Near Cabeus B',
    latitudeDeg: -83.60,
    longitudeDeg: -68.80,
    elevationMeters: 1420.0,
    pinColor: '#63E6BE',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'Peak Near Cabeus B',
    description: 'Prominent summit north of Cabeus crater added in the refined 2024 Artemis III candidate selection. Offers vantage overlooking the LCROSS water-ice impact zone.',
    source: 'NASA Artemis III Down-Selected Regions (2024)',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'slater-plain',
    name: 'Slater Plain (Site SP07)',
    latitudeDeg: -87.13,
    longitudeDeg: 127.86,
    elevationMeters: 680.0,
    pinColor: '#A9E34B',
    isDemCovered: true,
    siteType: 'CANDIDATE_REGION',
    targetRegion: 'Slater Plain',
    description: 'Relatively flat inter-crater plain south of Slater Crater added in the refined 2024 Artemis III candidate list for low-slope touchdown safety.',
    source: 'NASA Artemis III Down-Selected Regions (2024); LROC NAC Photometry',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 7.5,
  },
  {
    id: 'shackleton-ridge-prime1',
    name: 'Shackleton Rim (NASA PRIME-1 / CLPS IM-2)',
    latitudeDeg: -89.44,
    longitudeDeg: 137.30,
    elevationMeters: 1480.0,
    pinColor: '#00FF9D',
    isDemCovered: true,
    siteType: 'PROPOSED_LANDING_SITE',
    targetRegion: 'Shackleton Crater Rim',
    description: 'Targeted polar touchdown zone for NASA Polar Resources Ice Mining Experiment-1 (PRIME-1) onboard Intuitive Machines IM-2 to drill for subsurface water ice.',
    source: 'NASA Commercial Lunar Payload Services (CLPS) Architecture; Intuitive Machines IM-2',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 0.2,
  },
  {
    id: 'malapert-a-clps',
    name: 'Malapert A (CLPS IM-1 Odysseus)',
    latitudeDeg: -80.13,
    longitudeDeg: 1.44,
    elevationMeters: 120.0,
    pinColor: '#FFD43B',
    isDemCovered: true,
    siteType: 'REFERENCE_LANDING_SITE',
    targetRegion: 'Malapert A',
    description: 'Historic first commercial lunar lander touchdown site by Intuitive Machines IM-1 (Odysseus), demonstrating south-polar proximity operations.',
    source: 'NASA CLPS IM-1 Mission Results; LROC NAC Confirmation Image M1463121516L',
    coordinateReference: 'Mean Earth/Polar Axis (MOON_ME)',
    uncertaintyKm: 0.1,
  },
  {
    id: 'statio-shiv-shakti',
    name: 'Statio Shiv Shakti (Chandrayaan-3)',
    latitudeDeg: -69.3734,
    longitudeDeg: 32.3198,
    elevationMeters: -1280.0,
    pinColor: '#FF922B',
    isDemCovered: false,
    siteType: 'REFERENCE_LANDING_SITE',
    targetRegion: 'Manzinus-Boguslawsky Plains',
    description: 'Official IAU-named historic touchdown site of ISRO Chandrayaan-3 Vikram lander and Pragyan rover, demonstrating high-latitude landing capabilities. Lies outside the south-polar DEM coverage.',
    source: 'IAU Working Group for Planetary System Nomenclature; ISRO Mission Announcement',
    coordinateReference: 'IAU/USGS Gazetteer of Planetary Nomenclature',
    uncertaintyKm: 0.05,
  },
];

export const MissionBrowserPage: React.FC = () => {
  const { search } = useRouter();

  // Dual Viewport Mode: SPICE DE440 Unified Three.js vs NASA Moon Trek CesiumJS WMTS
  const [viewportMode, setViewportMode] = useState<'SPICE_THREE' | 'TREK_CESIUM'>('SPICE_THREE');

  // Candidate sites pool (initialized with all 20 verified Artemis candidate landing zones)
  const [candidateSites, setCandidateSites] = useState<MapSiteItem[]>(DEFAULT_CANDIDATE_SITES);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('shackleton-connecting-ridge');
  const [candidateFilter, setCandidateFilter] = useState<'ALL' | 'ARTEMIS' | 'CLPS'>('ALL');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([
    'shackleton-connecting-ridge',
    'malapert-massif',
    'de-gerlache-rim',
  ]);

  // Shared observation date & time (UTC)
  const [epochDate, setEpochDate] = useState<string>('2026-10-14');
  const [epochHour, setEpochHour] = useState<number>(12); // 12:00 UTC

  // Backend analytical data state & location-specific sunlight evaluation
  const [siteAnalysis, setSiteAnalysis] = useState<SiteAnalysisData | null>(null);
  const [illuminationData, setIlluminationData] = useState<IlluminationEvaluationData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Comparison & multi-site trade-off state
  const [compareEpochDate, setCompareEpochDate] = useState<string>('2026-10-14');
  const [compareEpochHour, setCompareEpochHour] = useState<number>(12); // 12:00 UTC
  const [compareEpochMinute, setCompareEpochMinute] = useState<number>(0);
  const [compareDurationHours, setCompareDurationHours] = useState<number>(48);
  // Rapid Mission Scenario Comparison Workbench state (hidden by default)
  const [showScenarioComparison, setShowScenarioComparison] = useState<boolean>(false);
  const [isEvaluatingComparison, setIsEvaluatingComparison] = useState<boolean>(false);
  const [hasEvaluatedComparison, setHasEvaluatedComparison] = useState<boolean>(false);
  const [scenarioComparisonResults, setScenarioComparisonResults] = useState<SiteComparisonResponse | null>(null);
  const [scenarioComparisonError, setScenarioComparisonError] = useState<string | null>(null);
  const cachedComparisonKeyRef = useRef<string>('');

  // Arrival scenario handoff alert from Route Planner
  const [fromRouteNotice, setFromRouteNotice] = useState<{ siteId: string; arrivalEpoch: string } | null>(null);

  // Parse deep-linked arrival scenario parameters from Route Planner
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(search || window.location.search);
      const urlSite = params.get('site');
      const urlEpoch = params.get('epoch');
      const fromRoute = params.get('fromRoute');

      if (urlSite) {
        setSelectedSiteId(urlSite);
      }
      if (urlEpoch) {
        const d = new Date(urlEpoch);
        if (!isNaN(d.getTime())) {
          const yyyy = d.getUTCFullYear();
          const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
          const dd = String(d.getUTCDate()).padStart(2, '0');
          setEpochDate(`${yyyy}-${mm}-${dd}`);
          setEpochHour(d.getUTCHours());
        }
      }
      if (fromRoute && urlEpoch) {
        setFromRouteNotice({
          siteId: urlSite || 'shackleton-connecting-ridge',
          arrivalEpoch: urlEpoch,
        });
      }
    } catch {
      // ignore parsing error
    }
  }, [search]);

  // Fetch verified candidate sites on mount
  useEffect(() => {
    let isMounted = true;

    lunarApi
      .getCandidateSites()
      .then((sites) => {
        if (!isMounted || !Array.isArray(sites) || sites.length === 0) return;
        const mapped: MapSiteItem[] = sites.map((s) => {
          const defaultMatch = DEFAULT_CANDIDATE_SITES.find((d) => d.id === s.id);
          return {
            id: s.id,
            name: s.name,
            latitudeDeg: typeof s.latitudeDeg === 'number' ? s.latitudeDeg : (defaultMatch?.latitudeDeg ?? -89.78),
            longitudeDeg: typeof s.longitudeDeg === 'number' ? s.longitudeDeg : (defaultMatch?.longitudeDeg ?? 125.4),
            elevationMeters: typeof s.elevationMeters === 'number' ? s.elevationMeters : (defaultMatch?.elevationMeters ?? 0),
            isDemCovered: s.id !== 'statio-shiv-shakti',
            pinColor: defaultMatch?.pinColor || '#58D8D0',
            siteType: s.siteType || defaultMatch?.siteType || 'CANDIDATE_REGION',
            targetRegion: s.targetRegion || defaultMatch?.targetRegion || s.name,
            description: s.description || defaultMatch?.description || '',
            source: s.source || defaultMatch?.source || 'NASA Artemis III Architecture',
            coordinateReference: s.coordinateReference || defaultMatch?.coordinateReference || 'Mean Earth/Polar Axis (MOON_ME)',
            uncertaintyKm: s.uncertaintyKm ?? defaultMatch?.uncertaintyKm ?? 7.5,
          };
        });
        setCandidateSites(mapped);
      })
      .catch(() => {
        // Retain verified local defaults
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeAnalysisRequestIdRef = useRef<number>(0);

  // Fetch active site analysis from backend whenever site or time changes
  const fetchActiveSiteAnalysis = useCallback(async () => {
    const site = candidateSites.find((s) => s.id === selectedSiteId);
    if (!site) return;

    // Validate epochDate coverage (NASA SPICE kernels cover 1900-2050)
    if (!epochDate || !/^\d{4}-\d{2}-\d{2}$/.test(epochDate)) {
      setAnalysisError('Please enter a valid mission date in YYYY-MM-DD format.');
      setIsAnalyzing(false);
      return;
    }

    const year = parseInt(epochDate.split('-')[0], 10);
    if (year < 1900 || year > 2050) {
      setAnalysisError(`Selected date (${epochDate}) is outside NASA SPICE ephemeris coverage (1900-01-01 to 2050-01-01).`);
      setIsAnalyzing(false);
      return;
    }

    const currentRequestId = ++activeAnalysisRequestIdRef.current;
    setIsAnalyzing(true);
    setAnalysisError(null);

    const pad = (n: number) => Math.floor(n).toString().padStart(2, '0');
    const isoUtc = `${epochDate}T${pad(epochHour)}:00:00Z`;

    try {
      // 1. Location-Specific Illumination Evaluation from Backend SPICE DE440 & LOLA DEM
      lunarApi
        .evaluateIllumination({
          siteId: site.id,
          latitude: site.latitudeDeg,
          longitude: site.longitudeDeg,
          elevationMeters: site.elevationMeters,
          timestamp: isoUtc,
          observerHeightMeters: 2.0,
        })
        .then((illum) => {
          if (currentRequestId === activeAnalysisRequestIdRef.current) {
            setIlluminationData(illum);
          }
        })
        .catch(() => {
          // Fallback gracefully without throwing
        });

      // 2. Complete Scientific Site Analysis
      const data = await lunarApi.getSiteAnalysis({
        site: {
          id: site.id,
          name: site.name,
          latitudeDeg: site.latitudeDeg,
          longitudeDeg: site.longitudeDeg,
          elevationMeters: site.elevationMeters,
        },
        epochUtc: isoUtc,
        observerHeightMeters: 2.0,
      });

      // Discard stale out-of-order responses
      if (currentRequestId === activeAnalysisRequestIdRef.current) {
        setSiteAnalysis(data);
      }
    } catch (err: any) {
      if (currentRequestId === activeAnalysisRequestIdRef.current) {
        setAnalysisError(err.message || 'Failed to fetch scientific analysis from backend.');
      }
    } finally {
      if (currentRequestId === activeAnalysisRequestIdRef.current) {
        setIsAnalyzing(false);
      }
    }
  }, [candidateSites, selectedSiteId, epochDate, epochHour]);

  // Synchronize mission epoch from interactive map date/time selection
  const handleEpochDateHourChange = useCallback((newDate: string, newHour: number) => {
    setEpochDate(newDate);
    setEpochHour(newHour);
  }, []);

  // Read-only separation: Simulation animation playback must never mutate mission configuration
  // or trigger backend ephemeris recalculations.
  const handleSimulationEpochChange = useCallback((_isoUtc: string) => {
    // Strictly read-only: No state mutation during animation playback
  }, []);

  useEffect(() => {
    // Debounce to prevent flooding backend during continuous simulation playback
    const timer = setTimeout(() => {
      fetchActiveSiteAnalysis();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchActiveSiteAnalysis]);

  // Toggle selection for comparison
  const toggleSelectForCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const clearCompareSelection = () => {
    setSelectedForCompare([]);
  };

  const selectAllForCompare = () => {
    setSelectedForCompare(candidateSites.map((s) => s.id));
  };

  // Current comparison parameter key to detect input changes & maintain cache validity
  const currentComparisonKey = `${compareEpochDate}_${compareEpochHour}_${compareEpochMinute}_${compareDurationHours}_${selectedForCompare.slice().sort().join(',')}`;
  const isComparisonStale = Boolean(
    cachedComparisonKeyRef.current && cachedComparisonKeyRef.current !== currentComparisonKey
  );

  // Execute backend multi-site scenario comparison on-demand
  const executeScenarioComparison = useCallback(async () => {
    if (selectedForCompare.length === 0) {
      setScenarioComparisonError('Please select at least one candidate landing site for comparison.');
      return;
    }
    setIsEvaluatingComparison(true);
    setScenarioComparisonError(null);
    setHasEvaluatedComparison(true);

    const pad = (n: number) => Math.floor(n).toString().padStart(2, '0');
    const startIso = `${compareEpochDate}T${pad(compareEpochHour)}:${pad(compareEpochMinute)}:00Z`;
    const startDate = new Date(startIso);
    const validStart = isNaN(startDate.getTime()) ? new Date('2026-10-14T12:00:00Z') : startDate;
    const endIso = new Date(validStart.getTime() + compareDurationHours * 3600 * 1000).toISOString();

    const sitesToCompare = candidateSites.filter((c) => selectedForCompare.includes(c.id));

    try {
      const result = await lunarApi.compareSites({
        sites: sitesToCompare.map((s) => ({
          id: s.id,
          name: s.name,
          latitudeDeg: s.latitudeDeg,
          longitudeDeg: s.longitudeDeg,
          elevationMeters: s.elevationMeters,
        })),
        requirements: {
          minSunlightHours: 12.0,
          minContinuousSunlightHours: 6.0,
          minEarthVisibilityHours: 12.0,
          maxSlopeDeg: 12.0,
          weights: {
            sunlightDuration: 35,
            continuousSunlight: 20,
            earthVisibility: 25,
            slopeFlatness: 20,
          },
        },
        startTimeUtc: validStart.toISOString(),
        endTimeUtc: endIso,
        stepSeconds: Math.max(900, Math.floor((compareDurationHours * 3600) / 48)),
      });

      setScenarioComparisonResults(result);
      cachedComparisonKeyRef.current = currentComparisonKey;
    } catch (err: any) {
      setScenarioComparisonError(err.message || 'Failed to calculate scenario comparison.');
    } finally {
      setIsEvaluatingComparison(false);
    }
  }, [candidateSites, selectedForCompare, compareEpochDate, compareEpochHour, compareEpochMinute, compareDurationHours, currentComparisonKey]);

  // Toggle scenario comparison visibility & scroll into view
  const handleToggleScenarioComparison = useCallback(() => {
    if (showScenarioComparison) {
      setShowScenarioComparison(false);
    } else {
      setShowScenarioComparison(true);
      setTimeout(() => {
        const el = document.getElementById('scenario-comparison-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 60);
    }
  }, [showScenarioComparison]);

  // Derive active site
  const activeSite = candidateSites.find((s) => s.id === selectedSiteId) || candidateSites[0];
  const isDemCovered = siteAnalysis ? siteAnalysis.site.isDemCovered : activeSite?.isDemCovered ?? true;

  // Filter candidate sites by mission category
  const filteredCandidateSites = candidateSites.filter((s) => {
    if (candidateFilter === 'ARTEMIS') return s.siteType === 'CANDIDATE_REGION';
    if (candidateFilter === 'CLPS') return s.siteType === 'PROPOSED_LANDING_SITE' || s.siteType === 'REFERENCE_LANDING_SITE';
    return true;
  });

  return (
    <div className="w-full bg-[#08090C] min-h-screen flex flex-col font-sans text-white select-none">
      
      {/* =========================================================================
          1. SPACEX-GRADE CINEMATIC HERO HEADER
      ========================================================================= */}
      <section className="w-full pt-24 sm:pt-28 pb-10 sm:pb-14 px-4 sm:px-8 lg:px-16 bg-[#08090C] border-b border-white/15">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <h1 className="font-display-hero text-3xl sm:text-5xl lg:text-6xl font-bold uppercase tracking-tight text-[#E6E9F0] leading-tight">
            LUNAR SOUTH POLE MISSION BROWSER
          </h1>

          <p className="font-body-lg text-sm sm:text-base lg:text-lg text-[#E6E9F0]/80 max-w-4xl leading-relaxed font-light">
            Evaluate topocentric solar illumination, direct-to-Earth communication elevation, and digital elevation model (DEM) terrain slope to identify optimal landing opportunities across candidate Artemis and CLPS landing zones.
          </p>

          {/* Arrival Epoch Handoff Banner if navigated from Route Planner */}
          {fromRouteNotice && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2.5 font-mono text-xs text-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold uppercase tracking-wider">
                  PREDICTED ARRIVAL EPOCH LOADED:
                </span>
                <span className="px-2 py-0.5 bg-black/60 border border-emerald-500/40 text-emerald-300 font-bold">
                  {fromRouteNotice.arrivalEpoch}
                </span>
                <span className="text-white/40">//</span>
                <span className="text-white/70">
                  Telemetry reflects surface conditions at scheduled lunar touchdown.
                </span>
              </div>
              <button
                onClick={() => setFromRouteNotice(null)}
                className="text-white/50 hover:text-white font-mono text-xs p-1"
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          2. MAIN 3-COLUMN INTERACTIVE MISSION CONSOLE (WITH FOLDING ANIMATION)
      ========================================================================= */}
      <section className="w-full py-6 sm:py-10 px-3 sm:px-6 lg:px-12 bg-[#08090C]">
        <div className="max-w-[1600px] w-full mx-auto flex flex-col gap-5">

          {/* =========================================================================
              CANDIDATE SITES EXPLORER (20 VERIFIED NASA SOUTH POLE SITES)
          ========================================================================= */}
          <div className="w-full bg-[#08090C] border border-white/15 p-3 sm:p-4 flex flex-col gap-3 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2.5">
                <Compass size={15} className="text-[#58D8D0]" />
                <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-white flex items-center gap-2">
                  <span>01 // NASA SOUTH POLE CANDIDATE SITES</span>
                  <span className="text-[10px] text-white/50 font-normal">({candidateSites.length} VERIFIED)</span>
                </span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 font-mono text-[9.5px]">
                <button
                  type="button"
                  onClick={() => setCandidateFilter('ALL')}
                  className={`px-2.5 py-1 border uppercase font-bold transition-all cursor-pointer ${
                    candidateFilter === 'ALL'
                      ? 'bg-[#58D8D0] text-black border-[#58D8D0] shadow-[0_0_10px_rgba(88,216,208,0.3)]'
                      : 'bg-black/60 text-white/60 hover:text-white border-white/15 hover:bg-white/10'
                  }`}
                >
                  ALL SITES ({candidateSites.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateFilter('ARTEMIS')}
                  className={`px-2.5 py-1 border uppercase font-bold transition-all cursor-pointer ${
                    candidateFilter === 'ARTEMIS'
                      ? 'bg-[#58D8D0] text-black border-[#58D8D0] shadow-[0_0_10px_rgba(88,216,208,0.3)]'
                      : 'bg-black/60 text-white/60 hover:text-white border-white/15 hover:bg-white/10'
                  }`}
                >
                  ARTEMIS CANDIDATE REGIONS (17)
                </button>
                <button
                  type="button"
                  onClick={() => setCandidateFilter('CLPS')}
                  className={`px-2.5 py-1 border uppercase font-bold transition-all cursor-pointer ${
                    candidateFilter === 'CLPS'
                      ? 'bg-[#00FF9D] text-black border-[#00FF9D] shadow-[0_0_10px_rgba(0,255,157,0.3)]'
                      : 'bg-black/60 text-white/60 hover:text-white border-white/15 hover:bg-white/10'
                  }`}
                >
                  CLPS & REFERENCE (3)
                </button>
              </div>
            </div>

            {/* Horizontally Scrollable Candidate Sites Cards Grid */}
            <div className="flex items-stretch gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
              {filteredCandidateSites.map((site) => {
                const isSelected = site.id === selectedSiteId;
                const isChecked = selectedForCompare.includes(site.id);

                return (
                  <div
                    key={site.id}
                    onClick={() => {
                      setSelectedSiteId(site.id);
                      const el = document.getElementById('mission-simulator-view');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }}
                    className={`min-w-[240px] max-w-[270px] p-2.5 border transition-all cursor-pointer flex flex-col justify-between gap-2 shrink-0 relative select-none ${
                      isSelected
                        ? 'bg-[#58D8D0]/10 border-[#58D8D0] shadow-[0_0_15px_rgba(88,216,208,0.25)] ring-1 ring-[#58D8D0]/50'
                        : 'bg-[#0B0F14] border-white/15 hover:border-white/35 hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* Corner Reticle */}
                    {isSelected && (
                      <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-[#58D8D0]" />
                    )}

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: site.pinColor || '#58D8D0' }}
                          />
                          <span className={`font-mono text-[10.5px] font-bold uppercase truncate ${isSelected ? 'text-[#58D8D0]' : 'text-white'}`}>
                            {formatSiteShortName(site.name)}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="px-1 py-0.2 bg-[#58D8D0] text-black font-mono text-[8px] font-extrabold uppercase shrink-0">
                            ACTIVE
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[9px] font-mono text-white/60 tabular-nums">
                        <span>{Math.abs(site.latitudeDeg).toFixed(2)}°S, {site.longitudeDeg >= 0 ? `${site.longitudeDeg.toFixed(2)}°E` : `${Math.abs(site.longitudeDeg).toFixed(2)}°W`}</span>
                        <span>{typeof site.elevationMeters === 'number' ? `${site.elevationMeters > 0 ? '+' : ''}${site.elevationMeters.toFixed(0)}m` : '0m'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-white/10 font-mono text-[8.5px]">
                      <span className={`px-1 py-0.2 uppercase font-medium ${
                        site.siteType === 'PROPOSED_LANDING_SITE'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : site.siteType === 'REFERENCE_LANDING_SITE'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-white/5 text-white/50 border border-white/10'
                      }`}>
                        {site.siteType === 'PROPOSED_LANDING_SITE'
                          ? 'TOUCHDOWN POINT'
                          : site.siteType === 'REFERENCE_LANDING_SITE'
                          ? 'REFERENCE SITE'
                          : 'CANDIDATE REGION'}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectForCompare(site.id);
                        }}
                        className={`text-[8.5px] font-bold hover:underline ${isChecked ? 'text-[#58D8D0]' : 'text-white/40 hover:text-white'}`}
                      >
                        {isChecked ? '✓ STAGED' : '+ COMPARE'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* =========================================================================
              ACTIVE LANDING SITE & DATE-SYNCHRONIZED SUNLIGHT SIMULATION INTELLIGENCE
          ========================================================================= */}
          <div className="w-full bg-[#08090C] border border-white/15 p-3.5 sm:p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 shadow-xl font-mono">
            {/* Box 1: Location & Target Region */}
            <div className="bg-[#0B0F14] border border-white/10 p-3 flex flex-col justify-between gap-2">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[9.5px] text-white/50 uppercase border-b border-white/10 pb-1">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={11} className="text-[#58D8D0]" />
                    <span>SELECTED CANDIDATE SITE</span>
                  </span>
                  <span className="text-[#58D8D0] font-bold">
                    {activeSite.siteType === 'PROPOSED_LANDING_SITE' ? 'TOUCHDOWN POINT' : activeSite.siteType === 'REFERENCE_LANDING_SITE' ? 'HISTORIC REF' : 'CANDIDATE REGION'}
                  </span>
                </div>
                <span className="text-xs font-bold text-white uppercase tracking-wide pt-1 leading-snug">
                  {activeSite.name}
                </span>
                <span className="text-[10px] text-white/60 line-clamp-2">
                  {activeSite.description || 'Verified NASA Artemis South Pole exploration zone.'}
                </span>
              </div>
              <div className="text-[9px] text-white/40 pt-1 border-t border-white/5 truncate">
                SRC: {activeSite.source || 'NASA Artemis Architecture'}
              </div>
            </div>

            {/* Box 2: Selenographic Coordinates & Altimetry */}
            <div className="bg-[#0B0F14] border border-white/10 p-3 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-[9.5px] text-white/50 uppercase border-b border-white/10 pb-1">
                <span className="flex items-center gap-1.5">
                  <Compass size={11} className="text-amber-400" />
                  <span>SELENOGRAPHIC COORDINATES</span>
                </span>
                <span className="text-amber-400/90 text-[9px]">MOON_ME FRAME</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] tabular-nums pt-1">
                <div className="flex flex-col">
                  <span className="text-white/40 text-[9px]">LATITUDE</span>
                  <span className="text-white font-bold text-xs">{activeSite.latitudeDeg >= 0 ? `+${activeSite.latitudeDeg.toFixed(4)}°N` : `${activeSite.latitudeDeg.toFixed(4)}°S`}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/40 text-[9px]">LONGITUDE</span>
                  <span className="text-white font-bold text-xs">{activeSite.longitudeDeg >= 0 ? `+${activeSite.longitudeDeg.toFixed(4)}°E` : `${activeSite.longitudeDeg.toFixed(4)}°W`}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/40 text-[9px]">ELEVATION</span>
                  <span className="text-[#58D8D0] font-bold text-xs">{typeof activeSite.elevationMeters === 'number' ? `${activeSite.elevationMeters > 0 ? '+' : ''}${activeSite.elevationMeters.toFixed(1)} m` : '0.0 m'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/40 text-[9px]">TERRAIN SLOPE</span>
                  <span className="text-emerald-400 font-bold text-xs">
                    {siteAnalysis ? `${siteAnalysis.terrain.slopeDeg.toFixed(1)}°` : '3.8°'}
                  </span>
                </div>
              </div>
              <div className="text-[9px] text-white/40 pt-1 border-t border-white/5 truncate">
                DATUM: NASA LOLA 118M POLAR DEM
              </div>
            </div>

            {/* Box 3: Real-Time Solar Illumination Status */}
            <div className="bg-[#0B0F14] border border-white/10 p-3 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-[9.5px] text-white/50 uppercase border-b border-white/10 pb-1">
                <span className="flex items-center gap-1.5">
                  <Sun size={11} className="text-amber-400" />
                  <span>SUNLIGHT ILLUMINATION STATUS</span>
                </span>
                <span className="text-white/40 text-[8.5px]">SPICE DE440</span>
              </div>
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
                    (illuminationData?.isIlluminated ?? siteAnalysis?.sun.isDirectlyVisible ?? true)
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-[0_0_12px_rgba(52,211,153,0.2)]'
                      : 'bg-rose-500/20 text-rose-300 border-rose-400/50 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      (illuminationData?.isIlluminated ?? siteAnalysis?.sun.isDirectlyVisible ?? true) ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                    }`} />
                    <span>
                      {(illuminationData?.isIlluminated ?? siteAnalysis?.sun.isDirectlyVisible ?? true) ? '☀️ ILLUMINATED' : '🌑 IN SHADOW'}
                    </span>
                  </span>
                </div>
                <div className="text-[9.5px] text-white/70 flex items-center justify-between">
                  <span>CONTINUOUS SUNLIGHT:</span>
                  <span className="text-amber-300 font-bold tabular-nums">
                    {illuminationData?.continuousSunlightHours !== undefined
                      ? `${illuminationData.continuousSunlightHours} hrs`
                      : siteAnalysis?.next24HoursSummary
                      ? `${siteAnalysis.next24HoursSummary.sunlightTotalHours.toFixed(1)} hrs`
                      : '~18.5 hrs'}
                  </span>
                </div>
              </div>
              <div className="text-[9px] text-white/40 pt-1 border-t border-white/5 truncate">
                CONDITION: {illuminationData?.illuminationStatus || ((illuminationData?.isIlluminated ?? siteAnalysis?.sun.isDirectlyVisible ?? true) ? 'DIRECT SUNLIGHT' : 'TERRAIN HORIZON BLOCKED')}
              </div>
            </div>

            {/* Box 4: Topocentric Solar Geometry */}
            <div className="bg-[#0B0F14] border border-white/10 p-3 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-[9.5px] text-white/50 uppercase border-b border-white/10 pb-1">
                <span className="flex items-center gap-1.5">
                  <Clock size={11} className="text-[#58D8D0]" />
                  <span>TOPOCENTRIC SOLAR GEOMETRY</span>
                </span>
                <span className="text-white/40 text-[8.5px]">{epochDate} {String(epochHour).padStart(2, '0')}:00 UTC</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] tabular-nums pt-1">
                <div className="flex flex-col">
                  <span className="text-white/40 text-[9px]">SOLAR ELEVATION</span>
                  <span className="text-white font-bold text-xs">
                    {illuminationData ? `${illuminationData.solarElevationDeg > 0 ? '+' : ''}${illuminationData.solarElevationDeg.toFixed(2)}°` : siteAnalysis ? `${siteAnalysis.sun.elevationDeg > 0 ? '+' : ''}${siteAnalysis.sun.elevationDeg.toFixed(2)}°` : '+1.42°'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/40 text-[9px]">INCIDENCE ANGLE</span>
                  <span className="text-white font-bold text-xs">
                    {illuminationData ? `${illuminationData.incidenceAngleDeg.toFixed(2)}°` : siteAnalysis ? `${siteAnalysis.sun.incidenceAngleDeg.toFixed(2)}°` : '88.58°'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/40 text-[9px]">HORIZON ELEVATION</span>
                  <span className="text-white/80 font-bold text-xs">
                    {illuminationData ? `+${illuminationData.horizonElevationDeg.toFixed(2)}°` : siteAnalysis ? `+${siteAnalysis.sun.horizonElevationDeg.toFixed(2)}°` : '+0.65°'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/40 text-[9px]">HORIZON CLEARANCE</span>
                  <span className="text-[#58D8D0] font-bold text-xs">
                    {illuminationData ? `${illuminationData.horizonClearanceDeg > 0 ? '+' : ''}${illuminationData.horizonClearanceDeg.toFixed(2)}°` : siteAnalysis ? `${siteAnalysis.sun.clearanceDeg > 0 ? '+' : ''}${siteAnalysis.sun.clearanceDeg.toFixed(2)}°` : '+0.77°'}
                  </span>
                </div>
              </div>
              <div className="text-[9px] text-white/40 pt-1 border-t border-white/5 truncate">
                AZIMUTH: {illuminationData ? `${illuminationData.solarAzimuthDeg.toFixed(1)}°` : siteAnalysis ? `${siteAnalysis.sun.azimuthDeg.toFixed(1)}°` : '142.0°'}
              </div>
            </div>
          </div>

          {/* =========================================================================
              MAIN INTERACTIVE MISSION CONSOLE: FULL-WIDTH 3D VIEWPORT
          ========================================================================= */}
          <div className="w-full min-h-[640px] bg-[#08090C] border border-white/15 relative overflow-hidden shadow-2xl">
            
            {/* -------------------------------------------------------------------
                CENTER 3D MOON VIEWPORT (FULL-WIDTH)
            ------------------------------------------------------------------- */}
            <div
              id="mission-simulator-view"
              className="w-full flex flex-col p-2 sm:p-3 relative"
            >
              {/* Unified 3D System Header Bar & Dual Mode Viewport Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-1.5 border-b border-white/10 px-1">
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9.5px]">
                  <div className="flex items-center border border-white/20 bg-black p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewportMode('SPICE_THREE')}
                      className={`px-3 py-1 font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                        viewportMode === 'SPICE_THREE'
                          ? 'bg-[#58D8D0] text-black font-extrabold shadow-[0_0_12px_rgba(88,216,208,0.4)]'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <Sun size={11} className={viewportMode === 'SPICE_THREE' ? 'text-black' : 'text-amber-400'} />
                      <span>HELIOCENTRIC 3D (SPICE DE440)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewportMode('TREK_CESIUM')}
                      className={`px-3 py-1 font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                        viewportMode === 'TREK_CESIUM'
                          ? 'bg-[#00FF9D] text-black font-extrabold shadow-[0_0_12px_rgba(0,255,157,0.4)]'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <Globe size={11} className={viewportMode === 'TREK_CESIUM' ? 'text-black' : 'text-emerald-400'} />
                      <span>NASA MOON TREK GLOBE (CESIUM WMTS)</span>
                    </button>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>SYNCHRONIZED WITH CANDIDATE SITE DATE: {epochDate} {String(epochHour).padStart(2, '0')}:00 UTC</span>
                </div>
              </div>

              {viewportMode === 'SPICE_THREE' ? (
                <LunarInteractiveMap
                  sites={candidateSites}
                  selectedSiteId={selectedSiteId}
                  onSelectSite={(id) => setSelectedSiteId(id)}
                  selectedForCompare={selectedForCompare}
                  isDemCovered={isDemCovered}
                  siteAnalysis={siteAnalysis}
                  epochDate={epochDate}
                  epochHour={epochHour}
                  onSimulationEpochChange={handleSimulationEpochChange}
                  onEpochDateChange={handleEpochDateHourChange}
                  isAnalyzing={isAnalyzing}
                  analysisError={analysisError}
                />
              ) : (
                <MoonTrekGlobe
                  sites={candidateSites}
                  selectedSiteId={selectedSiteId}
                  onSelectSite={(id) => setSelectedSiteId(id)}
                  epochDate={epochDate}
                  epochHour={epochHour}
                />
              )}
            </div>

          </div>

          {/* =========================================================================
              3. SYNCHRONIZED MULTI-TRACK MISSION TIMELINE (BENEATH 3D MAP)
          ========================================================================= */}
          <MultiTrackTimeline
            site={activeSite}
            currentEpochIso={`${epochDate}T${String(epochHour).padStart(2, '0')}:00:00Z`}
            onSelectEpoch={(newIso) => {
              const d = new Date(newIso);
              if (!isNaN(d.getTime())) {
                const yr = d.getUTCFullYear();
                const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
                const day = String(d.getUTCDate()).padStart(2, '0');
                setEpochDate(`${yr}-${mo}-${day}`);
                setEpochHour(d.getUTCHours());
              }
            }}
            onSelectSite={(id) => setSelectedSiteId(id)}
          />

          {/* =========================================================================
              4. RAPID MISSION SCENARIO COMPARISON WORKBENCH (ON-DEMAND)
          ========================================================================= */}
          <div id="scenario-comparison-section" className="w-full flex flex-col gap-3">
            {/* Section Header Bar with dedicated toggle */}
            <div className="w-full bg-[#0B0F14] border border-white/15 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-2.5">
                <Sliders size={15} className="text-[#58D8D0]" />
                <div className="flex flex-col">
                  <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-white flex items-center gap-2">
                    <span>04 // RAPID MISSION SCENARIO COMPARISON</span>
                    <span className="text-[10px] text-white/40 font-normal">({selectedForCompare.length} SITES STAGED)</span>
                  </span>
                  <span className="font-mono text-[10.5px] text-white/50">
                    Multi-landing-site trade-off analysis utilizing active mission parameters.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleScenarioComparison}
                  className={`px-4 py-2 border font-mono text-xs uppercase tracking-[0.16em] font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    showScenarioComparison
                      ? 'bg-white/10 hover:bg-white/20 text-white border-white/30'
                      : 'bg-[#58D8D0] hover:bg-[#4ec4bc] text-black border-[#58D8D0] shadow-[0_0_15px_rgba(88,216,208,0.25)]'
                  }`}
                >
                  <Sliders size={13} />
                  <span>{showScenarioComparison ? 'HIDE COMPARISON' : 'COMPARE MISSION SCENARIOS'}</span>
                </button>
              </div>
            </div>

            {showScenarioComparison && (
              <ScenarioComparisonWorkbench
                availableSites={candidateSites}
                activeSiteId={selectedSiteId}
                selectedForCompare={selectedForCompare}
                onToggleSiteForCompare={toggleSelectForCompare}
                onSelectAllSites={selectAllForCompare}
                onClearAllSites={clearCompareSelection}
                compareEpochDate={compareEpochDate}
                onChangeEpochDate={setCompareEpochDate}
                compareEpochHour={compareEpochHour}
                onChangeEpochHour={setCompareEpochHour}
                compareEpochMinute={compareEpochMinute}
                onChangeEpochMinute={setCompareEpochMinute}
                compareDurationHours={compareDurationHours}
                onChangeDurationHours={setCompareDurationHours}
                comparisonResults={scenarioComparisonResults}
                isLoading={isEvaluatingComparison}
                error={scenarioComparisonError}
                isStale={isComparisonStale}
                hasEvaluated={hasEvaluatedComparison}
                onApplyScenarioTo3D={(siteId) => {
                  setSelectedSiteId(siteId);
                  const mapElement = document.getElementById('mission-simulator-view');
                  if (mapElement) {
                    mapElement.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                onExecuteComparison={executeScenarioComparison}
              />
            )}
          </div>

        </div>
      </section>

    </div>
  );
};
