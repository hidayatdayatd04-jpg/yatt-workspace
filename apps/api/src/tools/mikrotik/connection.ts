import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../db";
import { agentRuns, conversations } from "../../db/schema";
import type { ConnectorService } from "../../services/connector";
import type { McpSupervisor } from "../../mcp/supervisor";
import type { TransactionCoordinator } from "../../transactions/coordinator";
import { defineTool, objectSchema, stringField } from "../types";

export function createConnectionTools(deps: { db: Database; connectors: ConnectorService; supervisor: McpSupervisor; transactions: TransactionCoordinator }) {
  return [
    defineTool({ name: "mikrotik:list_routers", connector: "mikrotik", description: "Cari router tersimpan milik pengguna untuk connect/reconnect lewat chat. Mengembalikan ID, label, host, status, dan mode tanpa kredensial.", schema: z.object({}).strict(), parameters: objectSchema({}),
      execute: async (_, run) => (await deps.connectors.list(run.userId)).map((c) => ({ id: c.id, label: c.label, host: c.host, status: c.status, mode: c.mode })) }),
    defineTool({ name: "mikrotik:connect_router", connector: "mikrotik", description: "Connect atau reconnect router tersimpan melalui SSH, lalu jadikan target chat ini. Cari ID dengan list_routers. Tidak mengaktifkan izin tulis. Jangan meminta password di chat; kredensial baru disimpan lewat Connectors.", schema: z.object({ connectionId: z.string().uuid() }).strict(), parameters: objectSchema({ connectionId: stringField }, ["connectionId"]),
      execute: async (args, run, signal) => {
        signal?.throwIfAborted();
        const conn = await deps.connectors.requireOwned(run.userId, args.connectionId)();
        const transactions = await deps.transactions.activeTransactionsForRouter(conn.routerIdentity ?? "");
        if (run.policy.transactionState === "active" || transactions.some((tx) => ["preparing", "active", "verifying", "committing", "rolling_back", "unknown"].includes(tx.state))) throw new Error("Selesaikan transaksi router sebelum connect/reconnect atau mengganti target.");
        // A fresh process uses the just-verified credentials. Mutations are never replayed.
        await deps.supervisor.stop(run.userId, args.connectionId);
        const connected = await deps.connectors.connect(run.userId, args.connectionId);
        signal?.throwIfAborted();
        await deps.db.update(conversations).set({ activeConnectionId: args.connectionId, revision: sql`${conversations.revision} + 1`, updatedAt: new Date() }).where(and(eq(conversations.id, run.conversationId), eq(conversations.userId, run.userId)));
        await deps.db.update(agentRuns).set({ connectionId: args.connectionId }).where(and(eq(agentRuns.id, run.runId), eq(agentRuns.userId, run.userId)));
        run.connectionId = args.connectionId;
        // New target is read-only for this run. A subsequent run re-resolves live write grants.
        Object.assign(run.policy, { connectionId: args.connectionId, connectionHost: connected.host, managementInterface: undefined, mode: "read-only", connectorMode: connected.mode, runMode: "read-only", modeVersion: connected.modeVersion, transactionState: "none" });
        return { connected: connected.status === "connected", connectionId: connected.id, label: connected.label, host: connected.host, mode: "read-only", guidance: "Target chat diperbarui. Tools baca router kini tersedia; lanjutkan pemeriksaan. Untuk perubahan, gunakan izin MikroTik dan permintaan berikutnya." };
      } }),
  ];
}
