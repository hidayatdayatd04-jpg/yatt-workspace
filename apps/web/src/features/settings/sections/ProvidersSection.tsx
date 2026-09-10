import { ProviderTab } from "@/features/chat/settings-tabs/ProviderTab";
import { useProviderList } from "@/features/chat/settings-tabs/use-provider-list";

export function ProvidersSection() {
  const page = useProviderList();
  return <ProviderTab page={page} />;
}
