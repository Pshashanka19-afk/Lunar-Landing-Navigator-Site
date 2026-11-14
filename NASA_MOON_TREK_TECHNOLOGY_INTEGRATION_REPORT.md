# NASA Moon Trek Lunar Visualization Technology Integration Report

**Project:** LUNARIS — Lunar Landing Site Navigator  
**Document:** NASA Moon Trek Technology Integration Report  
**Date:** November 2026  
**Status:** Successfully Integrated & Verified (8/8 Test Suite Passing, Production Build Verified)

---

## Executive Summary

LUNARIS has been upgraded from static lunar spherical mapping to genuine **NASA Moon Trek-grade planetary visualization technology**. The application now directly interfaces with NASA's official OGC-compliant **Web Map Tile Service (WMTS)** infrastructure hosted at `trek.nasa.gov`, streams high-resolution Lunar Reconnaissance Orbiter (LRO) imagery and altimetry, renders a precision 3D lunar globe using **CesiumJS** ($R = 1,737,400\text{ m}$), and preserves the existing heliocentric astronomical ephemeris and candidate landing site navigation systems.

The implementation follows a **cleanly separated dual-mode architecture**:
1. **NASA Moon Trek 3D Globe (CesiumJS OGC WMTS)**: Dedicated planetary globe and close-up surface exploration engine streaming authentic NASA LROC and LOLA data products with 3D candidate landing site beacons and telemetry.
2. **Orbital Ephemeris Simulation (Three.js SPICE DE440)**: Macro-scale Sun-centric celestial mechanics system displaying real-time astronomical ephemeris, Cassini axial tilts, and solar illumination geometry.

Both visualization modes share identical candidate landing site selections, Selenographic coordinates, and mission simulation dates.

---

## 1. Study of NASA Moon Trek Technology & Architecture

### 1.1 Architecture & Service Delivery Model
NASA's Solar System Treks portals (`trek.nasa.gov/moon/`) are developed by NASA Jet Propulsion Laboratory (JPL) and NASA Ames Research Center. Key architectural findings include:
- **No Proprietary Client Source Code Distribution:** NASA Moon Trek does not publish a standalone open-source client application. Instead, it provides standardized, publicly accessible OGC-compliant data services.
- **Protocol:** Open Geospatial Consortium (OGC) **Web Map Tile Service (WMTS) 1.0.0** RESTful implementation.
- **REST Catalog Services:** Solr-based catalog search endpoints (`https://trek.nasa.gov/moon/TrekServices/ws/index/eq/searchItems`) indexing over 9,300 lunar geospatial products.
- **CORS Support:** NASA's WMTS servers explicitly return `Access-Control-Allow-Origin: *`, enabling direct client-side tile streaming in modern web browsers without mandatory server-side proxying.

### 1.2 Projections & Coordinate Reference Systems
NASA Moon Trek publishes datasets in three primary projections:
| Projection | CRS Identifier | Coverage | Usage in LUNARIS |
| :--- | :--- | :--- | :--- |
| **Equirectangular (EQ)** | `urn:ogc:def:crs:EPSG::104903` | Global ($180^\circ\text{W}$ to $180^\circ\text{E}$, $90^\circ\text{S}$ to $90^\circ\text{N}$) | Primary global globe base layers and South Polar regional EQ products |
| **South Pole Stereographic (SP)** | `urn:ogc:def:crs:IAU2000::30120` | Polar ($75^\circ\text{S}$ to $90^\circ\text{S}$) | Extreme polar illumination and local slope maps |
| **North Pole Stereographic (NP)** | `urn:ogc:def:crs:IAU2000::30118` | Polar ($75^\circ\text{N}$ to $90^\circ\text{N}$) | Northern polar regions |

