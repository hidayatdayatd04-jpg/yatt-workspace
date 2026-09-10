import { Suspense, lazy, useCallback } from "react";
import { navigate, type Route } from "../lib/router";
import { ModalPage } from "./ModalPage";
import { SettingsShell } from "../features/settings/SettingsShell";

const NetworkMapPage = lazy(() => import("../features/network-map/NetworkMapPage"));
const MonitoringDashboard = lazy(() => import("../features/monitoring/MonitoringDashboard"));
const NotificationsPage = lazy(() => import("../features/notifications/NotificationsPage"));
const BackupsPage = lazy(() => import("../features/backups/BackupsPage"));

export type OverlayRoute = Extract<
  Route,
  { name: "settings" } | { name: "connectors" } | { name: "network-map" } | { name: "monitoring" } | { name: "notifications" } | { name: "backups" }
>;

export function isOverlayRoute(route: Route): route is OverlayRoute {
  return (
    route.name === "settings" ||
    route.name === "connectors" ||
    route.name === "network-map" ||
    route.name === "monitoring" ||
    route.name === "notifications" ||
    route.name === "backups"
  );
}

function useCloseOverlay() {
  return useCallback(() => {
    const before = window.location.pathname + window.location.search;
    window.history.back();
    // Fallback bila tidak ada riwayat (mis. URL dibuka langsung).
    window.setTimeout(() => {
      if (window.location.pathname + window.location.search === before) navigate({ name: "chat-new" });
    }, 200);
  }, []);
}

function LoadingHint({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">{text}</div>;
}

export function OverlayView({ route }: { route: OverlayRoute }) {
  const close = useCloseOverlay();
  if (route.name === "settings" || route.name === "connectors") {
    const params = new URLSearchParams(window.location.search);
    // /connectors selalu tampil di dalam modal Settings (sidebar tetap terlihat).
    const section = route.name === "settings" ? route.section : "connectors";
    return (
      <ModalPage label="Pengaturan" wide onClose={close}>
        <SettingsShell
          section={section}
          autoAdd={params.get("add") === "1"}
          onBack={close}
        />
      </ModalPage>
    );
  }
  if (route.name === "network-map") {
    return (
      <ModalPage label="Network Map" wide onClose={close}>
        <Suspense fallback={<LoadingHint text="Memuat Network Map…" />}><NetworkMapPage connectionId={route.id} /></Suspense>
      </ModalPage>
    );
  }
  if (route.name === "monitoring") {
    return (
      <ModalPage label="Monitoring" wide onClose={close}>
        <Suspense fallback={<LoadingHint text="Memuat Monitoring…" />}><MonitoringDashboard initialConnectionId={route.id} /></Suspense>
      </ModalPage>
    );
  }
  if (route.name === "notifications") {
    return (
      <ModalPage label="Notifikasi" onClose={close}>
        <Suspense fallback={<LoadingHint text="Memuat Notifikasi…" />}><NotificationsPage /></Suspense>
      </ModalPage>
    );
  }
  return (
    <ModalPage label="Backup & Diff" wide onClose={close}>
      <Suspense fallback={<LoadingHint text="Memuat Backup & Diff…" />}><BackupsPage initialConnectionId={route.id} /></Suspense>
    </ModalPage>
  );
}
