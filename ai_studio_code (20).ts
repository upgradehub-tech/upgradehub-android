// src/server.ts
import express from "express";
import cors from "cors";
import { referralRouter } from "./routes/referral.routes";
import { resourceRouter } from "./routes/resource.routes";
import { adminRouter } from "./routes/admin.routes";

const app = express();
app.use(cors());
app.use(express.json());

// Main App API Routes
app.use("/api/v1/referrals", referralRouter);
app.use("/api/v1/resources", resourceRouter);
app.use("/api/v1/admin", adminRouter);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[Life OS Backend] Production Server running on port ${PORT}`);
});