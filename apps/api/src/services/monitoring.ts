import { fetchLive, getHistory, type MonitoringDeps } from "./monitoring/service";

export function createMonitoringService(deps: MonitoringDeps) {
  return {
    fetchLive: (userId: string, connectionId: string) => fetchLive(deps, userId, connectionId),
    getHistory: (userId: string, connectionId: string, range?: "1h" | "24h" | "7d") => getHistory(deps, userId, connectionId, range),
  };
}

export type MonitoringService = ReturnType<typeof createMonitoringService>;
