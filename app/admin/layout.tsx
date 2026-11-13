"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, ShieldOff } from "lucide-react";
import { signOut } from "next-auth/react";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminHeader } from "@/components/layout/admin-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { AdminPermissionsProvider, useAdminPermissions } from "@/components/admin/admin-permissions-provider";
import { Button } from "@/components/ui/button";

/**
 * Ce que l'administration montre tant que le rôle n'est pas connu, ou absent.
 *
 * ⚠ UN COMPTE `is_staff` SANS RÔLE N'EST PAS UN PLANTAGE. `is_staff` se pose
 * aussi depuis l'admin Django ; sans cet écran, chaque page répondrait « rôle
 * insuffisant » à sa façon, et personne ne saurait que c'est le rôle qui manque.
 */
function PorteDuRole({ children }: { children: React.ReactNode }) {
  const { etat, recharger } = useAdminPermissions();
  if (etat.kind === "chargement") {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (etat.kind === "sans_role") {
    return (
      <div className="mx-auto max-w-md py-16 text-center space-y-4">
        <ShieldOff className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Aucun rôle sur la plateforme</h1>
        <p className="text-sm text-muted-foreground">
          Ce compte n&apos;a pas, ou plus, de rôle d&apos;administration. Demandez à un
          super-administrateur de vous en attribuer un depuis l&apos;écran « Administrateurs ».
        </p>
        <Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
          Se déconnecter
        </Button>
      </div>
    );
  }
  if (etat.kind === "erreur") {
    return (
      <div className="mx-auto max-w-md py-16 text-center space-y-4">
        <p className="text-sm text-muted-foreground">{etat.message}</p>
        <Button onClick={recharger}>Réessayer</Button>
      </div>
    );
  }
  return <>{children}</>;
}

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
      <AdminPermissionsProvider>
      <div className="flex h-screen bg-background">
        <AdminSidebar
          isMobileOpen={isMobileOpen}
          onMobileClose={() => setIsMobileOpen(false)}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <AdminHeader onMenuClick={() => setIsMobileOpen(!isMobileOpen)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <ErrorBoundary name="admin-page">
              <PorteDuRole>{children}</PorteDuRole>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      </AdminPermissionsProvider>
    </ErrorBoundary>
  );
}
