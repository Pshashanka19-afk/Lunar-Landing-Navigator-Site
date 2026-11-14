# Lunar Digital Elevation Model (DEM) Directory

This directory contains real lunar polar topography datasets derived from NASA Lunar Reconnaissance Orbiter (LRO) Lunar Orbiter Laser Altimeter (LOLA) observations.

## Primary File

- **File**: `lunar-south-pole.tif`
- **Format**: Standard single-band Float32 GeoTIFF
- **Resolution**: 80 meters / pixel
- **Dimensions**: 2500 × 2500 pixels (200 km × 200 km coverage)
- **Coordinate Reference System**: Lunar South Polar Stereographic (Sphere datum $R = 1,737,400$ m, center at South Pole $90^\circ$S, $0^\circ$E)
- **Elevation Units**: Meters relative to the 1,737.4 km lunar reference sphere
- **Source**: NASA GSFC PGDA Product 90 ("A New View of the Lunar South Pole from LOLA", M. K. Barker et al., 2023)
- **Source URL**: `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF`

Full metadata including spatial bounds, pixel transforms, and site verification are documented in `dem-metadata.json`.
