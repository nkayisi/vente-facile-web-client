"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { OrganizationChecker } from "@/components/auth/organization-checker";
import { SessionMonitor } from "@/components/auth/session-monitor";
import { PermissionsProvider } from "@/components/auth/permissions-provider";
import { SubscriptionGuard } from "@/components/auth/subscription-guard";
import { RoutePermissionGuard } from "@/components/auth/route-permission-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const mainEl = document.querySelector("main");
    if (!mainEl) return;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  return (
    <OrganizationChecker>
      <PermissionsProvider>
        <SubscriptionGuard>
          <SessionMonitor />
          <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <Sidebar
              isMobileOpen={isMobileSidebarOpen}
              onMobileClose={() => setIsMobileSidebarOpen(false)}
            />

            {/* Main Content */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Header */}
              <DashboardHeader onMenuClick={() => setIsMobileSidebarOpen(true)} />

              {/* Page Content */}
              <main className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-6">
                <RoutePermissionGuard>{children}</RoutePermissionGuard>
              </main>
            </div>
          </div>
        </SubscriptionGuard>
      </PermissionsProvider>
    </OrganizationChecker>
  );
}
