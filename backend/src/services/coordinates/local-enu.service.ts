import { Vector3D, createVector, dot } from '../../utils/vectors';
import { degToRad, enuVectorToAzEl } from '../../utils/angles';
import { LunarSiteCoordinates, LunarFrameService } from './lunar-frame.service';

export interface LocalEnuBasis {
  east: Vector3D;
  north: Vector3D;
  up: Vector3D;
}

export interface LocalHorizontalTargetGeometry {
  azimuthDeg: number;
  elevationDeg: number;
  rangeMeters: number;
  enuVector: Vector3D;
}

export class LocalEnuService {
  /**
   * Computes the orthonormal East-North-Up (ENU) unit vectors in the MOON_ME Cartesian frame
   * for a given landing site.
   * 
   * Orthonormal basis:
   * e_East  = (-sin(lon),  cos(lon), 0)
   * e_North = (-sin(lat)*cos(lon), -sin(lat)*sin(lon), cos(lat))
   * e_Up    = ( cos(lat)*cos(lon),  cos(lat)*sin(lon), sin(lat))
   */
  public static computeEnuBasis(coords: LunarSiteCoordinates): LocalEnuBasis {
    LunarFrameService.validateCoordinates(coords);

    const latRad = degToRad(coords.latitudeDeg);
    const lonRad = degToRad(coords.longitudeDeg);

    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);
    const cosLon = Math.cos(lonRad);
    const sinLon = Math.sin(lonRad);

    const east = createVector(-sinLon, cosLon, 0);
    const north = createVector(-sinLat * cosLon, -sinLat * sinLon, cosLat);
    const up = createVector(cosLat * cosLon, cosLat * sinLon, sinLat);

    return { east, north, up };
  }

  /**
   * Transforms a 3D vector from the Moon-centered MOON_ME frame into the local ENU frame
   * at the specified landing site.
   * 
   * Note: If the vector represents a position rather than a displacement, subtract the site's
   * Moon-centered Cartesian position first to obtain the topocentric relative vector.
   */
  public static vectorMEToEnu(
    vectorME: Vector3D,
    coords: LunarSiteCoordinates
  ): Vector3D {
    const basis = this.computeEnuBasis(coords);

    return createVector(
      dot(vectorME, basis.east),
      dot(vectorME, basis.north),
      dot(vectorME, basis.up)
    );
  }

  /**
   * Transforms a local ENU vector back into the MOON_ME frame.
   */
  public static vectorEnuToME(
    enuVector: Vector3D,
    coords: LunarSiteCoordinates
  ): Vector3D {
    const basis = this.computeEnuBasis(coords);

    return createVector(
      enuVector.x * basis.east.x + enuVector.y * basis.north.x + enuVector.z * basis.up.x,
      enuVector.x * basis.east.y + enuVector.y * basis.north.y + enuVector.z * basis.up.y,
      enuVector.x * basis.east.z + enuVector.y * basis.north.z + enuVector.z * basis.up.z
    );
  }

  /**
   * Given the Moon-centered position of a celestial target (Sun or Earth) in MOON_ME and
   * the landing site coordinates, calculates the topocentric vector, azimuth, elevation,
   * and range.
   */
  public static calculateTargetGeometry(
    targetPositionME: Vector3D,
    siteCoords: LunarSiteCoordinates,
    observerHeightMeters = 2.0
  ): LocalHorizontalTargetGeometry {
    // Landing site surface position + observer antenna/sensor height
    const totalSiteCoords: LunarSiteCoordinates = {
      ...siteCoords,
      elevationMeters: (siteCoords.elevationMeters ?? 0.0) + observerHeightMeters,
    };

    const sitePositionME = LunarFrameService.selenographicToCartesianME(totalSiteCoords);

    // Topocentric vector from observer at site to target
    const topocentricVectorME = {
      x: targetPositionME.x - sitePositionME.x,
      y: targetPositionME.y - sitePositionME.y,
      z: targetPositionME.z - sitePositionME.z,
    };

    const rangeMeters = Math.hypot(
      topocentricVectorME.x,
      topocentricVectorME.y,
      topocentricVectorME.z
    );

    // Transform into local East-North-Up frame
    const enuVector = this.vectorMEToEnu(topocentricVectorME, siteCoords);

    // Calculate azimuth and elevation
    const { azimuthDeg, elevationDeg } = enuVectorToAzEl(enuVector);

    return {
      azimuthDeg,
      elevationDeg,
      rangeMeters,
      enuVector,
    };
  }
}
