import React from 'react';
import {
  Sun,
  Globe,
  Activity,
  Compass,
  Layers,
} from 'lucide-react';
import type { MapSiteItem, DatasetLayerType } from './LunarInteractiveMap';
import { formatSiteShortName } from './LunarInteractiveMap';

// =============================================================================
// SUB-PART B1: SIMULATION STATUS HEADER (TOP HEADER BAR IN MISSION BROWSER)
// =============================================================================

export interface SimulationStatusHeaderProps {
  epochDate: string;
  isLoading?: boolean;
}

export const SimulationStatusHeaderSkeleton: React.FC = () => (
  <div className="w-full h-[38px] min-h-[38px] max-h-[38px] flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-white/10 px-1 overflow-x-auto scrollbar-none whitespace-nowrap select-none font-mono text-xs shrink-0">
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="w-[340px] h-7 bg-white/10 animate-pulse rounded-none" />
      <div className="w-[220px] h-7 bg-white/10 animate-pulse rounded-none" />
    </div>
    <div className="w-[260px] h-5 bg-white/5 animate-pulse rounded-none ml-auto shrink-0" />
  </div>
);

export const SimulationStatusHeader: React.FC<SimulationStatusHeaderProps> = React.memo(({
  epochDate,
  isLoading = false,
}) => {
  if (isLoading) {
    return <SimulationStatusHeaderSkeleton />;
  }

  return (
    <div className="w-full h-[38px] min-h-[38px] max-h-[38px] flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-white/10 px-1 overflow-x-auto scrollbar-none whitespace-nowrap select-none font-mono text-xs shrink-0">
      {/* Left Badges */}
      <div className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider shrink-0">
        <div className="flex items-center gap-2 px-3 h-7 bg-[#070A0F] border border-[#58D8D0]/40 text-[#58D8D0] shadow-[0_0_15px_rgba(88,216,208,0.2)] shrink-0">
          <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">UNIFIED HELIOCENTRIC SYSTEM (SUN → EARTH → MOON)</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 h-7 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 shrink-0">
          <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">NASA MOON TREK WMTS INTEGRATED</span>
        </div>
      </div>

      {/* Right Synchronized Date (Fixed Reserved Width) */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 shrink-0 ml-auto min-w-[270px] justify-end">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        <span className="truncate">SYNCHRONIZED WITH CANDIDATE SITE DATE:</span>
        <span className="text-slate-200 font-bold tabular-nums min-w-[80px] text-right shrink-0">
          {epochDate}
        </span>
      </div>
    </div>
  );
});

SimulationStatusHeader.displayName = 'SimulationStatusHeader';

// =============================================================================
// SUB-PART B2: SIMULATION CONFIGURATION TOOLBAR (TIER 2 IN 3D MAP)
// =============================================================================

export interface SimulationConfigToolbarProps {
  sites: MapSiteItem[];
  selectedSiteId: string;
  onSelectSite: (site: MapSiteItem) => void;
  activeLayer: DatasetLayerType;
  onSelectLayer: (layer: DatasetLayerType) => void;
  isLoading?: boolean;
}

export const SimulationConfigToolbarSkeleton: React.FC = () => (
  <div className="w-full h-[38px] min-h-[38px] max-h-[38px] flex items-center justify-between gap-1.5 p-1 bg-black/90 border border-white/15 pointer-events-auto overflow-x-auto scrollbar-none rounded-none text-[9.5px] font-mono select-none whitespace-nowrap shrink-0">
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-[185px] h-6 bg-white/10 animate-pulse rounded-none" />
      <div className="w-[210px] h-6 bg-white/10 animate-pulse rounded-none" />
    </div>

    <div className="flex items-center gap-2 ml-auto shrink-0">
      <div className="w-[220px] sm:w-[250px] h-6 bg-white/10 animate-pulse rounded-none" />
      <div className="w-[64px] h-4 bg-white/5 animate-pulse rounded-none ml-1" />
      <div className="w-[96px] h-6 bg-white/10 animate-pulse rounded-none" />
      <div className="w-[92px] h-6 bg-white/10 animate-pulse rounded-none" />
      <div className="w-[102px] h-6 bg-white/10 animate-pulse rounded-none" />
      <div className="w-[76px] h-6 bg-white/10 animate-pulse rounded-none" />
    </div>
  </div>
);

export const SimulationConfigToolbar: React.FC<SimulationConfigToolbarProps> = React.memo(({
  sites,
  selectedSiteId,
  onSelectSite,
  activeLayer,
  onSelectLayer,
  isLoading = false,
}) => {
  if (isLoading) {
    return <SimulationConfigToolbarSkeleton />;
  }

  return (
    <div className="w-full h-[38px] min-h-[38px] max-h-[38px] flex items-center justify-between gap-1.5 p-1 bg-black/90 border border-white/15 pointer-events-auto overflow-x-auto scrollbar-none rounded-none text-[9.5px] font-mono select-none whitespace-nowrap shrink-0">
      {/* Left: Documented Visual Scale Disclaimer */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="flex items-center gap-1 text-[#00FF9D] font-bold px-1.5 h-6 shrink-0">
          <Activity size={11} className="shrink-0" />
          <span className="truncate">CONTINUOUS HELIOCENTRIC SCENE</span>
        </span>
        <span className="text-white/30 shrink-0">•</span>
        <span className="text-amber-300 font-extrabold tracking-wider bg-amber-400/10 px-2 h-6 flex items-center border border-amber-400/30 shrink-0">
          VISUAL SCALE: COMPRESSED — NOT TO SCALE
        </span>
      </div>

      {/* Center-Right: Jump to Landing Site & Dataset Layer */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        {/* Jump to Candidate Landing Site Dropdown (Fixed Width) */}
        <div className="flex items-center gap-1 shrink-0">
          <Compass size={11} className="text-[#58D8D0] shrink-0" />
          <select
            value={selectedSiteId}
            onChange={(e) => {
              const s = sites.find((x) => x.id === e.target.value);
              if (s) onSelectSite(s);
            }}
            title="Jump camera specifically to South Pole landing site on the Moon"
            className="w-[200px] sm:w-[240px] h-6 bg-black border border-white/25 hover:border-white/50 text-white font-mono text-[9px] font-bold px-2 outline-none cursor-pointer uppercase tracking-wider rounded-none truncate shrink-0"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id} className="bg-[#08090C] text-white">
                SITE: {formatSiteShortName(s.name)} ({Math.abs(s.latitudeDeg).toFixed(1)}°S)
              </option>
            ))}
          </select>
        </div>

        {/* Moon Dataset Texture Layer Switcher (NASA Moon Trek WMTS & Three.js Fallback) */}
        <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-white/15">
          <Layers size={10} className="text-[#00FF9D] shrink-0" />
          <span className="text-[8.5px] uppercase tracking-wider text-white/50 font-bold shrink-0 w-[64px] text-center">
            MAP LAYER:
          </span>
          <button
            type="button"
            onClick={() => onSelectLayer('MOON_TREK_WAC')}
            title="NASA Moon Trek LROC WAC Global Mosaic (100m/pixel OGC WMTS)"
            className={`w-[96px] h-6 flex items-center justify-center text-[9px] font-mono uppercase font-bold tracking-wider transition-all cursor-pointer rounded-none shrink-0 ${
              activeLayer === 'MOON_TREK_WAC'
                ? 'bg-[#00FF9D] text-black font-extrabold border border-[#00FF9D]'
                : 'text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
            }`}
          >
            LROC WAC 100M
          </button>
          <button
            type="button"
            onClick={() => onSelectLayer('MOON_TREK_RELIEF')}
            title="NASA Moon Trek LOLA + Kaguya Grayscale Relief (59m/pixel)"
            className={`w-[92px] h-6 flex items-center justify-center text-[9px] font-mono uppercase font-bold tracking-wider transition-all cursor-pointer rounded-none shrink-0 ${
              activeLayer === 'MOON_TREK_RELIEF'
                ? 'bg-[#58D8D0] text-black font-extrabold border border-[#58D8D0]'
                : 'text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
            }`}
          >
            Kaguya Relief
          </button>
          <button
            type="button"
            onClick={() => onSelectLayer('MOON_TREK_LOLA')}
            title="NASA Moon Trek LOLA Altimetry Color Shading"
            className={`w-[102px] h-6 flex items-center justify-center text-[9px] font-mono uppercase font-bold tracking-wider transition-all cursor-pointer rounded-none shrink-0 ${
              activeLayer === 'MOON_TREK_LOLA'
                ? 'bg-[#ECC068] text-black font-extrabold border border-[#ECC068]'
                : 'text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
            }`}
          >
            LOLA Altimetry
          </button>
          <button
            type="button"
            onClick={() => onSelectLayer('LROC_IMAGERY')}
            title="Three.js 4K LROC Photometry Texture"
            className={`w-[76px] h-6 flex items-center justify-center text-[9px] font-mono uppercase font-bold tracking-wider transition-all cursor-pointer rounded-none shrink-0 ${
              activeLayer === 'LROC_IMAGERY'
                ? 'bg-white text-black font-extrabold border border-white'
                : 'text-white/40 hover:text-white hover:bg-white/10 border border-transparent'
            }`}
          >
            4K Texture
          </button>
        </div>
      </div>
    </div>
  );
});

SimulationConfigToolbar.displayName = 'SimulationConfigToolbar';

