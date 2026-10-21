export const REFERRAL_CONFIG = {
  REQUIRED_REFERRALS_PER_MILESTONE: 10,
  REWARD_AMOUNT_INR: 100.0,
  APP_DEEP_LINK_BASE: "https://lifeos.edtech.com/invite?code=",
};

export const ADMIN_AUTH_CONFIG = {
  // Production-authorized Gmail addresses. Must match exact verified Google identity.
  AUTHORIZED_GMAIL_ACCOUNTS: (process.env.ADMIN_GMAIL_WHITELIST || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0),
};