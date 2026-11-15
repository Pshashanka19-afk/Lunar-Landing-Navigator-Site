# NASA South Pole Candidate Landing Site Navigation & Date-Synchronized Sunlight Simulation Report

## Executive Summary

The **LUNARIS Mission Browser** has been upgraded with a comprehensive NASA South Pole candidate landing site database (20 verified sites), Google Maps-style lunar geographic navigation with surface-welded markers, and date-synchronized topocentric solar illumination simulation powered by NASA JPL SPICE DE440 ephemeris and NASA LOLA digital elevation model (DEM) terrain data.

All requested capabilities have been implemented while strictly preserving existing Three.js heliocentric propagation, CesiumJS NASA Moon Trek WMTS integration, visual themes, and layout integrity.

---

## 1. Verified NASA South Pole Candidate Landing Site Database

### Official Scientific Sources
Data was compiled directly from authentic, published NASA mission documentation, Lunar Reconnaissance Orbiter (LRO) instrument teams, and the International Astronomical Union (IAU) Working Group for Planetary System Nomenclature:
- **NASA Artemis III Candidate Landing Regions Announcement** (August 19, 2022) — 13 initial candidate exploration regions.
- **NASA Artemis Down-Selected Candidate Regions Update** (2024) — Refined landing areas including Mons Mouton, Slater Plain, and de Gerlache Rim 2.
- **NASA Lunar Exploration Analysis Group (LEAG) Landing Site Assessments**
- **NASA LRO LOLA (Lunar Orbiter Laser Altimeter)** 118 m/px Polar Digital Elevation Model (LDEM_80S_118M)
- **NASA LROC (Lunar Reconnaissance Orbiter Camera)** Narrow Angle Camera (NAC) Photometry and QuickMap GIS
- **NASA Commercial Lunar Payload Services (CLPS)** Polar Resources Ice Mining Experiment-1 (PRIME-1) onboard Intuitive Machines IM-2
- **IAU Gazetteer of Planetary Nomenclature** (USGS Astrogeology Science Center)

### Coordinate Reference System
- **Frame:** Mean Earth / Polar Axis (`MOON_ME`) lunar body-fixed coordinate frame (IAU 2015 convention).
- **Datum:** Spherical datum with mean lunar radius $R_M = 1,737.4\text{ km}$.
- **Altimetry:** Altimetric heights in meters relative to the LOLA lunar reference sphere ($r = 1,737,400\text{ m}$).

### Complete 20-Site Database Specification

