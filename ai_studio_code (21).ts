// src/routes/referral.routes.ts
import { Router } from "express";
import { ReferralController } from "../controllers/referral.controller";
import { authenticateUser } from "../middleware/auth.middleware";

export const referralRouter = Router();
const controller = new ReferralController();

referralRouter.get("/dashboard", authenticateUser, controller.getDashboard);
referralRouter.post("/complete", authenticateUser, controller.triggerReferralCompletion);

// src/routes/resource.routes.ts
import { Router as ResourceExpressRouter } from "express";
import { ResourceController } from "../controllers/resource.controller";
import { authenticateUser } from "../middleware/auth.middleware";

export const resourceRouter = ResourceExpressRouter();
const resController = new ResourceController();

resourceRouter.get("/subjects", authenticateUser, resController.getSubjects);
resourceRouter.get("/list", authenticateUser, resController.listResources);
resourceRouter.post("/:id/download", authenticateUser, resController.downloadResource);

// src/routes/admin.routes.ts
import { Router as AdminExpressRouter } from "express";
import { AdminController } from "../controllers/admin.controller";
import { authenticateUser } from "../middleware/auth.middleware";
import { requireGmailAdmin } from "../middleware/admin.middleware";

export const adminRouter = AdminExpressRouter();
const admController = new AdminController();

// Admin routes strictly secured via Google Identity & authorized Gmail whitelist
adminRouter.use(authenticateUser, requireGmailAdmin);
adminRouter.post("/resources", admController.createResource);
adminRouter.get("/metrics", admController.getMetrics);