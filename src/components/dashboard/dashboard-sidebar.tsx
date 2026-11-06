import { Logo } from "@/components/brand/logo";
import { requireUser } from "@/lib/session";
import { SidebarNav } from "./sidebar";

export async function DashboardSidebar() {
  const user = await requireUser();
  return <SidebarNav user={{ name: user.name, email: user.email }} />;
}

export function SidebarFallback() {
  return (
    <aside className="hidden h-screen w-[248px] shrink-0 flex-col gap-7 bg-[#0E0F13] px-4 py-6 text-white lg:flex">
      <div className="px-2">
        <Logo size={32} wordmarkSize={20} wordmarkColor="#FFFFFF" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="animate-shimmer h-[46px] rounded-xl bg-[linear-gradient(90deg,#1E2028_0%,#2A2D38_50%,#1E2028_100%)]"
          />
        ))}
      </div>
    </aside>
  );
}