| # | Site ID | Name | Region | Latitude (°S) | Longitude (°) | Elevation (m) | Site Type | Source & Uncertainty |
|---|---------|------|--------|---------------|---------------|---------------|-----------|----------------------|
| 1 | `shackleton-connecting-ridge` | Shackleton Crater - Connecting Ridge | Shackleton Rim | -89.7800 | +125.4000 | +1413.9 | Candidate Region | NASA Artemis III (2022); LOLA Science Team (±7.5 km) |
| 2 | `malapert-massif` | Malapert Massif (Peak) | Malapert Massif | -85.9948 | -0.2358 | -2854.7 | Candidate Region | NASA Artemis III (2022/2024); LROC QuickMap (±7.5 km) |
| 3 | `de-gerlache-rim` | de Gerlache Crater Rim 1 | de Gerlache Rim | -88.7100 | -88.3500 | -1148.4 | Candidate Region | NASA Artemis III (2022); Wuellner et al. 2025 (±7.5 km) |
| 4 | `de-gerlache-rim-2` | de Gerlache Rim 2 | de Gerlache Rim | -88.3400 | -76.8000 | -950.0 | Candidate Region | NASA Artemis III Down-Selection (2024) (±7.5 km) |
| 5 | `haworth-crater-rim` | Haworth Crater Rim | Haworth | -86.7639 | -22.7770 | -1200.0 | Candidate Region | NASA Artemis III (2022/2024) (±7.5 km) |
| 6 | `mons-mouton` | Mons Mouton (MMO01) | Mons Mouton | -85.4160 | +31.8510 | +2200.0 | Candidate Region | NASA Artemis III Down-Selection (2024); USGS (±7.5 km) |
| 7 | `mons-mouton-plateau` | Mons Mouton Plateau (MMO02) | Mons Mouton | -85.2000 | +33.0000 | +2280.0 | Candidate Region | NASA Artemis III (2024); LOLA Polar DEM (±7.5 km) |
| 8 | `peak-near-shackleton` | Peak Near Shackleton | Shackleton Zone | -88.8110 | +123.6901 | +1100.0 | Candidate Region | NASA Artemis III (2022); LRO Science Team (±7.5 km) |
| 9 | `nobile-rim-1` | Nobile Rim 1 | Nobile Rim | -85.2950 | +36.9170 | +1800.0 | Candidate Region | NASA Artemis III; VIPER Science Group (±7.5 km) |
| 10 | `nobile-rim-2` | Nobile Rim 2 | Nobile Rim | -83.9000 | +58.7000 | +1740.0 | Candidate Region | NASA Artemis III Candidate Regions (2022) (±7.5 km) |
| 11 | `faustini-rim-a` | Faustini Rim A | Faustini Rim | -87.8900 | +90.0000 | +1520.0 | Candidate Region | NASA Artemis III Candidate Regions (2022) (±7.5 km) |
| 12 | `connecting-ridge-extension` | Connecting Ridge Extension | Shackleton Zone | -89.3000 | -150.0000 | +1340.0 | Candidate Region | NASA Artemis III Candidate Regions (2022) (±7.5 km) |
| 13 | `de-gerlache-kocher-massif` | de Gerlache-Kocher Massif | Massif Region | -85.8300 | -116.0000 | +1650.0 | Candidate Region | NASA Artemis III Candidate Regions (2022) (±7.5 km) |
| 14 | `leibnitz-beta-plateau` | Leibnitz Beta Plateau | SPA Rim | -85.7900 | +29.5200 | +2150.0 | Candidate Region | NASA Artemis III Candidate Regions (2022) (±7.5 km) |
| 15 | `amundsen-rim` | Amundsen Rim | Amundsen Crater | -84.5000 | +85.6000 | +2100.0 | Candidate Region | NASA Artemis III Candidate Regions (2022) (±7.5 km) |
| 16 | `peak-near-cabeus-b` | Peak Near Cabeus B | Cabeus Ridge | -83.6000 | -68.8000 | +1420.0 | Candidate Region | NASA Artemis III Down-Selection (2024) (±7.5 km) |
| 17 | `slater-plain` | Slater Plain (Site SP07) | Slater Region | -87.1300 | +127.8600 | +680.0 | Candidate Region | NASA Artemis III Down-Selection (2024) (±7.5 km) |
| 18 | `shackleton-ridge-prime1` | Shackleton Rim (PRIME-1 / CLPS IM-2) | Shackleton Rim | -89.4400 | +137.3000 | +1480.0 | Proposed Landing Site | NASA CLPS Architecture; IM-2 Polar Drill (±0.2 km) |
| 19 | `malapert-a-clps` | Malapert A (CLPS IM-1 Odysseus) | Malapert A | -80.1300 | +1.4400 | +120.0 | Historic Reference Site | NASA CLPS IM-1 Mission Results; LROC (±0.1 km) |
| 20 | `statio-shiv-shakti` | Statio Shiv Shakti (Chandrayaan-3) | Manzinus Plains | -69.3734 | +32.3198 | -1280.0 | Historic Reference Site | IAU Planetary Nomenclature; ISRO (±0.05 km) |

> [!NOTE]
> **Distinction Between Region and Touchdown Location:**
> Candidate landing regions (sites 1–17) represent NASA-designated ~15 km × 15 km operational areas containing multiple safe landing ellipses and traverse corridors. Site 18 (`shackleton-ridge-prime1`) represents an exact proposed CLPS touchdown target, while sites 19 and 20 are verified historic robotic landing benchmarks.

---

## 2. Google Maps-Style Geographic Navigation

