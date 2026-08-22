import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull().default(""),
  school: text("school").notNull().default(""),
  department: text("department").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  status: text("status", { enum: ["pending", "active", "disabled"] }).notNull().default("pending"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  plan: text("plan", { enum: ["free", "unlimited"] }).notNull().default("free"),
  khbdUsed: integer("khbd_used").notNull().default(0),
  ppctUsed: integer("ppct_used").notNull().default(0),
  createdAt: text("created_at").notNull(),
  approvedAt: text("approved_at"),
}, (table) => [uniqueIndex("users_username_unique").on(table.username)]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("sessions_token_hash_unique").on(table.tokenHash)]);
