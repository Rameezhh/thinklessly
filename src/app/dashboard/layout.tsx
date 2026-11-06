import { Suspense } from "react";
import { DashboardSidebar, SidebarFallback } from "@/components/dashboard/dashboard-sidebar";
import { PageTransition } from "@/components/dashboard/page-transition";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F7F4] lg:flex">
      <Suspense fallback={<SidebarFallback />}>
        <DashboardSidebar />
      </Suspense>
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 lg:px-14 lg:py-12">
          <Suspense fallback={<div className="animate-page" />}>
            <PageTransition>{children}</PageTransition>
          </Suspense>
        </div>
      </div>
    </div>
  );
}