# NASA/NAIF SPICE Kernels Directory

This directory contains official NASA/JPL NAIF SPICE kernels required for high-precision lunar ephemeris calculations, coordinate transformations, and solar/terrestrial geometry.

## Available Kernels

| Filename | Type | Size | Description | Official Source URL |
|---|---|---|---|---|
| `naif0012.tls` | LSK | 5.3 KB | Leapseconds kernel | `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls` |
| `pck00010.tpc` | PCK | 126.1 KB | Planetary constants | `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc` |
| `de421.bsp` | SPK | 16.8 MB | Planetary ephemeris (1900–2050) | `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/a_old_versions/de421.bsp` |
| `de440s.bsp` | SPK | 32.7 MB | Modern planetary ephemeris (1900–2050) | `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp` |
| `moon_080317.tf` | FK | 21.4 KB | Lunar frames definition (`MOON_ME`, `MOON_PA`) | `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf` |
| `moon_pa_de421_1900-2050.bpc` | Binary PCK | 1.8 MB | High-precision lunar orientation / libration | `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de421_1900-2050.bpc` |

## Verification

Checksums and detailed metadata are tracked in `kernel-manifest.json`.
The backend uses NASA-AMMOS CSPICE WebAssembly bindings to load and compute positions directly from these kernels.