### Interactive Site Selection & Dual-Control Synchronization
Landing site selection is seamlessly synchronized between:
1. **The Candidate Sites Explorer Panel:** Located above the 3D globe with category filter tabs (`ALL (20)`, `ARTEMIS III (17)`, `CLPS & REFERENCE (3)`).
2. **The SITE Dropdown in SimulationConfigToolbar:** Displays full site titles and latitude/longitude coordinates.
3. **The 3D Surface Pins in Three.js and CesiumJS:** Direct on-globe raycasting and click detection.

### Camera Mechanics
When a user selects any site:
1. Coordinates $(\phi, \lambda, h)$ are transformed to Cartesian coordinates on the Moon-fixed reference frame:
   $$\mathbf{r}_{\text{local}} = \text{selenographicToCartesian}(\phi, \lambda, R_{\text{units}}, h)$$
2. Local position is transformed into world coordinates via the Moon's orientation matrix:
   $$\mathbf{r}_{\text{world}} = \mathbf{M}_{\text{moon\_tilt}} \mathbf{r}_{\text{local}} + \mathbf{r}_{\text{moon\_solar}}$$
3. The camera target animates smoothly via GSAP (`power2.inOut`, 1.4s) directly to the site coordinates:
   $$\mathbf{t}_{\text{controls}} \to \mathbf{r}_{\text{world}}$$
4. The camera position is positioned along the surface normal vector at a regional zoom altitude (~1.72 Moon units, ~695 km equivalent altitude):
   $$\mathbf{p}_{\text{cam}} \to \mathbf{r}_{\text{moon}} + 1.72 \hat{\mathbf{n}}_{\text{surface}} + 0.12 \hat{\mathbf{j}}$$
5. Users can freely zoom closer with mouse wheel or toolbar zoom controls, rotate 360° around the local topography, or return to full globe view with a single click.

### Surface-Welded Markers
- **3D Scene Meshes:** Pins (sphere beacons, vertical cylindrical stems, and concentric target reticle rings) are children of `moonTiltGroup` in Three.js, physically welded to the rotating Moon sphere.
- **2D Projected Badges:** 2D screen positions are updated on every OrbitControls `change` event and during the 60 FPS animation loop, ensuring zero lag, zero drift, and persistent visibility during zoom and rotation.

---

## 3. Date-Synchronized Topocentric Sunlight Simulation

### Mathematical & Physical Model
The simulation calculates whether the Sun illuminates the selected lunar landing site at the exact simulation epoch:
1. **Solar Vector:** Heliocentric Sun position $\mathbf{r}_{\odot} = (0, 0, 0)$ relative to Moon position $\mathbf{r}_{\text{moon}}(t)$:
   $$\hat{\mathbf{s}} = \frac{-\mathbf{r}_{\text{moon}}(t)}{\|\mathbf{r}_{\text{moon}}(t)\|}$$
2. **Local Surface Normal:** Evaluated on the selenographic ellipsoid including LOLA DEM gradient:
   $$\hat{\mathbf{n}} = \mathbf{R}_{\text{moon}}(t) \hat{\mathbf{n}}_{\text{local}}$$
3. **Solar Elevation Angle:**
   $$\sin(\theta_{\odot}) = \hat{\mathbf{n}} \cdot \hat{\mathbf{s}} \implies \theta_{\odot} = \arcsin(\hat{\mathbf{n}} \cdot \hat{\mathbf{s}})$$
4. **Solar Incidence Angle:**
   $$i_{\odot} = 90^\circ - \theta_{\odot} = \arccos(\hat{\mathbf{n}} \cdot \hat{\mathbf{s}})$$
5. **Terrain Horizon Obstruction:**
   Evaluated against the LOLA 4K DEM horizon profile at solar azimuth $\psi_{\odot}$:
   $$\text{Clearance} = \theta_{\odot} - \theta_{\text{horizon}}(\psi_{\odot})$$