### 1.3 Tile Matrix Schemes & Dimensions
- **Tile Matrix Set:** `default028mm` (OGC physical pixel distance standard $0.28\text{ mm}$, corresponding to 90.7 DPI).
- **Tile Dimensions:** $256 \times 256$ pixels.
- **Zoom Level 0:** Exactly 2 columns $\times$ 1 row covering $-180^\circ$ to $+180^\circ$ longitude and $-90^\circ$ to $+90^\circ$ latitude.
- **Zoom Progression:** Matrix width doubles each zoom level ($2, 4, 8, 16, 32, 64, 128, 256, 512$).
- **Tile URL Template:**
  ```text
  https://trek.nasa.gov/tiles/Moon/EQ/{LayerName}/1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.{ext}
  ```

---

## 2. Integrated NASA Moon Trek WMTS Layers

The following verified layers are registered in the LUNARIS backend and frontend catalogs:

| Layer Identifier | Title | Format | Max Zoom | Resolution | Data Source |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `LRO_WAC_Mosaic_Global_303ppd_v02` | LROC WAC Global Photographic Mosaic | `image/jpeg` | Level 8 | $\sim 100\text{ m/px}$ | NASA/GSFC/ASU Lunar Reconnaissance Orbiter Wide Angle Camera |
| `LRO_LOLA_ClrShade_Global_128ppd_v04` | LOLA Global Color Altimetry Hillshade | `image/png` | Level 7 | $\sim 237\text{ m/px}$ | NASA/GSFC Lunar Orbiter Laser Altimeter laser altimetry |
| `LRO_LOLAKaguya_Hillshade_60N60S_512ppd` | LOLA & Kaguya TC High-Detail Grayscale Shaded Relief | `image/png` | Level 8 | $\sim 59\text{ m/px}$ | Merged NASA LOLA altimetry + JAXA Kaguya Terrain Camera stereo photometry |
| `LRO_LOLA_ClrShade_SPole75_30mp_v04_EQ` | LOLA South Pole Artemis Exploration Zone Color Shading | `image/png` | Level 9 | $\sim 30\text{ m/px}$ | NASA GSFC PGDA Product 90 (Barker et al. 2023) |

---

## 3. CesiumJS 3D Lunar Globe Architecture

### 3.1 Selenographic Ellipsoid Configuration
Standard CesiumJS defaults to the WGS84 terrestrial ellipsoid ($a = 6,378,137\text{ m}$). To accurately model the Moon, LUNARIS instantiates a custom lunar ellipsoid matching the IAU/NASA mean lunar radius:

$$\text{Ellipsoid}(1737400.0\text{ m},\, 1737400.0\text{ m},\, 1737400.0\text{ m})$$

### 3.2 Tiling Scheme Compatibility
Cesium's `GeographicTilingScheme` is configured with:
```typescript
const lunarTilingScheme = new Cesium.GeographicTilingScheme({
  ellipsoid: lunarEllipsoid,
  numberOfLevelZeroTilesX: 2,
  numberOfLevelZeroTilesY: 1,
});
```
This guarantees 1:1 mathematical alignment with NASA Moon Trek's `default028mm` tile matrix set.

### 3.3 Provider Integration
Cesium's `UrlTemplateImageryProvider` consumes the verified NASA Moon Trek endpoint:
```typescript
const lrocProvider = new Cesium.UrlTemplateImageryProvider({
  url: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
  tilingScheme: lunarTilingScheme,
  ellipsoid: lunarEllipsoid,
  minimumLevel: 0,
  maximumLevel: 8,
  credit: new Cesium.Credit('NASA / GSFC / Arizona State University (LROC) - NASA Moon Trek WMTS', true),
});
```

### 3.4 Candidate Landing Site Selenographic 3D Beacons
Landing sites are placed at their exact Selenographic coordinates using `Cesium.Cartesian3.fromDegrees`:
- **Shackleton Crater Ridge:** Lat $-89.78^\circ$, Lon $+125.40^\circ$, Elevation $+1,413.9\text{ m}$
- **Malapert Massif:** Lat $-86.04^\circ$, Lon $+2.70^\circ$, Elevation $-2,854.7\text{ m}$
- **de Gerlache Rim:** Lat $-88.71^\circ$, Lon $-68.70^\circ$, Elevation $-1,148.4\text{ m}$
- **Haworth Crater Rim:** Lat $-87.87^\circ$, Lon $-5.17^\circ$, Elevation $-1,200.0\text{ m}$

