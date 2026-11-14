# LUNARIS — Unified Sun-Centric 3D Solar System & Lunar Mission Navigator

[![NASA Space Apps Challenge 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026-blue.svg)](https://www.spaceappschallenge.org/)
[![Live Deployment](https://img.shields.io/badge/Live%20Demo-Render-46E3B7.svg?logo=render&logoColor=white)](https://lunar-missionbrowser-1.onrender.com)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x%20%7C%207.x-3178C6.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.186-black.svg)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF.svg)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5.3-000000.svg)](https://expressjs.com/)

> 🚀 **Live Deployment**: [https://lunar-missionbrowser-1.onrender.com](https://lunar-missionbrowser-1.onrender.com)

**LUNARIS** is an aerospace-grade planetary visualization and mission analysis platform designed for evaluating lunar landing sites, solar illumination regimes, and Direct-to-Earth (DTE) communication windows for NASA's Commercial Lunar Payload Services (CLPS) and Artemis expeditions.

---

## 1. The Challenge

Missions targeting the lunar south pole ($85.0^\circ\text{S} - 90.0^\circ\text{S}$) face severe operational and environmental constraints:

- **Ultra-Low Grazing Sun Elevation**: Because the Moon's axial tilt relative to the ecliptic is only **$1.54^\circ$**, the Sun skims the horizon at $+0.5^\circ$ to $+1.8^\circ$. Modest crater rims ($2,000 - 3,500\,\text{m}$) cast long shadows spanning **$50 - 100\,\text{km}$** across the surface.
- **Extreme Cryogenic Environments**: Permanently Shadowed Regions (PSRs) inside craters like Shackleton and Haworth drop to $< 40\,\text{K}$ ($-233^\circ\text{C}$), requiring precise solar array illumination modeling to prevent mission-ending battery freezes.
- **Earth Libration & Telemetry Blindspots**: Because the Moon wobbles due to optical and physical libration ($\pm 6.7^\circ$ in latitude $\times \pm 7.9^\circ$ in longitude), Earth dips above and below the jagged polar horizon every $27.3$-day sidereal month.
- **The Existing Tool Gap**: NASA QuickMap, Moon Trek, and JPL Horizons are designed for planetary scientists. Comparing landing sites, evaluating alternative launch slips, and checking direct horizon occlusions traditionally requires cross-referencing multiple separate databases.

LUNARIS bridges this gap by unifying **JPL DE440 planetary ephemerides**, **LOLA 30m digital elevation model (DEM) radial ray-marching**, and an interactive **Unified Sun-Centric 3D engine**.

---

## 2. Key Features

### A. Unified Sun-Centric 3D Solar System Visualization
- **Stationary Sun Origin**: The Sun remains anchored at the central heliocentric origin `(0, 0, 0)` with its scientific axial tilt ($7.25^\circ$).
- **Realistic Orbital Mechanics**: Earth revolves around the Sun with its authentic $23.44^\circ$ obliquity, while the Moon revolves around Earth with its $1.54^\circ$ axial inclination and tidal locking.
- **Smooth Moon-Focused Camera Zoom**: The camera zoom target focuses directly on the Moon's current world-space position. Zooming in transitions smoothly from a complete heliocentric solar system view to a close-up inspection of lunar surface features and landing sites.
- **Simulation Time Controls**: Real-time scrubbing across hours, days, and orbital speeds ($1\times$ to $50,000\times$) with automatic ephemeris synchronization.

### B. Dual Scientific Lunar Textures
- **LROC 4K Surface Imagery**: High-resolution photorealistic imagery from the Lunar Reconnaissance Orbiter Camera (`lroc_color_4k.jpg`).
- **LOLA Elevation Altimetry**: False-color topographic elevation map highlighting altitude variations from deep crater floors to towering mountain ridges (`lunar_elevation_4k.jpg`).
- **LOLA 4K Bump Mapping**: Surface normal displacement derived from LOLA LDEM altimetry (`ldem_4k_bump.jpg`).

### C. Topographic Horizon Ray-Marching & Illumination
- **360° Radial Horizon Masks**: Radial elevation tracing out to 120 km from the landing site datum against NASA LOLA 30m altimetry grids.
- **Vacuum Photometry**: Simulates knife-edge vacuum shadows with zero atmospheric refraction or twilight diffusion.
- **Clearance Delta ($\Delta\theta$)**: Calculates instant angular separation between celestial target vectors and the jagged local crater crest.

### D. Trans-Lunar Mission Route Planner
- **Departure Origin**: Support for major terrestrial spaceports (Kennedy Space Center LC-39B, Vandenberg SLC-4E, Starbase Boca Chica, Guiana ELA-4, Tanegashima) and circular/elliptical parking orbits (LEO, Polar, Custom).
- **Spacecraft Profiles**: Presets for CLPS Landers, VIPER-class Rovers, Artemis HLS Starships, and SmallSat Impactor probes.
- **3D Trajectory Visualization**: Kinematic trans-lunar flight path with multi-scenario departure windows, transfer durations, $\Delta V$ estimates, and touchdown condition predictions.

### E. Multi-Site Comparison Workbench
- **Prime Candidate Sites**: Shackleton Crater Ridge, Malapert Massif, de Gerlache Rim 2, Haworth Crater Rim.
- **Multi-Criteria Decision Analysis (MCDA)**: Composite feasibility ranking based on continuous sunlight hours, DTE communication windows, surface slope, and surface roughness.
- **Chronological Mission Timelines**: Hour-by-hour operational gantt bars displaying Sun visibility, Earth contact, and dual-operation windows.

---

## 3. Technology Stack

### Frontend
- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Dev Server**: [Vite 8](https://vitejs.dev/)
- **3D Graphics**: [Three.js](https://threejs.org/) + OrbitControls
- **Animation & Transitions**: [GSAP](https://gsap.com/) + [Motion](https://motion.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Linter**: [Oxlint](https://oxc.rs/)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/) (CommonJS / ES Modules via tsx)
- **Framework**: [Express 5](https://expressjs.com/)
- **Validation**: [Zod](https://zod.dev/)
- **Ephemeris Engine**: TimeCraftJS + NAIF SPICE DE440 Kernels
- **Geospatial & DEM**: GeoTIFF (30m & 80m Lunar South Pole Altimetry)
- **Logging**: Pino + Pino-HTTP
- **Testing**: [Vitest](https://vitest.dev/)

---

## 4. Architecture & Data Pipeline

```
[ NASA JPL NAIF SPICE DE440 ]      [ NASA GSFC LOLA DEM 30m ]
             │                                   │
             ▼                                   ▼
 [ SPICE Barycentric Ephemeris ]    [ 360° Radial Ray-Marching ]
             │                                   │
             └───────────────┬───────────────────┘
                             │
                             ▼
              [ LUNARIS Core Analytical Engine ]
              ├── Coordinate Transforms (ICRF → ME → SEZ)
              ├── Topocentric Parallax Correction (< 0.28°)
              ├── Vacuum Photometric Solar Flux (1,361.2 W/m²)
              ├── DTE RF Line-of-Sight & Libration Loop (±6.7°/±7.9°)
              └── MCDA Multi-Site Composite Scoring
                             │
                             ▼
              [ RESTful API Service (Express 5) ]
                             │
             ┌───────────────┴───────────────┐
             ▼                               ▼
 [ Unified 3D Solar System ]     [ Route Planner & Workbench ]
 - Sun-Centric Heliocentric       - Translunar Injection Vectors
 - Earth Orbit & Obliquity        - Departure Window Scenarios
 - Moon Orbit & Tilt (1.54°)      - Multi-Track Timeline Grids
 - LROC 4K / Elevation Textures   - Site Feasibility Rankings
```

---

## 5. Repository Structure

```
.
├── backend/
│   ├── data/
│   │   ├── dem/                   # LOLA DEM datasets and tile processing scripts
│   │   └── kernels/               # NASA JPL SPICE kernels (DE440, leap seconds, PCK)
│   ├── src/
│   │   ├── config/                # Environment variables and physical constants
│   │   ├── controllers/           # Geometry, terrain, illumination, windows, test controllers
│   │   ├── middleware/            # Request ID, logger, error handlers
│   │   ├── routes/                # Express API routes
│   │   ├── schemas/               # Zod validation schemas
│   │   ├── scripts/               # Offline verification and test scripts
│   │   ├── services/              # Ephemeris, coordinates, terrain, thermal, windows services
│   │   ├── tests/
│   │   │   ├── integration/       # API integration test suites
│   │   │   └── unit/              # 12 unit test suites (57 passed tests)
│   │   ├── app.ts                 # Express application setup
│   │   └── server.ts              # HTTP server entry point
│   └── package.json
├── frontend/
│   ├── public/
│   │   ├── textures/moon/         # LROC 4K color, Elevation, and Bump maps
│   │   └── textures/earth/        # 2K Earth Day, Night, and Cloud textures
│   ├── src/
│   │   ├── assets/                # Verified images and insignias
│   │   ├── components/            # Three.js 3D viewers, HUD, navigation, timeline
│   │   ├── data/                  # Launch sites, spacecraft presets, images
│   │   ├── pages/
│   │   │   ├── OverviewPage.tsx   # Home landing page with 100vh SpaceX hero
│   │   │   ├── MissionBrowserPage.tsx # Flagship 3D Sun-Earth-Moon simulator
│   │   │   └── MissionRoutePlannerPage.tsx # Trans-lunar flight trajectory planner
│   │   ├── services/              # lunarApi client service
│   │   ├── App.tsx                # Client-side router and root layout
│   │   ├── index.css              # Design system and Tailwind base styles
│   │   └── main.tsx               # React 19 root
│   └── package.json
├── CODEBASE_CLEANUP_AUDIT.md      # Comprehensive cleanup audit
├── CODEBASE_CLEANUP_REPORT.md     # Codebase cleanup report
└── README.md
```

---

## 6. Live Deployment & Getting Started

### Live Application
Access the live cloud deployment directly in your browser:
- **Production URL**: [https://lunar-missionbrowser-1.onrender.com](https://lunar-missionbrowser-1.onrender.com)

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd "NASA Hackathon"
   ```

2. **Install Backend Dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies**:
   ```bash
   cd ../frontend
   npm install
   ```

### Configuration

Copy the example environment files:

```bash
# Backend environment
cp backend/.env.example backend/.env

# Frontend environment
cp frontend/.env.example frontend/.env
```

---

## 7. Running the Application

### Start the Backend Server
```bash
cd backend
npm run dev
```
The backend API server will start at `http://127.0.0.1:5001`.

### Start the Frontend Client
```bash
cd frontend
npm run dev
```
The Vite development server will start at `http://localhost:5173`.

---

## 8. Testing & Verification

### Run Backend Unit Tests
Execute the comprehensive scientific validation test suite:
```bash
cd backend
npm test -- src/tests/unit/
```
All **12 test suites** and **57 unit tests** will execute and validate SPICE calculations, topocentric SEZ transforms, horizon ray-marching, and thermal flux.

### Run Backend Typecheck
```bash
cd backend
npm run typecheck
```

### Run Frontend Linter
```bash
cd frontend
npm run lint
```

### Build for Production
```bash
# Build backend
cd backend
npm run build

# Build frontend
cd ../frontend
npm run build
```

---

## 9. API Reference

All backend endpoints are prefixed with `/api/v1` (with convenience aliases available at `/api`):

| Endpoint | Method | Description |
|---|---|---|
| `/health` | `GET` | Service status, uptime, and system diagnostics |
| `/health/science` | `GET` | SPICE kernel and LOLA DEM readiness verification |
| `/geometry/sun` | `POST` | Instantaneous topocentric Sun azimuth and elevation |
| `/geometry/earth` | `POST` | Instantaneous topocentric Earth azimuth and elevation |
| `/geometry/sky` | `POST` | Combined Sun and Earth celestial vectors |
| `/terrain/surface-normal` | `POST` | Local slope and aspect calculated from LOLA DEM |
| `/terrain/horizon` | `POST` | Full 360° radial horizon obstacle profile |
| `/terrain/visibility` | `POST` | Clearance evaluation between horizon mask and target vector |
| `/illumination/instant` | `POST` | Instant illumination status and fractional limb coverage |
| `/windows/calculate` | `POST` | Continuous illumination and DTE contact window intervals |
| `/sites/defaults` | `GET` | Curated NASA candidate landing sites |
| `/sites/validate` | `POST` | Coordinate validation and polar DEM bounding check |
| `/sites/compare` | `POST` | Multi-site trade-off scoring and MCDA ranking |

---

## 10. Scientific References & Data Credits

- **NASA JPL Planetary Ephemeris (DE440)**: Folkner et al., *The Planetary and Lunar Ephemeris DE440 and DE441*, Jet Propulsion Laboratory / NAIF.
- **NASA GSFC Lunar Orbiter Laser Altimeter (LOLA)**: Smith et al., *Initial results from the Lunar Orbiter Laser Altimeter on the Lunar Reconnaissance Orbiter*, Space Science Reviews.
- **NASA ASU Lunar Reconnaissance Orbiter Camera (LROC)**: Robinson et al., *Lunar Reconnaissance Orbiter Camera (LROC) Instrument Overview*, Space Science Reviews.
- **NASA JPL Horizons On-Line Ephemeris System**: Giorgini et al., *JPL Solar System Dynamics Group*, NASA/JPL.
- **NASA Human Exploration and Operations Mission Directorate**: *Artemis III Candidate Landing Regions*, NASA Technical Reports Server.

---

## 11. License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.

