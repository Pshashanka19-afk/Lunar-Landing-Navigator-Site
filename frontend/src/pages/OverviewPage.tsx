import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, Compass, ArrowDown, ChevronRight } from 'lucide-react';
import { Link } from '../router';
import { Hero } from '../components/Hero';
import { ThreeSunEarthMoon } from '../components/ThreeSunEarthMoon';
import { IMAGES } from '../data/images';

interface CinematicSectionProps {
  id: string;
  index: string;
  eyebrow: string;
  headline: string;
  supportingText: string;
  primaryAction: {
    label: string;
    href?: string;
    onClick?: () => void;
    isPrimary?: boolean;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  bgMedia: {
    type: 'image' | 'video' | 'three';
    src?: string;
    poster?: string;
  };
}

const CinematicSection: React.FC<CinematicSectionProps> = ({
  id,
  index,
  eyebrow,
  headline,
  supportingText,
  primaryAction,
  secondaryAction,
  bgMedia,
}) => {
  const containerRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // Smooth cinematic image scaling & parallax
  const bgScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.12, 1.0, 1.08]);
  const bgY = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);
  const contentY = useTransform(scrollYProgress, [0.15, 0.5], [40, 0]);
  const contentOpacity = useTransform(scrollYProgress, [0.15, 0.45], [0, 1]);

  return (
    <section
      ref={containerRef}
      id={id}
      className="relative w-full min-h-[100dvh] h-auto sm:h-screen sm:min-h-screen flex items-end pt-24 pb-16 sm:pb-24 lg:pb-28 px-4 sm:px-12 lg:px-24 overflow-hidden select-none bg-[#08090C]"
    >
      {/* Background Media */}
      <motion.div
        className={`absolute inset-0 z-0 overflow-hidden ${bgMedia.type === 'three' ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{ scale: bgScale, y: bgY }}
      >
        {bgMedia.type === 'video' && bgMedia.src && (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={bgMedia.poster}
            className="w-full h-full object-cover object-center"
          >
            <source src={bgMedia.src} type="video/mp4" />
          </video>
        )}

        {bgMedia.type === 'image' && bgMedia.src && (
          <img
            src={bgMedia.src}
            alt={headline}
            className="w-full h-full object-cover object-center"
            loading="lazy"
          />
        )}

        {bgMedia.type === 'three' && (
          <div className="w-full h-full pointer-events-auto">
            <ThreeSunEarthMoon className="w-full h-full" />
          </div>
        )}
      </motion.div>

      {/* Atmospheric Aerospace Vignette & Readability Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#08090C]/92 via-[#08090C]/45 to-transparent z-[1] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-transparent to-black/50 z-[1] pointer-events-none" />

      {/* Top-Right Index Pill */}
      <div className="absolute top-8 right-6 sm:right-12 z-10 hidden sm:flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-md border border-white/15 text-white/70 font-mono text-xs tracking-[0.25em] uppercase">
        <span className="w-1.5 h-1.5 bg-[#FFFFFF] rounded-full animate-pulse" />
        <span>SECTION {index} // 06</span>
      </div>

      {/* Left-Anchored SpaceX-Style Aerospace Typography */}
      <motion.div
        className="relative z-10 max-w-3xl flex flex-col items-start gap-4 sm:gap-6 pointer-events-none"
        style={{ y: contentY, opacity: contentOpacity }}
      >
        {/* Eyebrow */}
        <div className="flex items-center gap-2.5 text-[#FFFFFF] font-mono text-xs sm:text-sm uppercase tracking-[0.25em] sm:tracking-[0.3em] font-semibold">
          <span className="w-1.5 h-1.5 bg-[#FFFFFF]" />
          <span>{eyebrow}</span>
        </div>

        {/* Large Bold Uppercase Headline */}
        <h2 className="font-display-hero text-2xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-[68px] text-white font-bold tracking-[0.02em] leading-[1.08] sm:leading-[1.04] uppercase">
          {headline}
        </h2>

        {/* Minimal Supporting Description */}
        <p className="font-body-lg text-sm sm:text-lg lg:text-xl text-white/80 max-w-xl leading-relaxed font-light">
          {supportingText}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-5 pt-2 sm:pt-3 pointer-events-auto w-full sm:w-auto">
          {primaryAction.href ? (
            <Link
              href={primaryAction.href}
              className={`w-full sm:w-auto justify-center px-6 sm:px-8 py-3.5 sm:py-4 font-mono text-xs sm:text-sm uppercase tracking-[0.22em] font-bold transition-all duration-300 flex items-center gap-3 ${
                primaryAction.isPrimary
                  ? 'bg-[#FFFFFF] hover:bg-[#E2E8F0] text-black shadow-[0_0_25px_rgba(255, 255, 255, 0.35)]'
                  : 'border border-white hover:border-[#FFFFFF] hover:bg-white text-white hover:text-black'
              }`}
            >
              <span>{primaryAction.label}</span>
              <ArrowRight size={14} className={primaryAction.isPrimary ? 'text-black' : 'text-[#FFFFFF]'} />
            </Link>
          ) : (
            <button
              onClick={primaryAction.onClick}
              className="w-full sm:w-auto justify-center px-6 sm:px-8 py-3.5 sm:py-4 border border-white hover:border-[#FFFFFF] hover:bg-white text-white hover:text-black font-mono text-xs sm:text-sm uppercase tracking-[0.22em] font-bold transition-all duration-300 flex items-center gap-3 cursor-pointer group"
            >
              <span>{primaryAction.label}</span>
              <ArrowDown size={14} className="text-[#FFFFFF] group-hover:text-black transition-transform group-hover:translate-y-1" />
            </button>
          )}

          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="w-full sm:w-auto justify-center px-6 sm:px-8 py-3.5 sm:py-4 border border-white/25 hover:border-white/60 bg-white/5 hover:bg-white/10 text-white font-mono text-xs sm:text-sm uppercase tracking-[0.2em] font-semibold transition-all duration-300 flex items-center gap-2 backdrop-blur-sm cursor-pointer"
            >
              <span>{secondaryAction.label}</span>
              <ChevronRight size={14} className="text-white/60" />
            </Link>
          )}
        </div>
      </motion.div>
    </section>
  );
};

export const OverviewPage: React.FC = () => {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full bg-[#08090C] flex flex-col text-white">
      {/* 100vh SpaceX-Grade Cinematic Hero */}
      <Hero />

      {/* SECTION 01 — THE MISSION */}
      <CinematicSection
        id="story-section-01"
        index="01"
        eyebrow="01 // TRANSLUNAR EXPEDITION"
        headline="HUMANITY IS GOING BACK TO THE MOON."
        supportingText="But reaching the surface is only the beginning."
        primaryAction={{
          label: 'EXPLORE THE MISSION',
          onClick: () => scrollToSection('story-section-02'),
        }}
        secondaryAction={{
          label: 'MISSION BROWSER',
          href: '/mission-browser',
        }}
        bgMedia={{
          type: 'image',
          src: IMAGES.clpsLander,
        }}
      />

      {/* SECTION 02 — POLAR ILLUMINATION */}
      <CinematicSection
        id="story-section-02"
        index="02"
        eyebrow="02 // POLAR ILLUMINATION"
        headline="LIGHT IS NEVER GUARANTEED."
        supportingText="At the lunar south pole, even nearby terrain can determine whether a landing site receives sunlight."
        primaryAction={{
          label: 'EXPLORE MISSION BROWSER',
          href: '/mission-browser',
        }}
        secondaryAction={{
          label: 'ROUTE PLANNER',
          href: '/route-planner',
        }}
        bgMedia={{
          type: 'image',
          src: IMAGES.psrTerminator,
        }}
      />

      {/* SECTION 03 — TRAJECTORY & NAVIGATION */}
      <CinematicSection
        id="story-section-03"
        index="03"
        eyebrow="03 // TRANSLUNAR TRAJECTORY"
        headline="OPTIMIZING FLIGHT PATHS."
        supportingText="Calculate transfer durations, orbital insertion requirements, and surface illumination conditions at arrival."
        primaryAction={{
          label: 'TRAJECTORY PLANNER',
          href: '/route-planner',
        }}
        secondaryAction={{
          label: 'MISSION BROWSER',
          href: '/mission-browser',
        }}
        bgMedia={{
          type: 'three',
        }}
      />

      {/* SECTION 04 — MISSION BROWSER */}
      <CinematicSection
        id="story-section-04"
        index="04"
        eyebrow="04 // CLPS LANDING SITE SELECTION"
        headline="WHERE SHOULD WE LAND?"
        supportingText="Explore lunar locations, select an observation epoch, and evaluate topocentric solar illumination and direct Earth visibility."
        primaryAction={{
          label: 'OPEN MISSION BROWSER',
          href: '/mission-browser',
          isPrimary: true,
        }}
        secondaryAction={{
          label: 'ROUTE PLANNER',
          href: '/route-planner',
        }}
        bgMedia={{
          type: 'image',
          src: IMAGES.lolaDem,
        }}
      />

      {/* SpaceX Mission Architecture Directory & Scientific Gateway */}
      <section className="w-full py-24 sm:py-32 px-6 sm:px-12 lg:px-24 bg-[#08090C] border-b border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col gap-16">
          <div className="flex flex-col gap-3 max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#FFFFFF] font-semibold flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#FFFFFF]" />
              MISSION ARCHITECTURE // MODULE DIRECTORY
            </span>
            <h3 className="font-display-hero text-3xl sm:text-5xl font-bold uppercase tracking-tight text-white leading-tight">
              SCIENTIFIC MODULES &amp; TOOLS
            </h3>
            <p className="font-body-md text-sm sm:text-base text-white/70 leading-relaxed font-light">
              Dive directly into the validated planetary ephemeris models, astrodynamics engine, and 3D lunar terrain simulator.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: 'MISSION BROWSER',
                desc: 'Flagship unified Sun-centric 3D simulator with Moon zoom, LOLA DEM topography, and real-time SPICE ephemeris.',
                path: '/mission-browser',
                tag: 'MODULE 01',
                highlight: true,
              },
              {
                title: 'ROUTE PLANNER',
                desc: 'Translunar injection planning, multi-scenario departure windows, and surface landing condition verification.',
                path: '/route-planner',
                tag: 'MODULE 02',
              },
            ].map((mod) => (
              <Link
                key={mod.path}
                href={mod.path}
                className={`p-8 border transition-all duration-300 flex flex-col justify-between gap-6 group rounded-none ${
                  mod.highlight
                    ? 'border-white/60 bg-white/[0.04] hover:border-white hover:bg-white/[0.08]'
                    : 'border-white/15 bg-white/[0.02] hover:border-white/40 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#FFFFFF] font-bold">
                      {mod.tag}
                    </span>
                    <ArrowRight size={14} className="text-white/40 group-hover:text-[#FFFFFF] group-hover:translate-x-1 transition-all" />
                  </div>
                  <h4 className="font-display-hero text-xl sm:text-2xl font-bold uppercase text-white group-hover:text-[#FFFFFF] transition-colors">
                    {mod.title}
                  </h4>
                  <p className="font-body-md text-xs sm:text-sm text-white/65 leading-relaxed font-light">
                    {mod.desc}
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white/70 group-hover:text-white font-semibold">
                  <span>LAUNCH MODULE</span>
                  <ChevronRight size={12} className="text-[#FFFFFF]" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* SpaceX-Grade Closing Section */}
      <section className="w-full py-28 sm:py-36 px-6 sm:px-12 lg:px-24 bg-gradient-to-b from-[#08090C] via-black to-black flex flex-col items-center justify-center text-center relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#FFFFFF]/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative z-10 max-w-4xl flex flex-col items-center gap-6">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#FFFFFF] font-semibold">
            EXPEDITION LUNARIS // READY FOR LAUNCH
          </span>
          <h2 className="font-display-hero text-4xl sm:text-6xl md:text-7xl font-bold uppercase tracking-tight text-white leading-tight">
            WHERE WILL HUMANITY LAND?
          </h2>
          <p className="font-body-lg text-base sm:text-xl text-white/75 max-w-xl leading-relaxed font-light">
            Test candidate landing coordinates, calculate illumination intervals, and verify direct-to-Earth communication links in real time.
          </p>
          <div className="pt-4">
            <Link
              href="/mission-browser"
              className="px-10 py-5 bg-[#FFFFFF] hover:bg-[#E2E8F0] text-black font-mono text-sm uppercase tracking-[0.24em] font-bold transition-all duration-300 flex items-center gap-3 shadow-[0_0_30px_rgba(255, 255, 255, 0.4)] hover:shadow-[0_0_45px_rgba(255, 255, 255, 0.7)]"
            >
              <Compass size={18} className="text-black" />
              <span>LAUNCH CLPS MISSION BROWSER</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
