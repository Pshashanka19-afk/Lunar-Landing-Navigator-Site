import React from 'react';
import {
  Sun,
  Globe,
  Crosshair,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export type CameraFocusTarget = 'MOON' | 'EARTH' | 'SUN' | 'SYSTEM';

export interface SimulationControlToolbarProps {
  cameraFocusTarget?: CameraFocusTarget;
  onFocusMoon: () => void;
  onZoomMoonClose: () => void;
  onZoomEarthMoon: () => void;
  onZoomSystemOverview: () => void;
  onStepZoom: (factor: number) => void;
  showOrbits: boolean;
  onToggleOrbits: () => void;
  showAxialTilts: boolean;
  onToggleAxialTilts: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  showHud: boolean;
  onToggleHud: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isLoading?: boolean;
}

/**
 * YouTube-style fixed skeleton placeholder for Section A (Simulation Control Toolbar).
 * Exactly preserves the h-[38px] dimensions, padding, borders, gaps and button bounds.
 */
export const SimulationControlToolbarSkeleton: React.FC = () => (
  <div className="w-full h-[38px] min-h-[38px] max-h-[38px] flex items-center justify-between gap-1.5 p-1 bg-black/95 border border-white/20 pointer-events-auto overflow-x-auto scrollbar-none rounded-none select-none text-[9.5px] font-mono shrink-0">
    {/* Left Group Shimmer Placeholders */}
    <div className="flex items-center gap-1 shrink-0">
      <div className="w-[148px] h-7 bg-white/10 animate-pulse rounded-none" />
      <div className="h-3.5 w-px bg-white/20 mx-0.5 shrink-0" />
      <div className="w-[144px] h-7 bg-white/15 animate-pulse rounded-none" />
      <div className="w-[164px] h-7 bg-white/10 animate-pulse rounded-none" />
    </div>

    {/* Center Zoom Controls Shimmer Placeholders */}
    <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-white/15">
      <div className="w-[42px] h-4 bg-white/5 animate-pulse rounded-none" />
      <div className="w-[78px] h-6 bg-white/10 animate-pulse rounded-none" />
      <div className="w-[82px] h-6 bg-white/10 animate-pulse rounded-none" />
      <div className="w-[82px] h-6 bg-white/10 animate-pulse rounded-none" />
      <div className="w-6 h-6 bg-white/10 animate-pulse rounded-none" />
      <div className="w-6 h-6 bg-white/10 animate-pulse rounded-none" />
    </div>

    {/* Right Toggles Shimmer Placeholders */}
    <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-white/15">
      <div className="w-[54px] h-6 bg-white/10 animate-pulse rounded-none" />
      <div className="w-[78px] h-6 bg-white/10 animate-pulse rounded-none" />
      <div className="w-[54px] h-6 bg-white/10 animate-pulse rounded-none" />
      <div className="w-[42px] h-6 bg-white/10 animate-pulse rounded-none" />
      <div className="w-6 h-6 bg-white/10 animate-pulse rounded-none" />
    </div>
  </div>
);

/**
 * Section A: Simulation Control Toolbar (Memoized & Permanently Mounted)
 * Fixed height, locked button dimensions, preserved horizontal scroll, and zero layout shift.
 */
export const SimulationControlToolbar: React.FC<SimulationControlToolbarProps> = React.memo(({
  onFocusMoon,
  onZoomMoonClose,
  onZoomEarthMoon,
  onZoomSystemOverview,
  onStepZoom,
  showOrbits,
  onToggleOrbits,
  showAxialTilts,
  onToggleAxialTilts,
  showLabels,
  onToggleLabels,
  showHud,
  onToggleHud,
  isFullscreen,
  onToggleFullscreen,
  isLoading = false,
}) => {
  if (isLoading) {
    return <SimulationControlToolbarSkeleton />;
  }

  return (
    <div className="w-full h-[38px] min-h-[38px] max-h-[38px] flex items-center justify-between gap-1.5 p-1 bg-black/95 border border-white/20 pointer-events-auto overflow-x-auto scrollbar-none rounded-none select-none text-[9.5px] font-mono shrink-0">
      {/* Left Group: Unified Heliocentric Brand & Focus Target Switcher */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Unified System Badge */}
        <div
          title="Heliocentric origin at Sun (0,0,0) with authentic Keplerian orbital propagation"
          className="flex items-center gap-1.5 px-2.5 h-7 bg-white/10 border border-white/25 text-white font-mono text-[9.5px] font-bold tracking-wider uppercase shrink-0 min-w-[148px]"
        >
          <Sun size={12} className="text-amber-400 shrink-0" />
          <span className="truncate">SUN-CENTRIC SYSTEM</span>
        </div>

        <div className="h-3.5 w-px bg-white/20 mx-0.5 shrink-0" />

        {/* Camera Focus: Moon (Primary Focus Target) */}
        <button
          type="button"
          onClick={onFocusMoon}
          title="Lock camera focus on the Moon with dynamic orbital tracking"
          className="flex items-center justify-center gap-1.5 px-2.5 h-7 text-[9.5px] font-mono uppercase font-bold tracking-[0.12em] bg-[#58D8D0] text-black font-extrabold shadow-[0_0_12px_rgba(88,216,208,0.4)] cursor-pointer rounded-none shrink-0 min-w-[144px]"
        >
          <Crosshair size={11} className="text-black shrink-0" />
          <span className="truncate">ZOOM TARGET: MOON</span>
        </button>

        {/* Moon Trek WMTS Active Badge */}
        <div
          title="NASA Moon Trek CesiumJS OGC WMTS active in unified solar system"
          className="flex items-center justify-center gap-1.5 px-2 h-7 text-[9px] font-mono uppercase font-bold tracking-[0.1em] bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 rounded-none shrink-0 min-w-[164px]"
        >
          <Globe size={11} className="text-emerald-400 shrink-0" />
          <span className="truncate">MOON TREK WMTS ACTIVE</span>
        </div>
      </div>

      {/* Center-Right Group: Moon-Centric Zoom Presets & In/Out Steppers */}
      <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-white/15">
        <span className="text-[8.5px] font-mono uppercase text-white/50 px-1 font-bold shrink-0 w-[42px] text-center">
          ZOOM:
        </span>

        {/* Zoom Moon Close */}
        <button
          type="button"
          onClick={onZoomMoonClose}
          title="Zoom in close specifically around the Moon to inspect craters & landing sites"
          className="px-2 h-6 flex items-center justify-center text-[9px] font-mono uppercase font-bold text-[#00FF9D] hover:bg-[#00FF9D]/15 border border-[#00FF9D]/40 transition-colors cursor-pointer rounded-none shrink-0 min-w-[78px]"
        >
          Moon Close
        </button>

        {/* Zoom Earth-Moon */}
        <button
          type="button"
          onClick={onZoomEarthMoon}
          title="Medium zoom framing Earth and Moon revolving together"
          className="px-2 h-6 flex items-center justify-center text-[9px] font-mono uppercase font-bold text-[#58D8D0] hover:bg-[#58D8D0]/15 border border-[#58D8D0]/30 transition-colors cursor-pointer rounded-none shrink-0 min-w-[82px]"
        >
          Earth–Moon
        </button>

        {/* Zoom Full System */}
        <button
          type="button"
          onClick={onZoomSystemOverview}
          title="Zoom out to complete Sun-centric solar system framing"
          className="px-2 h-6 flex items-center justify-center text-[9px] font-mono uppercase font-bold text-amber-300 hover:bg-amber-400/15 border border-amber-400/30 transition-colors cursor-pointer rounded-none shrink-0 min-w-[82px]"
        >
          Full System
        </button>

        {/* Zoom Steppers (+) and (-) */}
        <button
          type="button"
          onClick={() => onStepZoom(0.72)}
          title="Zoom In towards current focus target"
          className="w-6 h-6 flex items-center justify-center text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors cursor-pointer rounded-none shrink-0"
        >
          <ZoomIn size={11} />
        </button>
        <button
          type="button"
          onClick={() => onStepZoom(1.38)}
          title="Zoom Out away from current focus target"
          className="w-6 h-6 flex items-center justify-center text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-colors cursor-pointer rounded-none shrink-0"
        >
          <ZoomOut size={11} />
        </button>
      </div>

      {/* Right Group: Visual Toggles & Fullscreen */}
      <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-white/15">
        {/* Orbits Toggle */}
        <button
          type="button"
          onClick={onToggleOrbits}
          title="Toggle Earth & Moon orbital paths"
          className={`px-1.5 h-6 flex items-center justify-center text-[8.5px] font-mono uppercase font-bold transition-colors cursor-pointer rounded-none shrink-0 min-w-[54px] ${
            showOrbits
              ? 'bg-[#58D8D0]/20 text-[#58D8D0] border border-[#58D8D0]/40'
              : 'text-white/40 hover:text-white border border-white/10'
          }`}
        >
          Orbits
        </button>

        {/* Axial Tilts Toggle */}
        <button
          type="button"
          onClick={onToggleAxialTilts}
          title="Toggle Sun (7.25°), Earth (23.44°), and Moon (1.54°) axial tilt lines & graticules"
          className={`px-1.5 h-6 flex items-center justify-center text-[8.5px] font-mono uppercase font-bold transition-colors cursor-pointer rounded-none shrink-0 min-w-[78px] ${
            showAxialTilts
              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
              : 'text-white/40 hover:text-white border border-white/10'
          }`}
        >
          Tilts & Axes
        </button>

        {/* Labels Toggle */}
        <button
          type="button"
          onClick={onToggleLabels}
          title="Toggle celestial body labels"
          className={`px-1.5 h-6 flex items-center justify-center text-[8.5px] font-mono uppercase font-bold transition-colors cursor-pointer rounded-none shrink-0 min-w-[54px] ${
            showLabels
              ? 'bg-white/20 text-white border border-white/30'
              : 'text-white/40 hover:text-white border border-white/10'
          }`}
        >
          Labels
        </button>

        {/* Telemetry HUD Toggle */}
        <button
          type="button"
          onClick={onToggleHud}
          title="Toggle astronomical telemetry dossier"
          className={`px-1.5 h-6 flex items-center justify-center text-[8.5px] font-mono uppercase font-bold transition-colors cursor-pointer rounded-none shrink-0 min-w-[42px] ${
            showHud
              ? 'bg-white text-black font-extrabold border border-white'
              : 'text-white/50 hover:text-white border border-white/15'
          }`}
        >
          HUD
        </button>

        {/* Fullscreen */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Simulator'}
          className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer border border-white/15 rounded-none shrink-0"
        >
          {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
        </button>
      </div>
    </div>
  );
});

SimulationControlToolbar.displayName = 'SimulationControlToolbar';

