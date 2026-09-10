import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile, symlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync } from "fflate";
import { Hono } from "hono";
import { createDb, type Database } from "../db";
import { workspaces, integrations, conversations, agentRuns, messages, toolExecutions } from "../db/schema";
import { createIntegrationService } from "../services/integrations";
import { createConnectorService } from "../services/connector";
import { createAgentToolRegistry } from "./registry";
import { createWorkspaceProcessManager } from "../services/workspace-processes";
import { createAgentLoop, type StartRunInput } from "../agent/loop";
import { buildRunCatalog } from "../agent/loop/catalog";
import { createFileTools, workspacePath, workspaceRoot } from "./general/files";
import { encodeEmail } from "./integrations/gmail";
import { createIntegrationRoutes } from "../routes/integrations";
import { AppError } from "../lib/errors";
import type { Env } from "../types";
import type { NormalizedTool } from "../policies/normalize";
import type { PolicyDispatcher } from "../policies/dispatcher";
import type { McpSupervisor } from "../mcp/supervisor";
import type { TransactionCoordinator } from "../transactions/coordinator";
import type { ChatClient } from "../agent/chat-client";

const databases: Database[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.$client.close(); });
async function fixture() {
  const db = createDb(); databases.push(db);
  const userId = crypto.randomUUID(), other = crypto.randomUUID();
  await db.insert(workspaces).values([{ id: userId }, { id: other }]);
  const keyRing = { currentVersion: 1, resolve: () => Buffer.alloc(32, 7) };
  const service = createIntegrationService({ db, keyRing });
  const base = await mkdtemp(join(tmpdir(), "agent-tools-test-"));
  const connectors = createConnectorService({ db, keyRing, targetPolicy: { check: async () => ({ allowed: true as const, ip: "192.168.88.1" }) }, sshTimeoutMs: 1000, log: () => {}, probe: async () => ({ ok: true, kind: "ok", fingerprint: "SHA256:test", routerIdentity: "Lab", message: "ok" }) });
  const supervisor = { stop: async () => {} } as unknown as McpSupervisor;
  const transactions = { activeTransactionsForRouter: async () => [] } as unknown as TransactionCoordinator;
  const testLogger = { info() {}, warn() {}, error() {}, debug() {} };
  const processes = createWorkspaceProcessManager({ maxPerUser: 2, maxTotal: 4, idleMs: 60_000 }, testLogger as never);
  const registry = createAgentToolRegistry({ db, integrations: service, connectors, supervisor, transactions, dataDir: base, shellAvailable: false, logger: testLogger as never, processes });
  const conversationId = crypto.randomUUID(), runId = crypto.randomUUID(), userMessageId = crypto.randomUUID();
  await db.insert(conversations).values({ id: conversationId, userId });
  await db.insert(agentRuns).values({ id: runId, userId, conversationId });
  await db.insert(messages).values({ id: userMessageId, conversationId, role: "user", content: { text: "Hubungkan Lab lalu baca status." }, seq: 1 });
  const run: StartRunInput = { userId, conversationId, runId, userMessageId, connectionId: null, userText: "Hubungkan Lab lalu baca status.", policy: { userId, connectionId: "none", mode: "read-only", modeVersion: 1, transactionState: "none" }, client: { modelLabel: "test", async *stream() { yield { type: "done", finishReason: "stop" }; } }, systemInstruction: "test", executeTool: async () => ({ ok: true, output: "ok" }) };
  return { db, userId, other, service, base, connectors, registry, run, transactions };
}

