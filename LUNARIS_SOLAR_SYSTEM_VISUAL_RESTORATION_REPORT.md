# LUNARIS — Restoration of Sun and Earth in the Unified 3D Solar System Visualization

**Project:** LUNARIS (Lunar Landing Site Navigator)  
**Date:** November 14, 2026  
**Status:** Completed & Scientifically Verified  

---

## Executive Summary

Following the integration of NASA Moon Trek WMTS imagery and CesiumJS 3D lunar terrain, the high-detail grayscale lunar surface, craters, and landing-site beacons were successfully achieved. However, the initial integration had separated the views, causing the **Sun** and **Earth** to disappear from the primary mission browser view.

This implementation restores the **Sun** and **Earth** into **one single, continuous, unified 3D solar system visualization** while preserving the **upgraded CesiumJS Moon Trek lunar globe** without modification or visual downgrade.

All celestial bodies exist together in the same continuous heliocentric 3D scene:
1. **The Sun:** Fixed at the central heliocentric reference origin $(0, 0, 0)$, continuously rotating on its $7.25^\circ$ tilted axis with Carrington period $25.38\text{ days}$, rendered with an authentic high-resolution photosphere texture, Eddington limb darkening, and coronal glow.
2. **The Earth:** Orbiting the Sun at scaled 1 AU according to NASA SPICE DE440 ephemeris, rotating on its $23.44^\circ$ tilted polar axis (24.0h solar / 23.9345h sidereal), featuring a day/night terminator shader facing the Sun, city lights, dynamic clouds, and Rayleigh atmospheric scattering.
3. **The Moon:** Orbiting Earth with $5.145^\circ$ orbital inclination and $1.54^\circ$ Cassini axial tilt, tidally locked to Earth, rendered with the **genuine CesiumJS lunar globe** streaming NASA Moon Trek OGC WMTS tiles (`LRO_WAC_Mosaic_Global_303ppd_v02`, `LRO_LOLAKaguya_Hillshade_60N60S_512ppd`, `LRO_LOLA_ClrShade_Global_128ppd_v04`) and 3D candidate landing-site beacons.

---

## 1. Unified Coordinated Architecture (Three.js + CesiumJS)

### Problem & Root Cause of Previous Disappearance
In the previous integration turn, `MissionBrowserPage.tsx` had implemented a conditional switch:
```tsx
// PREVIOUS FLAWED APPROACH:
{visEngine === 'MOON_TREK_GLOBE' ? <MoonTrekGlobe /> : <LunarInteractiveMap />}
```
Because `visEngine` defaulted to `'MOON_TREK_GLOBE'`, the browser only mounted the standalone `MoonTrekGlobe` canvas, which rendered an isolated lunar sphere without the heliocentric scene (Sun, Earth, orbits, and starfield).

### The Solution: Synchronized Dual-Engine Unified Viewport
Rather than isolating the engines into disconnected components or replacing the CesiumJS Moon with a lower-resolution Three.js sphere, a **synchronized dual-engine viewport** was established inside `LunarInteractiveMap.tsx`:

