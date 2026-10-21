import { prisma } from "../config/prisma";
import { REFERRAL_CONFIG } from "../config/constants";
import { Decimal } from "@prisma/client/runtime/library";

export class ReferralService {
  /**
   * Generates or retrieves user's referral summary & tracking progress
   */
  async getReferralDashboard(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    if (!user) throw new Error("User does not exist");

    const totalSuccessfulReferrals = await prisma.referral.count({
      where: {
        referrerId: userId,
        status: "COMPLETED",
      },
    });

    const pendingReferrals = await prisma.referral.count({
      where: {
        referrerId: userId,
        status: "PENDING",
      },
    });

    // Milestone rule: 10 referrals = ₹100
    const completedMilestones = Math.floor(
      totalSuccessfulReferrals / REFERRAL_CONFIG.REQUIRED_REFERRALS_PER_MILESTONE
    );
    const progressInCurrentMilestone =
      totalSuccessfulReferrals % REFERRAL_CONFIG.REQUIRED_REFERRALS_PER_MILESTONE;
    const referralsNeededForNextReward =
      REFERRAL_CONFIG.REQUIRED_REFERRALS_PER_MILESTONE - progressInCurrentMilestone;

    const rewards = await prisma.referralReward.findMany({
      where: { userId },
      orderBy: { milestoneNumber: "desc" },
    });

    const shareUrl = `${REFERRAL_CONFIG.APP_DEEP_LINK_BASE}${user.referralCode}`;

    return {
      referralCode: user.referralCode,
      shareUrl,
      stats: {
        totalSuccessful: totalSuccessfulReferrals,
        totalPending: pendingReferrals,
        currentMilestoneProgress: progressInCurrentMilestone,
        referralsNeededForNextReward,
        requiredBatchSize: REFERRAL_CONFIG.REQUIRED_REFERRALS_PER_MILESTONE,
        rewardPerMilestoneINR: REFERRAL_CONFIG.REWARD_AMOUNT_INR,
        totalEarnedINR: completedMilestones * REFERRAL_CONFIG.REWARD_AMOUNT_INR,
      },
      rewards,
    };
  }

  /**
   * Complete referee signup and evaluate milestone unlock atomically.
   */
  async processSuccessfulReferral(referrerId: string, refereeId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Create or update referral record to COMPLETED
      const referral = await tx.referral.upsert({
        where: { refereeId },
        update: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
        create: {
          referrerId,
          refereeId,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      // 2. Count all completed referrals without an assigned milestone
      const unassignedReferrals = await tx.referral.findMany({
        where: {
          referrerId,
          status: "COMPLETED",
          milestoneId: null,
        },
        take: REFERRAL_CONFIG.REQUIRED_REFERRALS_PER_MILESTONE,
        orderBy: { completedAt: "asc" },
      });

      // 3. Exactly 10 successful referrals unlock the reward
      if (unassignedReferrals.length === REFERRAL_CONFIG.REQUIRED_REFERRALS_PER_MILESTONE) {
        const lastMilestone = await tx.referralReward.findFirst({
          where: { userId: referrerId },
          orderBy: { milestoneNumber: "desc" },
        });

        const nextMilestoneNumber = (lastMilestone?.milestoneNumber || 0) + 1;

        // Ensure wallet exists
        const wallet = await tx.wallet.upsert({
          where: { userId: referrerId },
          update: {
            balance: { increment: REFERRAL_CONFIG.REWARD_AMOUNT_INR },
          },
          create: {
            userId: referrerId,
            balance: new Decimal(REFERRAL_CONFIG.REWARD_AMOUNT_INR),
          },
        });

        // Create reward entry
        const reward = await tx.referralReward.create({
          data: {
            userId: referrerId,
            milestoneNumber: nextMilestoneNumber,
            requiredCount: REFERRAL_CONFIG.REQUIRED_REFERRALS_PER_MILESTONE,
            rewardAmount: new Decimal(REFERRAL_CONFIG.REWARD_AMOUNT_INR),
            status: "CLAIMED",
            claimedAt: new Date(),
          },
        });

        // Create wallet ledger transaction record
        await tx.walletLedger.create({
          data: {
            walletId: wallet.id,
            type: "CREDIT",
            amount: new Decimal(REFERRAL_CONFIG.REWARD_AMOUNT_INR),
            description: `Unlocked Milestone #${nextMilestoneNumber}: 10 Successful Referrals Reward`,
            rewardId: reward.id,
          },
        });

        // Associate referrals with this milestone
        const referralIds = unassignedReferrals.map((r) => r.id);
        await tx.referral.updateMany({
          where: { id: { in: referralIds } },
          data: { milestoneId: reward.id },
        });

        return { rewardGranted: true, milestoneNumber: nextMilestoneNumber, rewardAmount: REFERRAL_CONFIG.REWARD_AMOUNT_INR };
      }

      return { rewardGranted: false, remaining: REFERRAL_CONFIG.REQUIRED_REFERRALS_PER_MILESTONE - unassignedReferrals.length };
    });
  }
}