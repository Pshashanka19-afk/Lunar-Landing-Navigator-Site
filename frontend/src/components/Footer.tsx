import React from 'react';
import { Link } from '../router';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-black text-white/70 border-t border-white/15">
      <div className="w-full px-4 sm:px-8 lg:px-16 py-16 max-w-7xl mx-auto">
        {/* Top bar with system status */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-8 mb-12 gap-4 border-b border-white/15">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <span className="font-display-hero text-base sm:text-lg text-white tracking-[0.16em] font-bold uppercase">
              LUNARIS TELEMETRY CORE
            </span>
            <span className="font-mono text-[9px] sm:text-[10px] text-white/40 tracking-[0.2em] uppercase">
              REVISION 2026.4 // MULTI-PAGE CONSOLE
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-black border border-white/20 text-white font-mono text-[11px]">
              <span className="w-2 h-2 bg-[#FFFFFF] animate-pulse" />
              <span className="font-semibold tracking-[0.15em] uppercase">
                STATUS: NOMINAL // SPICE ONLINE
              </span>
            </div>
          </div>
        </div>

        {/* 4-Column Link Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-[11px] text-white uppercase tracking-[0.2em] font-bold">
              Mission Modules
            </span>
            <Link href="/" className="font-mono text-[11px] text-white/60 hover:text-white transition-colors">
              01 — Home
            </Link>
            <Link href="/mission-browser" className="font-mono text-[11px] text-white/60 hover:text-white transition-colors">
              02 — Mission Browser
            </Link>
            <Link href="/route-planner" className="font-mono text-[11px] text-white/60 hover:text-white transition-colors">
              03 — Route Planner
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <span className="font-mono text-[11px] text-white uppercase tracking-[0.2em] font-bold">
              3D Planetary Simulation
            </span>
            <Link href="/mission-browser" className="font-mono text-[11px] text-white/60 hover:text-white transition-colors">
              NASA LOLA 3D Terrain
            </Link>
            <Link href="/mission-browser" className="font-mono text-[11px] text-white/60 hover:text-white transition-colors">
              SPICE DE440 Ephemeris Engine
            </Link>
            <Link href="/mission-browser" className="font-mono text-[11px] text-white/60 hover:text-white transition-colors">
              Multi-Site Trade-Off Matrix
            </Link>
            <Link href="/mission-browser" className="font-mono text-[11px] text-white/60 hover:text-white transition-colors">
              Topocentric Telemetry Dossier
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <span className="font-mono text-[11px] text-white uppercase tracking-[0.2em] font-bold">
              Planetary Ephemeris
            </span>
            <a href="https://naif.jpl.nasa.gov/naif/" target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-white/60 hover:text-white transition-colors">
              NAIF SPICE Toolkit
            </a>
            <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-white/60 hover:text-white transition-colors">
              JPL Horizons System
            </a>
            <a href="https://pds-geosciences.wustl.edu/" target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-white/60 hover:text-white transition-colors">
              PDS Geosciences Node
            </a>
            <a href="https://pgda.gsfc.nasa.gov/" target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-white/60 hover:text-white transition-colors">
              LRO LOLA Polar DEMs
            </a>
          </div>

          <div className="flex flex-col gap-3">
            <span className="font-mono text-[11px] text-white uppercase tracking-[0.2em] font-bold">
              Challenge Specs
            </span>
            <span className="font-mono text-[11px] text-white/40">
              NASA Space Apps 2026
            </span>
            <span className="font-mono text-[11px] text-white/40">
              Challenge: Lunar Horizon
            </span>
            <span className="font-mono text-[11px] text-white/40">
              Datum: MOON_ME (IAU/IAG)
            </span>
            <span className="font-mono text-[11px] text-[#FFFFFF]/80">
              Solar Irradiance &amp; DTE Engine
            </span>
          </div>
        </div>

        {/* Bottom copyright & attribution */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono text-[10px] text-white/40">
          <div>
            © 2026 EXPEDITION LUNARIS // DEVELOPED FOR THE 2026 NASA SPACE APPS CHALLENGE.
          </div>
          <div className="flex items-center gap-4">
            <span>NO LOGIN OR REGISTRATION REQUIRED</span>
            <span>OPEN DATA &amp; CITATIONS INCLUDED</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
