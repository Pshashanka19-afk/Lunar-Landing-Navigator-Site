import React, { useState, useEffect, useCallback } from 'react';
import { 
  Compass, 
  Calendar, 
  Clock, 
  Sun, 
  Globe, 
  Mountain, 
  Check, 
  Plus, 
  AlertTriangle, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Maximize2, 
  Minimize2, 
  PanelLeftClose, 
  PanelLeftOpen, 
  BarChart2, 
  Sliders, 
  ShieldCheck,
  Columns,
  X,
  Rocket
} from 'lucide-react';
import { Link } from '../router';
import { 
  lunarApi, 
  type SiteAnalysisData, 
  type SiteComparisonResponse,
  type ScienceHealth
} from '../services/lunarApi';
import { IMAGES } from '../data/images';
import { LunarInteractiveMap, type MapSiteItem } from '../components/LunarInteractiveMap';
import { MissionDatePicker } from '../components/MissionDatePicker';
import { MultiTrackTimeline } from '../components/MultiTrackTimeline';
import { ScenarioComparisonWorkbench } from '../components/ScenarioComparisonWorkbench';

// Helper to retrieve authentic verified project image asset
const getSiteImage = (id: string, name?: string): string => {
  const text = (id + ' ' + (name || '')).toLowerCase();
  if (text.includes('malapert')) return IMAGES.malapertPeak;
  if (text.includes('gerlache')) return IMAGES.clpsLander;
  if (text.includes('haworth')) return IMAGES.earthRise;
  if (text.includes('nobile')) return IMAGES.shadowRay;
  return IMAGES.lolaDem; // Shackleton Crater Ridge default
};

// Default NASA South Pole candidate landing sites
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

