import { ChatRoute } from "./ChatRoute";

export function MainRoutes(props: { conversationId: string | null; onToggleSidebar: () => void }) {
  return (
    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      <ChatRoute conversationId={props.conversationId} onToggleSidebar={props.onToggleSidebar} />
    </main>
  );
}
