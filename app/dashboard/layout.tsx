"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { OrganizationChecker } from "@/components/auth/organization-checker";
import { SessionMonitor } from "@/components/auth/session-monitor";
import { PermissionsProvider } from "@/components/auth/permissions-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <OrganizationChecker>
      <PermissionsProvider>
        <SessionMonitor />
        <div className="flex h-screen bg-gray-50">
          {/* Sidebar */}
          <Sidebar
            isMobileOpen={isMobileSidebarOpen}
            onMobileClose={() => setIsMobileSidebarOpen(false)}
          />

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <DashboardHeader onMenuClick={() => setIsMobileSidebarOpen(true)} />

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto p-4 lg:p-6 ">
              {children}
            </main>
          </div>
        </div>
      </PermissionsProvider>
    </OrganizationChecker>
  );
}
