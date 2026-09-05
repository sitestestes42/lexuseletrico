import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";

// This is intentionally an integration test: it must not guess a provider endpoint.
describe.skipIf(process.env.RUN_LIVE_INTEGRATION_TESTS !== "1")("PantePay credentials", () => {
  it("authenticates against the configured lightweight provider endpoint", async () => {
    expect(ENV.pantepaySecretKey).toMatch(/^sk_live_/);
    expect(ENV.pantepayApiUrl, "PANTEPAY_API_URL is required for the live credential check").toMatch(/^https:\/\//);

    const response = await fetch(ENV.pantepayApiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: ENV.pantepaySecretKey,
      },
      signal: AbortSignal.timeout(10_000),
    });

    expect(response.status, `PantePay endpoint returned HTTP ${response.status}`).not.toBe(401);
    expect(response.status).not.toBe(403);
  });
});
