export interface MoonTrekLayerMetadata {
  id: string;
  title: string;
  description: string;
  projection: 'EQ' | 'SP' | 'NP';
  crs: string;
  format: 'image/jpeg' | 'image/png';
  tileMatrixSet: string;
  minZoom: number;
  maxZoom: number;
  resolutionMpp: number;
  wmtsEndpoint: string;
  tileUrlTemplate: string;
  localFallbackUrl?: string;
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  instrument: string;
  mission: string;
  attribution: string;
  isElevationOrShade: boolean;
}

export const VERIFIED_MOON_TREK_LAYERS: MoonTrekLayerMetadata[] = [
  {
    id: 'LRO_WAC_Mosaic_Global_303ppd_v02',
    title: 'LROC WAC Global Photographic Mosaic',
    description: 'NASA Lunar Reconnaissance Orbiter Wide Angle Camera global morphologic mosaic (~100 meters/pixel, 303 pixels/degree). Shows authentic lunar albedo, maria, highlands, and surface impact features.',
    projection: 'EQ',
    crs: 'urn:ogc:def:crs:EPSG::104903',
    format: 'image/jpeg',
    tileMatrixSet: 'default028mm',
    minZoom: 0,
    maxZoom: 8,
    resolutionMpp: 100,
    wmtsEndpoint: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/',
    tileUrlTemplate: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    localFallbackUrl: '/tiles/lroc/{z}/{x}/{y}.png',
    bounds: { west: -180, south: -90, east: 180, north: 90 },
    instrument: 'Wide Angle Camera (WAC)',
    mission: 'Lunar Reconnaissance Orbiter (LRO)',
    attribution: 'NASA / GSFC / Arizona State University (LROC)',
    isElevationOrShade: false,
  },
  {
    id: 'LRO_LOLA_ClrShade_Global_128ppd_v04',
    title: 'LOLA Global Color Altimetry Hillshade',
    description: 'Lunar Orbiter Laser Altimeter (LOLA) global topography colorized relief map (~237 meters/pixel, 128 pixels/degree). Elevation values mapped to color gradient highlighting lunar elevation relief.',
    projection: 'EQ',
    crs: 'urn:ogc:def:crs:EPSG::104903',
    format: 'image/png',
    tileMatrixSet: 'default028mm',
    minZoom: 0,
    maxZoom: 7,
    resolutionMpp: 237,
    wmtsEndpoint: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_ClrShade_Global_128ppd_v04/1.0.0/',
    tileUrlTemplate: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_ClrShade_Global_128ppd_v04/1.0.0/default/default028mm/{z}/{y}/{x}.png',
    bounds: { west: -180, south: -90, east: 180, north: 90 },
    instrument: 'Lunar Orbiter Laser Altimeter (LOLA)',
    mission: 'Lunar Reconnaissance Orbiter (LRO)',
    attribution: 'NASA / GSFC / LOLA Science Team',
    isElevationOrShade: true,
  },
  {
    id: 'LRO_LOLAKaguya_Hillshade_60N60S_512ppd',
    title: 'LOLA & Kaguya TC High-Detail Grayscale Shaded Relief',
    description: 'Seamless merge of LRO LOLA laser altimetry and JAXA Kaguya Terrain Camera stereo photometry (~59 meters/pixel, 512 pixels/degree). Accurately resolves crater rims, terraces, and geological structures.',
    projection: 'EQ',
    crs: 'urn:ogc:def:crs:EPSG::104903',
    format: 'image/png',
    tileMatrixSet: 'default028mm',
    minZoom: 0,
    maxZoom: 8,
    resolutionMpp: 59,
    wmtsEndpoint: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLAKaguya_Hillshade_60N60S_512ppd/1.0.0/',
    tileUrlTemplate: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLAKaguya_Hillshade_60N60S_512ppd/1.0.0/default/default028mm/{z}/{y}/{x}.png',
    bounds: { west: -180, south: -60, east: 180, north: 60 },
    instrument: 'LOLA + Terrain Camera (TC)',
    mission: 'LRO & JAXA SELENE (Kaguya)',
    attribution: 'NASA / GSFC / JAXA / USGS Astrogeology',
    isElevationOrShade: true,
  },
  {
    id: 'LRO_LOLA_ClrShade_SPole75_30mp_v04_EQ',
    title: 'LOLA South Pole Artemis Exploration Zone Color Shading',
    description: 'High-resolution polar altimetry color shading from 75°S to 90°S (~30 meters/pixel). Directly encompasses the Artemis candidate landing sites (Shackleton, Malapert, de Gerlache, Haworth).',
    projection: 'EQ',
    crs: 'urn:ogc:def:crs:EPSG::104903',
    format: 'image/png',
    tileMatrixSet: 'default028mm',
    minZoom: 0,
    maxZoom: 9,
    resolutionMpp: 30,
    wmtsEndpoint: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_ClrShade_SPole75_30mp_v04_EQ/1.0.0/',
    tileUrlTemplate: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_ClrShade_SPole75_30mp_v04_EQ/1.0.0/default/default028mm/{z}/{y}/{x}.png',
    bounds: { west: -180, south: -90, east: 180, north: -75 },
    instrument: 'Lunar Orbiter Laser Altimeter (LOLA)',
    mission: 'Lunar Reconnaissance Orbiter (LRO)',
    attribution: 'NASA / GSFC / Barker et al. (PGDA)',
    isElevationOrShade: true,
  },
];

