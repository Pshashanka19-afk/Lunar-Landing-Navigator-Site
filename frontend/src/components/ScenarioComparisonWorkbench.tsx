import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Sun,
  Globe,
  Mountain,
  Clock,
  RefreshCw,
  Eye,
  Layers,
  Zap,
} from 'lucide-react';
import { lunarApi, type MissionAssessmentResponse } from '../services/lunarApi';

export interface WorkbenchSiteItem {
  id: string;
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
  elevationMeters: number;
}

export interface ComparisonScenario {
  id: string;
  name: string;
  description: string;
  siteId: string;
  dateIso: string;
  hourUtc: number;
  durationHours: number;
  assessment: MissionAssessmentResponse | null;
  loading: boolean;
  error: string | null;
}

interface ScenarioComparisonWorkbenchProps {
  availableSites: WorkbenchSiteItem[];
  activeSiteId: string;
  activeEpochDate: string;
  activeEpochHour: number;
  onApplyScenarioTo3D: (siteId: string, epochDate: string, epochHour: number) => void;
}

export const ScenarioComparisonWorkbench: React.FC<ScenarioComparisonWorkbenchProps> = ({
  availableSites,
  activeSiteId,
  activeEpochDate,
  activeEpochHour,
  onApplyScenarioTo3D,
}) => {
  // Scenario slots
  const [scenarios, setScenarios] = useState<ComparisonScenario[]>([
    {
      id: 'scen-a',
      name: 'SCENARIO A (Baseline)',
      description: 'Primary planned landing at Shackleton Ridge',
      siteId: activeSiteId || 'shackleton-connecting-ridge',
      dateIso: activeEpochDate || '2026-10-14',
      hourUtc: activeEpochHour ?? 12,
      durationHours: 72,
      assessment: null,
      loading: false,
      error: null,
    },
    {
      id: 'scen-b',
      name: 'SCENARIO B (Alternate Date)',
      description: 'Same site 1 month later (Seasonal Solar Dip)',
      siteId: activeSiteId || 'shackleton-connecting-ridge',
      dateIso: '2026-11-15',
      hourUtc: 12,
      durationHours: 72,
      assessment: null,
      loading: false,
      error: null,
    },
    {
      id: 'scen-c',
      name: 'SCENARIO C (Alternate Site)',
      description: 'Malapert Massif on target launch epoch',
      siteId: 'malapert-mountain',
      dateIso: activeEpochDate || '2026-10-14',
      hourUtc: activeEpochHour ?? 12,
      durationHours: 72,
      assessment: null,
      loading: false,
      error: null,
    },
  ]);

  const [activePreset, setActivePreset] = useState<string>('seasonal');
  const [isEvaluatingAll, setIsEvaluatingAll] = useState<boolean>(false);

  // Evaluate a single scenario against backend SPICE & LOLA DEM API
  const evaluateScenario = async (scen: ComparisonScenario): Promise<MissionAssessmentResponse> => {
    const siteObj = availableSites.find((s) => s.id === scen.siteId) || {
      id: scen.siteId,
      name: 'Custom Lunar Target',
      latitudeDeg: -89.78,
      longitudeDeg: 125.4,
      elevationMeters: 1413.9,
    };

    const startUtc = `${scen.dateIso}T${String(scen.hourUtc).padStart(2, '0')}:00:00Z`;

    return await lunarApi.getMissionAssessment({
      site: {
        latitudeDeg: siteObj.latitudeDeg,
        longitudeDeg: siteObj.longitudeDeg,
        elevationMeters: siteObj.elevationMeters,
      },
      startTimeUtc: startUtc,
      durationHours: scen.durationHours,
      minSolarElevationDeg: 0.5,
      minSunlightDurationHours: 24.0,
      minEarthElevationDeg: 0.0,
      minCommWindowHours: 12.0,
      maxSlopeDeg: 15.0,
    });
  };

  // Evaluate all scenarios in parallel
  const runAllEvaluations = async () => {
    setIsEvaluatingAll(true);

    const updated = [...scenarios];
    await Promise.all(
      updated.map(async (scen, idx) => {
        scen.loading = true;
        scen.error = null;
        try {
          const res = await evaluateScenario(scen);
          updated[idx] = { ...scen, assessment: res, loading: false };
        } catch (err: any) {
          updated[idx] = { ...scen, error: err.message || 'Evaluation failed', loading: false };
        }
      })
    );

    setScenarios(updated);
    setIsEvaluatingAll(false);
  };

  // Trigger evaluation on initial mount
  useEffect(() => {
    runAllEvaluations();
  }, []);

  // Update specific field in a scenario
  const updateScenarioField = (
    id: string,
    field: 'siteId' | 'dateIso' | 'hourUtc' | 'durationHours',
    val: any
  ) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val, assessment: null } : s))
    );
  };

  // Apply Quick Presets
  const applyPreset = (presetKey: 'seasonal' | 'shootout' | 'window') => {
    setActivePreset(presetKey);

    if (presetKey === 'seasonal') {
      // Shackleton across 3 months
      setScenarios([
        {
          id: 'scen-a',
          name: 'SCENARIO A (Oct 2026)',
          description: 'Shackleton Ridge (Spring Solar Elevation: ~1.5°)',
          siteId: 'shackleton-connecting-ridge',
          dateIso: '2026-10-14',
          hourUtc: 12,
          durationHours: 72,
          assessment: null,
          loading: false,
          error: null,
        },
        {
          id: 'scen-b',
          name: 'SCENARIO B (Nov 2026)',
          description: 'Shackleton Ridge (Approaching Summer Solstice)',
          siteId: 'shackleton-connecting-ridge',
          dateIso: '2026-11-15',
          hourUtc: 12,
          durationHours: 72,
          assessment: null,
          loading: false,
          error: null,
        },
        {
          id: 'scen-c',
          name: 'SCENARIO C (Dec 2026)',
          description: 'Shackleton Ridge (Summer Solstice Peak: ~1.54°)',
          siteId: 'shackleton-connecting-ridge',
          dateIso: '2026-12-21',
          hourUtc: 12,
          durationHours: 72,
          assessment: null,
          loading: false,
          error: null,
        },
      ]);
    } else if (presetKey === 'shootout') {
      // 3 Top Artemis Sites on Oct 14
      setScenarios([
        {
          id: 'scen-a',
          name: 'SCENARIO A (Shackleton)',
          description: '89.78°S — Continuous illumination peak',
          siteId: 'shackleton-connecting-ridge',
          dateIso: '2026-10-14',
          hourUtc: 12,
          durationHours: 72,
          assessment: null,
          loading: false,
          error: null,
        },
        {
          id: 'scen-b',
          name: 'SCENARIO B (Malapert Massif)',
          description: '86.04°S — Uninterrupted Direct-to-Earth Comm',
          siteId: 'malapert-mountain',
          dateIso: '2026-10-14',
          hourUtc: 12,
          durationHours: 72,
          assessment: null,
          loading: false,
          error: null,
        },
        {
          id: 'scen-c',
          name: 'SCENARIO C (de Gerlache Rim)',
          description: '88.71°S — High elevated rim plateau',
          siteId: 'de-gerlache-rim-2',
          dateIso: '2026-10-14',
          hourUtc: 12,
          durationHours: 72,
          assessment: null,
          loading: false,
          error: null,
        },
      ]);
    } else if (presetKey === 'window') {
      // Launch window week by week at Malapert
      setScenarios([
        {
          id: 'scen-a',
          name: 'SCENARIO A (Oct 14)',
          description: 'Opening of launch window at Malapert Massif',
          siteId: 'malapert-mountain',
          dateIso: '2026-10-14',
          hourUtc: 12,
          durationHours: 72,
          assessment: null,
          loading: false,
          error: null,
        },
        {
          id: 'scen-b',
          name: 'SCENARIO B (Oct 21)',
          description: 'Mid-window launch (+7 days)',
          siteId: 'malapert-mountain',
          dateIso: '2026-10-21',
          hourUtc: 12,
          durationHours: 72,
          assessment: null,
          loading: false,
          error: null,
        },
        {
          id: 'scen-c',
          name: 'SCENARIO C (Oct 28)',
          description: 'Closing of launch window (+14 days)',
          siteId: 'malapert-mountain',
          dateIso: '2026-10-28',
          hourUtc: 12,
          durationHours: 72,
          assessment: null,
          loading: false,
          error: null,
        },
      ]);
    }
  };

  // Baseline scenario for delta calculations
  const baseline = scenarios[0]?.assessment;

  return (
    <div className="w-full bg-[#08090C] border border-white/15 p-4 sm:p-6 flex flex-col gap-6 rounded-none">
      {/* Workbench Header & Preset Switchers */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Sliders size={14} className="text-white" />
            <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-white">
              04 // RAPID MISSION SCENARIO COMPARISON WORKBENCH
            </span>
          </div>
          <p className="font-mono text-[11px] text-white/50 max-w-3xl">
            Simultaneously evaluate and compare multiple lunar landing locations and observation epochs.
            Analyze how changing the landing date or coordinates impacts solar power duration, direct Earth communication line-of-sight, and terrain slope safety.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={runAllEvaluations}
            disabled={isEvaluatingAll}
            className="px-4 py-2 bg-white text-black hover:bg-slate-200 font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors rounded-none disabled:opacity-50"
          >
            <RefreshCw size={12} className={isEvaluatingAll ? 'animate-spin' : ''} />
            <span>{isEvaluatingAll ? 'EVALUATING...' : 'RE-EVALUATE SCENARIOS'}</span>
          </button>
        </div>
      </div>

      {/* Preset Scenario Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#101216] border border-white/10 font-mono text-xs">
        <div className="flex items-center gap-2">
          <Layers size={13} className="text-white/40" />
          <span className="text-white/60 uppercase text-[10px] font-bold">RAPID PRESETS:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyPreset('seasonal')}
            className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider border transition-all cursor-pointer rounded-none ${
              activePreset === 'seasonal'
                ? 'bg-white text-black border-white'
                : 'bg-black/60 text-white/70 hover:text-white border-white/20 hover:bg-white/10'
            }`}
          >
            Seasonal Variation (Shackleton Oct vs Nov vs Dec)
          </button>

          <button
            type="button"
            onClick={() => applyPreset('shootout')}
            className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider border transition-all cursor-pointer rounded-none ${
              activePreset === 'shootout'
                ? 'bg-white text-black border-white'
                : 'bg-black/60 text-white/70 hover:text-white border-white/20 hover:bg-white/10'
            }`}
          >
            Candidate Site Shootout (Shackleton vs Malapert vs de Gerlache)
          </button>

          <button
            type="button"
            onClick={() => applyPreset('window')}
            className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wider border transition-all cursor-pointer rounded-none ${
              activePreset === 'window'
                ? 'bg-white text-black border-white'
                : 'bg-black/60 text-white/70 hover:text-white border-white/20 hover:bg-white/10'
            }`}
          >
            Launch Window Sensitivity (+0d vs +7d vs +14d)
          </button>
        </div>
      </div>

      {/* Side-by-Side 3-Scenario Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {scenarios.map((scen, idx) => {
          const siteObj = availableSites.find((s) => s.id === scen.siteId);
          const assessment = scen.assessment;
          const isBaseline = idx === 0;

          // Status colors
          const status = assessment?.finalAssessment.status ?? 'EVALUATING';
          const isFeasible = status === 'FEASIBLE';
          const isMarginal = status === 'MARGINAL';

          return (
            <div
              key={scen.id}
              className={`bg-black border p-4 flex flex-col justify-between gap-4 relative transition-all rounded-none ${
                isBaseline
                  ? 'border-white/50 border-t-2 border-t-[#58D8D0]'
                  : 'border-white/20 hover:border-white/40'
              }`}
            >
              <div className="flex flex-col gap-3.5">
                {/* Header & Tag */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <span className={`px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider border rounded-none ${
                    isBaseline ? 'bg-white text-black border-white' : 'bg-white/10 text-white/80 border-white/20'
                  }`}>
                    {scen.name}
                  </span>

                  <span className="font-mono text-xs font-bold text-white tabular-nums">
                    SCORE: {assessment ? `${assessment.finalAssessment.score}/100` : '—'}
                  </span>
                </div>

                {/* Scenario Description */}
                <p className="font-mono text-[10px] text-white/50 leading-relaxed min-h-[28px]">
                  {scen.description}
                </p>

                {/* Scenario Config Controls */}
                <div className="bg-[#101216] border border-white/10 p-2.5 flex flex-col gap-2 font-mono text-[10.5px]">
                  {/* Site Selector */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-white/40 uppercase font-bold">TARGET SITE:</span>
                      {siteObj && (
                        <span className="text-[9px] text-white/40 tabular-nums">
                          {Math.abs(siteObj.latitudeDeg).toFixed(2)}°S, {siteObj.longitudeDeg.toFixed(2)}°E
                        </span>
                      )}
                    </div>
                    <select
                      value={scen.siteId}
                      onChange={(e) => updateScenarioField(scen.id, 'siteId', e.target.value)}
                      className="bg-black border border-white/20 text-white p-1 text-[10.5px] outline-none cursor-pointer"
                    >
                      {availableSites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({Math.abs(s.latitudeDeg).toFixed(1)}°S)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date & Time Picker */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-white/40 uppercase font-bold">EPOCH DATE:</span>
                      <input
                        type="date"
                        value={scen.dateIso}
                        onChange={(e) => updateScenarioField(scen.id, 'dateIso', e.target.value)}
                        className="bg-black border border-white/20 text-white p-1 text-[10.5px] outline-none cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-white/40 uppercase font-bold">HOUR (UTC):</span>
                      <select
                        value={scen.hourUtc}
                        onChange={(e) => updateScenarioField(scen.id, 'hourUtc', parseInt(e.target.value))}
                        className="bg-black border border-white/20 text-white p-1 text-[10.5px] outline-none cursor-pointer"
                      >
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, '0')}:00 UTC
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Duration Selector */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-[9px] text-white/40 uppercase font-bold">WINDOW:</span>
                    <div className="flex gap-1">
                      {[24, 48, 72].map((dur) => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => updateScenarioField(scen.id, 'durationHours', dur)}
                          className={`px-1.5 py-0.5 text-[9px] font-bold border rounded-none cursor-pointer ${
                            scen.durationHours === dur
                              ? 'bg-white text-black border-white'
                              : 'bg-black text-white/50 border-white/20'
                          }`}
                        >
                          {dur}H
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Scenario Metrics Dossier */}
                {assessment ? (
                  <div className="flex flex-col gap-1.5 font-mono text-[10.5px] border border-white/10 bg-black/90 p-2.5">
                    {/* Solar Sunlight */}
                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-white/60 flex items-center gap-1.5">
                        <Sun size={11} className="text-[#ECC068]" /> Total Sunlight:
                      </span>
                      <div className="flex items-center gap-1.5 font-bold tabular-nums">
                        <span className="text-white">{assessment.powerAssessment.sunlightTotalHours.toFixed(1)} hrs</span>
                        <span className="text-white/40 text-[9.5px]">({assessment.powerAssessment.sunlightPercentage.toFixed(0)}%)</span>
                      </div>
                    </div>

                    {/* Continuous Streak */}
                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-white/60 flex items-center gap-1.5">
                        <Clock size={11} className="text-amber-300" /> Max Sun Streak:
                      </span>
                      <span className="text-amber-300 font-bold tabular-nums">
                        {assessment.powerAssessment.longestContinuousSunlightHours.toFixed(1)} hrs
                      </span>
                    </div>

                    {/* Direct-to-Earth Comm */}
                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-white/60 flex items-center gap-1.5">
                        <Globe size={11} className="text-[#58D8D0]" /> Direct Earth LOS:
                      </span>
                      <div className="flex items-center gap-1.5 font-bold tabular-nums">
                        <span className="text-[#58D8D0]">
                          {assessment.communicationAssessment.earthVisibilityTotalHours.toFixed(1)} hrs
                        </span>
                        <span className="text-white/40 text-[9.5px]">
                          ({assessment.communicationAssessment.earthVisibilityPercentage.toFixed(0)}%)
                        </span>
                      </div>
                    </div>

                    {/* Max Solar Elevation */}
                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-white/60 flex items-center gap-1.5">
                        <Zap size={11} className="text-[#ECC068]" /> Max Solar Angle:
                      </span>
                      <span className="text-white font-bold tabular-nums">
                        {assessment.powerAssessment.maxSolarElevationDeg > 0 ? '+' : ''}{assessment.powerAssessment.maxSolarElevationDeg.toFixed(2)}°
                      </span>
                    </div>

                    {/* Topographic Slope */}
                    <div className="flex items-center justify-between py-1">
                      <span className="text-white/60 flex items-center gap-1.5">
                        <Mountain size={11} className="text-emerald-400" /> LOLA Slope:
                      </span>
                      <span className={`font-bold tabular-nums ${assessment.terrainParameters.slopeDeg <= 12 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {assessment.terrainParameters.slopeDeg.toFixed(1)}°
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-black/60 border border-white/10 text-center font-mono text-xs text-white/40 flex items-center justify-center gap-2">
                    <RefreshCw size={12} className={scen.loading ? 'animate-spin text-white' : ''} />
                    <span>{scen.loading ? 'Computing SPICE & LOLA DEM...' : 'Awaiting evaluation'}</span>
                  </div>
                )}

                {/* Delta Matrix vs Scenario A */}
                {!isBaseline && assessment && baseline && (
                  <div className="p-2 bg-[#121418] border border-white/10 flex flex-col gap-1 font-mono text-[10px]">
                    <span className="text-white/40 uppercase font-bold text-[8.5px] tracking-wider">
                      OPERATIONAL DELTA VS SCENARIO A:
                    </span>
                    <div className="grid grid-cols-2 gap-1 text-[9.5px]">
                      {/* Sun Delta */}
                      {(() => {
                        const delta = assessment.powerAssessment.sunlightTotalHours - baseline.powerAssessment.sunlightTotalHours;
                        return (
                          <div className="flex justify-between">
                            <span className="text-white/50">Sunlight:</span>
                            <span className={`font-bold tabular-nums ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {delta >= 0 ? `+${delta.toFixed(1)}h` : `${delta.toFixed(1)}h`}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Comm Delta */}
                      {(() => {
                        const delta = assessment.communicationAssessment.earthVisibilityTotalHours - baseline.communicationAssessment.earthVisibilityTotalHours;
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
                        const delta = assessment.finalAssessment.score - baseline.finalAssessment.score;
                        return (
                          <div className="flex justify-between">
                            <span className="text-white/50">Score:</span>
                            <span className={`font-bold tabular-nums ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {delta >= 0 ? `+${delta.toFixed(0)} pts` : `${delta.toFixed(0)} pts`}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Slope Delta */}
                      {(() => {
                        const delta = assessment.terrainParameters.slopeDeg - baseline.terrainParameters.slopeDeg;
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
                  </div>
                )}

                {/* Scientific Reasons from Backend */}
                {assessment && assessment.finalAssessment.reasons.length > 0 && (
                  <div className="flex flex-col gap-1 border-t border-white/10 pt-2 font-mono text-[9.5px]">
                    <span className="text-white/40 uppercase font-bold text-[8.5px]">LIMITING CONSTRAINTS:</span>
                    <ul className="flex flex-col gap-1 text-white/70">
                      {assessment.finalAssessment.reasons.slice(0, 3).map((r, rIdx) => (
                        <li key={rIdx} className="flex items-start gap-1 leading-tight">
                          <span className="text-white/30">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Card Footer: Status & 3D Load Button */}
              <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-white/40 uppercase">VERDICT:</span>
                  <span className={`px-2 py-0.5 font-bold uppercase tracking-wider border rounded-none ${
                    isFeasible
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      : isMarginal
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                  }`}>
                    {status}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onApplyScenarioTo3D(scen.siteId, scen.dateIso, scen.hourUtc)}
                  className="w-full py-2 bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 font-mono text-[10.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer rounded-none"
                >
                  <Eye size={12} />
                  <span>LOAD INTO 3D SIMULATOR</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
