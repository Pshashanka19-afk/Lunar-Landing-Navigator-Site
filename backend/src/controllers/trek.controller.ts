import { Request, Response, NextFunction } from 'express';
import { MoonTrekService } from '../services/trek/trek.service';

export class MoonTrekController {
  public static getLayers(_req: Request, res: Response, next: NextFunction): void {
    try {
      const layers = MoonTrekService.getLayers();
      res.json({
        success: true,
        count: layers.length,
        layers,
      });
    } catch (error) {
      next(error);
    }
  }

  public static getLayerDetails(req: Request, res: Response, next: NextFunction): void {
    try {
      const layerId = String(req.params.layerId || '');
      const layer = MoonTrekService.getLayerById(layerId);
      if (!layer) {
        res.status(404).json({
          success: false,
          error: `Layer ${layerId} not found in verified NASA Moon Trek catalog`,
        });
        return;
      }
      res.json({
        success: true,
        layer,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getCapabilities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const layerId = String(req.params.layerId || '');
      const xml = await MoonTrekService.getCapabilities(layerId);
      res.set('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      next(error);
    }
  }
}