Each site features:
1. High-visibility colored 3D surface beacons with depth testing disabled at high altitude.
2. Space Mono aerospace billboard labels indicating site name and exact latitude/longitude.
3. Left-click raycast picking with smooth camera fly-to animation.

### 3.5 Solar Ephemeris Illumination Synchronization
Cesium's simulation clock is tied to the Candidate Site mission date:
```typescript
const julianDate = Cesium.JulianDate.fromIso8601(`${epochDate}T${epochHour.toString().padStart(2, '0')}:00:00Z`);
viewer.clock.currentTime = julianDate;
viewer.scene.globe.enableLighting = sunLightingEnabled;
```
This ensures surface shading and terminator position on the Moon Trek globe match the astronomical configuration calculated by SPICE/DE440 for the selected mission epoch.

---

## 4. Separation of Responsibilities (Dual-Mode Architecture)

To avoid competing 3D engines, the application implements a dedicated Viewport Mode Switcher:

```
+-----------------------------------------------------------------------------------------+
| LUNARIS 3D VIEWPORT HEADER                                                              |
| [ * NASA MOON TREK GLOBE (CESIUM OGC WMTS) ]  [ SUN-CENTRIC EPHEMERIS (THREE.JS SPICE) ] |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  ACTIVE MODE A: NASA MOON TREK GLOBE           ACTIVE MODE B: ORBITAL SIMULATION        |
|  - Engine: CesiumJS                            - Engine: Three.js                       |
|  - Focus: Selenographic Planetary Surface      - Focus: Heliocentric Solar System       |
|  - Data: Live NASA WMTS 100m - 30m Tiles       - Data: Astronomical Ephemeris           |
|  - Spherical Radius: 1,737,400 m               - Coordinates: Ecliptic J2000            |
|  - Controls: Fly-to Sites, Pitch, Tilt, HDG   - Controls: Moon Orbit, Cassini Tilts    |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
| SHARED STATE: Candidate Site Selection, Selenographic Lat/Lon, Mission Epoch Date/Hour  |
+-----------------------------------------------------------------------------------------+
```

---

## 5. Real Lunar Terrain Integration

1. **Topographical Shading without Distortion:**
   Rather than artificial procedural bumps or exaggerated displacement, LUNARIS utilizes NASA LOLA altimetry hillshade and merged LOLA/Kaguya stereo photometry (`LRO_LOLAKaguya_Hillshade_60N60S_512ppd`). This renders actual crater rims, impact central peaks, terraces, and ridge slopes with genuine 59-meter resolution.
2. **Authentic Polar Topography GeoTIFF:**
   The backend hosts the Barker et al. 2023 NASA Goddard PGDA Product 90 dataset (`lunar-south-pole.tif`, 80 m/pixel Float32 GeoTIFF, $2500 \times 2500$ grid). The `/api/v1/terrain/subgrid` endpoint extracts genuine 3D elevation matrices around candidate sites for local slope and horizon profiling.

---

## 6. Backend Services & REST Endpoints

