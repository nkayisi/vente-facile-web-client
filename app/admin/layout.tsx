"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminHeader } from "@/components/layout/admin-header";
import { ErrorBoundary } from "@/components/error-boundary";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }
    if (status === "authenticated" && !session?.isStaff) {
      router.push("/dashboard");
      return;
    }
  }, [status, session?.isStaff, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Non-staff : une redirection vers /dashboard est en cours. On affiche un
  // loader plutôt qu'un écran vide le temps que la navigation opère.
  if (!session?.isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ErrorBoundary name="admin-shell">
      <div className="flex h-screen bg-background">
        <AdminSidebar
          isMobileOpen={isMobileOpen}
          onMobileClose={() => setIsMobileOpen(false)}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <AdminHeader onMenuClick={() => setIsMobileOpen(!isMobileOpen)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <ErrorBoundary name="admin-page">{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