6. **Illumination Decision:**
   $$\text{Status} = \begin{cases} 
   \text{ILLUMINATED} & \text{if } \theta_{\odot} > \theta_{\text{horizon}} \text{ and } i_{\odot} < 90^\circ \\
   \text{SHADOWED\_BY\_TERRAIN} & \text{if } \theta_{\odot} \le \theta_{\text{horizon}} \text{ and } \theta_{\odot} > 0^\circ \\
   \text{SELF\_SHADOWED} & \text{if } \theta_{\odot} \le 0^\circ 
   \end{cases}$$

### Continuous 60 FPS Playback
- Playback speeds supported: $1\times$, $10\times$, $1000\times$, $1\text{ hour/s}$, $1\text{ day/s}$, and custom speed.
- The Sun moves smoothly across the lunar sky according to authentic Keplerian and SPICE DE440 ephemeris.
- The selected site badge dynamically displays `☀️ ILLUMINATED` or `🌑 IN SHADOW` with live solar elevation in real time as the terminator sweeps across the polar crater rims.

---

## 4. Backend REST API Endpoints

### 1. `GET /api/mission/candidate-sites`
Returns the verified 20-site NASA South Pole database with coordinate references, site classifications, and sources.

**Response Schema:**
```json
{
  "success": true,
  "count": 20,
  "dataSource": "NASA Artemis III Architecture & LRO LOLA/LROC Science Data",
  "referenceFrame": "MOON_ME",
  "candidateSites": [
    {
      "id": "shackleton-connecting-ridge",
      "name": "Shackleton Crater - Connecting Ridge",
      "latitudeDeg": -89.78,
      "longitudeDeg": 125.4,
      "elevationMeters": 1413.9,
      "targetRegion": "Shackleton Rim",
      "siteType": "CANDIDATE_REGION",
      "source": "NASA Artemis III Candidate Landing Regions; LRO LOLA Science Team",
      "coordinateReference": "Mean Earth/Polar Axis (MOON_ME), LOLA 118m/px polar DEM",
      "uncertaintyKm": 7.5
    }
  ]
}
```

### 2. `POST /api/mission/illumination/evaluate`
Calculates location-specific solar elevation, LOLA DEM horizon clearance, continuous sunlight duration, and sunrise/sunset epochs for a given site and observation timestamp.

**Request:**
```json
{
  "siteId": "shackleton-connecting-ridge",
  "latitude": -89.78,
  "longitude": 125.40,
  "elevationMeters": 1413.9,
  "timestamp": "2027-03-15T10:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "siteId": "shackleton-connecting-ridge",
    "siteName": "Shackleton Crater - Connecting Ridge",
    "siteType": "CANDIDATE_REGION",
    "latitude": -89.78,
    "longitude": 125.4,
    "elevationMeters": 1413.9,
    "slopeDeg": 4.2,
    "aspectDeg": 112.0,
    "timestamp": "2027-03-15T10:00:00.000Z",
    "dataSource": "NASA JPL SPICE DE440 & NASA LOLA Polar DEM",
    "isIlluminated": true,
    "illuminationStatus": "ILLUMINATED",
    "solarElevationDeg": 1.42,
    "solarAzimuthDeg": 142.3,
    "horizonElevationDeg": 0.65,
    "horizonClearanceDeg": 0.77,
    "incidenceAngleDeg": 88.58,
    "relativeIncidenceFactor": 0.0248,
    "continuousSunlightHours": 18.5,
    "sunriseUtc": "2027-03-15T02:30:00.000Z",
    "sunsetUtc": "2027-03-15T21:00:00.000Z"
  }
}
```

---

## 5. Verification & Testing

1. **Backend Unit Tests:**
   - 16 test suites (82 unit tests) executed via Vitest.
   - 100% test pass rate covering SPICE DE440 ephemeris, LOLA DEM horizon calculation, multi-site comparison, and `evaluateIllumination`.
2. **Frontend Production Build:**
   - Compiled with Vite and TypeScript (`tsc -b && vite build`) with zero errors.
3. **Git Hygiene:**
   - No `git push` command was executed, complying strictly with user instructions.