The backend provides the following endpoints under `/api/v1/trek`:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/trek/layers` | `GET` | Returns verified NASA Moon Trek layer metadata, matrix sets, projections, and attributions. |
| `/api/v1/trek/layers/:layerId` | `GET` | Returns detailed specifications for a specific Moon Trek layer. |
| `/api/v1/trek/capabilities/:layerId` | `GET` | Retrieves and caches live OGC WMTSCapabilities XML from `trek.nasa.gov` (with synthetic offline fallback). |

---

## 7. Technology & Licensing Verification

| Asset / Service | Provider | License / Terms of Use | Requirements |
| :--- | :--- | :--- | :--- |
| **NASA Moon Trek WMTS** | NASA JPL / Solar System Treks | Public domain (US Government scientific work) | Requires standard NASA attribution (`NASA/GSFC/ASU/JPL`). CORS enabled. |
| **CesiumJS** | Cesium GS, Inc. | Apache 2.0 Open Source | Free for commercial and non-commercial use. Base CesiumJS library requires no token. |
| **LRO WAC & LOLA Data** | NASA PDS / LROC / LOLA Teams | Open Scientific Data Policy | Publicly accessible worldwide. |
| **SPICE Kernels (DE440)** | NASA NAIF / JPL | Open Scientific Data Policy | Publicly accessible worldwide. |

---

## 8. Verification Results

The automated integration test suite (`backend/src/scripts/verify-moon-trek-integration.ts`) executed with **8/8 checks passing**:

```text
================================================================
NASA MOON TREK TECHNOLOGY INTEGRATION VERIFICATION SUITE
================================================================

Test 1: Verify Moon Trek Layer Catalog
  Catalog contains 4 verified NASA layers.
  ✓ PASS: All essential Moon Trek imagery & elevation layers registered.

Test 2: Query API Endpoint /api/v1/trek/layers
  ✓ PASS: Endpoint responded HTTP 200 with 4 layers.

Test 3: Query Layer Detail for LRO WAC Global Mosaic
  ✓ PASS: Layer detail verified with projection urn:ogc:def:crs:EPSG::104903.

Test 4: Verify OGC WMTSCapabilities XML Generation/Retrieval
  ✓ PASS: Compliant OGC WMTSCapabilities XML retrieved.

Test 5: Query Real NASA LOLA GeoTIFF Terrain Subgrid at Shackleton Crater
  ✓ PASS: Subgrid extracted with center elevation: 1413.88 m.

Test 6: Verify Selenographic Coordinates for Key Candidate Sites
  - Verified Shackleton Crater: Lat -89.78°, Lon 125.4°
  - Verified Malapert Massif: Lat -86.04°, Lon 2.7°
  - Verified de Gerlache Rim: Lat -88.71°, Lon -68.7°
  - Verified Haworth Crater Rim: Lat -87.87°, Lon -5.17°
  ✓ PASS: All Candidate Sites map to authentic Selenographic coordinates.

Test 7: Verify Mission Date Synchronization with Ephemeris System
  Target Date: 2027-03-15T12:00:00Z
  Ephemeris Sun Distance: 148.743 million km
  Ephemeris Earth Distance: 371806.7 km
  ✓ PASS: Ephemeris positions computed accurately for future mission date.

Test 8: Architecture Check — Separation of Engine Responsibilities
  - Three.js: Central Heliocentric Astronomical Ephemeris System (Sun, Earth, Moon)
  - CesiumJS: High-Fidelity NASA Moon Trek 3D Globe & Surface Exploration
  - View Switcher: Seamless switching with shared site & mission date state
  ✓ PASS: Dual-mode architecture cleanly separated without competing globes.

================================================================
VERIFICATION COMPLETE: 8/8 TESTS PASSED!
================================================================
```

### Production Build Verification
- **Backend Typecheck:** `tsc --noEmit` exited 0 (clean).
- **Backend Unit Tests:** `npx vitest run src/tests/unit/trek-service.test.ts` passed (3/3).
- **Frontend Build:** `tsc -b && vite build` completed in 1.91s with 0 errors.
- **Frontend Bundle Structure:** Cleanly code-split into `vendor-react`, `vendor-three`, `vendor-libs` (CesiumJS), and application views.

---

## 9. Conclusion

NASA Moon Trek-style lunar visualization technology is now fully operational in LUNARIS. Users can explore genuine LRO WAC global photographic mosaics, LOLA altimetry, and Kaguya shaded relief streamed directly from NASA's official WMTS servers on a high-fidelity 3D Cesium globe, inspect Artemis candidate landing sites with 3D beacons and telemetry, and seamlessly switch to the Three.js heliocentric ephemeris system—all while preserving candidate site dates and SPICE astronomical calculations.

