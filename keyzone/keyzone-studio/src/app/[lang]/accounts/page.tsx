import { PageHeader } from "@/components/ui";
import { AccountsPanel } from "@/components/accounts-panel";
import { getLocale } from "@/i18n/server";

export default async function AccountsPage() {
  const vi = (await getLocale()) === "vi";
  return <>
    <PageHeader eyebrow={vi ? "KẾT NỐI" : "CONNECTIONS"} title={vi ? "Tài khoản Muse" : "Muse accounts"}
      description={vi ? "Quản lý kết nối Muse. Thay tài khoản và giữ nguyên dự án." : "Manage Muse connections. Replace an account and keep your projects."} />
    <AccountsPanel />
  </>;
}
