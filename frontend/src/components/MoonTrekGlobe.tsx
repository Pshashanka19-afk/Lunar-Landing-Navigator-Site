import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { 
  Globe, 
  Layers, 
  Compass, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Sun
} from 'lucide-react';
import { type MapSiteItem } from './LunarInteractiveMap';
import { lunarApi, type MoonTrekLayerMetadata } from '../services/lunarApi';

// Lunar Reference Spheroid (IAU / NASA Mean Radius)
export const LUNAR_RADIUS_METERS = 1737400.0;

interface MoonTrekGlobeProps {
  sites: MapSiteItem[];
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
  epochDate: string;
  epochHour: number;
}

export const MoonTrekGlobe: React.FC<MoonTrekGlobeProps> = ({
  sites,
  selectedSiteId,
  onSelectSite,
  epochDate,
  epochHour,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const siteEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());

  const [layers, setLayers] = useState<MoonTrekLayerMetadata[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string>('LRO_WAC_Mosaic_Global_303ppd_v02');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [sunLightingEnabled, setSunLightingEnabled] = useState<boolean>(true);

  // Load NASA Moon Trek layer catalog
  useEffect(() => {
    let mounted = true;
    lunarApi.getMoonTrekLayers().then((loadedLayers) => {
      if (mounted && loadedLayers.length > 0) {
        setLayers(loadedLayers);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize Cesium Lunar Globe
  useEffect(() => {
    if (!containerRef.current) return;

    // Define Selenographic Ellipsoid (Moon Sphere)
    const lunarEllipsoid = new Cesium.Ellipsoid(
      LUNAR_RADIUS_METERS,
      LUNAR_RADIUS_METERS,
      LUNAR_RADIUS_METERS
    );

    // Explicitly configure Cesium Base URL for assets/workers
    (window as any).CESIUM_BASE_URL = '/cesium';

    // Geographic Tiling Scheme for Equirectangular Lunar Projections
    const lunarTilingScheme = new Cesium.GeographicTilingScheme({
      ellipsoid: lunarEllipsoid,
      numberOfLevelZeroTilesX: 2,
      numberOfLevelZeroTilesY: 1,
    });

    // Configure base NASA Moon Trek LROC WAC Imagery Provider
    const lrocProvider = new Cesium.UrlTemplateImageryProvider({
      url: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
      tilingScheme: lunarTilingScheme,
      ellipsoid: lunarEllipsoid,
      minimumLevel: 0,
      maximumLevel: 8,
      credit: new Cesium.Credit('NASA / GSFC / Arizona State University (LROC) - NASA Moon Trek WMTS', true),
    });

    // Create the Cesium Viewer dedicated to the Moon
    const viewer = new Cesium.Viewer(containerRef.current, {
      globe: new Cesium.Globe(lunarEllipsoid),
      baseLayer: new Cesium.ImageryLayer(lrocProvider),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      animation: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      vrButton: false,
      skyAtmosphere: false as any,
    });

    viewerRef.current = viewer;

    // Set black deep space background and configure globe
    viewer.scene.backgroundColor = Cesium.Color.BLACK;
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#14171a');
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.highDynamicRange = true;
    viewer.scene.globe.maximumScreenSpaceError = 2.0;
    viewer.scene.globe.tileCacheSize = 300;
    viewer.scene.globe.preloadAncestors = true;
    viewer.scene.globe.preloadSiblings = true;

    // Synchronize simulation time with Candidate Site Date & Hour
    const simIso = `${epochDate}T${epochHour.toString().padStart(2, '0')}:00:00Z`;
    try {
      const julianDate = Cesium.JulianDate.fromIso8601(simIso);
      viewer.clock.currentTime = julianDate;
      viewer.clock.shouldAnimate = false;
    } catch {
      // Default clock
    }

    // Default Camera: Looking at Lunar South Pole Artemis Exploration Zone
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        0.0,
        -88.5,
        450000.0,
        lunarEllipsoid
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-85),
        roll: 0.0,
      },
    });

    setIsInitializing(false);

    // Cleanup on unmount
    return () => {
      if (!viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  // Synchronize Simulation Date & Lighting
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const simIso = `${epochDate}T${epochHour.toString().padStart(2, '0')}:00:00Z`;
    try {
      const julianDate = Cesium.JulianDate.fromIso8601(simIso);
      viewer.clock.currentTime = julianDate;
    } catch {
      // ignore
    }
  }, [epochDate, epochHour]);

  // Toggle Sunlight Shading
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.scene.globe.enableLighting = sunLightingEnabled;
  }, [sunLightingEnabled]);

  // Handle Layer Changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const targetLayerMeta = layers.find((l) => l.id === activeLayerId);
    if (!targetLayerMeta) return;

    const lunarEllipsoid = new Cesium.Ellipsoid(
      LUNAR_RADIUS_METERS,
      LUNAR_RADIUS_METERS,
      LUNAR_RADIUS_METERS
    );
    const lunarTilingScheme = new Cesium.GeographicTilingScheme({
      ellipsoid: lunarEllipsoid,
      numberOfLevelZeroTilesX: 2,
      numberOfLevelZeroTilesY: 1,
    });

    // Remove existing imagery layers
    const imageryLayers = viewer.imageryLayers;
    imageryLayers.removeAll();

    // Create provider with the NASA Moon Trek WMTS template
    const provider = new Cesium.UrlTemplateImageryProvider({
      url: targetLayerMeta.tileUrlTemplate,
      tilingScheme: lunarTilingScheme,
      ellipsoid: lunarEllipsoid,
      minimumLevel: targetLayerMeta.minZoom,
      maximumLevel: targetLayerMeta.maxZoom,
      credit: new Cesium.Credit(targetLayerMeta.attribution, true),
    });

    imageryLayers.addImageryProvider(provider);
  }, [activeLayerId, layers]);

  // Create & Update Landing Site Markers on Lunar Surface
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const lunarEllipsoid = new Cesium.Ellipsoid(
      LUNAR_RADIUS_METERS,
      LUNAR_RADIUS_METERS,
      LUNAR_RADIUS_METERS
    );

    // Clear existing entities
    siteEntitiesRef.current.forEach((entity) => {
      viewer.entities.remove(entity);
    });
    siteEntitiesRef.current.clear();

    // Only add a Cesium entity for the currently selected site.
    // This prevents overlapping labels/pins when all 20 sites would otherwise be shown.
    const selectedSite = sites.find((s) => s.id === selectedSiteId);
    if (!selectedSite) return;

    const position = Cesium.Cartesian3.fromDegrees(
      selectedSite.longitudeDeg,
      selectedSite.latitudeDeg,
      selectedSite.elevationMeters || 0,
      lunarEllipsoid
    );

    // Create landing site pin with 3D beacon line and label (selected site only)
    const entity = viewer.entities.add({
      id: selectedSite.id,
      name: selectedSite.name,
      position: position,
      point: {
        pixelSize: 14,
        color: Cesium.Color.fromCssColorString('#00FF9D'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
      },
      label: {
        text: ` ${selectedSite.name.toUpperCase()} \n [${typeof selectedSite.latitudeDeg === 'number' ? Math.abs(selectedSite.latitudeDeg).toFixed(2) : '89.50'}°S, ${typeof selectedSite.longitudeDeg === 'number' ? selectedSite.longitudeDeg.toFixed(2) : '0.00'}°E] [ACTIVE]`,
        font: 'bold 12px "Space Mono", monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.fromCssColorString('#00FF9D'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -14),
      },
    });

    siteEntitiesRef.current.set(selectedSite.id, entity);

    // Screen-space click handler for site selection
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.id) {
        onSelectSite(pickedObject.id.id);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
    };
  }, [sites, selectedSiteId, onSelectSite]);

  // Smooth Camera Fly-To when selectedSiteId changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !selectedSiteId) return;

    const targetSite = sites.find((s) => s.id === selectedSiteId);
    if (!targetSite) return;

    const lunarEllipsoid = new Cesium.Ellipsoid(
      LUNAR_RADIUS_METERS,
      LUNAR_RADIUS_METERS,
      LUNAR_RADIUS_METERS
    );

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        targetSite.longitudeDeg,
        targetSite.latitudeDeg,
        180000.0, // 180 km altitude for close exploration
        lunarEllipsoid
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-75),
        roll: 0.0,
      },
      duration: 1.8,
    });
  }, [selectedSiteId, sites]);

  // Navigation Camera Actions
  const handleZoomIn = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.35);
  }, []);

  const handleZoomOut = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.45);
  }, []);

  const handleResetView = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const lunarEllipsoid = new Cesium.Ellipsoid(
      LUNAR_RADIUS_METERS,
      LUNAR_RADIUS_METERS,
      LUNAR_RADIUS_METERS
    );
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(0.0, -88.5, 450000.0, lunarEllipsoid),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-85),
        roll: 0,
      },
      duration: 1.5,
    });
  }, []);

  const handleFlyToSouthPole = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const lunarEllipsoid = new Cesium.Ellipsoid(
      LUNAR_RADIUS_METERS,
      LUNAR_RADIUS_METERS,
      LUNAR_RADIUS_METERS
    );
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(0.0, -89.9, 220000.0, lunarEllipsoid),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration: 2.0,
    });
  }, []);

  return (
    <div className="relative w-full h-full min-h-[640px] bg-[#020508] overflow-hidden select-none">
      {/* Cesium WebGL Container */}
      <div ref={containerRef} className="w-full h-full min-h-[640px]" />

      {/* Loading Overlay */}
      {isInitializing && (
        <div className="absolute inset-0 bg-[#060a0f]/90 flex flex-col items-center justify-center z-30">
          <div className="w-12 h-12 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin mb-4" />
          <div className="text-emerald-400 font-mono text-sm tracking-widest uppercase">
            INITIALIZING NASA MOON TREK GLOBE...
          </div>
          <div className="text-slate-400 font-mono text-xs mt-2">
            Connecting to NASA OGC WMTS (LROC WAC & LOLA Altimetry)
          </div>
        </div>
      )}

      {/* Top Banner: NASA Moon Trek System Header */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-2 bg-[#0c131c]/90 border border-slate-700/80 px-3 py-1.5 rounded backdrop-blur">
          <Globe className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-100">
            NASA MOON TREK 3D GLOBE
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            OGC WMTS
          </span>
        </div>

        {/* Candidate Landing Site Selector */}
        <div className="flex items-center gap-1.5 bg-[#0c131c]/90 border border-slate-700/80 px-2 py-1 rounded backdrop-blur">
          <Compass className="w-3.5 h-3.5 text-[#58D8D0]" />
          <select
            value={selectedSiteId}
            onChange={(e) => onSelectSite(e.target.value)}
            className="bg-transparent text-xs font-mono text-slate-200 outline-none cursor-pointer pr-1 max-w-[200px] truncate"
            title="Navigate Moon Trek Globe to Selected Candidate Landing Site"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id} className="bg-[#0c131c] text-slate-200">
                SITE: {s.name} ({Math.abs(s.latitudeDeg).toFixed(1)}°S)
              </option>
            ))}
          </select>
        </div>

        {/* Layer Selector */}
        <div className="flex items-center gap-1.5 bg-[#0c131c]/90 border border-slate-700/80 px-2 py-1 rounded backdrop-blur">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={activeLayerId}
            onChange={(e) => setActiveLayerId(e.target.value)}
            className="bg-transparent text-xs font-mono text-slate-200 outline-none cursor-pointer pr-1"
          >
            {layers.map((l) => (
              <option key={l.id} value={l.id} className="bg-[#0c131c] text-slate-200">
                {l.title} ({l.resolutionMpp}m/px)
              </option>
            ))}
          </select>
        </div>

        {/* Sunlight Toggle */}
        <button
          onClick={() => setSunLightingEnabled((prev) => !prev)}
          className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded border transition-colors ${
            sunLightingEnabled
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
              : 'bg-slate-800/80 border-slate-700 text-slate-400'
          }`}
          title="Toggle Authentic Solar Ephemeris Illumination"
        >
          <Sun className="w-3.5 h-3.5" />
          <span>{sunLightingEnabled ? 'SUN LIGHTING ON' : 'UNIFORM LIGHT'}</span>
        </button>
      </div>

      {/* Floating Right Control Palette */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-[#0c131c]/90 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 transition-colors shadow"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-[#0c131c]/90 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 transition-colors shadow"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFlyToSouthPole}
          className="p-2 bg-[#0c131c]/90 hover:bg-slate-800 border border-slate-700 rounded text-cyan-400 transition-colors shadow"
          title="Fly to Lunar South Pole (Artemis Zone)"
        >
          <Compass className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 bg-[#0c131c]/90 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 transition-colors shadow"
          title="Reset Camera"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Service Attribution Footer */}
      <div className="absolute bottom-4 right-4 z-20 hidden lg:flex items-center gap-2 bg-[#080d14]/80 border border-slate-800 px-3 py-1.5 rounded text-[11px] font-mono text-slate-400 pointer-events-auto">
        <span>DATA: NASA JPL / GSFC / ASU LROC / LOLA</span>
        <span className="text-slate-600">•</span>
        <span>ENGINE: CesiumJS</span>
      </div>
    </div>
  );
};
