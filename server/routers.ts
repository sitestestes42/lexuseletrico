import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { calculateServerTotal, PRODUCT_ID, productCatalog } from "../shared/catalog";
import { signOutSupabaseSession } from "./_core/auth";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getOrderByIdempotencyKey, insertOrderWithItems } from "./db";

const orderLineSchema = z.object({
  productId: z.literal(PRODUCT_ID),
  variant: z.enum(["Preto", "Caramelo"]),
  quantity: z.number().int().min(1).max(10),
});

const createOrderSchema = z.object({
  lines: z.array(orderLineSchema).min(1).max(2),
  idempotencyKey: z.string().trim().min(16).max(96),
});

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await signOutSupabaseSession(ctx.req, ctx.res);
      return { success: true } as const;
    }),
  }),
  orders: router({
    create: protectedProcedure.input(createOrderSchema).mutation(async ({ ctx, input }) => {
      if (ctx.user.id === null) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Sua sessão está ativa, mas as tabelas do banco ainda não estão prontas. Aplique a migração PostgreSQL do projeto no Supabase.",
        });
      }

      const uniqueVariants = new Set(input.lines.map((line) => line.variant));
      if (uniqueVariants.size !== input.lines.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cada variante deve aparecer apenas uma vez no pedido." });
      }

      const totalCents = calculateServerTotal(input.lines);
      if (totalCents <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Não foi possível validar o valor do pedido." });
      }

      const existing = await getOrderByIdempotencyKey(ctx.user.id, input.idempotencyKey);
      if (existing) {
        return {
          orderId: existing.id,
          status: existing.status,
          total: existing.totalCents,
          message: "Este pedido já foi validado. Nenhum pedido duplicado foi criado.",
        };
      }

      const orderId = nanoid(20);
      await insertOrderWithItems({
        id: orderId,
        userId: ctx.user.id,
        totalCents,
        idempotencyKey: input.idempotencyKey,
        items: input.lines.map((line) => ({
          productId: line.productId,
          variant: line.variant,
          quantity: line.quantity,
          unitPriceCents: productCatalog.promotionalPriceCents,
        })),
      });

      return {
        orderId,
        status: "pending" as const,
        total: totalCents,
        message: "Pedido validado e criado como pendente. O pagamento será conectado à PantePay na próxima etapa.",
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
