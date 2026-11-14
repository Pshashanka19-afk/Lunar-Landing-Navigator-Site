import numpy as np
from PIL import Image
import os
import subprocess

print("Generating global equirectangular rasters from authentic NASA datasets...")

# 1. Global LOLA DEM: backend/data/dem/ldem_16_uint.tif (5760 x 2880)
dem_path = "backend/data/dem/ldem_16_uint.tif"
processed_dir = "backend/data/dem/processed"
os.makedirs(processed_dir, exist_ok=True)

print("1. Reading 16-bit LOLA DEM...")
dem_img = Image.open(dem_path)
dem_arr = np.array(dem_img, dtype=np.float32)

# Elevation in meters relative to 1737400m sphere
# NASA SVS CGI Moon Kit formula: elev = (pixel_val - 18961) * 0.5
elev = (dem_arr - 18961.0) * 0.5
print(f"Elevation stats: Min={elev.min():.1f}m, Max={elev.max():.1f}m, Mean={elev.mean():.1f}m")

# Generate Global Hypsometric Elevation Color Relief
print("2. Computing global hypsometric color gradient...")
# Palette range: -8500m to +11000m
norm = np.clip((elev - (-8500.0)) / (11000.0 - (-8500.0)), 0, 1)

palette = [
    (0.00, (24, 20, 54)),   # -8500m: Deepest basin
    (0.18, (28, 44, 94)),   # -5000m: Lowlands
    (0.32, (28, 85, 125)),  # -2200m: Maria
    (0.44, (30, 135, 140)), # 0m: Reference sphere
    (0.55, (42, 165, 130)), # +2200m: Uplands
    (0.70, (200, 170, 55)), # +5100m: Highlands
    (0.85, (225, 115, 45)), # +8000m: Mountain peaks
    (1.00, (250, 250, 255)) # +11000m: Highest crests
]

r = np.zeros_like(norm)
g = np.zeros_like(norm)
b = np.zeros_like(norm)

for i in range(len(palette) - 1):
    val0, c0 = palette[i]
    val1, c1 = palette[i + 1]
    mask = (norm >= val0) & (norm <= val1)
    t = (norm[mask] - val0) / (val1 - val0)
    r[mask] = c0[0] + t * (c1[0] - c0[0])
    g[mask] = c0[1] + t * (c1[1] - c0[1])
    b[mask] = c0[2] + t * (c1[2] - c0[2])

elev_rgb = np.dstack([r.astype(np.uint8), g.astype(np.uint8), b.astype(np.uint8)])
elev_img = Image.fromarray(elev_rgb, 'RGB')
elev_img.save(f"{processed_dir}/global_elevation_5k.png", "PNG", optimize=True)
print(f"Saved {processed_dir}/global_elevation_5k.png")

# Generate Global Hillshade
# We calculate directional slope derivatives across the 5760x2880 grid
print("3. Computing global analytical hillshade...")
# Sun azimuth = 315 deg (from NW), elevation = 45 deg
azimuth_rad = np.radians(315.0)
altitude_rad = np.radians(40.0)

# Pixel sizes in meters:
# Along latitude: 180 deg / 2880 = 0.0625 deg. R_moon * 0.0625 * pi / 180 = ~1895 meters
# Along longitude at equator: 360 deg / 5760 = 0.0625 deg = ~1895 meters
dx_base = 1895.0
dy = 1895.0

# Central differences for gradients:
dz_dy, dz_dx = np.gradient(elev, dy, dx_base)

# Account for spherical convergence of meridians toward poles:
lats = np.linspace(90.0, -90.0, dem_arr.shape[0])
cos_lats = np.cos(np.radians(lats))
# Avoid division by zero near poles
cos_lats = np.clip(cos_lats, 0.02, 1.0)
dz_dx = dz_dx / cos_lats[:, np.newaxis]

slope = np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))
aspect = np.arctan2(-dz_dy, -dz_dx)

hillshade = 255.0 * (
    (np.sin(altitude_rad) * np.cos(slope)) +
    (np.cos(altitude_rad) * np.sin(slope) * np.cos(azimuth_rad - aspect))
)
hillshade = np.clip(hillshade, 0, 255).astype(np.uint8)

hill_img = Image.fromarray(hillshade, 'L')
hill_img.save(f"{processed_dir}/global_hillshade_5k.png", "PNG", optimize=True)
print(f"Saved {processed_dir}/global_hillshade_5k.png")

# 4. Generate Blended Shaded Relief
print("4. Blending global shaded relief...")
h_norm = hillshade.astype(np.float32) / 255.0
h_factor = 0.35 + 0.85 * h_norm
shaded_rgb = np.clip(elev_rgb.astype(np.float32) * h_factor[:, :, np.newaxis], 0, 255).astype(np.uint8)

shaded_img = Image.fromarray(shaded_rgb, 'RGB')
shaded_img.save(f"{processed_dir}/global_shaded_relief_5k.png", "PNG", optimize=True)
print(f"Saved {processed_dir}/global_shaded_relief_5k.png")
print("Global base rasters generated successfully!")

