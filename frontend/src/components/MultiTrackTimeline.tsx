import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Sun,
  Globe,
  Zap,
  AlertCircle,
  RefreshCw,
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
    return { hexColor: '#121418', label: 'Shadowed' };
  }
  if (p.sun.elevationDeg >= 1.5) {
    return { hexColor: '#F59E0B', label: 'High Sunlight (>1.5°)' };
  }
  return { hexColor: '#D97706', label: 'Direct Sunlight' };
}

export function getEarthCommCellColor(p: TimelinePoint): { hexColor: string; label: string } {
  if (p.earth.isVisible) {
    return { hexColor: '#38BDF8', label: 'Direct LOS Active' };
  }
  if (p.earth.elevationDeg >= -2.0) {
    return { hexColor: '#1E293B', label: 'Marginal Blockage (-2° to 0°)' };
  }
  return { hexColor: '#0F172A', label: `Blocked (${p.earth.elevationDeg.toFixed(1)}°)` };
}

export function getDualOpCellColor(p: TimelinePoint): { hexColor: string; label: string } {
  if (p.bothVisible) {
    return { hexColor: '#10B981', label: 'Simultaneous Sun & Comm' };
  }
  if (p.sun.isVisible) {
    return { hexColor: '#78350F', label: 'Sunlight Only' };
  }
  return { hexColor: '#090B0E', label: 'No Sun / No Comm' };
}

