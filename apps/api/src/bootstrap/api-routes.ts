import type { Hono } from "hono";
import { AppError } from "../lib/errors";
import type { Env as HonoEnv } from "../types";
import { config, db, logger, rosetta, supervisor } from "./foundation";
import {
  approvals,
  backups,
  catalogSource,
  connectors,
  monitoring,
  networkMap,
  notifications,
  safeModeSessions,
  txCoordinator,
} from "./policy";
import { executeTool, providerSettings, visionSettingsService, webSearchSettingsService, integrationService } from "./ai";
import { createIntegrationRoutes } from "../routes/integrations";
import { createGoogleOAuthRoutes } from "../routes/google-oauth";
import { createCustomConnectorRoutes } from "../routes/custom-connectors";
import { createWorkspaceRoutes } from "../routes/workspace";
import { storage } from "./storage";
import { createConnectorRoutes } from "../routes/connectors";
import { createTransactionRoutes } from "../routes/transactions";
import { createAiProviderRoutes } from "../routes/ai-provider";
import { createAttachmentRoutes } from "../routes/attachments";
import { createAuthRoutes } from "../routes/auth";
import { createActivityRoutes } from "../routes/activities";
import { createCompactionRoutes } from "../routes/compaction";
import { createTerminalRoutes } from "../routes/terminal";
import { createPreferencesRoutes } from "../routes/preferences";
import { createNetworkMapRoutes } from "../routes/network-map";
import { createMonitoringRoutes } from "../routes/monitoring";
import { createNotificationRoutes } from "../routes/notifications";
import { createBackupRoutes } from "../routes/backups";
import { createMemoryRoutes } from "../routes/memory";
import { createApprovalRoutes } from "../routes/approvals";
import { createWebSearchSettingsRoutes } from "../routes/web-search-settings";
import { createVisionSettingsRoutes } from "../routes/vision-settings";
import { createOpenAiCompatibleClient } from "../agent/chat-client";
import { globalRateLimiter, globalCheckpoints } from "../agent/rate-limiter";

export function mountApiRoutes(app: Hono<HonoEnv>) {
  app.route("/api/integrations/google", createGoogleOAuthRoutes(integrationService, { clientId: config.GOOGLE_OAUTH_CLIENT_ID, clientSecret: config.GOOGLE_OAUTH_CLIENT_SECRET, redirectUri: config.GOOGLE_OAUTH_REDIRECT_URI, appUrl: config.APP_URL }));
  app.route("/api/custom-connectors", createCustomConnectorRoutes({ db, logger }));
  app.route("/api/integrations", createIntegrationRoutes(integrationService, config.AGENT_SHELL_ENABLED));
  app.route("/api/workspace", createWorkspaceRoutes(integrationService, config.DATA_DIR));
  const connectorRoutes = createConnectorRoutes({ connectors, supervisor, txCoordinator, safeModeSessions, logger, invalidateCatalog: () => catalogSource.invalidate() });
  const transactionRoutes = createTransactionRoutes({ coordinator: txCoordinator, connectors, db, logger });
  const aiProviderRoutes = createAiProviderRoutes({ providers: providerSettings, logger, limiter: globalRateLimiter, checkpoints: globalCheckpoints });
  const attachmentRoutes = createAttachmentRoutes({
    db,
    logger,
    storage,
    limits: { maxBytes: config.UPLOAD_MAX_BYTES, maxFilesPerMessage: config.UPLOAD_MAX_FILES_PER_MESSAGE },
  });
  const authRoutes = createAuthRoutes({ db, logger });
  const activityRoutes = createActivityRoutes({ db });
  const compactionRoutes = createCompactionRoutes({
    db,
    logger,
    getProviderClient: async (userId: string) => {
      const cfg = await providerSettings.resolveForRun(userId, {});
      if (!cfg) return null;
      // Background task wajib lewat limiter terpusat yang sama (#1).
      return { client: createOpenAiCompatibleClient(cfg, logger, { limiter: globalRateLimiter, temperature: config.AI_TEMPERATURE }), model: cfg.model, provider: cfg.kind };
    },
  });
  const terminalRoutes = createTerminalRoutes({ db, logger, connectors, transactions: txCoordinator });
  const preferencesRoutes = createPreferencesRoutes({ db, logger });
  const networkMapRoutes = createNetworkMapRoutes(networkMap);
  const monitoringRoutes = createMonitoringRoutes({ monitoring, db });
  const notificationRoutes = createNotificationRoutes({ notifications });
  const backupRoutes = createBackupRoutes({ backups });
  const memoryRoutes = createMemoryRoutes({ db });
  const approvalRoutes = createApprovalRoutes({ approvals, executeTool });
  app.route("/api/auth", authRoutes);
  app.route("/api/preferences", preferencesRoutes);
  app.route("/api/terminal", terminalRoutes);
  app.route("/api/connectors", connectorRoutes);
  app.route("/api/transactions", transactionRoutes);
  app.route("/api/ai-provider", aiProviderRoutes);
  app.route("/api/web-search-settings", createWebSearchSettingsRoutes({ settings: webSearchSettingsService }));
  app.route("/api/vision-settings", createVisionSettingsRoutes({ settings: visionSettingsService, logger }));
  app.route("/api/attachments", attachmentRoutes);
  app.route("/api/network-map", networkMapRoutes);
  app.route("/api/monitoring", monitoringRoutes);
  app.route("/api/notifications", notificationRoutes);
  app.route("/api/backups", backupRoutes);
  app.route("/api/memories", memoryRoutes);
  app.route("/api/approvals", approvalRoutes);
  app.route("/", activityRoutes);
  app.route("/", compactionRoutes);

  // Documentation search through the shared Rosetta process (no router credentials involved).
  app.get("/api/tools/rosetta", async (c) => {
    const tools = await rosetta.listTools();
    return c.json({
      tools: tools.map((t) => ({
        name: (t as { name?: string }).name ?? "",
        description: ((t as { description?: string }).description ?? "").slice(0, 200),
      })),
    });
  });

  app.post("/api/tools/rosetta/search", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { query?: string } | null;
    const query = body?.query?.trim();
    if (!query || query.length > 256) {
      throw new AppError("VALIDATION_FAILED", "Query pencarian wajib 1-256 karakter.", 422);
    }
    const result = await rosetta.call("routeros_search", { query, limit: 5 });
    return c.json({ result });
  });
}
