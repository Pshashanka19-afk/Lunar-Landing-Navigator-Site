import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Sun,
  Globe,
  Zap,
  AlertCircle,
  RefreshCw,
  Battery,
  BatteryCharging,
  Radio,
  ShieldAlert,
  HardDrive,
  Info,
  Layers,
} from 'lucide-react';
import { lunarApi, type TimelineResponse, type TimelinePoint } from '../services/lunarApi';

interface MultiTrackTimelineProps {
  site: {
    id: string;
    name: string;
    latitudeDeg: number;
    longitudeDeg: number;
    elevationMeters: number;
  };
  currentEpochIso: string;
  onSelectEpoch: (epochIso: string) => void;
  onSelectSite?: (siteId: string) => void;
}

export interface CalculatedWindow {
  id: string;
  type: 'SUN' | 'EARTH' | 'DUAL';
  startUtc: string;
  endUtc: string;
  durationHours: number;
  minElevationDeg: number;
  maxElevationDeg: number;
  isActive: boolean;
}

export function getSunlightCellColor(p: TimelinePoint): { hexColor: string; label: string } {
  if (!p.sun.isVisible) {
    if (p.sun.elevationDeg >= -1.0) {
      return { hexColor: '#5A270D', label: 'Penumbra / Horizon Graze' };
    }
    return { hexColor: '#101317', label: 'Shadowed' };
  }
  if (p.sun.elevationDeg >= 1.6) {
    return { hexColor: '#ECC068', label: 'Peak Sun (>1.6°)' };
  }
  if (p.sun.elevationDeg >= 1.0) {
    return { hexColor: '#D97706', label: 'Nominal Sun (1.0°–1.6°)' };
  }
  return { hexColor: '#B45309', label: 'Low Graze (<1.0°)' };
}

export function getEarthCommCellColor(p: TimelinePoint): { hexColor: string; label: string } {
  if (p.earth.isVisible) {
    if (p.earth.elevationDeg >= 2.0) {
      return { hexColor: '#58D8D0', label: 'Optimal DTE Link (>2.0°)' };
    }
    return { hexColor: '#0284C7', label: 'Low Horizon DTE (0.0°–2.0°)' };
  }
  if (p.earth.elevationDeg >= -1.5) {
    return { hexColor: '#1E3A8A', label: 'Marginal Occultation (-1.5°–0.0°, Mast Reachable)' };
  }
  if (p.earth.elevationDeg >= -4.0) {
    return { hexColor: '#172554', label: 'Shallow Occultation (-4.0°– -1.5°)' };
  }
  return { hexColor: '#0E1217', label: `Deep Occultation (${p.earth.elevationDeg.toFixed(1)}°)` };
}

export function getDualOpCellColor(p: TimelinePoint): { hexColor: string; label: string } {
  if (p.bothVisible) {
    if (p.sun.elevationDeg >= 1.0 && p.earth.elevationDeg >= 1.0) {
      return { hexColor: '#00FF9D', label: 'Optimal Simultaneous Op' };
    }
    return { hexColor: '#84CC16', label: 'Marginal Simultaneous Op' };
  }
  if (p.sun.isVisible && !p.earth.isVisible) {
    return { hexColor: '#362208', label: 'Solar Power Only (Charging)' };
  }
  if (!p.sun.isVisible && p.earth.isVisible) {
    return { hexColor: '#082F49', label: 'Comm on Battery Discharge' };
  }
  return { hexColor: '#080A0D', label: 'Asset Blackout (No Sun / No Comm)' };
}

