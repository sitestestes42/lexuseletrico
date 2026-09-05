export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  // Database connection configured in Settings → Secrets / Environment Variables.
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // PantePay secrets: backend only; never prefix these with VITE_ or expose them to React.
  pantepayApiUrl: process.env.PANTEPAY_API_URL ?? "",
  pantepaySecretKey: process.env.PANTEPAY_SECRET_KEY ?? "",
  pantepayWebhookSecret: process.env.PANTEPAY_WEBHOOK_SECRET ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? "",
};
