import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { IMAGES } from '../data/images';
import { useRouter, Link, type RoutePath } from '../router';

interface NavItem {
  path: RoutePath;
  label: string;
}

export const Header: React.FC = () => {
  const { currentPath } = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close drawer if viewport is resized to laptop/desktop (>= 1024px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Primary desktop navigation links (Laptop & Desktop)
  const desktopNavItems: NavItem[] = [
    { path: '/', label: 'HOME' },
    { path: '/route-planner', label: 'ROUTE PLANNER' },
  ];

  // Streamlined navigation items for mobile & tablet drawer menu
  const allNavItems: NavItem[] = [
    { path: '/', label: 'HOME' },
    { path: '/route-planner', label: 'ROUTE PLANNER' },
    { path: '/mission-browser', label: 'MISSION BROWSER' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 select-none border-0 border-none outline-none shadow-none ${
        isScrolled
          ? 'bg-[#08090C]/85 backdrop-blur-md py-3 sm:py-3.5'
          : 'bg-transparent py-4 sm:py-6'
      }`}
    >
      <div className="w-full px-4 sm:px-12 lg:px-20 flex items-center justify-between gap-4 sm:gap-6">
        
        {/* Left: LUNARIS Brand & Insignia */}
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3.5 group cursor-pointer">
          <div className="relative w-7 h-7 sm:w-8 sm:h-8 overflow-hidden border border-white/30 bg-black/60 flex items-center justify-center p-0.5 transition-transform duration-300 group-hover:scale-105 group-hover:border-[#FFFFFF]">
            <img 
              src={IMAGES.lunarisInsignia} 
              alt="LUNARIS Insignia" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-display-hero text-sm sm:text-lg tracking-[0.2em] sm:tracking-[0.24em] text-white font-bold uppercase transition-colors group-hover:text-[#FFFFFF]">
              LUNARIS
            </span>
            <span className="font-mono text-[8px] sm:text-[9px] text-white/50 tracking-[0.2em] sm:tracking-[0.28em] uppercase transition-colors group-hover:text-white/80">
              SPACE APPS 2026 // CALYPSO
            </span>
          </div>
        </Link>

        {/* Right: Desktop Navigation & Action Button (Visible on Laptop & Desktop: lg and above) */}
        <div className="hidden lg:flex items-center gap-7">
          <nav className="flex items-center gap-6">
            {desktopNavItems.map((item) => {
              const isActive = currentPath === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`relative py-1 font-mono text-xs uppercase tracking-[0.22em] font-bold transition-all duration-200 ${
                    isActive 
                      ? 'text-white border-b border-white' 
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <span className="font-bold">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Mission Browser Primary Action Button */}
          <Link 
            href="/mission-browser"
            className={`px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] font-bold transition-all duration-300 flex items-center justify-center cursor-pointer border rounded-none ${
              currentPath === '/mission-browser'
                ? 'bg-white text-black border-white font-extrabold'
                : 'bg-transparent text-white/80 hover:text-white border-white/30 hover:border-white hover:bg-white/5'
            }`}
          >
            <span className="font-bold">MISSION BROWSER</span>
          </Link>
        </div>

        {/* Three-line Hamburger Menu Trigger (Phone & Tablet only: hidden on laptop & desktop) */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 text-white/80 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? (
            <X size={22} className="text-white" />
          ) : (
            <div className="flex flex-col gap-1.5 w-5 justify-center items-end group">
              <span className="w-5 h-[1.5px] bg-white transition-all group-hover:bg-white" />
              <span className="w-3.5 h-[1.5px] bg-white transition-all group-hover:w-5 group-hover:bg-white" />
            </div>
          )}
        </button>
      </div>

      {/* Right-Side Off-Canvas Drawer (Phone & Tablet only) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="lg:hidden">
            {/* Backdrop Blur Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 cursor-pointer"
            />

            {/* Slide-over Panel from Right */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-[#08090C] border-l border-white/15 z-50 p-6 sm:p-8 flex flex-col justify-between select-none"
            >
              <div className="flex flex-col gap-6 overflow-y-auto pr-1">
                {/* Header inside drawer */}
                <div className="flex items-center justify-between border-b border-white/15 pb-4">
                  <div className="flex flex-col">
                    <span className="font-display-hero text-sm tracking-[0.24em] text-white font-bold uppercase">
                      LUNARIS
                    </span>
                    <span className="font-mono text-[9px] text-white/50 tracking-[0.2em] uppercase">
                      EXPEDITION NAVIGATION
                    </span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 text-white/70 hover:text-white transition-colors cursor-pointer border border-white/20 hover:border-white"
                    aria-label="Close navigation menu"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Nav Links */}
                <nav className="flex flex-col">
                  {allNavItems.map((item) => {
                    const isActive = currentPath === item.path;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`font-mono text-xs sm:text-sm uppercase tracking-[0.22em] py-3.5 border-b border-white/10 flex items-center justify-between transition-colors ${
                          isActive ? 'text-white font-bold bg-white/[0.04] px-2' : 'text-white/70 hover:text-white hover:bg-white/[0.02] px-2'
                        }`}
                      >
                        <span>{item.label}</span>
                        {isActive && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Bottom Mission Browser Action */}
              <div className="pt-6 border-t border-white/15 flex flex-col gap-3">
                <Link
                  href="/mission-browser"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-3.5 bg-transparent border border-white hover:bg-white text-white hover:text-black font-mono text-xs uppercase tracking-[0.22em] font-bold flex items-center justify-center transition-all duration-300 rounded-none"
                >
                  <span>MISSION BROWSER</span>
                </Link>
                <div className="flex items-center justify-between font-mono text-[9px] text-white/40 tracking-widest uppercase pt-2">
                  <span>NASA SPACE APPS 2026</span>
                  <span className="text-emerald-400">● LIVE</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
};