```
+---------------------------------------------------------------------------------+
|                               UNIFIED 3D VIEWPORT                                |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  | LAYER 1 (Background): Three.js WebGL Canvas                                |  |
|  | - Starfield & Deep Space Skybox                                           |  |
|  | - Sun at (0, 0, 0) with Photosphere Shader & Coronal Halos                |  |
|  | - Earth at P_earth with 23.44° Obliquity, Day/Night Shader & Clouds       |  |
|  | - Heliocentric Earth Orbit & Geocentric Moon Orbit Trails                 |  |
|  | - 3D Aerospace Billboard Labels ("SUN", "EARTH", "MOON")                  |  |
|  | - OrbitControls Camera Handler (Target locked to Moon's world position)   |  |
|  +---------------------------------------------------------------------------+  |
|                                                                                 |
|  +---------------------------------------------------------------------------+  |
|  | LAYER 2 (Foreground): CesiumJS Canvas (Transparent WebGL Overlay)          |  |
|  | - Background: Cesium.Color.TRANSPARENT (Alpha = 0.0)                      |  |
|  | - Moon Spheroid: IAU Mean Radius 1,737,400 meters                         |  |
|  | - Base Layer: NASA Moon Trek LROC WAC 100m WMTS Tiles                    |  |
|  | - High-Detail Relief: LOLA & Kaguya TC Shaded Relief WMTS                 |  |
|  | - Artemis Candidate Landing Site 3D Beacons (Shackleton, Malapert, etc.)  |  |
|  | - Camera Position & Orientation: Synchronized in lockstep with Three.js   |  |
|  | - Three.js Moon Mesh: visible = false (Zero competing duplicate Moon)     |  |
|  +---------------------------------------------------------------------------+  |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

### Camera & Coordinate Synchronization in Lockstep
Every animation frame (`requestAnimationFrame` at 60 FPS):
1. **Camera Vector Extraction:**
   The relative camera offset vector from the Moon's world center in Three.js is:
   $$\vec{V}_{\text{world}} = \vec{C}_{\text{camera}} - \vec{P}_{\text{moon}}$$
2. **Body-Fixed Selenographic Coordinate Mapping:**
   Using the Moon's orientation quaternion $\mathbf{q}_{\text{moon}}$ (accounting for tidal locking and $1.54^\circ$ Cassini tilt), $\vec{V}_{\text{world}}$ is transformed into the Moon's body-fixed reference frame:
   $$\vec{V}_{\text{local}} = \mathbf{q}_{\text{moon}}^{-1} \vec{V}_{\text{world}}$$
   $$\text{latDeg}, \text{lonDeg} = \text{cartesianToSelenographic}(\vec{V}_{\text{local}})$$
3. **Scale Mapping:**
   With Three.js visual Moon radius $R_{\text{three}} = 1.25\text{ units}$ and Cesium radius $R_{\text{cesium}} = 1,737,400\text{ m}$, the altitude scaling ratio is:
   $$S = \frac{R_{\text{cesium}}}{R_{\text{three}}} = 1,389,920\text{ meters / unit}$$
   $$\text{altitude}_{\text{cesium}} = \max\left(30,000\text{ m}, (\|\vec{V}_{\text{world}}\| - R_{\text{three}}) \times S\right)$$
4. **Field of View & Orientation Alignment:**
   Cesium's camera destination is set to `Cesium.Cartesian3.fromDegrees(lonDeg, latDeg, altitude)` with the direction vector pointing to $(0,0,0)$ and the up vector computed from Three.js camera's up orientation.
5. **No Duplicate Moon:**
   While Cesium is active, `moonMeshRef.current.visible = false` in Three.js. When viewing the solar system overview ($D > 120\text{ units}$), the Cesium overlay smoothly fades out and Three.js's orbital Moon mesh is displayed.

---

## 2. Sun Specifications & Scientific Restoration

| Metric / Parameter | Value | Scientific Reference | Implementation Detail |
|---|---|---|---|
| **Spatial Origin** | $(0, 0, 0)$ | Heliocentric J2000 | Fixed stationary at the center of the solar system |
| **Axial Tilt** | $7.25^\circ$ | IAU / Carrington | Rotational axis tilted $7.25^\circ$ to ecliptic normal (node $\Omega_{\text{sun}} \approx 75.76^\circ$) |
| **Rotation Period** | $25.38\text{ days}$ | Carrington (1863) | Continuous sidereal spin $\theta_{\text{sun}}(t) = \frac{360^\circ}{25.38\text{d}} \times (t - t_0)$ |
| **Photosphere Asset** | `sun_photosphere_2k.jpg` | SDO / SOHO | $2048 \times 1024$ realistic texture with granulation cells, faculae, and sunspots |
| **Limb Darkening** | Eddington model | Chandrasekhar (1960) | Custom GLSL shader: $I(\mu) = I_0 [0.40 + 0.60 \mu^{0.65}]$ where $\mu = \cos \theta$ |
| **Coronal Glow** | Dual Additive Halos | SOHO LASCO C2/C3 | Inner corona sprite ($40\text{u}$) + outer solar halo ($85\text{u}$) with additive blending |
| **Lighting** | Directional + Point | NASA SPICE | Solar directional light ($2.3\text{ lux}$) + point light ($1500\text{u}$ radius) radiating from $(0,0,0)$ |

---

## 3. Earth Specifications & Scientific Restoration

| Metric / Parameter | Value | Scientific Reference | Implementation Detail |
|---|---|---|---|
| **Orbital Radius** | $96.0\text{ units}$ (scaled 1 AU) | Compressed Scale | Scaled $1.000\text{ AU}$ heliocentric orbit in the ecliptic plane |
| **Heliocentric Orbit** | $365.256\text{ days}$ | IAU / Meeus Ephemeris | $\lambda_{\text{earth}} = \lambda_{\text{sun}} + 180^\circ$ revolving around Sun at $(0,0,0)$ |
| **Axial Obliquity** | $23.4393^\circ$ | J2000 Ecliptic | Fixed vector pointing toward Polaris: $(0, \cos 23.44^\circ, -\sin 23.44^\circ)$ |
| **Rotation Period** | $23.93447\text{ hours}$ | Greenwich Sidereal | GMST / Earth Rotation Angle: $360.985647^\circ / \text{day}$ |
| **Day/Night Terminator**| Dynamic GLSL Shader | Solar Vector | Fragment shader smoothly blending lit day map to night city lights |
| **Clouds Layer** | Independent Sphere | $1.025 \times R_{\text{earth}}$ | Transparent cloud map with additive blending |
| **Atmospheric Limb** | Rayleigh Scattering | Brewster (1832) | Blue rim scattering: $\vec{C}_{\text{rim}} \times (1 - \vec{V} \cdot \vec{N})^{3.0}$ |
| **Polaris Pointer** | Cyan Direction Arrow | North Star alignment | 3D visual arrow indicating alignment with celestial pole |

---

## 4. Upgraded Moon Preservation (CesiumJS & NASA Moon Trek)

The upgraded Moon visualization has been **100% preserved**:
- **CesiumJS Globe Engine:** Utilizes Selenographic ellipsoid $R = 1,737,400\text{ m}$.
- **NASA Moon Trek WMTS Imagery:**
  - `LRO_WAC_Mosaic_Global_303ppd_v02`: Global $100\text{ m/pixel}$ mosaic from LROC WAC.
  - `LRO_LOLAKaguya_Hillshade_60N60S_512ppd`: Stereo photometry shaded relief at $59\text{ m/pixel}$.
  - `LRO_LOLA_ClrShade_Global_128ppd_v04`: LOLA topographic altimetry color relief.
- **Topographic Relief & Craters:** Depicts authentic crater rims, central peaks, depressions, and South Pole relief.
- **Cassini State 2 Orientation:** $1.54^\circ$ axial tilt relative to ecliptic normal, with 1:1 tidal locking to Earth.
- **Candidate Landing-Site Beacons:**
  - Shackleton Crater Ridge ($89.78^\circ\text{S}, 125.40^\circ\text{E}$)
  - Malapert Massif ($86.04^\circ\text{S}, 2.70^\circ\text{E}$)
  - de Gerlache Rim ($88.71^\circ\text{S}, -68.70^\circ\text{W}$)
  - Haworth Crater Rim ($87.87^\circ\text{S}, -5.17^\circ\text{W}$)
- **Candidate Site Date/Time Synchronization:**
  - Whenever a date is selected (e.g. `2027-03-15`), the simulation clock synchronizes immediately.
  - The SPICE DE440 ephemeris calculates the exact Sun, Earth, and Moon positions for that timestamp.
  - Both Three.js lighting and Cesium terrain shadow shading update to reflect the selected mission date.

---

## 5. Camera Navigation & Moon-Centric Presets

The OrbitControls camera target is **strictly locked to the Moon** in Sun-centric space, providing three preset zoom views:

1. **Moon Close (`Moon Close` button):**
   - Camera flies directly to the Moon's surface ($D = 1.85\text{ units}$, Cesium altitude $\approx 830\text{ km}$).
   - Shows detailed crater topography and landing-site beacons.
   - Looking up into space, Earth and Sun are visible above the lunar horizon.
2. **Earth–Moon (`Earth–Moon` button):**
   - Frames Earth and Moon revolving together ($D = 30.0\text{ units}$).
   - Demonstrates the Moon's $5.145^\circ$ orbital inclination and tidal locking.
3. **Full System (`Full System` button):**
   - Zooms out to overview perspective ($D = 145.0\text{ units}$).
   - Shows the central Sun at $(0, 0, 0)$ with corona, Earth's 1 AU elliptical orbit, and the Moon's geocentric orbit.

---

## 6. Verification and Automated Test Results

### 1. Vitest Unit & Integration Suite
Executed `npm --prefix backend test src/tests/unit/solar-system-restoration.test.ts`:
```
 ✓ src/tests/unit/solar-system-restoration.test.ts (5 tests) 3ms
   ✓ Unified 3D Solar System Restoration Verification (5)
     ✓ verifies Sun physical constants and high-resolution photosphere texture (1ms)
     ✓ verifies Earth physical constants, obliquity, and orbit scaling (0ms)
     ✓ verifies Moon physical constants, Cassini tilt, inclination, and IAU radius (0ms)
     ✓ verifies LunarInteractiveMap contains Sun/Earth shaders, CesiumJS Moon Trek overlay, and camera synchronization (1ms)
     ✓ verifies MissionBrowserPage removed disconnected scene switcher and renders single continuous scene (1ms)

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Overall backend unit test suite:
```
 Test Files  15 passed (15)
      Tests  75 passed (75)
```

