import { Request, Response } from "express";
import { ResourceService } from "../services/resource.service";
import { ResourceType } from "@prisma/client";

const resourceService = new ResourceService();

export class ResourceController {
  async getSubjects(req: Request, res: Response) {
    try {
      const subjects = await resourceService.getSubjectsWithHierarchy();
      res.status(200).json({ success: true, data: subjects });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async listResources(req: Request, res: Response) {
    try {
      const { subjectId, chapterId, type, search, page, limit } = req.query;
      const data = await resourceService.getVaultResources({
        subjectId: subjectId as string,
        chapterId: chapterId as string,
        type: type as ResourceType,
        search: search as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      });
      res.status(200).json({ success: true, ...data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async downloadResource(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await resourceService.recordDownload(id);
      res.status(200).json({ success: true, downloadUrl: result.fileUrl });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}