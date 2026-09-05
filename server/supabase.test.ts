import { describe, expect, it } from "vitest";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? "";

function getSupabaseUrl(value: string) {
  if (/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(value)) return value.replace(/\/$/, "");
  if (/^[a-z0-9-]+$/.test(value)) return `https://${value}.supabase.co`;
  return value;
}

describe.skipIf(process.env.RUN_LIVE_INTEGRATION_TESTS !== "1")("Supabase credentials", () => {
  it("authenticates against the Supabase settings endpoint", async () => {
    const normalizedUrl = getSupabaseUrl(supabaseUrl);
    expect(normalizedUrl).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
    expect(supabaseSecretKey).not.toBe("");

    const response = await fetch(`${normalizedUrl}/auth/v1/settings`, {
      headers: {
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    expect(response.status, `Supabase returned HTTP ${response.status}`).not.toBe(401);
    expect(response.status).not.toBe(403);
    expect(response.ok).toBe(true);
  });
});