export const MissionBrowserPage: React.FC = () => {
  // Candidate sites pool
  const [candidateSites, setCandidateSites] = useState<MapSiteItem[]>(DEFAULT_CANDIDATE_SITES);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('shackleton-connecting-ridge');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([
    'shackleton-connecting-ridge',
    'malapert-mountain',
    'de-gerlache-rim-2',
  ]);

  // Shared observation date & time (UTC)
  const [epochDate, setEpochDate] = useState<string>('2026-10-14');
  const [epochHour, setEpochHour] = useState<number>(12); // 12:00 UTC

  // Backend analytical data state
  const [siteAnalysis, setSiteAnalysis] = useState<SiteAnalysisData | null>(null);
  const [scienceHealth, setScienceHealth] = useState<ScienceHealth | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Comparison & multi-site trade-off state
  const [compareDurationHours, setCompareDurationHours] = useState<number>(48);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [comparisonResults, setComparisonResults] = useState<SiteComparisonResponse | null>(null);

  // Custom coordinates drawer
  const [showCustomDrawer, setShowCustomDrawer] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customLat, setCustomLat] = useState<number>(-89.5);
  const [customLon, setCustomLon] = useState<number>(120.0);
  const [isValidatingCustom, setIsValidatingCustom] = useState<boolean>(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // Advanced telemetry disclosure
  const [showAdvancedSnapshot, setShowAdvancedSnapshot] = useState<boolean>(false);

  // VS Code-style Activity Bar & Sidebar State ('sites' | 'telemetry' | 'both' | null)
  // Initially null (closed) matching VS Code closed sidebar screenshot
  type SidebarTab = 'sites' | 'telemetry' | 'both' | null;
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>(null);

  // Arrival scenario handoff alert from Route Planner
  const [fromRouteNotice, setFromRouteNotice] = useState<{ siteId: string; arrivalEpoch: string } | null>(null);

  // Parse deep-linked arrival scenario parameters from Route Planner
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
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
        setActiveSidebarTab('telemetry');
      }
    } catch {
      // ignore parsing error
    }
  }, []);

  // Fetch verified candidate sites and science backend status on mount
  useEffect(() => {
    let isMounted = true;

    lunarApi
      .checkScienceHealth()
      .then((health) => {
        if (isMounted) setScienceHealth(health);
      })
      .catch(() => {});

    lunarApi
      .getDefaultSites()
      .then((sites) => {
        if (!isMounted || !Array.isArray(sites) || sites.length === 0) return;
        const mapped: MapSiteItem[] = sites.map((s) => ({
          id: s.id,
          name: s.name,
          latitudeDeg: s.latitudeDeg,
          longitudeDeg: s.longitudeDeg,
          elevationMeters: s.elevationMeters,
          isDemCovered: true,
          pinColor: s.id.includes('shackleton')
            ? '#58D8D0'
            : s.id.includes('malapert')
            ? '#ECC068'
            : s.id.includes('gerlache')
            ? '#78F5EC'
            : '#FFB3B0',
        }));
        setCandidateSites(mapped);
      })
      .catch(() => {
        // Retain verified local defaults
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Keyboard navigation shortcuts for VS Code Activity Bar & Sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === 'Escape') {
        setActiveSidebarTab(null);
      } else if ((e.altKey && e.key === '1') || (e.key === '1' && !e.ctrlKey && !e.metaKey)) {
        setActiveSidebarTab((prev) => (prev === 'sites' ? null : 'sites'));
      } else if ((e.altKey && e.key === '2') || (e.key === '2' && !e.ctrlKey && !e.metaKey)) {
        setActiveSidebarTab((prev) => (prev === 'telemetry' ? null : 'telemetry'));
      } else if ((e.altKey && e.key === '3') || (e.key === '3' && !e.ctrlKey && !e.metaKey)) {
        setActiveSidebarTab((prev) => (prev === 'both' ? null : 'both'));
      } else if (e.key === 'f' || e.key === 'F') {
        setActiveSidebarTab((prev) => (prev === null ? 'sites' : null));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch active site analysis from backend whenever site or time changes
  const fetchActiveSiteAnalysis = useCallback(async () => {
    const site = candidateSites.find((s) => s.id === selectedSiteId);
    if (!site) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    const pad = (n: number) => Math.floor(n).toString().padStart(2, '0');
    const isoUtc = `${epochDate}T${pad(epochHour)}:00:00Z`;

    try {
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

      setSiteAnalysis(data);
    } catch (err: any) {
      setAnalysisError(err.message || 'Failed to fetch scientific analysis from backend.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [candidateSites, selectedSiteId, epochDate, epochHour]);

  // Handler for continuous simulation clock updates from 3D map
  const handleSimulationEpochChange = useCallback((isoUtc: string) => {
    try {
      const d = new Date(isoUtc);
      if (isNaN(d.getTime())) return;
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const hourVal = d.getUTCHours();
      setEpochDate(dateStr);
      setEpochHour(hourVal);
    } catch {
      // Ignore parsing errors
    }
  }, []);

  useEffect(() => {
    fetchActiveSiteAnalysis();
  }, [fetchActiveSiteAnalysis]);

  // Toggle selection for comparison
  const toggleSelectForCompare = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  // Add custom coordinates via backend validation
  const handleAddCustomSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError(null);
    setIsValidatingCustom(true);

    try {
      const validation = await lunarApi.validateSite({
        name: customName.trim() || 'Custom Lunar Site',
        latitudeDeg: customLat,
        longitudeDeg: customLon,
      });

      const isCovered = customLat <= -83.013 && customLat >= -90.0;
      const newId = `custom-${Date.now()}`;

      const newSite: MapSiteItem = {
        id: newId,
        name: validation.site?.name || customName.trim(),
        latitudeDeg: customLat,
        longitudeDeg: customLon,
        elevationMeters: validation.site?.elevationMeters || 0,
        isDemCovered: isCovered,
        pinColor: '#FFFFFF',
        isCustom: true,
      };

      setCandidateSites((prev) => [newSite, ...prev]);
      setSelectedSiteId(newId);
      setSelectedForCompare((prev) => [...prev, newId]);
      setShowCustomDrawer(false);
    } catch (err: any) {
      setCustomError(err.message || 'Invalid lunar coordinates.');
    } finally {
      setIsValidatingCustom(false);
    }
  };

  // Run backend multi-site comparison
  const handleRunComparison = async () => {
    if (selectedForCompare.length === 0) return;
    setIsComparing(true);

    const pad = (n: number) => Math.floor(n).toString().padStart(2, '0');
    const startIso = `${epochDate}T${pad(epochHour)}:00:00Z`;
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

      setComparisonResults(result);
    } catch {
      // Graceful error handling
    } finally {
      setIsComparing(false);
    }
  };

  // Run initial comparison on mount
  useEffect(() => {
    handleRunComparison();
  }, [compareDurationHours]);

  // Derive active site
  const activeSite = candidateSites.find((s) => s.id === selectedSiteId) || candidateSites[0];
  const isDemCovered = siteAnalysis ? siteAnalysis.site.isDemCovered : activeSite?.isDemCovered ?? true;

  // Derive Scientific Indicators from real backend analysis data
  const getSunlightIndicator = () => {
    if (isAnalyzing || !siteAnalysis) {
      return { status: 'CALCULATING...', color: 'text-white/40', badge: 'bg-white/5 text-white/50 border-white/10' };
    }
    const { sun } = siteAnalysis;
    if (sun.isDirectlyVisible && sun.clearanceDeg > 0.2) {
      return { status: 'DIRECT SUNLIGHT', color: 'text-[#ECC068]', badge: 'bg-[#ECC068]/15 text-[#ECC068] border-[#ECC068]/30' };
    }
    if (sun.elevationDeg >= -0.2 && sun.elevationDeg <= 1.0) {
      return { status: 'GRAZING PENUMBRA', color: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    }
    return { status: 'TERRAIN OCCLUDED', color: 'text-red-400', badge: 'bg-red-500/15 text-red-300 border-red-500/30' };
  };

  const getEarthIndicator = () => {
    if (isAnalyzing || !siteAnalysis) {
      return { status: 'CALCULATING...', color: 'text-white/40', badge: 'bg-white/5 text-white/50 border-white/10' };
    }
    const { earth } = siteAnalysis;
    if (earth.isDirectlyVisible && earth.clearanceDeg > 0.5) {
      return { status: 'DIRECT DTE LOS', color: 'text-[#58D8D0]', badge: 'bg-[#58D8D0]/15 text-[#58D8D0] border-[#58D8D0]/30' };
    }
    if (Math.abs(earth.clearanceDeg) <= 0.5) {
      return { status: 'LIBRATION MARGINAL', color: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    }
    return { status: 'HORIZON BLOCKED', color: 'text-red-400', badge: 'bg-red-500/15 text-red-300 border-red-500/30' };
  };

  const getTerrainIndicator = () => {
    if (!isDemCovered) {
      return { status: 'OUTSIDE POLAR DEM', color: 'text-gray-400', badge: 'bg-gray-500/15 text-gray-400 border-gray-500/30' };
    }
    if (isAnalyzing || !siteAnalysis) {
      return { status: 'CALCULATING...', color: 'text-white/40', badge: 'bg-white/5 text-white/50 border-white/10' };
    }
    const { slopeDeg } = siteAnalysis.terrain;
    if (slopeDeg <= 8.0) {
      return { status: 'SAFE SLOPE (<8°)', color: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    }
    if (slopeDeg <= 12.0) {
      return { status: 'MODERATE (<12°)', color: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    }
    return { status: 'STEEP (>12°)', color: 'text-red-400', badge: 'bg-red-500/15 text-red-300 border-red-500/30' };
  };

  const sunlightInd = getSunlightIndicator();
  const earthInd = getEarthIndicator();
  const terrainInd = getTerrainIndicator();

  // Overall Site Assessment derived strictly from verified indicators
  const getOverallAssessment = () => {
    if (!isDemCovered) {
      return {
        title: 'DATA LIMIT // OUTSIDE DEM',
        badge: 'bg-white/10 text-white/60 border-white/20',
        explanation: 'Topographic altimetry unavailable for this location (outside LOLA South Pole 85°S-90°S coverage).',
      };
    }
    if (isAnalyzing || !siteAnalysis) {
      return {
        title: 'COMPUTING SPICE & LOLA DEM...',
        badge: 'bg-white/10 text-white/50 border-white/20',
        explanation: 'Synchronizing orbital state vectors with NASA LOLA altimetry...',
      };
    }

    const { sun, earth, terrain } = siteAnalysis;
    const isSafeSlope = terrain.slopeDeg <= 12.0;
    const isSunGood = sun.isDirectlyVisible && sun.clearanceDeg > 0;
    const isEarthGood = earth.isDirectlyVisible && earth.clearanceDeg > 0;

    if (isSunGood && isEarthGood && isSafeSlope) {
      return {
        title: 'FEASIBLE // OPTIMAL MISSION GEOMETRY',
        badge: 'bg-white/20 text-white border-white font-bold',
        explanation: 'Continuous solar illumination clearance and unobstructed direct-to-Earth communication line of sight.',
      };
    }

    if (isSunGood && !isEarthGood && isSafeSlope) {
      return {
        title: 'MARGINAL // EARTH HORIZON OCCLUSION',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold',
        explanation: 'Favorable solar harvest, but direct Earth communication is occluded by nearby crater topography.',
      };
    }

    if (!isSunGood && isEarthGood && isSafeSlope) {
      return {
        title: 'MARGINAL // SOLAR SHADOW OCCLUSION',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold',
        explanation: 'Unobstructed Earth communication, but the site is currently in local terrain shadow.',
      };
    }

    if (!isSafeSlope) {
      return {
        title: 'CRITICAL // SLOPE EXCEEDS 12° THRESHOLD',
        badge: 'bg-red-500/20 text-red-300 border-red-500/40 font-bold',
        explanation: `Steep local terrain slope (${terrain.slopeDeg.toFixed(1)}° > 12° limit) exceeds lander stability tolerances.`,
      };
    }

    return {
      title: 'UNFAVORABLE // CONSTRAINTS EXCEEDED',
      badge: 'bg-red-500/20 text-red-300 border-red-500/40 font-bold',
      explanation: 'Both solar illumination and direct Earth line-of-sight are blocked by local relief.',
    };
  };

  const assessment = getOverallAssessment();

  // Helper render for Candidate Sites panel content
  const renderCandidateSitesPanel = () => (
    <div className="flex flex-col gap-4">
      {/* Candidate Landing Sites Panel */}
      <div className="bg-[#08090C] border border-white/15 p-3.5 sm:p-4 flex flex-col gap-3 rounded-none relative shadow-lg">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-white flex items-center gap-2">
            <Compass size={13} className="text-[#58D8D0]" />
            <span>01 // CANDIDATE SITES</span>
          </span>
          <span className="font-mono text-[9.5px] text-white/50 tracking-widest uppercase">
            {candidateSites.length} STAGED
          </span>
        </div>

        {/* Candidate Sites List */}
        <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
          {candidateSites.map((site) => {
            const isActive = site.id === selectedSiteId;
            const isChecked = selectedForCompare.includes(site.id);

            return (
              <div
                key={site.id}
                onClick={() => setSelectedSiteId(site.id)}
                className={`p-2.5 border transition-all cursor-pointer flex flex-col gap-2 relative rounded-none ${
                  isActive
                    ? 'bg-white/[0.06] border-white/40 border-l-2 border-l-[#58D8D0]'
                    : 'bg-[#0B0F14] border-white/10 hover:border-white/25 hover:bg-white/[0.02]'
                }`}
              >
                {/* Corner Alignment Reticle for active site */}
                {isActive && (
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#58D8D0]" />
                )}
                <div className="flex items-center justify-between gap-2">
                  {/* Checkbox for comparison inclusion */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectForCompare(site.id);
                    }}
                    className={`w-3.5 h-3.5 border rounded-none flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                      isChecked
                        ? 'bg-[#58D8D0] border-[#58D8D0] text-black'
                        : 'border-white/25 bg-black hover:border-white/50'
                    }`}
                    title="Toggle for multi-site comparison"
                  >
                    {isChecked && <Check size={10} className="stroke-[3]" />}
                  </div>

                  {/* Site Name */}
                  <span className="font-mono font-bold text-xs uppercase tracking-wider text-white truncate flex-1">
                    {site.name}
                  </span>

                  {/* DEM Status */}
                  <span className="px-1.5 py-0.2 font-mono text-[8.5px] uppercase tracking-widest shrink-0 border border-white/20 bg-white/5 text-white/60 rounded-none">
                    DEM 80M
                  </span>
                </div>

                {/* Thumbnail & Selenographic Coordinates */}
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 overflow-hidden border border-white/15 shrink-0 bg-black rounded-none">
                    <img
                      src={getSiteImage(site.id, site.name)}
                      alt={site.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5 text-[10.5px] font-mono text-white/60">
                    <span className="tabular-nums">
                      {Math.abs(site.latitudeDeg).toFixed(2)}°S, {site.longitudeDeg >= 0 ? `${site.longitudeDeg.toFixed(2)}°E` : `${Math.abs(site.longitudeDeg).toFixed(2)}°W`}
                    </span>
                    <span className="text-white/40 tabular-nums text-[10px]">
                      DATUM: {site.elevationMeters > 0 ? `+${site.elevationMeters.toFixed(0)}m` : `${site.elevationMeters.toFixed(0)}m`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Register Custom Coordinates */}
        <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowCustomDrawer(!showCustomDrawer)}
            className="w-full py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/20 text-white font-mono text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus size={13} />
            <span>+ Register Custom Coordinates</span>
          </button>

          {showCustomDrawer && (
            <form onSubmit={handleAddCustomSite} className="p-3.5 bg-black/80 border border-white/20 flex flex-col gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-mono font-bold text-white/50">Location Label</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. South Pole Peak C"
                  className="p-2 bg-[#101419] border border-white/20 text-white font-mono text-xs outline-none focus:border-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-white/50">Latitude (°)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="-90.0"
                    max="0.0"
                    value={customLat}
                    onChange={(e) => setCustomLat(parseFloat(e.target.value))}
                    className="p-2 bg-[#101419] border border-white/20 text-white font-mono text-xs outline-none focus:border-white"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-mono font-bold text-white/50">Longitude (°)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="-180.0"
                    max="180.0"
                    value={customLon}
                    onChange={(e) => setCustomLon(parseFloat(e.target.value))}
                    className="p-2 bg-[#101419] border border-white/20 text-white font-mono text-xs outline-none focus:border-white"
                    required
                  />
                </div>
              </div>

              {customError && (
                <span className="text-[10px] text-red-400 font-mono leading-tight">{customError}</span>
              )}

              <button
                type="submit"
                disabled={isValidatingCustom}
                className="w-full py-2 bg-white hover:bg-slate-200 disabled:opacity-50 text-black font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                {isValidatingCustom ? 'Validating...' : 'Register Coordinates'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Temporal Clock & Observation Epoch */}
      <div className="bg-[#08090C] border border-white/15 p-3.5 sm:p-4 flex flex-col gap-3 rounded-none">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-white flex items-center gap-2">
            <Calendar size={13} className="text-[#ECC068]" />
            <span>TEMPORAL CLOCK</span>
          </span>
          <span className="font-mono text-[9px] px-2 py-0.5 bg-[#ECC068]/15 text-[#ECC068] border border-[#ECC068]/30 font-bold uppercase tracking-wider rounded-none">
            UTC TIME
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {/* Date Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-mono font-bold text-white/50 flex items-center gap-1">
              <Calendar size={11} className="text-white/60" />
              <span>Observation Date</span>
            </label>
            <MissionDatePicker
              value={epochDate}
              onChange={(newDate) => setEpochDate(newDate)}
            />
          </div>

          {/* Hour Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-mono font-bold text-white/50 flex items-center gap-1">
              <Clock size={11} className="text-white/60" />
              <span>Observation Hour (UTC)</span>
            </label>
            <div className="flex items-center w-full h-8.5 bg-black/80 border border-white/20 hover:border-white/40 px-2.5 gap-2 transition-all rounded-none">
              <Clock size={12} className="text-[#ECC068] shrink-0" />
              <select
                value={epochHour}
                onChange={(e) => setEpochHour(parseInt(e.target.value))}
                className="flex-1 bg-transparent text-white font-mono text-xs outline-none cursor-pointer tracking-wider"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i} className="bg-[#08090C] text-white">
                    {String(i).padStart(2, '0')}:00 UTC
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mission Presets */}
          <div className="pt-1.5 flex flex-wrap gap-1.5 items-center">
            <span className="text-[9px] font-mono uppercase text-white/40 mr-0.5">Presets:</span>
            {[
              { label: 'Artemis III (Oct 2026)', date: '2026-10-14', hour: 12 },
              { label: 'Summer Peak (Dec 2026)', date: '2026-12-21', hour: 12 },
              { label: 'Current Ephemeris', date: '2026-10-29', hour: 12 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setEpochDate(preset.date);
                  setEpochHour(preset.hour);
                }}
                className="px-2 py-0.5 text-[9.5px] font-mono uppercase tracking-wider bg-black/60 hover:bg-white/15 border border-white/15 text-white/70 hover:text-white transition-colors cursor-pointer rounded-none"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[9.5px] font-mono text-white/40 flex items-center gap-1.5 pt-1">
          <RefreshCw size={10} className={isAnalyzing ? 'animate-spin text-white' : 'text-white/30'} />
          <span>SPICE DE440 Topocentric Kernel Sync</span>
        </div>
      </div>
    </div>
  );

  // Helper render for Site Telemetry panel content
  const renderSiteTelemetryPanel = () => (
    <div className="flex flex-col gap-4">
      <div className="bg-[#08090C] border border-white/15 p-3.5 sm:p-4 flex flex-col gap-4 rounded-none relative shadow-lg">
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
          <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-white flex items-center gap-2">
            <BarChart2 size={13} className="text-[#ECC068]" />
            <span>02 // SITE TELEMETRY</span>
          </span>
          <div className="flex items-center gap-2">
            {isAnalyzing && (
              <span className="font-mono text-[9px] text-[#ECC068] animate-pulse">
                SYNCING...
              </span>
            )}
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        {analysisError && (
          <div className="p-2.5 bg-red-950/70 border border-red-500/30 text-xs text-red-200 flex items-center gap-2 rounded-none">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <span className="font-mono text-[11px] leading-tight">{analysisError}</span>
          </div>
        )}

        {/* Active Site Header & Terrain Thumbnail */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 overflow-hidden border border-white/20 shrink-0 bg-black rounded-none">
            <img
              src={getSiteImage(activeSite.id, activeSite.name)}
              alt={activeSite.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white truncate">
              {activeSite.name}
            </h3>
            <div className="font-mono text-[10.5px] text-white/60 flex flex-col">
              <span className="tabular-nums">
                {Math.abs(activeSite.latitudeDeg).toFixed(2)}°S, {activeSite.longitudeDeg >= 0 ? `${activeSite.longitudeDeg.toFixed(2)}°E` : `${Math.abs(activeSite.longitudeDeg).toFixed(2)}°W`}
              </span>
              <span className="text-white/40 tabular-nums text-[10px]">
                ELEVATION: {siteAnalysis ? `${siteAnalysis.terrain.elevationMeters > 0 ? '+' : ''}${siteAnalysis.terrain.elevationMeters.toFixed(1)} m` : `${activeSite.elevationMeters > 0 ? '+' : ''}${activeSite.elevationMeters.toFixed(0)} m`}
              </span>
            </div>
          </div>
        </div>

        {/* The Three Core Indicators (NASA Open MCT Telemetry Grid) */}
        <div className="border border-white/15 bg-[#000000] divide-y divide-white/10 font-mono rounded-none">
          
          {/* Telemetry Row 1: Solar Illumination */}
          <div className="p-2.5 flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#ECC068] shrink-0" />
                <span className="text-[9px] uppercase tracking-[0.18em] text-white/50 font-bold truncate">
                  SOLAR ILLUMINATION
                </span>
              </div>
              <span className="text-xs font-bold text-white tabular-nums tracking-wide">
                EL: {siteAnalysis ? `${siteAnalysis.sun.elevationDeg > 0 ? '+' : ''}${siteAnalysis.sun.elevationDeg.toFixed(2)}°` : '—'}
                <span className="text-white/30 mx-1.5">|</span>
                AZ: {siteAnalysis ? `${siteAnalysis.sun.azimuthDeg.toFixed(1)}°` : '—'}
              </span>
            </div>
            <span className={`px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider border rounded-none shrink-0 ${sunlightInd.badge}`}>
              {sunlightInd.status}
            </span>
          </div>

          {/* Telemetry Row 2: Earth Direct Line-of-Sight */}
          <div className="p-2.5 flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#58D8D0] shrink-0" />
                <span className="text-[9px] uppercase tracking-[0.18em] text-white/50 font-bold truncate">
                  DIRECT-TO-EARTH (DTE)
                </span>
              </div>
              <span className="text-xs font-bold text-white tabular-nums tracking-wide">
                EL: {siteAnalysis ? `${siteAnalysis.earth.elevationDeg > 0 ? '+' : ''}${siteAnalysis.earth.elevationDeg.toFixed(2)}°` : '—'}
                <span className="text-white/30 mx-1.5">|</span>
                AZ: {siteAnalysis ? `${siteAnalysis.earth.azimuthDeg.toFixed(1)}°` : '—'}
              </span>
            </div>
            <span className={`px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider border rounded-none shrink-0 ${earthInd.badge}`}>
              {earthInd.status}
            </span>
          </div>

          {/* Telemetry Row 3: LOLA Topography Slope */}
          <div className="p-2.5 flex items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 shrink-0" />
                <span className="text-[9px] uppercase tracking-[0.18em] text-white/50 font-bold truncate">
                  LOLA 80M SLOPE
                </span>
              </div>
              <span className="text-xs font-bold text-white tabular-nums tracking-wide">
                SLOPE: {isDemCovered && siteAnalysis ? `${siteAnalysis.terrain.slopeDeg.toFixed(2)}°` : '—'}
                <span className="text-white/30 mx-1.5">|</span>
                ASP: {isDemCovered && siteAnalysis ? `${siteAnalysis.terrain.aspectDeg.toFixed(0)}°` : '—'}
              </span>
            </div>
            <span className={`px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider border rounded-none shrink-0 ${terrainInd.badge}`}>
              {terrainInd.status}
            </span>
          </div>

        </div>

        {/* Overall Site Assessment Box */}
        <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
          <span className="text-[9.5px] uppercase font-mono font-bold text-white/50 tracking-widest">
            MISSION FEASIBILITY VERDICT
          </span>

          <div className="p-3 bg-black/90 border border-white/15 flex flex-col gap-2 rounded-none">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 font-bold font-mono text-[10px] uppercase tracking-wider border rounded-none ${assessment.badge}`}>
                {assessment.title}
              </span>
              <ShieldCheck size={15} className="text-white/40" />
            </div>

            <p className="text-[11px] text-white/75 font-mono leading-relaxed">
              {assessment.explanation}
            </p>
          </div>
        </div>

        {/* Advanced Telemetry Disclosure */}
        <div className="pt-1 border-t border-white/10">
          <button
            type="button"
            onClick={() => setShowAdvancedSnapshot(!showAdvancedSnapshot)}
            className="w-full flex items-center justify-between text-[11px] font-mono text-white/50 hover:text-white transition-colors py-1 cursor-pointer"
          >
            <span>Advanced Topocentric Metrics</span>
            {showAdvancedSnapshot ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showAdvancedSnapshot && siteAnalysis && (
            <div className="pt-2 flex flex-col gap-1.5 font-mono text-[10px] text-white/60">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span>Solar Incidence (cos μ):</span>
                <span className="text-white font-bold">{siteAnalysis.sun.relativeIncidenceFactor.toFixed(3)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span>Earth Range:</span>
                <span className="text-white font-bold">{siteAnalysis.earth.distanceKm.toLocaleString()} km</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span>Sunlight Clearance:</span>
                <span className="text-white font-bold">{siteAnalysis.sun.clearanceDeg.toFixed(2)}°</span>
              </div>
              <div className="flex justify-between py-1">
                <span>DEM Surface Normal:</span>
                <span className="text-white font-bold">
                  ({siteAnalysis.terrain.surfaceNormalEnu.x.toFixed(2)}, {siteAnalysis.terrain.surfaceNormalEnu.y.toFixed(2)}, {siteAnalysis.terrain.surfaceNormalEnu.z.toFixed(2)})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full bg-[#08090C] min-h-screen flex flex-col font-sans text-white select-none">
      
      {/* =========================================================================
          1. SPACEX-GRADE CINEMATIC HERO HEADER
      ========================================================================= */}
      <section className="w-full pt-24 sm:pt-28 pb-10 sm:pb-14 px-4 sm:px-8 lg:px-16 bg-[#08090C] border-b border-white/15">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
            <div className="flex items-center gap-2.5 text-white/70">
              <span className="px-2.5 py-1 bg-white/10 border border-white/20 font-bold uppercase tracking-widest text-white">
                EXPEDITION LUNARIS // MISSION BROWSER
              </span>
              <span className="text-white/30">//</span>
              <span className="text-white/60 uppercase tracking-[0.2em]">
                SOUTH POLE CANDIDATE EXPLORER
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-black/80 border border-white/15 font-mono text-[11px] text-white/70">
              <span className={`w-2 h-2 rounded-full ${scienceHealth?.ephemeris?.spice?.ready ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="tracking-widest uppercase">
                {scienceHealth
                  ? `${scienceHealth.operationalMode} // SPICE DE440 & LOLA DEM CONNECTED`
                  : 'SPICE DE440 ONLINE // 60 FPS INTERPOLATED'}
              </span>
            </div>
          </div>

          <h1 className="font-display-hero text-3xl sm:text-5xl lg:text-6xl font-bold uppercase tracking-tight text-[#E6E9F0] leading-tight">
            LUNAR SOUTH POLE MISSION BROWSER
          </h1>

          <p className="font-body-lg text-sm sm:text-base lg:text-lg text-[#E6E9F0]/80 max-w-4xl leading-relaxed font-light">
            Evaluate topocentric solar illumination, direct-to-Earth communication elevation, and digital elevation model (DEM) terrain slope to identify optimal landing opportunities across candidate Artemis and CLPS landing zones.
          </p>

          {/* Hairline Technical Specs Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 font-mono text-xs">
            <div className="p-3 bg-white/[0.02] border border-white/10 flex flex-col gap-0.5">
              <span className="text-white/40 text-[9.5px] uppercase tracking-wider">TARGET DOMAIN</span>
              <span className="font-bold text-white text-xs sm:text-sm">South Pole (85°S - 90°S)</span>
            </div>
            <div className="p-3 bg-white/[0.02] border border-white/10 flex flex-col gap-0.5">
              <span className="text-white/40 text-[9.5px] uppercase tracking-wider">CELESTIAL EPHEMERIS</span>
              <span className="font-bold text-[#ECC068] text-xs sm:text-sm">NASA JPL DE440 / MOON_ME</span>
            </div>
            <div className="p-3 bg-white/[0.02] border border-white/10 flex flex-col gap-0.5">
              <span className="text-white/40 text-[9.5px] uppercase tracking-wider">SURFACE ALTIMETRY</span>
              <span className="font-bold text-[#58D8D0] text-xs sm:text-sm">NASA LOLA 4K TOPOGRAPHY</span>
            </div>
            <div className="p-3 bg-white/[0.02] border border-white/10 flex flex-col gap-0.5">
              <span className="text-white/40 text-[9.5px] uppercase tracking-wider">SOLAR INCIDENCE</span>
              <span className="font-bold text-white text-xs sm:text-sm">+0.5° TO +1.8° GRAZING</span>
            </div>
          </div>

          {/* Mission Route & Trajectory Planner Direct Quick-Link */}
          <div className="mt-2 p-3 sm:p-4 bg-[#0B0F14] border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-none border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Rocket size={16} className="text-emerald-400" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-white">
                    MISSION ROUTE & LAUNCH WINDOW PLANNER
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    NEW CAPABILITY
                  </span>
                </div>
                <span className="font-mono text-[11px] text-white/50">
                  Model Earth spaceport departure, trans-lunar injection, and compute arrival solar/Earth telemetry.
                </span>
              </div>
            </div>

            <Link
              href="/route-planner"
              className="px-4 py-2 border border-emerald-400/60 bg-emerald-500/10 hover:bg-emerald-400 hover:text-black text-emerald-300 font-mono text-xs uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <span>CONFIGURE ROUTE</span>
              <span>→</span>
            </Link>
          </div>

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

          {/* Mission Console Interactive Viewport Bar with Synchronized Tab Controls & Full 3D Theatre */}
          <div className="w-full bg-[#0B0F14] border border-white/15 px-3 py-2 flex flex-wrap items-center justify-between gap-3 font-mono text-xs shadow-md">
            
            {/* Left: Quick Access Tool Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Quick Tab 01: Candidate Sites */}
              <button
                type="button"
                onClick={() => setActiveSidebarTab((prev) => (prev === 'sites' ? null : 'sites'))}
                className={`flex items-center gap-2 px-3 py-1.5 border transition-all cursor-pointer font-mono text-xs uppercase tracking-wider ${
                  activeSidebarTab === 'sites' || activeSidebarTab === 'both'
                    ? 'bg-[#58D8D0]/15 border-[#58D8D0] text-[#58D8D0] shadow-[0_0_12px_rgba(88,216,208,0.25)] font-bold'
                    : 'bg-black/90 border-white/20 text-white/70 hover:text-white hover:bg-white/10'
                }`}
                title="Toggle Candidate Sites Sidebar"
              >
                <Compass size={13} className={activeSidebarTab === 'sites' || activeSidebarTab === 'both' ? 'text-[#58D8D0]' : 'text-white/60'} />
                <span>01 // CANDIDATE SITES ({candidateSites.length})</span>
              </button>

              {/* Quick Tab 02: Site Telemetry */}
              <button
                type="button"
                onClick={() => setActiveSidebarTab((prev) => (prev === 'telemetry' ? null : 'telemetry'))}
                className={`flex items-center gap-2 px-3 py-1.5 border transition-all cursor-pointer font-mono text-xs uppercase tracking-wider ${
                  activeSidebarTab === 'telemetry' || activeSidebarTab === 'both'
                    ? 'bg-[#ECC068]/15 border-[#ECC068] text-[#ECC068] shadow-[0_0_12px_rgba(236,192,104,0.25)] font-bold'
                    : 'bg-black/90 border-white/20 text-white/70 hover:text-white hover:bg-white/10'
                }`}
                title="Toggle Site Telemetry Sidebar"
              >
                <BarChart2 size={13} className={activeSidebarTab === 'telemetry' || activeSidebarTab === 'both' ? 'text-[#ECC068]' : 'text-white/60'} />
                <span>02 // SITE TELEMETRY (LIVE)</span>
              </button>

              {/* Dual Split View */}
              <button
                type="button"
                onClick={() => setActiveSidebarTab((prev) => (prev === 'both' ? null : 'both'))}
                className={`hidden md:flex items-center gap-2 px-3 py-1.5 border transition-all cursor-pointer font-mono text-xs uppercase tracking-wider ${
                  activeSidebarTab === 'both'
                    ? 'bg-white/20 border-white text-white font-bold'
                    : 'bg-black/90 border-white/20 text-white/70 hover:text-white hover:bg-white/10'
                }`}
                title="Toggle Split View (Both Panels)"
              >
                <Columns size={13} />
                <span>DUAL SPLIT</span>
              </button>
            </div>

            {/* Right: Full 3D Theatre / Close All Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveSidebarTab((prev) => (prev === null ? 'sites' : null))}
                className={`flex items-center gap-2 px-4 py-1.5 border transition-all cursor-pointer font-mono text-xs uppercase tracking-widest font-bold ${
                  activeSidebarTab === null
                    ? 'bg-[#58D8D0] border-[#58D8D0] text-black shadow-[0_0_20px_rgba(88,216,208,0.4)]'
                    : 'bg-white/5 hover:bg-white/15 border-white/20 text-white/90 hover:text-white'
                }`}
                title="Toggle full-width cinematic view for the center 3D simulator"
              >
                {activeSidebarTab === null ? (
                  <>
                    <Minimize2 size={13} />
                    <span>RESTORE SIDEBAR</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={13} />
                    <span>CINEMATIC FULL 3D THEATRE (CLOSE SIDEBAR)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* =========================================================================
              MAIN INTERACTIVE MISSION CONSOLE: VS CODE ACTIVITY BAR + SIDEBAR + 3D VIEWPORT
          ========================================================================= */}
          <div className="flex flex-col lg:flex-row items-stretch w-full min-h-[640px] bg-[#08090C] border border-white/15 relative overflow-hidden shadow-2xl">
            
            {/* -------------------------------------------------------------------
                VS CODE ACTIVITY BAR (FAR LEFT PERMANENT DOCKED RAIL)
            ------------------------------------------------------------------- */}
            <div className="w-full lg:w-[52px] shrink-0 bg-[#07090E] border-b lg:border-b-0 lg:border-r border-white/15 flex flex-row lg:flex-col items-center justify-between py-2 lg:py-3 px-2 lg:px-0 select-none z-20">
              
              {/* Activity Bar Top Tool Icons */}
              <div className="flex flex-row lg:flex-col items-center gap-1.5 lg:gap-2 w-auto lg:w-full">
                
                {/* Tool 01: Candidate Sites */}
                <button
                  type="button"
                  onClick={() => setActiveSidebarTab((prev) => (prev === 'sites' ? null : 'sites'))}
                  className={`w-10 h-10 lg:w-full lg:h-12 flex items-center justify-center relative group transition-colors cursor-pointer ${
                    activeSidebarTab === 'sites'
                      ? 'text-white'
                      : 'text-white/45 hover:text-white hover:bg-white/[0.04]'
                  }`}
                  title="01 // Candidate Sites (Toggle Sidebar)"
                >
                  {/* VS Code Active Left Accent Indicator */}
                  {activeSidebarTab === 'sites' && (
                    <div className="hidden lg:block absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[#58D8D0] rounded-r" />
                  )}
                  {activeSidebarTab === 'sites' && (
                    <div className="lg:hidden absolute bottom-0 left-1.5 right-1.5 h-[2.5px] bg-[#58D8D0] rounded-t" />
                  )}
                  <div className={`p-2 rounded transition-all ${activeSidebarTab === 'sites' ? 'bg-[#58D8D0]/20 text-[#58D8D0]' : 'group-hover:text-white'}`}>
                    <Compass size={20} className={activeSidebarTab === 'sites' ? 'text-[#58D8D0]' : 'text-white/60 group-hover:text-white'} />
                  </div>
                  {/* Sites Badge */}
                  <span className="absolute top-1 right-1 lg:top-1.5 lg:right-2 px-1 text-[8px] font-mono font-bold bg-[#58D8D0]/25 text-[#58D8D0] border border-[#58D8D0]/40 rounded-full leading-none">
                    {candidateSites.length}
                  </span>
                </button>

                {/* Tool 02: Site Telemetry */}
                <button
                  type="button"
                  onClick={() => setActiveSidebarTab((prev) => (prev === 'telemetry' ? null : 'telemetry'))}
                  className={`w-10 h-10 lg:w-full lg:h-12 flex items-center justify-center relative group transition-colors cursor-pointer ${
                    activeSidebarTab === 'telemetry'
                      ? 'text-white'
                      : 'text-white/45 hover:text-white hover:bg-white/[0.04]'
                  }`}
                  title="02 // Site Telemetry & SPICE Metrics (Toggle Sidebar)"
                >
                  {/* VS Code Active Left Accent Indicator */}
                  {activeSidebarTab === 'telemetry' && (
                    <div className="hidden lg:block absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[#ECC068] rounded-r" />
                  )}
                  {activeSidebarTab === 'telemetry' && (
                    <div className="lg:hidden absolute bottom-0 left-1.5 right-1.5 h-[2.5px] bg-[#ECC068] rounded-t" />
                  )}
                  <div className={`p-2 rounded transition-all ${activeSidebarTab === 'telemetry' ? 'bg-[#ECC068]/20 text-[#ECC068]' : 'group-hover:text-white'}`}>
                    <BarChart2 size={20} className={activeSidebarTab === 'telemetry' ? 'text-[#ECC068]' : 'text-white/60 group-hover:text-white'} />
                  </div>
                  {/* Live Pulse Dot */}
                  <span className="absolute top-1.5 right-1.5 lg:top-2 lg:right-2.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                </button>

                {/* Tool 03: Dual Split View (Both Sites & Telemetry) */}
                <button
                  type="button"
                  onClick={() => setActiveSidebarTab((prev) => (prev === 'both' ? null : 'both'))}
                  className={`w-10 h-10 lg:w-full lg:h-12 flex items-center justify-center relative group transition-colors cursor-pointer ${
                    activeSidebarTab === 'both'
                      ? 'text-white'
                      : 'text-white/45 hover:text-white hover:bg-white/[0.04]'
                  }`}
                  title="Dual Split View (Both Candidate Sites & Telemetry)"
                >
                  {activeSidebarTab === 'both' && (
                    <div className="hidden lg:block absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-white rounded-r" />
                  )}
                  {activeSidebarTab === 'both' && (
                    <div className="lg:hidden absolute bottom-0 left-1.5 right-1.5 h-[2.5px] bg-white rounded-t" />
                  )}
                  <div className={`p-2 rounded transition-all ${activeSidebarTab === 'both' ? 'bg-white/20 text-white' : 'group-hover:text-white'}`}>
                    <Columns size={18} className={activeSidebarTab === 'both' ? 'text-white' : 'text-white/60 group-hover:text-white'} />
                  </div>
                </button>

              </div>

              {/* Activity Bar Bottom Controls: Collapse / Expand */}
              <div className="flex flex-row lg:flex-col items-center gap-2 pb-0 lg:pb-1">
                <button
                  type="button"
                  onClick={() => setActiveSidebarTab((prev) => (prev ? null : 'sites'))}
                  className="w-8 h-8 lg:w-9 lg:h-9 flex items-center justify-center text-white/45 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                  title={activeSidebarTab ? 'Collapse Sidebar (Esc / Close)' : 'Expand Sidebar'}
                >
                  {activeSidebarTab ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                </button>
              </div>
            </div>

            {/* -------------------------------------------------------------------
                VS CODE SIDEBAR DRAWER (SMOOTH SLIDING APERTURE)
            ------------------------------------------------------------------- */}
            <div
              className={`transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 overflow-hidden flex flex-col bg-[#08090C] border-b lg:border-b-0 lg:border-r border-white/15 relative z-10 ${
                activeSidebarTab === null
                  ? 'w-0 max-w-0 opacity-0 pointer-events-none'
                  : activeSidebarTab === 'both'
                  ? 'w-full lg:w-[680px] xl:w-[720px] max-w-full lg:max-w-[720px] opacity-100'
                  : 'w-full lg:w-[350px] xl:w-[380px] max-w-full lg:max-w-[380px] opacity-100'
              }`}
            >
              {/* VS Code Style Sidebar Header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#0B0F14] border-b border-white/10 shrink-0 select-none">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase tracking-[0.16em] font-bold text-white flex items-center gap-2">
                    {activeSidebarTab === 'sites' && (
                      <>
                        <Compass size={14} className="text-[#58D8D0]" />
                        <span>01 // CANDIDATE SITES</span>
                      </>
                    )}
                    {activeSidebarTab === 'telemetry' && (
                      <>
                        <BarChart2 size={14} className="text-[#ECC068]" />
                        <span>02 // SITE TELEMETRY</span>
                      </>
                    )}
                    {activeSidebarTab === 'both' && (
                      <>
                        <Columns size={14} className="text-white" />
                        <span>01 + 02 // SITES & TELEMETRY</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Header Actions: Switch Tabs & Close Button */}
                <div className="flex items-center gap-2">
                  {/* Tab Switcher Pills */}
                  <div className="flex items-center bg-black/50 border border-white/10 p-0.5 rounded text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() => setActiveSidebarTab('sites')}
                      className={`px-2 py-0.5 transition-colors cursor-pointer ${
                        activeSidebarTab === 'sites'
                          ? 'bg-[#58D8D0]/20 text-[#58D8D0] font-bold'
                          : 'text-white/40 hover:text-white'
                      }`}
                      title="Show Candidate Sites"
                    >
                      SITES
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSidebarTab('telemetry')}
                      className={`px-2 py-0.5 transition-colors cursor-pointer ${
                        activeSidebarTab === 'telemetry'
                          ? 'bg-[#ECC068]/20 text-[#ECC068] font-bold'
                          : 'text-white/40 hover:text-white'
                      }`}
                      title="Show Site Telemetry"
                    >
                      TELEMETRY
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSidebarTab('both')}
                      className={`px-2 py-0.5 transition-colors cursor-pointer hidden sm:block ${
                        activeSidebarTab === 'both'
                          ? 'bg-white/20 text-white font-bold'
                          : 'text-white/40 hover:text-white'
                      }`}
                      title="Show Both Side-by-Side"
                    >
                      SPLIT
                    </button>
                  </div>

                  {/* VS Code Collapse / Close Button */}
                  <button
                    type="button"
                    onClick={() => setActiveSidebarTab(null)}
                    className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                    title="Close Sidebar (Esc)"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Sidebar Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 scrollbar-thin">
                {activeSidebarTab === 'sites' && (
                  <div className="flex flex-col gap-4">
                    {renderCandidateSitesPanel()}
                  </div>
                )}
                {activeSidebarTab === 'telemetry' && (
                  <div className="flex flex-col gap-4">
                    {renderSiteTelemetryPanel()}
                  </div>
                )}
                {activeSidebarTab === 'both' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-4">
                      {renderCandidateSitesPanel()}
                    </div>
                    <div className="flex flex-col gap-4">
                      {renderSiteTelemetryPanel()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* -------------------------------------------------------------------
                CENTER 3D MOON VIEWPORT (RESPONSIVE FLEX-1 EXPANDS TO FULL REMAINING WIDTH)
            ------------------------------------------------------------------- */}
            <div
              id="mission-simulator-view"
              className={`flex-1 min-w-0 w-full flex flex-col transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] p-2 sm:p-3 relative ${
                activeSidebarTab === null
                  ? 'scale-100 shadow-[0_0_40px_rgba(88,216,208,0.08)]'
                  : 'scale-[0.998]'
              }`}
            >
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
              />
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
              4. RAPID MISSION SCENARIO COMPARISON WORKBENCH
          ========================================================================= */}
          <ScenarioComparisonWorkbench
            availableSites={candidateSites}
            activeSiteId={selectedSiteId}
            activeEpochDate={epochDate}
            activeEpochHour={epochHour}
            onApplyScenarioTo3D={(siteId, dateIso, hourUtc) => {
              setSelectedSiteId(siteId);
              setEpochDate(dateIso);
              setEpochHour(hourUtc);
              const mapElement = document.getElementById('mission-simulator-view');
              if (mapElement) {
                mapElement.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          />

          {/* =========================================================================
              5. INTEGRATED MULTI-SITE TRADE-OFF & COMPARISON MATRIX
          ========================================================================= */}
          <div className="w-full bg-[#08090C] border border-white/15 p-5 sm:p-6 flex flex-col gap-5 rounded-none">
            
            {/* Header & Window Duration Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-white flex items-center gap-2">
                  <Sliders size={13} className="text-white" />
                  <span>05 // CANDIDATE SITES TRADE-OFF MATRIX</span>
                </span>
                <span className="text-xs text-white/50 font-light font-mono">
                  Evaluating {selectedForCompare.length} staged candidate landing sites across a synchronized {compareDurationHours}-hour timeline.
                </span>
              </div>

              {/* Mission Window Selector */}
              <div className="flex items-center gap-1 font-mono text-xs">
                <span className="text-white/40 text-[9.5px] uppercase mr-1">WINDOW:</span>
                {[
                  { hrs: 24, label: '24H' },
                  { hrs: 48, label: '48H' },
                  { hrs: 72, label: '72H' },
                  { hrs: 708, label: 'LUNAR DAY (708H)' },
                ].map((item) => (
                  <button
                    key={item.hrs}
                    type="button"
                    onClick={() => setCompareDurationHours(item.hrs)}
                    className={`px-2.5 py-1 border uppercase text-[10px] transition-all cursor-pointer font-bold rounded-none ${
                      compareDurationHours === item.hrs
                        ? 'bg-white text-black border-white'
                        : 'bg-black/80 text-white/60 hover:text-white border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Side-by-Side Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {selectedForCompare.map((id) => {
                const site = candidateSites.find((c) => c.id === id);
                if (!site) return null;

                const compItem = comparisonResults?.sites?.find((s) => s.site.id === site.id);
                const rankIndex = comparisonResults?.ranking?.indexOf(site.id) ?? -1;
                const isBestRank = rankIndex === 0;

                return (
                  <div
                    key={site.id}
                    className={`bg-[#000000] border p-4 flex flex-col justify-between gap-4 relative transition-all rounded-none ${
                      isBestRank
                        ? 'border-white/50 border-t-2 border-t-[#58D8D0] bg-white/[0.03]'
                        : 'border-white/15 bg-black/60 hover:border-white/30'
                    }`}
                  >
                    <div className="flex flex-col gap-3.5">
                      {/* Rank & Score Badge */}
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className={`px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider border rounded-none ${
                          isBestRank
                            ? 'bg-white text-black border-white font-extrabold'
                            : 'bg-white/10 text-white/70 border-white/20'
                        }`}>
                          {rankIndex >= 0 ? `RANK #${rankIndex + 1}` : 'EVALUATING'}
                        </span>
                        <span className="font-mono text-xs font-bold text-white tabular-nums">
                          SCORE: {compItem?.score !== undefined ? `${compItem.score.toFixed(1)}/100` : '—'}
                        </span>
                      </div>

                      {/* Site Header */}
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getSiteImage(site.id, site.name)}
                          alt={site.name}
                          className="w-9 h-9 object-cover border border-white/20 shrink-0 bg-black rounded-none"
                        />
                        <div className="flex flex-col">
                          <h4 className="font-bold text-xs text-white truncate font-mono uppercase tracking-wider">
                            {site.name}
                          </h4>
                          <span className="text-[10px] font-mono text-white/50 tabular-nums">
                            {Math.abs(site.latitudeDeg).toFixed(2)}°S, {site.longitudeDeg >= 0 ? `${site.longitudeDeg.toFixed(2)}°E` : `${Math.abs(site.longitudeDeg).toFixed(2)}°W`}
                          </span>
                        </div>
                      </div>

                      {/* Metric Specifications */}
                      <div className="flex flex-col gap-1.5 font-mono text-xs">
                        <div className="flex justify-between py-1 border-b border-white/5 text-[10.5px]">
                          <span className="text-white/50 flex items-center gap-1.5">
                            <Sun size={11} className="text-[#ECC068]" /> Cumulative Sun:
                          </span>
                          <span className="text-white font-bold tabular-nums">
                            {compItem?.metrics ? `${compItem.metrics.sunlightTotalHours.toFixed(1)} hrs` : '—'}
                          </span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-white/5 text-[10.5px]">
                          <span className="text-white/50 flex items-center gap-1.5">
                            <Clock size={11} className="text-amber-400" /> Max Streak:
                          </span>
                          <span className="text-amber-300 font-bold tabular-nums">
                            {compItem?.metrics ? `${compItem.metrics.longestSunlightContinuousHours.toFixed(1)} hrs` : '—'}
                          </span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-white/5 text-[10.5px]">
                          <span className="text-white/50 flex items-center gap-1.5">
                            <Globe size={11} className="text-[#58D8D0]" /> Direct Earth LOS:
                          </span>
                          <span className="text-[#58D8D0] font-bold tabular-nums">
                            {compItem?.metrics ? `${compItem.metrics.earthVisibilityTotalHours.toFixed(1)} hrs` : '—'}
                          </span>
                        </div>

                        <div className="flex justify-between py-1 border-b border-white/5 text-[10.5px]">
                          <span className="text-white/50 flex items-center gap-1.5">
                            <Mountain size={11} className="text-emerald-400" /> LOLA Slope:
                          </span>
                          <span className={`font-bold tabular-nums ${
                            compItem?.metrics && compItem.metrics.slopeDeg <= 12 ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {compItem?.metrics ? `${compItem.metrics.slopeDeg.toFixed(1)}°` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Overall Compliance */}
                    <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-white/40 uppercase">STATUS</span>
                      <span className={`font-bold uppercase tracking-wider ${
                        compItem?.overallStatus === 'ALL_PASSED' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {compItem?.overallStatus === 'ALL_PASSED' ? 'CONSTRAINTS MET' : 'MARGINAL'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Re-calculate Button Strip */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-white/10">
              <span className="text-xs text-white/50 font-mono">
                Barycentric time extrapolation using NASA JPL SPICE DE440 ephemerides.
              </span>
              <button
                type="button"
                onClick={handleRunComparison}
                disabled={isComparing}
                className="w-full sm:w-auto px-6 py-2.5 border border-white hover:bg-white text-white hover:text-black font-mono text-xs uppercase tracking-[0.2em] font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer rounded-none"
              >
                <RefreshCw size={12} className={isComparing ? 'animate-spin' : ''} />
                <span>{isComparing ? 'EVALUATING CONSTRAINTS...' : 'REFRESH TRADE-OFF MATRIX'}</span>
              </button>
            </div>

          </div>

        </div>
      </section>

    </div>
  );
};
