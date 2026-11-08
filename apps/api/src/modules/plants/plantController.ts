import { Response } from 'express';
import { Plant } from '../../models/Plant.js';
import { ProductionLine } from '../../models/ProductionLine.js';
import { Machine } from '../../models/Machine.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { CreatePlantSchema, CreateProductionLineSchema } from '@factorypulse/shared';

export class PlantController {
  static async listPlants(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filter: any = {};
    if (req.tenantId) {
      filter.tenantId = req.tenantId;
    }

    const plants = await Plant.find(filter).sort({ name: 1 });

    const enriched = await Promise.all(
      plants.map(async (p: any) => {
        const lineCount = await ProductionLine.countDocuments({ plantId: p._id });
        const machineCount = await Machine.countDocuments({ plantId: p._id, isArchived: false });
        return {
          ...p.toObject(),
          lineCount,
          machineCount
        };
      })
    );

    res.json({ success: true, data: enriched });
  }

  static async createPlant(req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = CreatePlantSchema.parse(req.body);
    const tenantId = req.tenantId || data.tenantId;

    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const plant = await Plant.create({
      ...data,
      tenantId
    });

    res.status(201).json({ success: true, data: plant });
  }

  static async getPlantById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const filter: any = { _id: id };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const plant = await Plant.findOne(filter);
    if (!plant) {
      res.status(404).json({ success: false, error: 'Plant not found' });
      return;
    }

    const lines = await ProductionLine.find({ plantId: plant._id });
    const machineCount = await Machine.countDocuments({ plantId: plant._id, isArchived: false });

    res.json({
      success: true,
      data: {
        ...plant.toObject(),
        lines,
        machineCount
      }
    });
  }

  static async listLines(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { plantId } = req.params;
    const filter: any = { plantId };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const lines = await ProductionLine.find(filter).sort({ name: 1 });

    const enriched = await Promise.all(
      lines.map(async (l: any) => {
        const machineCount = await Machine.countDocuments({ lineId: l._id, isArchived: false });
        return {
          ...l.toObject(),
          machineCount
        };
      })
    );

    res.json({ success: true, data: enriched });
  }

  static async createLine(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { plantId } = req.params;
    const data = CreateProductionLineSchema.parse({ ...req.body, plantId });
    const tenantId = req.tenantId || data.tenantId;

    const line = await ProductionLine.create({
      ...data,
      plantId,
      tenantId
    });

    res.status(201).json({ success: true, data: line });
  }

  static async updatePlant(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const filter: any = { _id: id };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const plant = await Plant.findOne(filter);
    if (!plant) {
      res.status(404).json({ success: false, error: 'Plant not found' });
      return;
    }

    if (req.body.name) plant.name = req.body.name;
    if (req.body.code) plant.code = req.body.code.toUpperCase();
    if (req.body.location) plant.location = req.body.location;
    if (req.body.managerName !== undefined) plant.managerName = req.body.managerName;

    await plant.save();
    res.json({ success: true, data: plant });
  }

  static async deletePlant(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const filter: any = { _id: id };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const plant = await Plant.findOne(filter);
    if (!plant) {
      res.status(404).json({ success: false, error: 'Plant not found' });
      return;
    }

    const machineCount = await Machine.countDocuments({ plantId: plant._id, isArchived: false });
    if (machineCount > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete plant "${plant.name}". It still contains ${machineCount} active machine assets. Please reassign or archive them first.`
      });
      return;
    }

    await ProductionLine.deleteMany({ plantId: plant._id });
    await Plant.deleteOne({ _id: plant._id });

    res.json({ success: true, message: 'Plant and associated lines successfully removed' });
  }

  static async updateLine(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { plantId, lineId } = req.params;
    const filter: any = { _id: lineId, plantId };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const line = await ProductionLine.findOne(filter);
    if (!line) {
      res.status(404).json({ success: false, error: 'Production line not found' });
      return;
    }

    if (req.body.name) line.name = req.body.name;
    if (req.body.code) line.code = req.body.code.toUpperCase();
    if (req.body.targetRatePerHour) line.targetRatePerHour = Number(req.body.targetRatePerHour);

    await line.save();
    res.json({ success: true, data: line });
  }

  static async deleteLine(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { plantId, lineId } = req.params;
    const filter: any = { _id: lineId, plantId };
    if (req.tenantId) filter.tenantId = req.tenantId;

    const line = await ProductionLine.findOne(filter);
    if (!line) {
      res.status(404).json({ success: false, error: 'Production line not found' });
      return;
    }

    const machineCount = await Machine.countDocuments({ lineId: line._id, isArchived: false });
    if (machineCount > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete line "${line.name}". It currently has ${machineCount} assigned machines. Reassign or unassign machines first.`
      });
      return;
    }

    await ProductionLine.deleteOne({ _id: line._id });
    res.json({ success: true, message: 'Production line removed' });
  }
}