describe("integration security and routing", () => {
  test("encrypted credentials, owner isolation, blank-preserve, delete disables", async () => {
    const f = await fixture();
    await f.service.save(f.userId, "telegram", { enabled: true, allowWrite: false, allowSend: false, allowShell: false, credentials: { botToken: "123456:TEST_SECRET" } });
    expect(JSON.stringify(await f.service.list(f.userId))).not.toContain("TEST_SECRET");
    expect(JSON.stringify(await f.db.select().from(integrations))).not.toContain("TEST_SECRET");
    expect((await f.service.status(f.other, "telegram")).configured).toBe(false);
    await expect(f.service.credentials(f.other, "telegram")).rejects.toThrow();
    await f.service.save(f.userId, "telegram", { enabled: true, allowWrite: false, allowSend: false, allowShell: false, credentials: { botToken: "" } });
    expect((await f.service.credentials(f.userId, "telegram")).botToken).toBe("123456:TEST_SECRET");
    await f.service.remove(f.userId, "telegram");
    expect((await f.service.status(f.userId, "telegram")).enabled).toBe(false);
    await expect(f.service.credentials(f.userId, "telegram")).rejects.toThrow();
  });
  test("general tools work without a router; MikroTik-disabled catalog never loads MCP", async () => {
    const f = await fixture();
    f.run.mikrotikEnabled = false; f.run.additionalTools = await f.registry.catalog(f.userId);
    const catalog = await buildRunCatalog({ getCatalog: async () => { throw new Error("MCP must not load"); } }, f.run);
    expect(catalog.catalog.some((t) => t.fqName === "general:list_files")).toBe(true);
    expect(catalog.catalog.some((t) => t.fqName.startsWith("mikrotik:") || t.fqName === "system:check_connection")).toBe(false);
    expect((await f.registry.execute("general:list_files", {}, f.run)).ok).toBe(true);
  });
  test("revoking access blocks already-catalogued tools; send and shell stay separate", async () => {
    const f = await fixture();
    // Workspace adalah tools default: tulis aktif tanpa konfigurasi.
    expect((await f.registry.execute("general:write_file", { path: "x.txt", content: "test" }, f.run)).ok).toBe(true);
    // Revoke eksplisit tetap memblokir (baca maupun tulis).
    await f.service.save(f.userId, "workspace", { enabled: true, allowWrite: false, allowSend: false, allowShell: false });
    await expect(f.registry.execute("general:write_file", { path: "y.txt", content: "test" }, f.run)).rejects.toThrow("Izin");
    await f.service.remove(f.userId, "workspace");
    await expect(f.registry.execute("general:list_files", {}, f.run)).rejects.toThrow("nonaktif");
    await f.service.save(f.userId, "telegram", { enabled: true, allowWrite: true, allowSend: false, allowShell: false, credentials: { botToken: "123456:TEST_SECRET" } });
    await expect(f.registry.execute("telegram:send_message", { chatId: "42", text: "test" }, f.run)).rejects.toThrow("Izin");
    expect((await f.registry.catalog(f.userId)).some((t) => t.fqName === "general:execute_shell")).toBe(false);
  });
  test("API requires auth, validates kind/body, and never accepts shell when unavailable", async () => {
    const f = await fixture(); const app = new Hono<Env>();
    app.use("*", async (c, next) => { if (c.req.header("x-test-user")) c.set("workspace", { userId: f.userId }); await next(); });
    app.onError((err, c) => c.json({ message: err.message }, err instanceof AppError ? err.status as 400 : 500));
    app.route("/integrations", createIntegrationRoutes(f.service, false));
    expect((await app.request("/integrations")).status).toBe(401);
    expect((await app.request("/integrations/nope", { method: "DELETE", headers: { "x-test-user": "1" } })).status).toBe(404);
    expect((await app.request("/integrations/workspace", { method: "PUT", headers: { "x-test-user": "1", "Content-Type": "application/json" }, body: JSON.stringify({ enabled: true, allowShell: true }) })).status).toBe(403);
  });
  test("connect then read in the same agent run refreshes target/catalog and audits both tools", async () => {
    const f = await fixture();
    await f.service.save(f.userId, "mikrotik", { enabled: true, allowWrite: false, allowSend: false, allowShell: false });
    const { connector } = await f.connectors.create(f.userId, { label: "Lab", host: "192.168.88.1", port: 22, username: "admin", password: "fixture-secret" });
    expect(connector.status).toBe("disconnected");
    const routerTool: NormalizedTool = { fqName: "mt:get_status", rawName: "get_status", risk: "read", origin: "custom", classificationProvenance: "custom-manifest", capabilities: [], description: "read", inputSchema: { type: "object", properties: {} }, isGateway: false };
    let turn = 0, reads = 0;
    const client: ChatClient = { modelLabel: "test", async *stream(input) {
      if (turn++ === 0) { expect(input.tools.some((t) => t.function.name === "mt_get_status")).toBe(false); yield { type: "tool_calls", toolCalls: [{ id: "connect", name: "mikrotik_connect_router", argumentsJson: JSON.stringify({ connectionId: connector.id }) }] }; }
      else if (turn === 2) { expect(input.tools.some((t) => t.function.name === "mt_get_status")).toBe(true); yield { type: "tool_calls", toolCalls: [{ id: "read", name: "mt_get_status", argumentsJson: "{}" }] }; }
      else yield { type: "text", text: "Router terhubung dan status terbaca." };
      yield { type: "done", finishReason: turn < 3 ? "tool_calls" : "stop" };
    } };
    f.run.client = client; f.run.additionalTools = await f.registry.catalog(f.userId);
    f.run.executeTool = async (_, live) => { expect(live?.connectionId).toBe(connector.id); reads++; return { ok: true, output: "healthy" }; };
    const loop = createAgentLoop({ db: f.db, agentTools: f.registry, logger: { info() {}, warn() {}, error() {}, debug() {} }, dispatcher: { check: async () => ({ allowed: true, tool: routerTool }) } as unknown as PolicyDispatcher, txCoordinator: f.transactions, catalog: { getCatalog: async () => [routerTool] }, limits: { maxSteps: 4, maxToolCalls: 5, runTimeoutMs: 5000, maxTokens: 1000 } });
    expect((await loop.run(f.run, async () => {})).status).toBe("completed");
    expect(reads).toBe(1);
    expect((await f.db.select().from(conversations))[0]!.activeConnectionId).toBe(connector.id);
    expect((await f.db.select().from(toolExecutions)).length).toBe(2);
    await expect(f.registry.execute("mikrotik:connect_router", { connectionId: connector.id }, { ...f.run, userId: f.other })).rejects.toThrow();
  });
});

