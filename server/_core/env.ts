export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  pantepayApiUrl: process.env.PANTEPAY_API_URL ?? "",
  pantepaySecretKey: process.env.PANTEPAY_SECRET_KEY ?? "",
  pantepayWebhookSecret: process.env.PANTEPAY_WEBHOOK_SECRET ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? "",
};
