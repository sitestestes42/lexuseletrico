import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { authenticateSupabaseRequest, type AuthenticatedUser } from "./auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: AuthenticatedUser | null = null;
  try {
    user = await authenticateSupabaseRequest(opts.req, opts.res);
  } catch (error) {
    // Public procedures must never crash just because authentication is unavailable.
    console.warn("[Auth] Falha ao resolver sessão:", error);
  }

  return { req: opts.req, res: opts.res, user };
}
