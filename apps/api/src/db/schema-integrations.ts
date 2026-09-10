import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { workspaces } from "./schema-core";

export const integrations = sqliteTable("integrations", {
  userId: text("user_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  allowWrite: integer("allow_write", { mode: "boolean" }).notNull().default(false),
  allowSend: integer("allow_send", { mode: "boolean" }).notNull().default(false),
  allowShell: integer("allow_shell", { mode: "boolean" }).notNull().default(false),
  ciphertext: text("ciphertext"), nonce: text("nonce"), authTag: text("auth_tag"),
  keyVersion: integer("key_version").notNull().default(1),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp_ms" }),
  lastError: text("last_error"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
}, (t) => [primaryKey({ columns: [t.userId, t.kind] })]);

export const customConnectors = sqliteTable("custom_connectors", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  serverUrl: text("server_url").notNull(),
  lastCheckedAt: integer("last_checked_at", { mode: "timestamp_ms" }),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
