import React from 'react';
import {
  Sliders,
  Sun,
  Globe,
  Mountain,
  Clock,
  RefreshCw,
  Eye,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { IMAGES } from '../data/images';
import type { SiteComparisonResponse, SiteComparisonItem } from '../services/lunarApi';

export interface WorkbenchSiteItem {
  id: string;
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
  elevationMeters: number;
}

export interface ScenarioComparisonWorkbenchProps {
  availableSites: WorkbenchSiteItem[];
  activeSiteId: string;
  selectedForCompare: string[];
  activeEpochDate: string;
  activeEpochHour: number;
  compareDurationHours: number;
  comparisonResults: SiteComparisonResponse | null;
  isLoading: boolean;
  error: string | null;
  isStale?: boolean;
  onApplyScenarioTo3D: (siteId: string) => void;
  onReevaluate: () => void;
}

// Helper to retrieve authentic verified project image asset
const getSiteImage = (id: string, name?: string): string => {
  const text = (id + ' ' + (name || '')).toLowerCase();
  if (text.includes('malapert')) return IMAGES.malapertPeak;
  if (text.includes('gerlache')) return IMAGES.clpsLander;
  if (text.includes('haworth')) return IMAGES.earthRise;
  if (text.includes('nobile')) return IMAGES.shadowRay;
  if (text.includes('shiv') || text.includes('shakti') || text.includes('chandrayaan')) return IMAGES.clpsLander;
  if (text.includes('mouton')) return IMAGES.psrTerminator;
  if (text.includes('peak')) return IMAGES.malapertPeak;
  return IMAGES.lolaDem;
};

// Fixed Skeleton Card matching exact 520px height and layout
const ScenarioCardSkeleton: React.FC<{ isBaseline?: boolean }> = ({ isBaseline }) => (
  <div
    className={`bg-[#000000] border p-4 flex flex-col justify-between gap-4 relative rounded-none h-[520px] select-none ${
      isBaseline
        ? 'border-white/40 border-t-2 border-t-[#58D8D0] bg-white/[0.02]'
        : 'border-white/15 bg-black/60'
    }`}
  >
    <div className="flex flex-col gap-3.5">
      {/* Header Placeholder */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="h-5 w-24 bg-white/10 animate-pulse rounded-none" />
        <div className="h-5 w-20 bg-white/10 animate-pulse rounded-none" />
      </div>

      {/* Site Thumbnail & Info Placeholder */}
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 bg-white/10 animate-pulse border border-white/15 shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="h-4 w-3/4 bg-white/10 animate-pulse" />
          <div className="h-3 w-1/2 bg-white/5 animate-pulse" />
        </div>
      </div>

      {/* Metrics Dossier Placeholder */}
      <div className="flex flex-col gap-2 font-mono border border-white/10 bg-black/90 p-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
            <div className="h-3 w-28 bg-white/10 animate-pulse" />
            <div className="h-3 w-16 bg-white/10 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Operational Delta Placeholder */}
      <div className="p-2 bg-[#121418] border border-white/10 flex flex-col gap-1.5">
        <div className="h-2.5 w-36 bg-white/10 animate-pulse" />
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-3 bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>

      {/* Constraints Placeholder */}
      <div className="flex flex-col gap-1 border-t border-white/10 pt-2">
        <div className="h-2.5 w-32 bg-white/10 animate-pulse" />
        <div className="h-3 w-full bg-white/5 animate-pulse" />
      </div>
    </div>

    {/* Footer Placeholder */}
    <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="h-3 w-16 bg-white/10 animate-pulse" />
        <div className="h-5 w-24 bg-white/10 animate-pulse" />
      </div>
      <div className="h-8 w-full bg-white/10 animate-pulse" />
    </div>
  </div>
);

export const ScenarioComparisonWorkbench: React.FC<ScenarioComparisonWorkbenchProps> = ({
  availableSites,
  activeSiteId,
  selectedForCompare,
  activeEpochDate,
  activeEpochHour,
  compareDurationHours,
  comparisonResults,
  isLoading,
  error,
  isStale = false,
  onApplyScenarioTo3D,
  onReevaluate,
}) => {
  const activeSite = availableSites.find((s) => s.id === activeSiteId) || availableSites[0];

  // Derive compared sites list
  const sitesToDisplay: SiteComparisonItem[] = React.useMemo(() => {
    if (!comparisonResults?.sites || comparisonResults.sites.length === 0) return [];
    // Sort so that baseline active site appears first, followed by ranked sites
    const sorted = [...comparisonResults.sites].sort((a, b) => {
      if (a.site.id === activeSiteId) return -1;
      if (b.site.id === activeSiteId) return 1;
      const rankA = comparisonResults.ranking?.indexOf(a.site.id) ?? 999;
      const rankB = comparisonResults.ranking?.indexOf(b.site.id) ?? 999;
      return rankA - rankB;
    });
    return sorted;
  }, [comparisonResults, activeSiteId]);

  // Baseline site metrics for delta calculations
  const baselineItem = React.useMemo(() => {
    if (!comparisonResults?.sites) return null;
    return comparisonResults.sites.find((s) => s.site.id === activeSiteId) || comparisonResults.sites[0] || null;
  }, [comparisonResults, activeSiteId]);

  return (
    <div className="w-full bg-[#08090C] border border-white/15 p-4 sm:p-6 flex flex-col gap-5 rounded-none shadow-xl">
      {/* Header & Shared Mission Parameters Badge Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Sliders size={14} className="text-[#58D8D0]" />
            <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-white">
              04 // RAPID MISSION SCENARIO COMPARISON WORKBENCH
            </span>
            {isStale && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-bold tracking-wider animate-pulse">
                PARAMETERS CHANGED
              </span>
            )}
          </div>
          <p className="font-mono text-[11px] text-white/50 max-w-3xl leading-relaxed">
            Comparing candidate lunar landing zones using current mission parameters. Real-time solar illumination, direct Earth line-of-sight communication, and LOLA altimetry evaluated via NASA SPICE DE440 ephemerides.
          </p>
        </div>

        {/* Action Controls & Re-evaluate Button */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={onReevaluate}
            disabled={isLoading}
            className="px-4 py-2 bg-white text-black hover:bg-slate-200 font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors rounded-none disabled:opacity-50 shadow-md"
            title="Recalculate trade-off comparison using current parameters"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'EVALUATING SPICE DE440...' : 'RE-EVALUATE SCENARIOS'}</span>
          </button>
        </div>
      </div>

      {/* Shared Mission Parameter Readout Bar (No Duplicate Inputs) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#101216] border border-white/10 font-mono text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9.5px] text-white/40 uppercase font-bold">ACTIVE BASELINE:</span>
          <span className="text-white font-bold text-[11.5px] truncate text-[#58D8D0]">
            {activeSite?.name || 'Baseline Site'}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9.5px] text-white/40 uppercase font-bold">OBSERVATION EPOCH:</span>
          <span className="text-white font-bold text-[11.5px] tabular-nums">
            {activeEpochDate} {String(activeEpochHour).padStart(2, '0')}:00 UTC
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9.5px] text-white/40 uppercase font-bold">MISSION WINDOW:</span>
          <span className="text-[#ECC068] font-bold text-[11.5px] tabular-nums">
            {compareDurationHours} Hours ({comparisonResults?.interval ? `${comparisonResults.interval.durationHours}h sync` : 'Nominal'})
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9.5px] text-white/40 uppercase font-bold">STAGED SITES:</span>
          <span className="text-white/80 font-bold text-[11.5px]">
            {sitesToDisplay.length > 0 ? `${sitesToDisplay.length} CANDIDATES` : `${selectedForCompare.length} STAGED`}
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-red-950/70 border border-red-500/40 text-red-200 font-mono text-xs flex items-center gap-2.5 rounded-none">
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={onReevaluate}
            className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-white font-bold uppercase text-[10px] border border-red-400/40 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Side-by-Side Scenario Cards Grid (Fixed Dimensions, Zero Layout Shift) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading || !comparisonResults ? (
          // Fixed Skeleton Layout: Exactly 3 identical cards
          <>
            <ScenarioCardSkeleton isBaseline={true} />
            <ScenarioCardSkeleton isBaseline={false} />
            <ScenarioCardSkeleton isBaseline={false} />
          </>
        ) : sitesToDisplay.length === 0 ? (
          <div className="col-span-full p-8 bg-black/60 border border-white/10 text-center font-mono text-xs text-white/50 flex flex-col items-center justify-center gap-3">
            <span>No comparison data returned for selected mission parameters.</span>
            <button
              type="button"
              onClick={onReevaluate}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold uppercase text-xs border border-white/30 cursor-pointer"
            >
              Run Evaluation
            </button>
          </div>
        ) : (
          sitesToDisplay.map((item) => {
            const isBaseline = item.site.id === activeSiteId;
            const rankIndex = comparisonResults.ranking?.indexOf(item.site.id) ?? -1;
            const isBestRank = rankIndex === 0;

            // Operational status
            const isPassed = item.overallStatus === 'ALL_PASSED';
            const statusLabel = isPassed ? 'CONSTRAINTS MET' : 'MARGINAL';

            return (
              <div
                key={item.site.id}
                className={`bg-black border p-4 flex flex-col justify-between gap-4 relative transition-all rounded-none h-[520px] ${
                  isBaseline
                    ? 'border-white/50 border-t-2 border-t-[#58D8D0] bg-white/[0.03]'
                    : isBestRank
                    ? 'border-white/40 bg-white/[0.015]'
                    : 'border-white/20 hover:border-white/35'
                }`}
              >
                {/* Corner reticle for active baseline */}
                {isBaseline && (
                  <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-[#58D8D0]" />
                )}

                <div className="flex flex-col gap-3">
                  {/* Card Header: Rank, Active Badge, Score */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider border rounded-none ${
                        isBaseline
                          ? 'bg-[#58D8D0]/20 text-[#58D8D0] border-[#58D8D0]/40 font-extrabold'
                          : isBestRank
                          ? 'bg-white text-black border-white font-extrabold'
                          : 'bg-white/10 text-white/80 border-white/20'
                      }`}>
                        {isBaseline ? 'BASELINE' : rankIndex >= 0 ? `RANK #${rankIndex + 1}` : 'EVALUATED'}
                      </span>
                      {isBaseline && (
                        <span className="font-mono text-[8.5px] uppercase tracking-wider text-[#58D8D0] font-bold">
                          ACTIVE TARGET
                        </span>
                      )}
                    </div>

                    <span className="font-mono text-xs font-bold text-white tabular-nums">
                      SCORE: {item.score !== undefined ? `${item.score.toFixed(1)}/100` : '—'}
                    </span>
                  </div>

                  {/* Site Header: Image, Name, Coordinates */}
                  <div className="flex items-center gap-2.5">
                    <img
                      src={getSiteImage(item.site.id, item.site.name)}
                      alt={item.site.name}
                      className="w-10 h-10 object-cover border border-white/20 shrink-0 bg-black rounded-none"
                    />
                    <div className="flex flex-col min-w-0">
                      <h4 className="font-bold text-xs text-white truncate font-mono uppercase tracking-wider">
                        {item.site.name}
                      </h4>
                      <span className="text-[10px] font-mono text-white/50 tabular-nums">
                        {Math.abs(item.site.latitudeDeg).toFixed(2)}°S, {item.site.longitudeDeg >= 0 ? `${item.site.longitudeDeg.toFixed(2)}°E` : `${Math.abs(item.site.longitudeDeg).toFixed(2)}°W`} • DATUM {item.site.elevationMeters > 0 ? `+${item.site.elevationMeters.toFixed(0)}m` : `${item.site.elevationMeters.toFixed(0)}m`}
                      </span>
                    </div>
                  </div>

                  {/* Metrics Dossier (Fixed row heights) */}
                  <div className="flex flex-col gap-1.5 font-mono text-[10.5px] border border-white/10 bg-black/90 p-2.5">
                    {/* Solar Sunlight */}
                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-white/60 flex items-center gap-1.5">
                        <Sun size={11} className="text-[#ECC068]" /> Total Sunlight:
                      </span>
                      <span className="text-white font-bold tabular-nums">
                        {item.metrics.sunlightTotalHours.toFixed(1)} hrs
                      </span>
                    </div>

                    {/* Continuous Sun Streak */}
                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-white/60 flex items-center gap-1.5">
                        <Clock size={11} className="text-amber-300" /> Max Sun Streak:
                      </span>
                      <span className="text-amber-300 font-bold tabular-nums">
                        {item.metrics.longestSunlightContinuousHours.toFixed(1)} hrs unbroken
                      </span>
                    </div>

                    {/* Direct Earth LOS */}
                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-white/60 flex items-center gap-1.5">
                        <Globe size={11} className="text-[#58D8D0]" /> Direct Earth LOS:
                      </span>
                      <span className="text-[#58D8D0] font-bold tabular-nums">
                        {item.metrics.earthVisibilityTotalHours.toFixed(1)} hrs
                      </span>
                    </div>

                    {/* Simultaneous Both Visible */}
                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-white/60 flex items-center gap-1.5">
                        <Zap size={11} className="text-emerald-400" /> Simultaneous Op:
                      </span>
                      <span className="text-emerald-400 font-bold tabular-nums">
                        {item.metrics.bothVisibilityTotalHours.toFixed(1)} hrs
                      </span>
                    </div>

                    {/* Topographic Slope */}
                    <div className="flex items-center justify-between py-1">
                      <span className="text-white/60 flex items-center gap-1.5">
                        <Mountain size={11} className="text-emerald-400" /> LOLA 80M Slope:
                      </span>
                      <span className={`font-bold tabular-nums ${item.metrics.slopeDeg <= 12 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {item.metrics.slopeDeg.toFixed(1)}° {item.metrics.slopeDeg <= 8 ? '(Safe)' : item.metrics.slopeDeg <= 12 ? '(Moderate)' : '(Steep)'}
                      </span>
                    </div>
                  </div>

                  {/* Operational Delta vs Baseline */}
                  <div className="p-2 bg-[#121418] border border-white/10 flex flex-col gap-1 font-mono text-[10px] min-h-[56px] justify-center">
                    <span className="text-white/40 uppercase font-bold text-[8.5px] tracking-wider">
                      {isBaseline ? 'PRIMARY OPERATIONAL REFERENCE:' : 'OPERATIONAL DELTA VS BASELINE:'}
                    </span>
                    {isBaseline ? (
                      <span className="text-white/60 text-[9.5px]">
                        Primary reference candidate site against which alternative scenarios are evaluated.
                      </span>
                    ) : baselineItem ? (
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9.5px]">
                        {/* Sunlight Delta */}
                        {(() => {
                          const delta = item.metrics.sunlightTotalHours - baselineItem.metrics.sunlightTotalHours;
                          return (
                            <div className="flex justify-between">
                              <span className="text-white/50">Sunlight:</span>
                              <span className={`font-bold tabular-nums ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {delta >= 0 ? `+${delta.toFixed(1)}h` : `${delta.toFixed(1)}h`}
                              </span>
                            </div>
                          );
                        })()}

                        {/* Earth LOS Delta */}
                        {(() => {
                          const delta = item.metrics.earthVisibilityTotalHours - baselineItem.metrics.earthVisibilityTotalHours;
                          return (
                            <div className="flex justify-between">
                              <span className="text-white/50">Earth LOS:</span>
                              <span className={`font-bold tabular-nums ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {delta >= 0 ? `+${delta.toFixed(1)}h` : `${delta.toFixed(1)}h`}
                              </span>
                            </div>
                          );
                        })()}

                        {/* Score Delta */}
                        {(() => {
                          const delta = (item.score ?? 0) - (baselineItem.score ?? 0);
                          return (
                            <div className="flex justify-between">
                              <span className="text-white/50">Score:</span>
                              <span className={`font-bold tabular-nums ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {delta >= 0 ? `+${delta.toFixed(1)}` : `${delta.toFixed(1)}`}
                              </span>
                            </div>
                          );
                        })()}

                        {/* Slope Delta */}
                        {(() => {
                          const delta = item.metrics.slopeDeg - baselineItem.metrics.slopeDeg;
                          return (
                            <div className="flex justify-between">
                              <span className="text-white/50">Slope:</span>
                              <span className={`font-bold tabular-nums ${delta <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {delta <= 0 ? `${delta.toFixed(1)}°` : `+${delta.toFixed(1)}°`}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    ) : null}
                  </div>

                  {/* Limiting Constraints from Real Backend */}
                  {item.reasons && item.reasons.length > 0 && (
                    <div className="flex flex-col gap-0.5 border-t border-white/10 pt-1.5 font-mono text-[9px] text-white/60 truncate">
                      <span className="text-white/40 uppercase font-bold text-[8px]">ANALYSIS RATIONALE:</span>
                      <span className="truncate text-white/70">{item.reasons[0]}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Status & 3D Load Button */}
                <div className="pt-2.5 border-t border-white/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-white/40 uppercase">STATUS:</span>
                    <span className={`px-2 py-0.5 font-bold uppercase tracking-wider border rounded-none ${
                      isPassed
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                    }`}>
                      {statusLabel}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onApplyScenarioTo3D(item.site.id)}
                    className={`w-full py-2 border font-mono text-[10.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer rounded-none ${
                      isBaseline
                        ? 'bg-[#58D8D0]/15 text-[#58D8D0] border-[#58D8D0]/40 hover:bg-[#58D8D0] hover:text-black'
                        : 'bg-white/10 hover:bg-white text-white hover:text-black border-white/20'
                    }`}
                  >
                    <Eye size={12} />
                    <span>{isBaseline ? 'FOCUS ON ACTIVE GLOBE' : 'LOAD INTO 3D SIMULATOR'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
