import { prisma } from "../config/prisma";
import { ResourceType } from "@prisma/client";

export class ResourceService {
  async getSubjectsWithHierarchy() {
    return await prisma.subject.findMany({
      include: {
        chapters: {
          orderBy: { chapterNo: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  async getVaultResources(params: {
    subjectId?: string;
    chapterId?: string;
    type?: ResourceType;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { subjectId, chapterId, type, search, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (subjectId) where.subjectId = subjectId;
    if (chapterId) where.chapterId = chapterId;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.resourceVault.findMany({
        where,
        include: {
          subject: { select: { id: true, name: true } },
          chapter: { select: { id: true, name: true, chapterNo: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.resourceVault.count({ where }),
    ]);

    return {
      items: items.map((res) => ({
        ...res,
        fileSizeBytes: res.fileSizeBytes.toString(),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async recordDownload(resourceId: string) {
    return await prisma.resourceVault.update({
      where: { id: resourceId },
      data: { downloads: { increment: 1 } },
      select: { id: true, downloads: true, fileUrl: true },
    });
  }
}