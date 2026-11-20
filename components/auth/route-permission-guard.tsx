"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { usePermissions } from "./permissions-provider";
import { pageOuverte, regleDeRoute } from "@/lib/navigation/regles-de-route";

export function RoutePermissionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isLoading, hasPermission } = usePermissions();

  if (!regleDeRoute(pathname)) return <>{children}</>;

  if (isLoading) return null;

  const allowed = pageOuverte(pathname, hasPermission);

  if (allowed) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <ShieldAlert className="h-16 w-16 text-gray-300 mb-4" />
      <h2 className="text-xl font-semibold text-gray-700 mb-2">Accès restreint</h2>
      <p className="text-gray-500">
        Vous n&apos;avez pas la permission d&apos;accéder à cette section.
      </p>
    </div>
  );
}
