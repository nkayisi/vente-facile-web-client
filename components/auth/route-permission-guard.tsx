"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { usePermissions } from "./permissions-provider";

interface RouteRule {
  prefix: string;
  permission?: string;
  anyPermissions?: string[];
}

// IMPORTANT : ces règles sont triées par longueur de prefix décroissante
// avant d'être consultées (voir SORTED_RULES). Le wildcard `/dashboard`
// doit toujours rester en dernier, et toute nouvelle règle plus spécifique
// (`/dashboard/foo/bar`) sera automatiquement matchée en priorité grâce au
// tri. Ne jamais consulter directement DASHBOARD_ROUTE_RULES.
const DASHBOARD_ROUTE_RULES: RouteRule[] = [
  { prefix: "/dashboard/users", permission: "users.view" },
  { prefix: "/dashboard/sales", permission: "sales.view" },
  { prefix: "/dashboard/products", permission: "products.view" },
  { prefix: "/dashboard/stock", permission: "stock.view" },
  { prefix: "/dashboard/inventory", permission: "inventory.view" },
  { prefix: "/dashboard/cashbook", permission: "cashbook.view" },
  { prefix: "/dashboard/reports", permission: "reports.view" },
  {
    prefix: "/dashboard/contacts",
    anyPermissions: ["customers.view", "suppliers.view"],
  },
  { prefix: "/dashboard/settings", permission: "settings.view" },
  { prefix: "/dashboard/subscription", permission: "subscription.view" },
  { prefix: "/dashboard", permission: "dashboard.view" },
];

// Tri stable des règles par longueur de prefix décroissante. Garantit qu'une
// règle ajoutée hors d'ordre par mégarde ne crée pas un trou de permission :
// `/dashboard/users/profile` matchera bien `/dashboard/users` avant de
// tomber sur le wildcard `/dashboard`.
const SORTED_RULES: RouteRule[] = [...DASHBOARD_ROUTE_RULES].sort(
  (a, b) => b.prefix.length - a.prefix.length,
);

function findRouteRule(pathname: string): RouteRule | undefined {
  return SORTED_RULES.find((rule) => pathname.startsWith(rule.prefix));
}

export function RoutePermissionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isLoading, hasPermission, hasAnyPermission } = usePermissions();

  const rule = findRouteRule(pathname);
  if (!rule) return <>{children}</>;

  if (isLoading) return null;

  const allowed = rule.permission
    ? hasPermission(rule.permission)
    : hasAnyPermission(rule.anyPermissions || []);

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
