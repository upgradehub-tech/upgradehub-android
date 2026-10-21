import { Request, Response, NextFunction } from "express";
import { ADMIN_AUTH_CONFIG } from "../config/constants";

export const requireGmailAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = req.user;

  if (!user) {
    res.status(401).json({ success: false, message: "Unauthenticated" });
    return;
  }

  const normalizedEmail = user.email.toLowerCase().trim();
  const isGmailDomain = normalizedEmail.endsWith("@gmail.com");
  const isWhitelisted = ADMIN_AUTH_CONFIG.AUTHORIZED_GMAIL_ACCOUNTS.includes(normalizedEmail);

  if (user.role !== "ADMIN" || !isGmailDomain || !isWhitelisted) {
    // Fail silently without exposing admin existence to ordinary student callers
    res.status(403).json({ success: false, message: "Resource not available" });
    return;
  }

  next();
};