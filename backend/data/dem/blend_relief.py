import numpy as np
from PIL import Image
import os

color_path = "backend/data/dem/processed/lunar-dem-color.tif"
hillshade_path = "backend/data/dem/processed/lunar-dem-hillshade.tif"
output_png = "frontend/public/dem/lunar-south-pole-shaded-relief.png"
output_color_png = "frontend/public/dem/lunar-dem-color.png"
output_hillshade_png = "frontend/public/dem/lunar-dem-hillshade.png"

print("Loading color relief...")
color_img = Image.open(color_path)
color_arr = np.array(color_img) # (2500, 2500, 4)

print("Loading hillshade...")
hill_img = Image.open(hillshade_path)
hill_arr = np.array(hill_img) # (2500, 2500)

print(f"Color shape: {color_arr.shape}, Hillshade shape: {hill_arr.shape}")

# Save clean individual PNGs for layer toggling
color_img.save(output_color_png, "PNG", optimize=True)
hill_img.save(output_hillshade_png, "PNG", optimize=True)
print(f"Saved {output_color_png} and {output_hillshade_png}")

# Create blended shaded relief:
# Alpha channel from color_arr
alpha = color_arr[:, :, 3]

# Normalize hillshade 0..1
# Modulate hillshade: shadows down to 0.35, highlights up to 1.15
# Avoid washing out colors
h_norm = hill_arr.astype(np.float32) / 255.0
h_factor = 0.30 + 0.85 * h_norm # range [0.30, 1.15]

# Apply to R, G, B
rgb = color_arr[:, :, :3].astype(np.float32)
shaded_rgb = np.clip(rgb * h_factor[:, :, np.newaxis], 0, 255).astype(np.uint8)

# Combine with alpha
result = np.dstack([shaded_rgb, alpha])

result_img = Image.fromarray(result, 'RGBA')
result_img.save(output_png, "PNG", optimize=True)
print(f"Saved shaded relief to {output_png} (Size: {os.path.getsize(output_png) / (1024*1024):.2f} MB)")

