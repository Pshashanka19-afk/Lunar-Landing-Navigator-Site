import React, { useState } from 'react';
import { Compass, Check, Plus, AlertTriangle } from 'lucide-react';
import { type MapSiteItem } from './LunarInteractiveMap';

interface MiniLunarMapSelectorProps {
  sites: MapSiteItem[];
  selectedSiteId: string;
  onSelectSite: (site: MapSiteItem) => void;
  onRegisterCustomCoordinates?: (lat: number, lon: number, name: string) => void;
  className?: string;
}

export const MiniLunarMapSelector: React.FC<MiniLunarMapSelectorProps> = ({
  sites,
  selectedSiteId,
  onSelectSite,
  onRegisterCustomCoordinates,
  className = '',
}) => {
  const [showCustomDrawer, setShowCustomDrawer] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('Custom Artemis Target');
  const [customLat, setCustomLat] = useState<number>(-89.5);
  const [customLon, setCustomLon] = useState<number>(120.0);
  const [customError, setCustomError] = useState<string | null>(null);

  const selectedSite = sites.find((s) => s.id === selectedSiteId) || sites[0];

  const handleRegisterCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customLat < -90 || customLat > -80) {
      setCustomError('Latitude must be within the South Polar exploration zone (-90° to -80°S).');
      return;
    }
    if (customLon < -180 || customLon > 180) {
      setCustomError('Longitude must be between -180° and +180°.');
      return;
    }
    setCustomError(null);

    const newSite: MapSiteItem = {
      id: `custom-${Date.now()}`,
      name: customName || `Target (${Math.abs(customLat).toFixed(2)}°S)`,
      latitudeDeg: customLat,
      longitudeDeg: customLon,
      elevationMeters: 0,
      pinColor: '#00FF9D',
      isCustom: true,
      isDemCovered: true,
    };

    onSelectSite(newSite);
    if (onRegisterCustomCoordinates) {
      onRegisterCustomCoordinates(customLat, customLon, customName);
    }
    setShowCustomDrawer(false);
  };

  // Convert south polar latitude and longitude to 2D polar projection SVG coordinates
  // South Pole (-90°) at center (100, 100), -80° at edge (radius 88px)
  const getSvgCoordinates = (lat: number, lon: number) => {
    const colatitude = 90 - Math.abs(lat); // 0 at pole, 10 at -80°
    const maxColat = 10;
    const r = (colatitude / maxColat) * 85; // Radius 0 to 85px
    const lonRad = (lon * Math.PI) / 180;
    const x = 100 + r * Math.sin(lonRad);
    const y = 100 - r * Math.cos(lonRad);
    return { x, y };
  };

  return (
    <div className={`flex flex-col gap-3 bg-black/90 border border-white/20 p-3 rounded-none font-mono ${className}`}>
      
      {/* Header with Active Site Datum */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[10px]">
        <div className="flex items-center gap-2">
          <Compass size={13} className="text-[#58D8D0]" />
          <span className="text-white font-bold uppercase tracking-wider">
            LUNAR SOUTH POLAR DESTINATION
          </span>
        </div>
        <span className="text-white/50 text-[9px]">
          80°S — 90°S LOLA HIGH-RES ZONE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        
        {/* Left: 2D Orthographic Polar Map Canvas */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-2 bg-[#06080C] border border-white/15 relative overflow-hidden">
          <svg viewBox="0 0 200 200" className="w-44 h-44 select-none">
            {/* Background Lunar Regolith Circle */}
            <circle cx="100" cy="100" r="92" fill="#0d1117" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            
            {/* Latitude Parallels (88°S, 85°S, 82°S) */}
            <circle cx="100" cy="100" r="17" fill="none" stroke="rgba(255,255,255,0.25)" strokeDasharray="2,2" strokeWidth="0.8" />
            <circle cx="100" cy="100" r="42" fill="none" stroke="rgba(255,255,255,0.18)" strokeDasharray="3,3" strokeWidth="0.8" />
            <circle cx="100" cy="100" r="68" fill="none" stroke="rgba(255,255,255,0.12)" strokeDasharray="3,3" strokeWidth="0.8" />
            
            {/* Cardinal Meridians */}
            <line x1="100" y1="8" x2="100" y2="192" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
            <line x1="8" y1="100" x2="192" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
            
            {/* Labels */}
            <text x="100" y="98" fill="#58D8D0" fontSize="6" textAnchor="middle" opacity="0.6">90°S</text>
            <text x="100" y="24" fill="#ffffff" fontSize="5" textAnchor="middle" opacity="0.4">0° PRIME</text>
            <text x="186" y="102" fill="#ffffff" fontSize="5" textAnchor="end" opacity="0.4">90°E</text>
            <text x="100" y="184" fill="#ffffff" fontSize="5" textAnchor="middle" opacity="0.4">180°</text>
            <text x="14" y="102" fill="#ffffff" fontSize="5" textAnchor="start" opacity="0.4">90°W</text>

            {/* Candidate Site Interactive Markers */}
            {sites.map((s) => {
              const { x, y } = getSvgCoordinates(s.latitudeDeg, s.longitudeDeg);
              const isSelected = s.id === selectedSiteId;
              return (
                <g 
                  key={s.id} 
                  className="cursor-pointer transition-transform hover:scale-125"
                  onClick={() => onSelectSite(s)}
                >
                  {/* Outer selection ring */}
                  {isSelected && (
                    <circle cx={x} cy={y} r="8" fill="none" stroke="#00FF9D" strokeWidth="1.2" strokeDasharray="2,2" className="animate-spin" />
                  )}
                  {/* Pin Circle */}
                  <circle 
                    cx={x} 
                    cy={y} 
                    r={isSelected ? "4.5" : "3.2"} 
                    fill={isSelected ? "#00FF9D" : (s.pinColor || "#58D8D0")} 
                    stroke="#000000" 
                    strokeWidth="1" 
                  />
                  {/* Label */}
                  <text 
                    x={x} 
                    y={y - 6} 
                    fill={isSelected ? "#FFFFFF" : "rgba(255,255,255,0.7)"} 
                    fontSize="5" 
                    fontWeight={isSelected ? "bold" : "normal"}
                    textAnchor="middle"
                  >
                    {s.name.split(' ')[0]}
                  </text>
                </g>
              );
            })}
          </svg>
          <span className="text-[8px] text-white/40 mt-1 uppercase">
            Click map pin to select touchdown target
          </span>
        </div>

        {/* Right: Site Cards & Custom Coordinate Toggle */}
        <div className="md:col-span-7 flex flex-col gap-1.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {sites.map((site) => {
              const isSelected = site.id === selectedSiteId;
              return (
                <div
                  key={site.id}
                  onClick={() => onSelectSite(site)}
                  className={`p-2 border transition-all cursor-pointer flex flex-col gap-0.5 rounded-none ${
                    isSelected
                      ? 'border-[#00FF9D] bg-[#00FF9D]/10 text-white shadow-[0_0_10px_rgba(0,255,157,0.15)]'
                      : 'border-white/20 bg-black/60 text-white/70 hover:border-white/50 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between text-[9.5px]">
                    <span className="font-bold uppercase tracking-wider truncate">
                      {site.name}
                    </span>
                    {isSelected && <Check size={11} className="text-[#00FF9D] shrink-0" />}
                  </div>

                  <div className="flex items-center justify-between text-[8px] text-white/50 tabular-nums">
                    <span>
                      {typeof site.latitudeDeg === 'number' ? Math.abs(site.latitudeDeg).toFixed(2) : '0.00'}°S,{' '}
                      {typeof site.longitudeDeg === 'number'
                        ? (site.longitudeDeg >= 0 ? `${site.longitudeDeg.toFixed(2)}°E` : `${Math.abs(site.longitudeDeg).toFixed(2)}°W`)
                        : '0.00°E'}
                    </span>
                    <span>
                      {typeof site.elevationMeters === 'number'
                        ? `${site.elevationMeters >= 0 ? '+' : ''}${site.elevationMeters.toFixed(0)}m`
                        : '0m'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Coordinate Button */}
          <button
            type="button"
            onClick={() => setShowCustomDrawer(!showCustomDrawer)}
            className="w-full py-1.5 text-[9px] font-mono uppercase font-bold text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/25 transition-colors flex items-center justify-center gap-1.5 rounded-none cursor-pointer"
          >
            <Plus size={11} />
            <span>{showCustomDrawer ? 'Hide Custom Coordinate Form' : 'Register Custom Target Coordinates'}</span>
          </button>

          {/* Expandable Custom Coordinate Form */}
          {showCustomDrawer && (
            <form onSubmit={handleRegisterCustom} className="p-2.5 bg-black border border-white/25 flex flex-col gap-2 animate-fadeIn">
              <div className="text-[9px] text-[#58D8D0] font-bold uppercase tracking-wider">
                Custom Lunar Landing Site
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[8.5px]">
                <div className="flex flex-col gap-1">
                  <span className="text-white/60">SITE LABEL:</span>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="bg-white/10 border border-white/30 text-white px-1.5 py-1 text-[9px] outline-none font-mono rounded-none"
                    placeholder="Site Designation"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-white/60">LATITUDE (-90° to -80°):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="-90"
                    max="-80"
                    value={customLat}
                    onChange={(e) => setCustomLat(parseFloat(e.target.value) || -89.5)}
                    className="bg-white/10 border border-white/30 text-white px-1.5 py-1 text-[9px] outline-none font-mono rounded-none tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-white/60">LONGITUDE (-180° to +180°):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="-180"
                    max="180"
                    value={customLon}
                    onChange={(e) => setCustomLon(parseFloat(e.target.value) || 0)}
                    className="bg-white/10 border border-white/30 text-white px-1.5 py-1 text-[9px] outline-none font-mono rounded-none tabular-nums"
                  />
                </div>
              </div>

              {customError && (
                <div className="text-amber-400 text-[8px] flex items-center gap-1">
                  <AlertTriangle size={10} />
                  <span>{customError}</span>
                </div>
              )}

              <button
                type="submit"
                className="py-1 px-3 bg-[#58D8D0] hover:bg-white text-black font-bold text-[9px] uppercase tracking-wider cursor-pointer rounded-none transition-colors self-end"
              >
                Apply Custom Coordinates
              </button>
            </form>
          )}

          {/* Active Target Banner */}
          <div className="p-1.5 bg-black/80 border border-white/15 rounded-none flex items-center justify-between text-[8.5px]">
            <span className="text-white/60">SELECTED TARGET:</span>
            <span className="text-[#00FF9D] font-bold uppercase">{selectedSite?.name || 'Site'}</span>
            <span className="text-white/40 tabular-nums">
              ({typeof selectedSite?.latitudeDeg === 'number' ? Math.abs(selectedSite.latitudeDeg).toFixed(2) : '0.00'}°S,{' '}
               {typeof selectedSite?.longitudeDeg === 'number' ? selectedSite.longitudeDeg.toFixed(2) : '0.00'}°E)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
