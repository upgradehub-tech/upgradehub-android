import { Request, Response } from "express";
import { ReferralService } from "../services/referral.service";

const referralService = new ReferralService();

export class ReferralController {
  async getDashboard(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const data = await referralService.getReferralDashboard(userId);
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async triggerReferralCompletion(req: Request, res: Response) {
    try {
      const { referrerId, refereeId } = req.body;
      if (!referrerId || !refereeId) {
        res.status(400).json({ success: false, message: "Missing required params" });
        return;
      }
      const result = await referralService.processSuccessfulReferral(referrerId, refereeId);
      res.status(200).json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}