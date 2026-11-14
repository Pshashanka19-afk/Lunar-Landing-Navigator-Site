import os
from PIL import Image

def generate_tile_pyramid(source_image_path, output_dir, max_zoom=3, tile_size=256, is_jpeg_source=False):
    print(f"Generating tile pyramid from {source_image_path} into {output_dir} (Max Zoom: {max_zoom})...")
    os.makedirs(output_dir, exist_ok=True)
    
    src = Image.open(source_image_path)
    if is_jpeg_source or src.mode != 'RGB':
        src = src.convert('RGB')
    
    src_w, src_h = src.size
    print(f"Source size: {src_w}x{src_h}")
    
    for z in range(max_zoom + 1):
        nx = 2 ** (z + 1)
        ny = 2 ** z
        print(f"  Zoom {z}: {nx}x{ny} = {nx * ny} tiles...")
        
        # Grid width and height in source image coordinates
        tile_src_w = src_w / float(nx)
        tile_src_h = src_h / float(ny)
        
        for x in range(nx):
            x_dir = os.path.join(output_dir, str(z), str(x))
            os.makedirs(x_dir, exist_ok=True)
            
            x0 = int(round(x * tile_src_w))
            x1 = int(round((x + 1) * tile_src_w))
            
            for y in range(ny):
                y0 = int(round(y * tile_src_h))
                y1 = int(round((y + 1) * tile_src_h))
                
                # Crop tile from source
                tile_crop = src.crop((x0, y0, x1, y1))
                tile_res = tile_crop.resize((tile_size, tile_size), Image.Resampling.LANCZOS)
                
                tile_path = os.path.join(x_dir, f"{y}.png")
                # Save optimized
                tile_res.save(tile_path, "PNG", optimize=True)

    print(f"Completed {output_dir}")

base_out = "frontend/public/tiles"
os.makedirs(base_out, exist_ok=True)

# 1. Shaded Relief
generate_tile_pyramid(
    "backend/data/dem/processed/global_shaded_relief_5k.png",
    os.path.join(base_out, "shaded-relief"),
    max_zoom=3
)

# 2. LROC Photographic Mosaic
generate_tile_pyramid(
    "backend/data/dem/lroc_color_4k.jpg",
    os.path.join(base_out, "lroc"),
    max_zoom=3,
    is_jpeg_source=True
)

# 3. Elevation Color
generate_tile_pyramid(
    "backend/data/dem/processed/global_elevation_5k.png",
    os.path.join(base_out, "elevation"),
    max_zoom=3
)

# 4. Hillshade
generate_tile_pyramid(
    "backend/data/dem/processed/global_hillshade_5k.png",
    os.path.join(base_out, "hillshade"),
    max_zoom=3
)

print("All global tile pyramids generated successfully!")

