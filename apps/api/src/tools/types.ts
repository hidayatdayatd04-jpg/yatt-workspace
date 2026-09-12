import type { z } from "zod";
import type { IntegrationKind } from "@shared/index";
import type { NormalizedTool } from "../policies/normalize";
import type { StartRunInput } from "../agent/loop/types";

export interface AgentTool extends NormalizedTool {
  connector: IntegrationKind;
  permission: "read" | "write" | "send" | "shell";
  schema: z.ZodType;
  activityMetadata?: (args: unknown, input: StartRunInput) => Promise<Record<string, unknown>>;
  execute: (args: unknown, input: StartRunInput, signal?: AbortSignal) => Promise<unknown>;
}
export function defineTool<T extends z.ZodType>(input: {
  name: string; description: string; connector: IntegrationKind; permission?: AgentTool["permission"];
  tags?: string[];
  schema: T; parameters: Record<string, unknown>;
  activityMetadata?: (args: z.infer<T>, input: StartRunInput) => Promise<Record<string, unknown>>;
  execute: (args: z.infer<T>, input: StartRunInput, signal?: AbortSignal) => Promise<unknown>;
}): AgentTool {
  const permission = input.permission ?? "read";
  return { fqName: input.name, rawName: input.name.split(":")[1]!, origin: "custom", risk: permission === "read" ? "read" : "write",
    classificationProvenance: "custom-manifest", capabilities: [input.connector, ...(input.tags ?? [])], inputSchema: input.parameters,
    description: input.description, isGateway: permission === "shell", connector: input.connector, permission, schema: input.schema,
    activityMetadata: input.activityMetadata ? (args, run) => input.activityMetadata!(input.schema.parse(args), run) : undefined,
    execute: (args, run, signal) => input.execute(input.schema.parse(args), run, signal) };
}
export const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
export const stringField = { type: "string" };
