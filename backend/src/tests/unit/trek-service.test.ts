import { describe, it, expect } from 'vitest';
import { MoonTrekService, VERIFIED_MOON_TREK_LAYERS } from '../../services/trek/trek.service';

describe('NASA Moon Trek WMTS Service & Catalog', () => {
  it('should list all verified NASA Moon Trek layers', () => {
    const layers = MoonTrekService.getLayers();
    expect(layers.length).toBeGreaterThanOrEqual(4);

    const wacLayer = layers.find((l) => l.id === 'LRO_WAC_Mosaic_Global_303ppd_v02');
    expect(wacLayer).toBeDefined();
    expect(wacLayer?.projection).toBe('EQ');
    expect(wacLayer?.crs).toBe('urn:ogc:def:crs:EPSG::104903');
    expect(wacLayer?.tileMatrixSet).toBe('default028mm');
    expect(wacLayer?.format).toBe('image/jpeg');
    expect(wacLayer?.tileUrlTemplate).toContain('LRO_WAC_Mosaic_Global_303ppd_v02');
  });

  it('should include authentic LOLA altimetry and shaded relief layers', () => {
    const lolaClr = MoonTrekService.getLayerById('LRO_LOLA_ClrShade_Global_128ppd_v04');
    expect(lolaClr).toBeDefined();
    expect(lolaClr?.format).toBe('image/png');
    expect(lolaClr?.isElevationOrShade).toBe(true);

    const kaguya = MoonTrekService.getLayerById('LRO_LOLAKaguya_Hillshade_60N60S_512ppd');
    expect(kaguya).toBeDefined();
    expect(kaguya?.resolutionMpp).toBe(59);

    const polar = MoonTrekService.getLayerById('LRO_LOLA_ClrShade_SPole75_30mp_v04_EQ');
    expect(polar).toBeDefined();
    expect(polar?.bounds.south).toBe(-90);
  });

  it('should generate compliant OGC WMTSCapabilities XML for layers', async () => {
    const xml = await MoonTrekService.getCapabilities('LRO_WAC_Mosaic_Global_303ppd_v02');
    expect(xml).toContain('<Capabilities');
    expect(xml).toContain('LRO_WAC_Mosaic_Global_303ppd_v02');
    expect(xml).toContain('default028mm');
  });
});

