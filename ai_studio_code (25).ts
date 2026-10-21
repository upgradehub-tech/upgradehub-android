import { prisma } from "../config/prisma";
import { ResourceType } from "@prisma/client";

export class AdminService {
  async addResourceItem(
    adminId: string,
    data: {
      title: string;
      description?: string;
      type: ResourceType;
      fileUrl: string;
      thumbnailUrl?: string;
      fileSizeBytes: bigint;
      fileExtension: string;
      isDownloadable: boolean;
      isPremium: boolean;
      subjectId: string;
      chapterId: string;
    }
  ) {
    return await prisma.$transaction(async (tx) => {
      const resource = await tx.resourceVault.create({
        data: {
          ...data,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          adminId,
          action: "CREATE_RESOURCE",
          targetId: resource.id,
          payload: { title: data.title, type: data.type },
        },
      });

      return resource;
    });
  }

  async getPlatformMetrics(adminId: string) {
    const [totalUsers, totalReferrals, totalPaidRewards, totalResources] =
      await Promise.all([
        prisma.user.count(),
        prisma.referral.count({ where: { status: "COMPLETED" } }),
        prisma.referralReward.aggregate({
          _sum: { rewardAmount: true },
        }),
        prisma.resourceVault.count(),
      ]);

    return {
      totalUsers,
      totalSuccessfulReferrals: totalReferrals,
      totalRewardsPaidINR: totalPaidRewards._sum.rewardAmount || 0,
      totalVaultResources: totalResources,
    };
  }
}