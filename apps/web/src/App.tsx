import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./features/auth/auth";
import { LoginPage } from "./features/auth/LoginPage";
import { useRoute, navigate } from "./lib/router";
import { useSidebarCollapsed } from "./app/app-hooks";
import { MobileTopBar } from "./app/MobileTopBar";
import { DesktopSidebar } from "./app/DesktopSidebar";
import { MainRoutes } from "./app/MainRoutes";
import { OverlayView, isOverlayRoute } from "./app/OverlayView";

function Shell() {
  const route = useRoute();
  const { profile, loading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { collapsed, setCollapsedPersist } = useSidebarCollapsed();
  const lastChatId = useRef<string | null>(null);

  // Auth gating
  useEffect(() => {
    if (!loading && !profile && route.name !== "login") {
      navigate({ name: "login" }, { replace: true });
    }
    if (!loading && profile && route.name === "login") {
      navigate({ name: "chat-new" }, { replace: true });
    }
  }, [loading, profile, route.name]);

  // Ingat chat terakhir agar tetap tampil di belakang pop-up.
  useEffect(() => {
    if (route.name === "chat") lastChatId.current = route.id;
    if (route.name === "chat-new") lastChatId.current = null;
  }, [route]);

  if (route.name === "login") {
    if (loading) return <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">Memuat…</div>;
    if (profile) return null;
    return <LoginPage />;
  }
  if (loading) return <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">Memuat session…</div>;
  if (!profile) return null;

  const overlay = isOverlayRoute(route) ? route : null;
  const conversationId = route.name === "chat" ? route.id : lastChatId.current;
  return (
    <div className="flex h-svh w-full flex-col overflow-hidden bg-background text-foreground md:flex-row">
      {/* Mobile top bar */}
      <MobileTopBar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        search={search}
        setSearch={setSearch}
        conversationId={conversationId}
        profileName={profile.displayName}
        profileUsername={profile.username}
        onLogout={() => void logout()}
      />

      {/* Desktop sidebar */}
      <DesktopSidebar
        collapsed={collapsed}
        onCollapse={() => setCollapsedPersist(true)}
        onExpand={() => setCollapsedPersist(false)}
        onExpandAndFocusSearch={() => {
          setCollapsedPersist(false);
          setTimeout(() => document.getElementById("sidebar-search")?.focus(), 60);
        }}
        search={search}
        setSearch={setSearch}
        conversationId={conversationId}
        profileName={profile.displayName}
        profileUsername={profile.username}
        onLogout={() => void logout()}
      />

      <MainRoutes conversationId={conversationId} onToggleSidebar={() => setCollapsedPersist(!collapsed)} />
      {overlay && <OverlayView key={`${overlay.name}-${window.location.pathname}${window.location.search}`} route={overlay} />}
      <Toaster position="top-center" richColors />
    </div>
  );
}

export function App() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        navigate({ name: "chat-new" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