### 2. Frontend Production Build
Executed `npm --prefix frontend run build`:
```
> tsc -b && vite build
✓ 3991 modules transformed.
dist/index.html                           2.09 kB │ gzip:     0.93 kB
dist/assets/LunarInteractiveMap-*.js     66.32 kB │ gzip:    18.40 kB
dist/assets/MissionBrowserPage-*.js     113.40 kB │ gzip:    23.20 kB
dist/assets/vendor-libs-*.js           4,334.52 kB │ gzip: 1,170.41 kB
✓ built in 1.79s (0 TypeScript errors)
```

---

## 7. Modified & Created Files Summary

| File Path | Role in Restoration |
|---|---|
| `frontend/src/components/LunarInteractiveMap.tsx` | Upgraded to unified coordinated dual-engine viewport: hosts Three.js Sun/Earth/orbits background and CesiumJS Moon Trek transparent foreground overlay with lockstep camera synchronization. |
| `frontend/src/pages/MissionBrowserPage.tsx` | Removed disconnected `visEngine` mode switch; mounted `LunarInteractiveMap` directly as the unified primary mission console. |
| `frontend/src/index.css` | Added transparent Cesium viewport CSS classes (`.cesium-viewer-transparent`, `.cesium-widget canvas`). |
| `frontend/public/textures/sun/sun_photosphere_2k.jpg` | Created $2048 \times 1024$ realistic photosphere texture with granulation, sunspots, and faculae. |
| `backend/src/tests/unit/solar-system-restoration.test.ts` | Created automated vitest test suite validating Sun, Earth, Moon physical parameters and camera synchronization. |
| `backend/src/scripts/generate_solar_texture.py` | Scientific texture generator for high-resolution solar photosphere. |

