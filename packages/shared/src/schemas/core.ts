import { z } from "zod";

export const RouterModeSchema = z.enum(["read-only", "write"]);
export type RouterMode = z.infer<typeof RouterModeSchema>;

export const ConnectorStatusSchema = z.enum([
  "unverified",
  "connecting",
  "connected",
  "disconnected",
  "failed",
]);

export const ConnectorDTOSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  host: z.string(),
  port: z.number().int().min(1).max(65535),
  username: z.string(),
  status: ConnectorStatusSchema,
  mode: RouterModeSchema,
  modeVersion: z.number().int(),
  hostKeyFingerprint: z.string().nullable(),
  lastVerifiedAt: z.string().datetime().nullable(),
  routerIdentity: z.string().nullable(),
  rosVersion: z.string().nullable().optional(),
  boardName: z.string().nullable().optional(),
  architecture: z.string().nullable().optional(),
  managementInterface: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ConnectorDTO = z.infer<typeof ConnectorDTOSchema>;
