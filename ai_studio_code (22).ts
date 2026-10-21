import { Request, Response } from "express";
import { AdminService } from "../services/admin.service";

const adminService = new AdminService();

export class AdminController {
  async createResource(req: Request, res: Response) {
    try {
      const adminId = req.user!.id;
      const {
        title,
        description,
        type,
        fileUrl,
        thumbnailUrl,
        fileSizeBytes,
        fileExtension,
        isDownloadable,
        isPremium,
        subjectId,
        chapterId,
      } = req.body;

      const resource = await adminService.addResourceItem(adminId, {
        title,
        description,
        type,
        fileUrl,
        thumbnailUrl,
        fileSizeBytes: BigInt(fileSizeBytes),
        fileExtension,
        isDownloadable: isDownloadable ?? true,
        isPremium: isPremium ?? false,
        subjectId,
        chapterId,
      });

      res.status(201).json({
        success: true,
        data: { ...resource, fileSizeBytes: resource.fileSizeBytes.toString() },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getMetrics(req: Request, res: Response) {
    try {
      const adminId = req.user!.id;
      const metrics = await adminService.getPlatformMetrics(adminId);
      res.status(200).json({ success: true, data: metrics });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}