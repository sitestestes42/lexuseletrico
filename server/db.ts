import { and, eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../drizzle/schema";
import { InsertUser, orderItems, orders, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: PostgresJsDatabase<typeof schema> | null = null;

export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    if (!/^postgres(?:ql)?:\/\//i.test(ENV.databaseUrl)) {
      console.warn("[Database] DATABASE_URL must be a PostgreSQL connection string for Supabase");
      return null;
    }
    try {
      const client = postgres(ENV.databaseUrl, { prepare: false });
      _db = drizzle(client, { schema });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = { updatedAt: new Date() };
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  await db.insert(users).values(values).onConflictDoUpdate({
    target: users.openId,
    set: updateSet,
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getOrderByIdempotencyKey(userId: number, idempotencyKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.idempotencyKey, idempotencyKey)))
    .limit(1);
  return result[0];
}

export async function insertOrderWithItems(input: {
  id: string;
  userId: number;
  totalCents: number;
  idempotencyKey: string;
  items: Array<{ productId: string; variant: string; quantity: number; unitPriceCents: number }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.insert(orders).values({
    id: input.id,
    userId: input.userId,
    totalCents: input.totalCents,
    idempotencyKey: input.idempotencyKey,
    status: "pending",
  });
  await db.insert(orderItems).values(input.items.map((item) => ({ orderId: input.id, ...item })));
  return input.id;
}