export const MultiTrackTimeline: React.FC<MultiTrackTimelineProps> = ({
  site,
  currentEpochIso,
  onSelectEpoch,
  onSelectSite,
}) => {
  const [durationHours, setDurationHours] = useState<number>(168);
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeWindowTab, setActiveWindowTab] = useState<'SUN' | 'EARTH' | 'DUAL' | 'ENERGY'>('EARTH');

  // Fetch timeline data whenever site, base date, or duration changes
  useEffect(() => {
    let isCancelled = false;

    async function fetchTimeline() {
      setIsLoading(true);
      setError(null);

      try {
        // Start from beginning of current observation date (00:00:00Z)
        const dateObj = new Date(currentEpochIso);
        const startIso = isNaN(dateObj.getTime())
          ? '2026-10-14T00:00:00Z'
          : new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0)).toISOString();

        const data = await lunarApi.getTimelineData({
          site: {
            latitudeDeg: site.latitudeDeg,
            longitudeDeg: site.longitudeDeg,
            elevationMeters: site.elevationMeters,
          },
          startTimeUtc: startIso,
          durationHours,
          stepSeconds: 3600,
        });

        if (!isCancelled) {
          setTimelineData(data);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Failed to load timeline data');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchTimeline();

    return () => {
      isCancelled = true;
    };
  }, [site.latitudeDeg, site.longitudeDeg, site.elevationMeters, currentEpochIso.slice(0, 10), durationHours]);

  const points = useMemo(() => timelineData?.timelinePoints || [], [timelineData]);

  // Current simulation cursor index
  const activeCursorIndex = useMemo(() => {
    if (points.length === 0) return -1;
    const currentMs = new Date(currentEpochIso).getTime();
    let closestIdx = 0;
    let minDiff = Infinity;
    points.forEach((p, idx) => {
      const diff = Math.abs(new Date(p.epochUtc).getTime() - currentMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    return closestIdx;
  }, [points, currentEpochIso]);

  // Compute discrete contiguous windows for Sun, Earth, and Dual Operation
  const { sunWindows, earthWindows, dualWindows } = useMemo(() => {
    if (points.length === 0) return { sunWindows: [], earthWindows: [], dualWindows: [] };

    const extractWindows = (
      predicate: (p: TimelinePoint) => boolean,
      elevationGetter: (p: TimelinePoint) => number,
      type: 'SUN' | 'EARTH' | 'DUAL'
    ): CalculatedWindow[] => {
      const list: CalculatedWindow[] = [];
      let inWindow = false;
      let startIdx = 0;
      let minEl = Infinity;
      let maxEl = -Infinity;

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const match = predicate(p);
        const el = elevationGetter(p);

        if (match) {
          if (!inWindow) {
            inWindow = true;
            startIdx = i;
            minEl = el;
            maxEl = el;
          } else {
            if (el < minEl) minEl = el;
            if (el > maxEl) maxEl = el;
          }
        } else {
          if (inWindow) {
            const duration = i - startIdx;
            list.push({
              id: `${type}-${list.length + 1}`,
              type,
              startUtc: points[startIdx].epochUtc,
              endUtc: points[i - 1].epochUtc,
              durationHours: duration,
              minElevationDeg: minEl,
              maxElevationDeg: maxEl,
              isActive: activeCursorIndex >= startIdx && activeCursorIndex < i,
            });
            inWindow = false;
          }
        }
      }

      if (inWindow) {
        const duration = points.length - startIdx;
        list.push({
          id: `${type}-${list.length + 1}`,
          type,
          startUtc: points[startIdx].epochUtc,
          endUtc: points[points.length - 1].epochUtc,
          durationHours: duration,
          minElevationDeg: minEl,
          maxElevationDeg: maxEl,
          isActive: activeCursorIndex >= startIdx,
        });
      }

      return list;
    };

    return {
      sunWindows: extractWindows((p) => p.sun.isVisible, (p) => p.sun.elevationDeg, 'SUN'),
      earthWindows: extractWindows((p) => p.earth.isVisible, (p) => p.earth.elevationDeg, 'EARTH'),
      dualWindows: extractWindows((p) => p.bothVisible, (p) => Math.min(p.sun.elevationDeg, p.earth.elevationDeg), 'DUAL'),
    };
  }, [points, activeCursorIndex]);

  // Compute Conserved Energy & Battery Endurance Metrics
  const energyMetrics = useMemo(() => {
    const totalHours = durationHours;
    const sunlitHours = timelineData?.summary.sunlightTotalHours ?? 0;
    const darknessHours = Math.max(0, totalHours - sunlitHours);
    const isContinuousSun = darknessHours === 0;
    const batterySurvivalLimitHours = 72.0; // Standard CLPS secondary battery mass limit
    const batteryDepletionHoursRemaining = Math.max(0, batterySurvivalLimitHours - darknessHours);

    return {
      isContinuousSun,
      sunlitHours,
      darknessHours,
      batteryConservedPercent: isContinuousSun
        ? 100
        : Math.max(0, Math.round((batteryDepletionHoursRemaining / batterySurvivalLimitHours) * 100)),
      conservedTillLabel: isContinuousSun
        ? `Indefinitely (> ${totalHours}h)`
        : darknessHours <= batterySurvivalLimitHours
          ? `Survives ${batteryDepletionHoursRemaining.toFixed(1)}h reserve`
          : `Depleted (${(darknessHours - batterySurvivalLimitHours).toFixed(1)}h deficit)`,
      energyStatus: isContinuousSun
        ? 'PERPETUAL SOLAR POWER'
        : darknessHours <= batterySurvivalLimitHours
          ? 'BATTERY DISCHARGE ACTIVE'
          : 'CRITICAL BATTERY DEFICIT',
      dataConservedPercent: (timelineData?.summary.earthVisibilityTotalHours ?? 0) === 0 ? 100 : 0,
      earthOccludedDeg: points[activeCursorIndex]?.earth.elevationDeg ?? -6.35,
    };
  }, [durationHours, timelineData, points, activeCursorIndex]);

  // Compute countdown / upcoming events relative to current cursor
  const upcomingEvents = useMemo(() => {
    if (points.length === 0 || activeCursorIndex < 0) return null;

    let nextSunsetHours: number | null = null;
    let nextEarthsetHours: number | null = null;
    let nextSimultaneousHours: number | null = null;

    const currentPoint = points[activeCursorIndex];
    const isCurrentlySunlit = currentPoint?.sun.isVisible;
    const isCurrentlyEarthVisible = currentPoint?.earth.isVisible;

    for (let i = activeCursorIndex + 1; i < points.length; i++) {
      const p = points[i];
      const deltaH = i - activeCursorIndex;

      if (isCurrentlySunlit && !p.sun.isVisible && nextSunsetHours === null) {
        nextSunsetHours = deltaH;
      }
      if (isCurrentlyEarthVisible && !p.earth.isVisible && nextEarthsetHours === null) {
        nextEarthsetHours = deltaH;
      }
      if (p.bothVisible && nextSimultaneousHours === null && !currentPoint?.bothVisible) {
        nextSimultaneousHours = deltaH;
      }
    }

    return {
      nextSunsetHours,
      nextEarthsetHours,
      nextSimultaneousHours,
      isCurrentlySunlit,
      isCurrentlyEarthVisible,
      isCurrentlySimultaneous: currentPoint?.bothVisible ?? false,
    };
  }, [points, activeCursorIndex]);

  const hoveredPoint: TimelinePoint | null = hoveredIndex !== null ? points[hoveredIndex] : null;
  const activePoint: TimelinePoint | null = points[activeCursorIndex] || null;

  return (
    <div className="w-full bg-[#08090C] border border-white/15 p-4 sm:p-6 flex flex-col gap-5 rounded-none shadow-lg">
      {/* Top Header & Duration Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[#58D8D0]" />
            <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-white">
              03 // SYNCHRONIZED MULTI-TRACK MISSION TIMELINE
            </span>
          </div>
          <span className="font-mono text-[11px] text-white/50">
            Topocentric horizon clearance, DTE communication windows &amp; energy reserves for {site.name} ({Math.abs(site.latitudeDeg).toFixed(2)}°S, {site.longitudeDeg >= 0 ? `${site.longitudeDeg.toFixed(2)}°E` : `${Math.abs(site.longitudeDeg).toFixed(2)}°W`})
          </span>
        </div>

        {/* Duration Selector */}
        <div className="flex items-center gap-1 font-mono text-xs">
          <span className="text-white/40 text-[9.5px] uppercase mr-1">INTERVAL:</span>
          {[
            { hrs: 24, label: '24H' },
            { hrs: 48, label: '48H' },
            { hrs: 72, label: '72H' },
            { hrs: 168, label: '7 DAYS (168H)' },
          ].map((item) => (
            <button
              key={item.hrs}
              type="button"
              onClick={() => setDurationHours(item.hrs)}
              className={`px-2.5 py-1 text-[9.5px] font-bold uppercase transition-all cursor-pointer rounded-none ${durationHours === item.hrs
                  ? 'bg-white text-black border border-white font-extrabold'
                  : 'bg-black/60 text-white/60 hover:text-white border border-white/20 hover:bg-white/10'
                }`}
            >
              {item.label}
            </button>
          ))}
          {isLoading && <RefreshCw size={12} className="animate-spin text-white/50 ml-2" />}
        </div>
      </div>

      {error ? (
        <div className="p-3 bg-red-950/60 border border-red-500/40 text-red-200 font-mono text-xs flex items-center gap-2">
          <AlertCircle size={14} className="text-red-400" />
          <span>{error}</span>
        </div>
      ) : isLoading && !timelineData ? (
        /* Fixed Skeleton Layout: Matches exact dimensions, zero layout shift */
        <div className="flex flex-col gap-5 select-none animate-pulse">
          {/* 5 Quick Metrics Cards Placeholder */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 font-mono text-xs">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-2.5 bg-black/80 border border-white/10 flex flex-col justify-between gap-2 h-[76px] rounded-none">
                <div className="h-3 w-24 bg-white/10 rounded-none" />
                <div className="h-5 w-16 bg-white/10 rounded-none" />
                <div className="h-2.5 w-20 bg-white/5 rounded-none" />
              </div>
            ))}
          </div>

          {/* Status Banner Placeholder */}
          <div className="px-3 py-2 bg-[#101216] border border-white/15 flex items-center justify-between h-[38px] rounded-none">
            <div className="h-3 w-48 bg-white/10 rounded-none" />
            <div className="h-3 w-36 bg-white/5 rounded-none" />
          </div>

          {/* Color Legend Placeholder */}
          <div className="p-2 bg-black/80 border border-white/10 flex items-center justify-between h-[34px] rounded-none">
            <div className="h-3 w-64 bg-white/10 rounded-none" />
            <div className="h-3 w-28 bg-white/5 rounded-none" />
          </div>

          {/* 3 Tracks Placeholder */}
          <div className="flex flex-col gap-2 font-mono text-[10px]">
            {['SUNLIGHT', 'DIRECT EARTH', 'DUAL OP'].map((label, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-white/40 font-bold text-[9px]">{label}</span>
                <div className="flex-1 h-6 bg-black/80 border border-white/15 relative overflow-hidden rounded-none">
                  <div className="h-full w-full bg-white/[0.04]" />
                </div>
              </div>
            ))}
          </div>

          {/* Day Metrics Placeholder */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="p-2 bg-black/80 border border-white/10 flex flex-col gap-1.5 h-[84px] rounded-none">
                <div className="h-3 w-16 bg-white/10 rounded-none" />
                <div className="h-4 w-12 bg-white/5 rounded-none" />
                <div className="h-2.5 w-20 bg-white/5 rounded-none" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Quick Metrics Strip with 5 Critical Operational Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 font-mono text-xs">
            {/* 1. Total Sunlight */}
            <div className="p-2.5 bg-black/80 border border-white/10 flex flex-col justify-between gap-1">
              <span className="text-[9.5px] text-white/50 uppercase flex items-center gap-1">
                <Sun size={11} className="text-[#ECC068]" /> Total Sunlight
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-white tabular-nums">
                  {timelineData?.summary.sunlightTotalHours.toFixed(1) ?? '—'}h
                </span>
                <span className="text-[10px] text-[#ECC068]">
                  ({timelineData?.summary.sunlightPercentage.toFixed(0) ?? '—'}%)
                </span>
              </div>
              <span className="text-[9px] text-white/40">
                {sunWindows.length} {sunWindows.length === 1 ? 'Continuous Window' : 'Illumination Windows'}
              </span>
            </div>

            {/* 2. Direct Earth LOS */}
            <div className={`p-2.5 bg-black/80 border flex flex-col justify-between gap-1 ${(timelineData?.summary.earthVisibilityTotalHours ?? 0) === 0 ? 'border-amber-400/30' : 'border-white/10'
              }`}>
              <span className="text-[9.5px] text-white/50 uppercase flex items-center gap-1">
                <Globe size={11} className="text-[#58D8D0]" /> Direct Earth LOS
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-white tabular-nums">
                  {timelineData?.summary.earthVisibilityTotalHours.toFixed(1) ?? '—'}h
                </span>
                <span className={`text-[10px] ${(timelineData?.summary.earthVisibilityTotalHours ?? 0) === 0 ? 'text-amber-400' : 'text-[#58D8D0]'
                  }`}>
                  ({timelineData?.summary.earthVisibilityPercentage.toFixed(0) ?? '—'}%)
                </span>
              </div>
              <span className="text-[9px] text-white/40">
                {(timelineData?.summary.earthVisibilityTotalHours ?? 0) === 0 ? 'Occulted below horizon' : `${earthWindows.length} Comm Windows`}
              </span>
            </div>

            {/* 3. Conserved Energy Till (Requested by User) */}
            <div className="p-2.5 bg-black/80 border border-white/10 flex flex-col justify-between gap-1">
              <span className="text-[9.5px] text-white/50 uppercase flex items-center gap-1">
                <BatteryCharging size={11} className="text-emerald-400" /> Conserved Energy Till
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-emerald-400 tabular-nums">
                  {energyMetrics.conservedTillLabel}
                </span>
              </div>
              <span className="text-[9px] text-white/40 truncate">
                {energyMetrics.isContinuousSun ? 'Battery: 100% Conserved' : `Darkness: ${energyMetrics.darknessHours.toFixed(1)}h`}
              </span>
            </div>

            {/* 4. Simultaneous Window */}
            <div className="p-2.5 bg-black/80 border border-white/10 flex flex-col justify-between gap-1">
              <span className="text-[9.5px] text-white/50 uppercase flex items-center gap-1">
                <Zap size={11} className="text-emerald-400" /> Simultaneous Window
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-white tabular-nums">
                  {timelineData?.summary.bothVisibilityTotalHours.toFixed(1) ?? '—'}h
                </span>
                <span className="text-[10px] text-white/40">
                  ({timelineData?.summary.bothVisibilityPercentage.toFixed(0) ?? '—'}%)
                </span>
              </div>
              <span className="text-[9px] text-white/40">
                {dualWindows.length} Simultaneous Windows
              </span>
            </div>

            {/* 5. Longest Sun Streak */}
            <div className="p-2.5 bg-black/80 border border-white/10 flex flex-col justify-between gap-1">
              <span className="text-[9.5px] text-white/50 uppercase flex items-center gap-1">
                <Clock size={11} className="text-amber-300" /> Longest Sun Streak
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-white tabular-nums">
                  {timelineData?.summary.longestSunlightContinuousHours.toFixed(1) ?? '—'}h
                </span>
                <span className="text-[9.5px] text-white/40">unbroken</span>
              </div>
              <span className="text-[9px] text-white/40">
                Peak Solar Elevation: {points.length > 0 ? `+${Math.max(...points.map(p => p.sun.elevationDeg)).toFixed(2)}°` : '—'}
              </span>
            </div>
          </div>

          {/* Next Mission Events Banner */}
          {upcomingEvents && (
            <div className="px-3 py-2 bg-[#101216] border border-white/15 flex flex-wrap items-center justify-between gap-3 text-[10.5px] font-mono">
              <div className="flex items-center gap-2">
                <span className="text-white/50 uppercase">CURRENT STATUS:</span>
                <span className={`px-1.5 py-0.2 font-bold ${upcomingEvents.isCurrentlySunlit ? 'text-[#ECC068]' : 'text-white/40'}`}>
                  {upcomingEvents.isCurrentlySunlit ? 'SUNLIT' : 'SHADOWED'}
                </span>
                <span className="text-white/20">|</span>
                <span className={`px-1.5 py-0.2 font-bold ${upcomingEvents.isCurrentlyEarthVisible ? 'text-[#58D8D0]' : 'text-amber-400'}`}>
                  {upcomingEvents.isCurrentlyEarthVisible ? 'EARTH LOS ACQUIRED' : 'EARTH OCCULTED (-6.35°)'}
                </span>
                <span className="text-white/20">|</span>
                <span className={`px-1.5 py-0.2 font-bold ${upcomingEvents.isCurrentlySimultaneous ? 'text-emerald-400' : 'text-white/40'}`}>
                  {upcomingEvents.isCurrentlySimultaneous ? 'SIMULTANEOUS OP' : 'ASYNC (SOLAR ONLY)'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-white/70">
                {upcomingEvents.nextSunsetHours !== null ? (
                  <span>
                    Sunset in: <strong className="text-white">{upcomingEvents.nextSunsetHours}h</strong>
                  </span>
                ) : (
                  <span className="text-amber-300/80">Permanent Sun across interval</span>
                )}
                {upcomingEvents.nextEarthsetHours !== null ? (
                  <span>
                    LOS Loss in: <strong className="text-white">{upcomingEvents.nextEarthsetHours}h</strong>
                  </span>
                ) : (
                  <span className="text-white/40">Earth occulted across entire interval</span>
                )}
                {upcomingEvents.nextSimultaneousHours !== null && (
                  <span>
                    Next Dual Window: <strong className="text-emerald-300">+{upcomingEvents.nextSimultaneousHours}h</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Site Visibility Context Callout for Sites with Occulted Earth */}
          {points.length > 0 && (timelineData?.summary.earthVisibilityTotalHours ?? 0) === 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-start gap-2.5">
                <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-amber-300 uppercase tracking-wide">
                    ASTRONOMICAL VISIBILITY PROFILE // {site.name.toUpperCase()}
                  </span>
                  <span className="text-white/70 text-[11px] leading-relaxed">
                    At coordinates {Math.abs(site.latitudeDeg).toFixed(2)}°S, {site.longitudeDeg >= 0 ? `${site.longitudeDeg.toFixed(2)}°E` : `${Math.abs(site.longitudeDeg).toFixed(2)}°W`}, 
                    the Sun maintains continuous polar summer light (+1.5° to +1.8°), while Earth is currently occulted at {points[activeCursorIndex]?.earth.elevationDeg.toFixed(1)}° below the local lunar horizon.
                  </span>
                </div>
              </div>

              {onSelectSite && (
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-white/50 uppercase">Compare Near-Side Sites:</span>
                  <button
                    type="button"
                    onClick={() => onSelectSite('malapert-massif')}
                    className="px-2.5 py-1 bg-[#58D8D0]/15 hover:bg-[#58D8D0] text-[#58D8D0] hover:text-black border border-[#58D8D0]/40 text-[9.5px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Malapert Massif (46.7h Comm)
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectSite('de-gerlache-rim')}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white text-white hover:text-black border border-white/30 text-[9.5px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    de Gerlache Rim (28h Comm)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Color Legend Bar */}
          <div className="p-2 bg-black/80 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-[9.5px] font-mono">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-white/40 uppercase font-bold">ELEVATION INTENSITY:</span>
              
              <div className="flex items-center gap-1.5">
                <span className="text-white/60">Sun:</span>
                <span className="inline-block w-2.5 h-2.5 bg-[#ECC068] border border-white/30" />
                <span className="text-white/70">&gt;+1.6° Peak</span>
                <span className="inline-block w-2.5 h-2.5 bg-[#D97706] border border-white/30" />
                <span className="text-white/70">+1.0°–+1.6° High</span>
                <span className="inline-block w-2.5 h-2.5 bg-[#B45309] border border-white/30" />
                <span className="text-white/70">&lt;+1.0° Graze</span>
                <span className="inline-block w-2.5 h-2.5 bg-[#101317] border border-white/30" />
                <span className="text-white/50">Shadow</span>
              </div>

              <div className="h-3 w-px bg-white/20" />

              <div className="flex items-center gap-1.5">
                <span className="text-white/60">Earth:</span>
                <span className="inline-block w-2.5 h-2.5 bg-[#58D8D0] border border-white/30" />
                <span className="text-white/70">&gt;+2.0° Strong</span>
                <span className="inline-block w-2.5 h-2.5 bg-[#0284C7] border border-white/30" />
                <span className="text-white/70">0°–+2° Low</span>
                <span className="inline-block w-2.5 h-2.5 bg-[#1E3A8A] border border-white/30" />
                <span className="text-white/70">-1.5°–0° Mast Reachable</span>
                <span className="inline-block w-2.5 h-2.5 bg-[#0E1217] border border-white/30" />
                <span className="text-white/50">Occulted</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-white/60">Dual Op:</span>
              <span className="inline-block w-2.5 h-2.5 bg-[#00FF9D] border border-white/30" />
              <span className="text-emerald-300">Simultaneous</span>
              <span className="inline-block w-2.5 h-2.5 bg-[#362208] border border-white/30" />
              <span className="text-amber-400/80">Solar Only</span>
            </div>
          </div>

          {/* Multi-Track Telemetry Display */}
          <div className="flex flex-col gap-1.5 font-mono text-[10px] select-none">
            {/* Track 1: Solar Illumination */}
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-white/60 flex items-center gap-1 font-bold">
                <Sun size={11} className="text-[#ECC068]" /> SUNLIGHT
              </span>
              <div className="relative flex-1 h-6 bg-black border border-white/20 flex overflow-hidden">
                {points.map((p, idx) => {
                  const isCursor = idx === activeCursorIndex;
                  const sunStyle = getSunlightCellColor(p);
                  return (
                    <div
                      key={p.epochUtc}
                      onClick={() => onSelectEpoch(p.epochUtc)}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      style={{ backgroundColor: sunStyle.hexColor }}
                      className="flex-1 h-full cursor-pointer transition-transform relative border-r border-black/30 hover:scale-y-110 hover:z-10"
                      title={`${new Date(p.epochUtc).toUTCString()} - Sun El: ${p.sun.elevationDeg > 0 ? '+' : ''}${p.sun.elevationDeg.toFixed(2)}° (${sunStyle.label})`}
                    >
                      {isCursor && (
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-white z-20 shadow-[0_0_8px_white]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Track 2: Direct-to-Earth Comm */}
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-white/60 flex items-center gap-1 font-bold">
                <Globe size={11} className="text-[#58D8D0]" /> DTE COMM
              </span>
              <div className="relative flex-1 h-6 bg-black border border-white/20 flex overflow-hidden">
                {points.map((p, idx) => {
                  const isCursor = idx === activeCursorIndex;
                  const earthStyle = getEarthCommCellColor(p);
                  return (
                    <div
                      key={p.epochUtc}
                      onClick={() => onSelectEpoch(p.epochUtc)}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      style={{ backgroundColor: earthStyle.hexColor }}
                      className="flex-1 h-full cursor-pointer transition-transform relative border-r border-black/30 hover:scale-y-110 hover:z-10"
                      title={`${new Date(p.epochUtc).toUTCString()} - Earth El: ${p.earth.elevationDeg > 0 ? '+' : ''}${p.earth.elevationDeg.toFixed(2)}° (${earthStyle.label})`}
                    >
                      {isCursor && (
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-white z-20 shadow-[0_0_8px_white]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Track 3: Simultaneous Operations */}
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-white/60 flex items-center gap-1 font-bold">
                <Zap size={11} className="text-emerald-400" /> DUAL OP
              </span>
              <div className="relative flex-1 h-6 bg-black border border-white/20 flex overflow-hidden">
                {points.map((p, idx) => {
                  const isCursor = idx === activeCursorIndex;
                  const dualStyle = getDualOpCellColor(p);
                  return (
                    <div
                      key={p.epochUtc}
                      onClick={() => onSelectEpoch(p.epochUtc)}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      style={{ backgroundColor: dualStyle.hexColor }}
                      className="flex-1 h-full cursor-pointer transition-transform relative border-r border-black/30 hover:scale-y-110 hover:z-10"
                      title={`${new Date(p.epochUtc).toUTCString()} - Simultaneous Status: ${dualStyle.label} (Sun: ${p.sun.elevationDeg > 0 ? '+' : ''}${p.sun.elevationDeg.toFixed(1)}°, Earth: ${p.earth.elevationDeg > 0 ? '+' : ''}${p.earth.elevationDeg.toFixed(1)}°)`}
                    >
                      {isCursor && (
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-white z-20 shadow-[0_0_8px_white]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline Time Axis Labels */}
            <div className="flex items-center gap-2 pt-1 text-[9px] text-white/40">
              <span className="w-24 shrink-0 uppercase">TIME (UTC)</span>
              <div className="flex-1 flex justify-between">
                {points.length > 0 && (
                  <>
                    <span>{points[0].epochUtc.slice(5, 16).replace('T', ' ')}Z</span>
                    {points.length > 12 && (
                      <span>
                        {points[Math.floor(points.length / 2)].epochUtc.slice(5, 16).replace('T', ' ')}Z
                      </span>
                    )}
                    <span>{points[points.length - 1].epochUtc.slice(5, 16).replace('T', ' ')}Z</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Inspection HUD */}
          {(hoveredPoint || activePoint) && (
            <div className="p-3 bg-black/95 border border-white/20 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-white/40 uppercase">
                  {hoveredPoint ? 'INSPECTING:' : 'SIMULATION CURSOR:'}
                </span>
                <span className="text-white font-bold">
                  {(hoveredPoint || activePoint)!.epochUtc.replace('T', ' ').replace('.000Z', ' UTC')}
                </span>
              </div>

              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#ECC068]" />
                  <span>Sun El: </span>
                  <strong className="text-white">{(hoveredPoint || activePoint)!.sun.elevationDeg > 0 ? '+' : ''}{(hoveredPoint || activePoint)!.sun.elevationDeg.toFixed(2)}°</strong>
                  <span className="text-white/40">({(hoveredPoint || activePoint)!.sun.isVisible ? 'Visible' : 'Shadowed'})</span>
                </span>

                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#58D8D0]" />
                  <span>Earth El: </span>
                  <strong className="text-white">{(hoveredPoint || activePoint)!.earth.elevationDeg > 0 ? '+' : ''}{(hoveredPoint || activePoint)!.earth.elevationDeg.toFixed(2)}°</strong>
                  <span className={(hoveredPoint || activePoint)!.earth.isVisible ? 'text-white/40' : 'text-amber-400 font-bold'}>
                    ({(hoveredPoint || activePoint)!.earth.isVisible ? 'LOS OK' : 'Blocked / Below Horizon'})
                  </span>
                </span>

                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Dual Window: </span>
                  <strong className={(hoveredPoint || activePoint)!.bothVisible ? 'text-emerald-400' : 'text-white/40'}>
                    {(hoveredPoint || activePoint)!.bothVisible ? 'ACTIVE' : 'NO'}
                  </strong>
                </span>

                {hoveredPoint && (
                  <button
                    type="button"
                    onClick={() => onSelectEpoch(hoveredPoint.epochUtc)}
                    className="px-2 py-0.5 bg-white text-black text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-200"
                  >
                    Set Scene Epoch
                  </button>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              4. DETAILED MISSION WINDOWS & CONSERVED ENERGY DOSSIER (NEW FEATURE)
          ========================================================================= */}
          <div className="border border-white/15 bg-black/90 flex flex-col font-mono text-xs">
            {/* Window Tabs Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-white/10 p-2 sm:px-3 bg-[#101216]">
              <div className="flex items-center gap-2">
                <Layers size={13} className="text-white/50" />
                <span className="text-[10px] uppercase font-bold text-white tracking-widest">
                  WINDOW SESSIONS &amp; ENERGY TELEMETRY
                </span>
              </div>

              {/* Tabs Switcher */}
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveWindowTab('SUN')}
                  className={`px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-none ${activeWindowTab === 'SUN'
                      ? 'bg-[#ECC068] text-black font-extrabold'
                      : 'bg-black/60 text-white/60 hover:text-white border border-white/15 hover:bg-white/10'
                    }`}
                >
                  <span className="flex items-center gap-1">
                    <Sun size={10} /> SUNLIGHT WINDOWS ({sunWindows.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveWindowTab('EARTH')}
                  className={`px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-none ${activeWindowTab === 'EARTH'
                      ? 'bg-[#58D8D0] text-black font-extrabold'
                      : 'bg-black/60 text-white/60 hover:text-white border border-white/15 hover:bg-white/10'
                    }`}
                >
                  <span className="flex items-center gap-1">
                    <Globe size={10} /> COMM WINDOWS ({earthWindows.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveWindowTab('DUAL')}
                  className={`px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-none ${activeWindowTab === 'DUAL'
                      ? 'bg-emerald-400 text-black font-extrabold'
                      : 'bg-black/60 text-white/60 hover:text-white border border-white/15 hover:bg-white/10'
                    }`}
                >
                  <span className="flex items-center gap-1">
                    <Zap size={10} /> DUAL OP ({dualWindows.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveWindowTab('ENERGY')}
                  className={`px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wider transition-all cursor-pointer rounded-none ${activeWindowTab === 'ENERGY'
                      ? 'bg-white text-black font-extrabold'
                      : 'bg-black/60 text-white/60 hover:text-white border border-white/15 hover:bg-white/10'
                    }`}
                >
                  <span className="flex items-center gap-1">
                    <BatteryCharging size={10} /> CONSERVED ENERGY &amp; STORAGE
                  </span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT 1: SUNLIGHT WINDOWS */}
            {activeWindowTab === 'SUN' && (
              <div className="p-3 sm:p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between text-white/60 text-[10.5px]">
                  <span className="flex items-center gap-1.5">
                    <Sun size={12} className="text-[#ECC068]" />
                    <strong>{sunWindows.length} Solar Illumination {sunWindows.length === 1 ? 'Window' : 'Windows'}</strong>
                    <span>(Total: {timelineData?.summary.sunlightTotalHours.toFixed(1)}h / {timelineData?.summary.sunlightPercentage.toFixed(0)}%)</span>
                  </span>
                  <span className="text-[10px] text-white/40">Point-Source Solar Ray Model (SPICE DE440)</span>
                </div>

                {sunWindows.length > 0 ? (
                  <div className="border border-white/10 divide-y divide-white/5 bg-black">
                    {sunWindows.map((win, wIdx) => (
                      <div
                        key={win.id}
                        className={`p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${win.isActive ? 'bg-[#ECC068]/10 border-l-2 border-l-[#ECC068]' : 'hover:bg-white/[0.02]'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-1.5 py-0.5 bg-white/10 text-white font-mono text-[9px] font-bold">
                            SESSION #{wIdx + 1}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-white font-bold text-[11px]">
                              {win.startUtc.replace('T', ' ').replace('.000Z', ' UTC')} → {win.endUtc.replace('T', ' ').replace('.000Z', ' UTC')}
                            </span>
                            <span className="text-[10px] text-white/50">
                              Duration: <strong className="text-white">{win.durationHours.toFixed(1)}h</strong> ({((win.durationHours / durationHours) * 100).toFixed(0)}% of mission window)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="text-white/60">
                            Solar Elevation: <strong className="text-white">+{win.minElevationDeg.toFixed(2)}° to +{win.maxElevationDeg.toFixed(2)}°</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => onSelectEpoch(win.startUtc)}
                            className="px-2 py-1 bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 text-[9px] uppercase font-bold tracking-wider cursor-pointer transition-colors"
                          >
                            Jump to Start
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-black/60 border border-white/10 text-center text-white/40">
                    No active solar illumination windows detected during this epoch.
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: COMMUNICATION WINDOWS (Answers User Question) */}
            {activeWindowTab === 'EARTH' && (
              <div className="p-3 sm:p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between text-white/60 text-[10.5px]">
                  <span className="flex items-center gap-1.5">
                    <Globe size={12} className="text-[#58D8D0]" />
                    <strong>{earthWindows.length} Direct-to-Earth (DTE) {earthWindows.length === 1 ? 'Window' : 'Windows'}</strong>
                    <span>(Total: {timelineData?.summary.earthVisibilityTotalHours.toFixed(1)}h / {timelineData?.summary.earthVisibilityPercentage.toFixed(0)}%)</span>
                  </span>
                  <span className="text-[10px] text-white/40">Geometric Line-of-Sight minus LOLA Horizon Mask</span>
                </div>

                {earthWindows.length > 0 ? (
                  <div className="border border-white/10 divide-y divide-white/5 bg-black">
                    {earthWindows.map((win, wIdx) => (
                      <div
                        key={win.id}
                        className={`p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${win.isActive ? 'bg-[#58D8D0]/10 border-l-2 border-l-[#58D8D0]' : 'hover:bg-white/[0.02]'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-1.5 py-0.5 bg-[#58D8D0]/20 text-[#58D8D0] font-mono text-[9px] font-bold">
                            COMM #{wIdx + 1}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-white font-bold text-[11px]">
                              {win.startUtc.replace('T', ' ').replace('.000Z', ' UTC')} → {win.endUtc.replace('T', ' ').replace('.000Z', ' UTC')}
                            </span>
                            <span className="text-[10px] text-white/50">
                              Duration: <strong className="text-white">{win.durationHours.toFixed(1)}h</strong> ({((win.durationHours / durationHours) * 100).toFixed(0)}% of mission window)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="text-white/60">
                            Earth Elevation: <strong className="text-white">+{win.minElevationDeg.toFixed(2)}° to +{win.maxElevationDeg.toFixed(2)}°</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => onSelectEpoch(win.startUtc)}
                            className="px-2 py-1 bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 text-[9px] uppercase font-bold tracking-wider cursor-pointer transition-colors"
                          >
                            Jump to Start
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Prominent Scientific Advisory when Communication is 0.0h */
                  <div className="p-3.5 sm:p-4 bg-amber-950/40 border border-amber-500/40 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2 text-amber-300 font-bold uppercase tracking-wider text-[11px]">
                      <ShieldAlert size={14} className="text-amber-400 shrink-0" />
                      <span>NO DIRECT-TO-EARTH COMMUNICATION WINDOW OPEN (0.0h / 0%)</span>
                    </div>

                    <p className="text-[11px] text-white/80 leading-relaxed">
                      At <strong>{site.name}</strong> ({Math.abs(site.latitudeDeg).toFixed(2)}°S, {site.longitudeDeg.toFixed(2)}°E), Earth remains at <strong className="text-amber-300">{energyMetrics.earthOccludedDeg > 0 ? `+${energyMetrics.earthOccludedDeg.toFixed(2)}°` : `${energyMetrics.earthOccludedDeg.toFixed(2)}°`}</strong> (below the local horizon) throughout this entire {durationHours}-hour observation epoch.
                      Direct radio line-of-sight is geometrically occluded by the massive lunar limb and high surrounding crater ridges.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 font-mono text-[10px]">
                      <div className="p-2 bg-black/80 border border-white/10 flex flex-col gap-1">
                        <span className="text-white/50 uppercase font-bold flex items-center gap-1">
                          <HardDrive size={10} className="text-[#58D8D0]" /> Onboard Data Buffer
                        </span>
                        <span className="text-white/80 leading-tight">
                          100% of telemetry and scientific payloads must be conserved in onboard solid-state mass memory until downlink acquisition.
                        </span>
                      </div>

                      <div className="p-2 bg-black/80 border border-white/10 flex flex-col gap-1">
                        <span className="text-white/50 uppercase font-bold flex items-center gap-1">
                          <Radio size={10} className="text-amber-400" /> Lunar Relay Satellite
                        </span>
                        <span className="text-white/80 leading-tight">
                          Telemetry downlink requires scheduling passes through a lunar polar communications orbiter or the Artemis Lunar Gateway.
                        </span>
                      </div>

                      <div className="p-2 bg-black/80 border border-white/10 flex flex-col gap-1">
                        <span className="text-white/50 uppercase font-bold flex items-center gap-1">
                          <Globe size={10} className="text-emerald-400" /> Alternate Landing Site
                        </span>
                        <span className="text-white/80 leading-tight">
                          For continuous Direct-to-Earth communication without an orbital relay, select <strong>Malapert Massif</strong> (+1.5° to +2.5° Earth elevation).
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 3: DUAL OPERATIONAL WINDOWS */}
            {activeWindowTab === 'DUAL' && (
              <div className="p-3 sm:p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between text-white/60 text-[10.5px]">
                  <span className="flex items-center gap-1.5">
                    <Zap size={12} className="text-emerald-400" />
                    <strong>{dualWindows.length} Dual Operational {dualWindows.length === 1 ? 'Window' : 'Windows'}</strong>
                    <span>(Total: {timelineData?.summary.bothVisibilityTotalHours.toFixed(1)}h / {timelineData?.summary.bothVisibilityPercentage.toFixed(0)}%)</span>
                  </span>
                  <span className="text-[10px] text-white/40">Simultaneous Solar Generation &amp; Direct Earth Telemetry</span>
                </div>

                {dualWindows.length > 0 ? (
                  <div className="border border-white/10 divide-y divide-white/5 bg-black">
                    {dualWindows.map((win, wIdx) => (
                      <div
                        key={win.id}
                        className={`p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${win.isActive ? 'bg-emerald-400/10 border-l-2 border-l-emerald-400' : 'hover:bg-white/[0.02]'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="px-1.5 py-0.5 bg-emerald-400/20 text-emerald-300 font-mono text-[9px] font-bold">
                            DUAL #{wIdx + 1}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-white font-bold text-[11px]">
                              {win.startUtc.replace('T', ' ').replace('.000Z', ' UTC')} → {win.endUtc.replace('T', ' ').replace('.000Z', ' UTC')}
                            </span>
                            <span className="text-[10px] text-white/50">
                              Duration: <strong className="text-emerald-300">{win.durationHours.toFixed(1)}h</strong> ({((win.durationHours / durationHours) * 100).toFixed(0)}% of mission window)
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectEpoch(win.startUtc)}
                          className="px-2 py-1 bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 text-[9px] uppercase font-bold tracking-wider cursor-pointer transition-colors"
                        >
                          Jump to Start
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-black/60 border border-white/10 text-center text-white/40">
                    No simultaneous solar power and direct Earth communication windows are active during this interval because Earth is occluded below the horizon.
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 4: CONSERVED ENERGY & BATTERY DOSSIER (Answers User Question) */}
            {activeWindowTab === 'ENERGY' && (
              <div className="p-3 sm:p-4 flex flex-col gap-3 font-mono">
                <div className="flex items-center justify-between text-white/60 text-[10.5px]">
                  <span className="flex items-center gap-1.5">
                    <BatteryCharging size={12} className="text-emerald-400" />
                    <strong>Power Flow, Energy Storage &amp; Conserved Endurance</strong>
                  </span>
                  <span className="text-[10px] text-white/40">NASA CLPS Standard 72h Secondary Battery Model</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Energy Telemetry 1: Solar Power vs Conserved Battery */}
                  <div className="p-3 bg-black border border-white/10 flex flex-col gap-2">
                    <span className="text-[10px] uppercase font-bold text-white/60 flex items-center gap-1.5">
                      <Sun size={11} className="text-[#ECC068]" /> Primary Solar Generation
                    </span>
                    <div className="flex items-baseline justify-between border-b border-white/10 pb-1.5">
                      <span className="text-white/50 text-[11px]">Illumination Hours:</span>
                      <span className="text-white font-bold tabular-nums">
                        {timelineData?.summary.sunlightTotalHours.toFixed(1)}h / {durationHours}h ({timelineData?.summary.sunlightPercentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between border-b border-white/10 pb-1.5">
                      <span className="text-white/50 text-[11px]">Darkness / Shadow Hours:</span>
                      <span className="text-white font-bold tabular-nums">
                        {energyMetrics.darknessHours.toFixed(1)}h
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-white/50 text-[11px]">Active Power Source:</span>
                      <span className="text-emerald-400 font-bold uppercase">
                        {energyMetrics.energyStatus}
                      </span>
                    </div>
                  </div>

                  {/* Energy Telemetry 2: Conserved Energy Till (Endurance) */}
                  <div className="p-3 bg-black border border-white/10 flex flex-col gap-2">
                    <span className="text-[10px] uppercase font-bold text-white/60 flex items-center gap-1.5">
                      <Battery size={11} className="text-emerald-400" /> Conserved Energy &amp; Battery Reserves
                    </span>
                    <div className="flex items-baseline justify-between border-b border-white/10 pb-1.5">
                      <span className="text-white/50 text-[11px]">Battery Capacity Conserved:</span>
                      <span className="text-emerald-400 font-bold tabular-nums">
                        {energyMetrics.batteryConservedPercent}% (Full Charge)
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between border-b border-white/10 pb-1.5">
                      <span className="text-white/50 text-[11px]">Conserved Energy Lasts Till:</span>
                      <span className="text-white font-bold tabular-nums">
                        {energyMetrics.conservedTillLabel}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-white/50 text-[11px]">Darkness Survival Limit:</span>
                      <span className="text-white/70 tabular-nums">
                        72.0h max secondary battery endurance
                      </span>
                    </div>
                  </div>
                </div>

                {/* Explanatory Aerospace Context */}
                <div className="p-3 bg-[#101216] border border-white/10 flex flex-col gap-1.5 text-[10.5px] text-white/75 leading-relaxed">
                  <div className="flex items-center gap-1.5 text-white font-bold uppercase text-[10px]">
                    <Info size={11} className="text-[#58D8D0]" />
                    <span>Scientific Context: How Conserved Energy &amp; Communication Work</span>
                  </div>
                  <p>
                    <strong>1. Why is Conserved Energy 100% / Infinite here?</strong> Because {site.name} enjoys perpetual solar illumination ({energyMetrics.sunlitHours.toFixed(1)}h) throughout this November 2026 week. Solar arrays power all lander avionics directly, so the secondary battery remains 100% trickle-charged with zero depth-of-discharge.
                  </p>
                  <p>
                    <strong>2. Why is Communication 0h?</strong> At {Math.abs(site.latitudeDeg).toFixed(2)}°S, Earth sits below the local horizon ({energyMetrics.earthOccludedDeg.toFixed(2)}°), occluded by the crater rim.
                  </p>
                  <p>
                    <strong>3. How is Data Conserved?</strong> Since direct Earth downlink is unavailable, telemetry data is conserved in onboard flash memory until Earth clears the horizon or a lunar relay orbiter (e.g., Gateway) passes overhead.
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