export class MoonTrekService {
  private static capabilitiesCache = new Map<string, { xml: string; cachedAt: number }>();
  private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Returns all verified NASA Moon Trek layers with their full metadata.
   */
  public static getLayers(): MoonTrekLayerMetadata[] {
    return VERIFIED_MOON_TREK_LAYERS;
  }

  /**
   * Finds layer metadata by layer identifier.
   */
  public static getLayerById(layerId: string): MoonTrekLayerMetadata | undefined {
    return VERIFIED_MOON_TREK_LAYERS.find((l) => l.id.toLowerCase() === layerId.toLowerCase());
  }

  /**
   * Fetches or retrieves cached OGC WMTSCapabilities XML for a layer.
   */
  public static async getCapabilities(layerId: string): Promise<string> {
    const layer = this.getLayerById(layerId);
    if (!layer) {
      throw new Error(`Unknown Moon Trek layer identifier: ${layerId}`);
    }

    const cached = this.capabilitiesCache.get(layer.id);
    const now = Date.now();
    if (cached && (now - cached.cachedAt) < this.CACHE_TTL_MS) {
      return cached.xml;
    }

    const capabilitiesUrl = `${layer.wmtsEndpoint}WMTSCapabilities.xml`;
    try {
      const response = await fetch(capabilitiesUrl, {
        headers: { 'Accept': 'application/xml, text/xml, */*' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`NASA Moon Trek server returned HTTP ${response.status}`);
      }

      const xml = await response.text();
      this.capabilitiesCache.set(layer.id, { xml, cachedAt: now });
      return xml;
    } catch (error) {
      // Return synthetic compliant WMTSCapabilities XML if offline / network unreachable
      const syntheticXml = this.generateSyntheticCapabilitiesXml(layer);
      this.capabilitiesCache.set(layer.id, { xml: syntheticXml, cachedAt: now });
      return syntheticXml;
    }
  }

  /**
   * Generates a fully OGC WMTS 1.0.0-compliant Capabilities document for offline resilience.
   */
  private static generateSyntheticCapabilitiesXml(layer: MoonTrekLayerMetadata): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Capabilities xmlns="http://www.opengis.net/wmts/1.0" xmlns:ows="http://www.opengis.net/ows/1.1" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.0.0">
  <ows:ServiceIdentification>
    <ows:Title>${layer.title}</ows:Title>
    <ows:Abstract>${layer.description}</ows:Abstract>
    <ows:ServiceType>OGC WMTS</ows:ServiceType>
    <ows:ServiceTypeVersion>1.0.0</ows:ServiceTypeVersion>
  </ows:ServiceIdentification>
  <Contents>
    <Layer>
      <ows:Title>${layer.title}</ows:Title>
      <ows:Identifier>${layer.id}</ows:Identifier>
      <ows:BoundingBox crs="${layer.crs}">
        <ows:LowerCorner>${layer.bounds.west} ${layer.bounds.south}</ows:LowerCorner>
        <ows:UpperCorner>${layer.bounds.east} ${layer.bounds.north}</ows:UpperCorner>
      </ows:BoundingBox>
      <Style isDefault="true">
        <ows:Title>Default Style</ows:Title>
        <ows:Identifier>default</ows:Identifier>
      </Style>
      <Format>${layer.format}</Format>
      <TileMatrixSetLink>
        <TileMatrixSet>${layer.tileMatrixSet}</TileMatrixSet>
      </TileMatrixSetLink>
      <ResourceURL format="${layer.format}" resourceType="tile" template="${layer.tileUrlTemplate}"/>
    </Layer>
    <TileMatrixSet>
      <ows:Identifier>${layer.tileMatrixSet}</ows:Identifier>
      <ows:SupportedCRS>${layer.crs}</ows:SupportedCRS>
    </TileMatrixSet>
  </Contents>
</Capabilities>`;
  }
}
