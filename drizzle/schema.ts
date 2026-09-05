import { integer, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "paid", "failed", "cancelled"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: varchar("id", { length: 32 }).primaryKey(),
  userId: integer("userId").notNull(),
  totalCents: integer("totalCents").notNull(),
  status: orderStatusEnum("status").default("pending").notNull(),
  providerReference: varchar("providerReference", { length: 128 }),
  idempotencyKey: varchar("idempotencyKey", { length: 96 }).notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: varchar("orderId", { length: 32 }).notNull(),
  productId: varchar("productId", { length: 64 }).notNull(),
  variant: varchar("variant", { length: 32 }).notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unitPriceCents").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