describe("workspace and message integrity", () => {
  test("rejects traversal, absolute paths, ADS and junctions", async () => {
    const f = await fixture(); const root = await workspaceRoot(f.base, f.userId);
    for (const path of ["../outside", "C:\\Windows\\x", "/etc/passwd", "file:secret"]) await expect(workspacePath(root, path)).rejects.toThrow();
    const outside = join(f.base, "outside"); await mkdir(outside);
    await symlink(outside, join(root, "link"), "junction");
    await expect(workspacePath(root, "link/secret")).rejects.toThrow();
    expect(await workspaceRoot(f.base, f.other)).not.toBe(root);
  });
  test("file writes require hash before overwrite and reject stale edits", async () => {
    const f = await fixture(); const tools = createFileTools(f.base);
    const write = tools.find((t) => t.fqName === "general:write_file")!;
    const read = tools.find((t) => t.fqName === "general:read_file")!;
    await write.execute({ path: "app.ts", content: "before" }, f.run);
    await expect(write.execute({ path: "app.ts", content: "oops" }, f.run)).rejects.toThrow();
    const result = await read.execute({ path: "app.ts" }, f.run) as { sha256: string };
    await write.execute({ path: "app.ts", content: "after", expectedHash: result.sha256 }, f.run);
    await expect(write.execute({ path: "app.ts", content: "stale", expectedHash: result.sha256 }, f.run)).rejects.toThrow("berubah");
  });
  test("ZIP validates traversal and expansion limits before extraction", async () => {
    const f = await fixture(); const root = await workspaceRoot(f.base, f.userId);
    const extract = createFileTools(f.base).find((t) => t.fqName === "general:extract_zip")!;
    await writeFile(join(root, "bad.zip"), zipSync({ "../escape.txt": new Uint8Array([1]) }));
    await expect(extract.execute({ path: "bad.zip", destination: "output" }, f.run)).rejects.toThrow();
    await writeFile(join(root, "large.zip"), zipSync({ "large.txt": new Uint8Array(5_000_001) }));
    await expect(extract.execute({ path: "large.zip", destination: "output" }, f.run)).rejects.toThrow("Batas");
    await writeFile(join(root, "good.zip"), zipSync({ "src/main.ts": Buffer.from("hello") }));
    await extract.execute({ path: "good.zip", destination: "output" }, f.run);
    expect(await readFile(join(root, "output/src/main.ts"), "utf8")).toBe("hello");
  });
  test("MIME encoding handles unicode and rejects header injection", () => {
    const raw = encodeEmail({ to: "user@example.com", subject: "Halo dunia ✓", body: "Isi pesan" });
    expect(Buffer.from(raw, "base64url").toString()).toContain("MIME-Version: 1.0");
    expect(() => encodeEmail({ to: "user@example.com", subject: "x\r\nBcc: bad@example.com", body: "test" })).toThrow();
  });
});
