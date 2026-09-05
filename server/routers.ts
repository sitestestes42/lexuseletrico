import { z } from "zod";
import { nanoid } from "nanoid";
import { COOKIE_NAME } from "@shared/const";
import { calculateServerTotal, PRODUCT_ID, productCatalog } from "@shared/catalog";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
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
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  orders: router({
    create: protectedProcedure.input(createOrderSchema).mutation(async ({ ctx, input }) => {
      const uniqueVariants = new Set(input.lines.map((line) => line.variant));
      if (uniqueVariants.size !== input.lines.length) {
        throw new Error("Cada variante deve aparecer apenas uma vez no pedido.");
      }
      const totalCents = calculateServerTotal(input.lines);
      if (totalCents <= 0) throw new Error("Não foi possível validar o valor do pedido.");
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
        message: "Pedido validado e criado como pendente. O provedor de pagamento ainda precisa ser configurado.",
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