export const MultiTrackTimeline: React.FC<MultiTrackTimelineProps> = ({
  site,
  currentEpochIso,
  onSelectEpoch,
}) => {
  const [durationHours, setDurationHours] = useState<number>(168);
  const [timelineData, setTimelineData] = useState<TimelineResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

  // Current simulation cursor index - attains the exact timing from the simulation toolbar (e.g. 2026-10-14 12:00:00 UTC)
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

  const activePoint: TimelinePoint | null = points[activeCursorIndex] || null;
  const inspectedPoint: TimelinePoint | null = hoveredIndex !== null ? points[hoveredIndex] : activePoint;

  // Format epoch cleanly as "YYYY-MM-DD HH:mm:ss UTC"
  const formatEpochUtc = (iso: string | undefined): string => {
    if (!iso) return '2026-10-14 12:00:00 UTC';
    return iso.replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC');
  };

  const sunHours = timelineData?.summary.sunlightTotalHours ?? 0;
  const sunPct = timelineData?.summary.sunlightPercentage ?? 0;
  const earthHours = timelineData?.summary.earthVisibilityTotalHours ?? 0;
  const earthPct = timelineData?.summary.earthVisibilityPercentage ?? 0;
  const dualHours = timelineData?.summary.bothVisibilityTotalHours ?? 0;
  const dualPct = timelineData?.summary.bothVisibilityPercentage ?? 0;

  return (
    <div className="w-full bg-[#08090C] border border-white/15 p-4 sm:p-6 flex flex-col gap-4 rounded-none shadow-xl select-none">
      {/* Top Header & Duration Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-[#38BDF8]" />
            <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-white">
              03 // SYNCHRONIZED MISSION TIMELINE
            </span>
          </div>
          <span className="font-mono text-[11px] text-white/50">
            {site.name} ({Math.abs(site.latitudeDeg).toFixed(2)}°S, {site.longitudeDeg >= 0 ? `${site.longitudeDeg.toFixed(2)}°E` : `${Math.abs(site.longitudeDeg).toFixed(2)}°W`})
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
              className={`px-2.5 py-1 text-[9.5px] font-bold uppercase transition-all cursor-pointer rounded-none ${
                durationHours === item.hrs
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
      ) : (
        <>
          {/* Simple 4-Metric Summary Cards Including Dual Window */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
            {/* Card 1: Sun Visibility */}
            <div className="p-3 bg-black/80 border border-amber-500/20 flex flex-col justify-between gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50 uppercase flex items-center gap-1.5 font-bold">
                  <Sun size={13} className="text-amber-400" /> SUN VISIBILITY
                </span>
                <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                  activePoint?.sun.isVisible ? 'bg-amber-500/20 text-amber-300' : 'bg-neutral-800 text-white/50'
                }`}>
                  {activePoint?.sun.isVisible ? 'DAYLIGHT' : 'SHADOW'}
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-xl font-bold text-white tabular-nums">
                  {sunHours.toFixed(1)}h
                </span>
                <span className="text-xs text-amber-400 font-bold">
                  ({sunPct.toFixed(0)}%)
                </span>
              </div>
              <span className="text-[10px] text-white/40">
                Sun: <strong className="text-white">{activePoint ? `${activePoint.sun.elevationDeg > 0 ? '+' : ''}${activePoint.sun.elevationDeg.toFixed(2)}°` : '—'}</strong>
              </span>
            </div>

            {/* Card 2: Earth Communication Window */}
            <div className="p-3 bg-black/80 border border-[#38BDF8]/20 flex flex-col justify-between gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50 uppercase flex items-center gap-1.5 font-bold">
                  <Globe size={13} className="text-[#38BDF8]" /> EARTH COMMS
                </span>
                <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                  activePoint?.earth.isVisible ? 'bg-sky-500/20 text-[#38BDF8]' : 'bg-neutral-800 text-white/50'
                }`}>
                  {activePoint?.earth.isVisible ? 'LOS OPEN' : 'OCCULTED'}
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-xl font-bold text-white tabular-nums">
                  {earthHours.toFixed(1)}h
                </span>
                <span className="text-xs text-[#38BDF8] font-bold">
                  ({earthPct.toFixed(0)}%)
                </span>
              </div>
              <span className="text-[10px] text-white/40">
                Earth: <strong className="text-white">{activePoint ? `${activePoint.earth.elevationDeg > 0 ? '+' : ''}${activePoint.earth.elevationDeg.toFixed(2)}°` : '—'}</strong>
              </span>
            </div>

            {/* Card 3: Dual Window (Common Meeting Branches of Sun + Earth) */}
            <div className="p-3 bg-black/80 border border-emerald-500/20 flex flex-col justify-between gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50 uppercase flex items-center gap-1.5 font-bold">
                  <Zap size={13} className="text-emerald-400" /> DUAL WINDOW
                </span>
                <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                  activePoint?.bothVisible ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-800 text-white/50'
                }`}>
                  {activePoint?.bothVisible ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-xl font-bold text-emerald-400 tabular-nums">
                  {dualHours.toFixed(1)}h
                </span>
                <span className="text-xs text-emerald-400 font-bold">
                  ({dualPct.toFixed(0)}% Both)
                </span>
              </div>
              <span className="text-[10px] text-white/40">
                Simultaneous sunlight &amp; comms
              </span>
            </div>

            {/* Card 4: Active Simulator Timing (Attains Image 2 Timing) */}
            <div className="p-3 bg-black/80 border border-white/20 flex flex-col justify-between gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50 uppercase flex items-center gap-1.5 font-bold">
                  <Clock size={13} className="text-white/80" /> ACTIVE TIMING
                </span>
                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white">
                  SYNCED
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-xs sm:text-sm font-bold text-white tabular-nums truncate">
                  {formatEpochUtc(currentEpochIso)}
                </span>
              </div>
              <span className="text-[10px] text-white/40">
                Simulation cursor timestamp
              </span>
            </div>
          </div>

          {/* Simple Legend Bar */}
          <div className="px-3 py-1.5 bg-black/60 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
            <div className="flex flex-wrap items-center gap-4">
              {/* Sun Legend */}
              <div className="flex items-center gap-1.5">
                <span className="text-white/50 uppercase font-semibold">Sun:</span>
                <span className="inline-block w-2.5 h-2.5 bg-[#F59E0B]" />
                <span className="text-amber-300">Visible</span>
                <span className="inline-block w-2.5 h-2.5 bg-[#121418] border border-white/20 ml-1" />
                <span className="text-white/40">Shadow</span>
              </div>

              <div className="h-3 w-px bg-white/20" />

              {/* Earth Legend */}
              <div className="flex items-center gap-1.5">
                <span className="text-white/50 uppercase font-semibold">Earth:</span>
                <span className="inline-block w-2.5 h-2.5 bg-[#38BDF8]" />
                <span className="text-[#38BDF8]">Direct LOS</span>
                <span className="inline-block w-2.5 h-2.5 bg-[#0F172A] border border-white/20 ml-1" />
                <span className="text-white/40">Blocked</span>
              </div>

              <div className="h-3 w-px bg-white/20" />

              {/* Dual Legend */}
              <div className="flex items-center gap-1.5">
                <span className="text-white/50 uppercase font-semibold">Dual Window:</span>
                <span className="inline-block w-2.5 h-2.5 bg-[#10B981] shadow-[0_0_4px_#10B981]" />
                <span className="text-emerald-300 font-bold">Both Meet</span>
                <span className="inline-block w-2.5 h-2.5 bg-[#0D1015] border border-white/20 ml-1" />
                <span className="text-white/40">Single / None</span>
              </div>
            </div>

            {/* Cursor Indicator Legend */}
            <div className="flex items-center gap-1.5 text-white/70">
              <span className="w-1.5 h-3 bg-white shadow-[0_0_6px_white]" />
              <span>Timing Cursor</span>
            </div>
          </div>

          {/* =========================================================================
              CLEAN 3-TRACK HORIZONTAL BAR GRAPH: SUN, EARTH, AND DUAL MEETING
          ========================================================================= */}
          <div className="flex flex-col gap-2 font-mono text-[10px] pt-1">
            {/* Track 1: Sun Visibility */}
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-amber-300 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                <Sun size={13} className="text-amber-400" /> SUNLIGHT
              </span>
              <div className="relative flex-1 h-8 bg-black border border-white/25 flex overflow-hidden shadow-inner">
                {points.map((p, idx) => {
                  const isCursor = idx === activeCursorIndex;
                  const isLit = p.sun.isVisible;
                  return (
                    <div
                      key={p.epochUtc}
                      onClick={() => onSelectEpoch(p.epochUtc)}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      style={{ backgroundColor: isLit ? '#F59E0B' : '#121418' }}
                      className="flex-1 h-full cursor-pointer transition-transform relative border-r border-black/20 hover:scale-y-110 hover:z-10"
                      title={`${formatEpochUtc(p.epochUtc)} | Sun El: ${p.sun.elevationDeg > 0 ? '+' : ''}${p.sun.elevationDeg.toFixed(2)}° (${isLit ? 'Daylight' : 'Shadow'})`}
                    >
                      {isCursor && (
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1.5 bg-white z-20 shadow-[0_0_10px_white]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Track 2: Earth Communication Window */}
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-[#38BDF8] flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                <Globe size={13} className="text-[#38BDF8]" /> EARTH COMMS
              </span>
              <div className="relative flex-1 h-8 bg-black border border-white/25 flex overflow-hidden shadow-inner">
                {points.map((p, idx) => {
                  const isCursor = idx === activeCursorIndex;
                  const isComm = p.earth.isVisible;
                  return (
                    <div
                      key={p.epochUtc}
                      onClick={() => onSelectEpoch(p.epochUtc)}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      style={{ backgroundColor: isComm ? '#38BDF8' : '#0F172A' }}
                      className="flex-1 h-full cursor-pointer transition-transform relative border-r border-black/20 hover:scale-y-110 hover:z-10"
                      title={`${formatEpochUtc(p.epochUtc)} | Earth El: ${p.earth.elevationDeg > 0 ? '+' : ''}${p.earth.elevationDeg.toFixed(2)}° (${isComm ? 'Direct LOS Open' : 'Blocked'})`}
                    >
                      {isCursor && (
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1.5 bg-white z-20 shadow-[0_0_10px_white]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Track 3: Dual Window (Common Branches Where Both Graphs Meet) */}
            <div className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-emerald-400 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                <Zap size={13} className="text-emerald-400" /> DUAL WINDOW
              </span>
              <div className="relative flex-1 h-8 bg-black border border-emerald-500/30 flex overflow-hidden shadow-inner">
                {points.map((p, idx) => {
                  const isCursor = idx === activeCursorIndex;
                  const isDual = p.bothVisible;
                  return (
                    <div
                      key={p.epochUtc}
                      onClick={() => onSelectEpoch(p.epochUtc)}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      style={{ backgroundColor: isDual ? '#10B981' : '#0D1015' }}
                      className={`flex-1 h-full cursor-pointer transition-transform relative border-r border-black/20 hover:scale-y-110 hover:z-10 ${
                        isDual ? 'shadow-[inset_0_0_8px_rgba(16,185,129,0.3)]' : ''
                      }`}
                      title={`${formatEpochUtc(p.epochUtc)} | Dual Status: ${isDual ? 'SIMULTANEOUS (Sun & Comm Meet)' : 'NO (Single or Shadowed)'} | Sun: ${p.sun.elevationDeg > 0 ? '+' : ''}${p.sun.elevationDeg.toFixed(1)}° | Earth: ${p.earth.elevationDeg > 0 ? '+' : ''}${p.earth.elevationDeg.toFixed(1)}°`}
                    >
                      {isCursor && (
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1.5 bg-white z-20 shadow-[0_0_10px_white]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Time Axis Labels */}
            <div className="flex items-center gap-2 pt-0.5 text-[10px] text-white/50 font-mono">
              <span className="w-32 shrink-0 uppercase tracking-wider font-semibold">TIME (UTC)</span>
              <div className="flex-1 flex justify-between px-0.5">
                {points.length > 0 && (
                  <>
                    <span>{points[0].epochUtc.slice(5, 16).replace('T', ' ')} UTC</span>
                    {points.length > 12 && (
                      <span className="text-white/70 font-semibold">
                        {points[Math.floor(points.length / 2)].epochUtc.slice(5, 16).replace('T', ' ')} UTC
                      </span>
                    )}
                    <span>{points[points.length - 1].epochUtc.slice(5, 16).replace('T', ' ')} UTC</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Inspection HUD (Attains the exact timing from Image 2) */}
          <div className="p-3 bg-black/90 border border-white/20 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-white/40 uppercase font-semibold">
                {hoveredIndex !== null ? 'INSPECTING TIMING:' : 'SIMULATION CURSOR:'}
              </span>
              <span className="text-white font-bold text-sm">
                {formatEpochUtc(inspectedPoint?.epochUtc)}
              </span>
              <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded">
                SYNCED
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-white/70">Sun:</span>
                <strong className={inspectedPoint?.sun.isVisible ? 'text-amber-300' : 'text-white/40'}>
                  {inspectedPoint ? `${inspectedPoint.sun.elevationDeg > 0 ? '+' : ''}${inspectedPoint.sun.elevationDeg.toFixed(2)}°` : '—'}
                </strong>
                <span className="text-white/50">
                  ({inspectedPoint?.sun.isVisible ? 'Visible' : 'In Shadow'})
                </span>
              </span>

              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
                <span className="text-white/70">Earth:</span>
                <strong className={inspectedPoint?.earth.isVisible ? 'text-[#38BDF8]' : 'text-amber-400'}>
                  {inspectedPoint ? `${inspectedPoint.earth.elevationDeg > 0 ? '+' : ''}${inspectedPoint.earth.elevationDeg.toFixed(2)}°` : '—'}
                </strong>
                <span className={inspectedPoint?.earth.isVisible ? 'text-white/50' : 'text-amber-400/90'}>
                  ({inspectedPoint?.earth.isVisible ? 'Direct Line-of-Sight' : 'Blocked / Below Horizon'})
                </span>
              </span>

              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${inspectedPoint?.bothVisible ? 'bg-emerald-400 shadow-[0_0_6px_#10B981]' : 'bg-neutral-600'}`} />
                <span className="text-white/70">Dual Window:</span>
                <strong className={inspectedPoint?.bothVisible ? 'text-emerald-400' : 'text-white/40'}>
                  {inspectedPoint?.bothVisible ? 'ACTIVE' : 'NO'}
                </strong>
              </span>

              {hoveredIndex !== null && (
                <button
                  type="button"
                  onClick={() => onSelectEpoch(inspectedPoint!.epochUtc)}
                  className="px-2.5 py-1 bg-white text-black text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-neutral-200 transition-colors"
                >
                  Set As Simulation Epoch
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
