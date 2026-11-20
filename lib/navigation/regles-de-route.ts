/**
 * Les règles d'accès des pages du tableau de bord : un seul endroit, lu par
 * la GARDE de route et par le MENU.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ LE MENU NE PORTE PAS SA PROPRE PERMISSION.                           │
 * │                                                                      │
 * │ Il recopiait la sienne, et elle avait dérivé : l'entrée              │
 * │ « Abonnement » était gardée par `settings.view` quand sa page exige  │
 * │ `subscription.view`. Le gérant voyait l'entrée sur chaque page, et   │
 * │ l'ouvrir rendait « pas la permission ». Le menu demande désormais à  │
 * │ cette table ce que la page ouvre.                                    │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Module PUR (aucun React) : éprouvé par Vitest.
 */

export interface RouteRule {
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
  // ⚠ Une sous-section dont la LISTE exige un autre droit que sa section
  // doit avoir sa règle : sinon `sales.view` (que le caissier possède) ouvre
  // la page, le serveur refuse sa liste, et le caissier lit deux toasts
  // d'erreur sur un écran vide. Même raison pour les fournisseurs, que
  // `customers.view` ouvrait au caissier par la règle des contacts.
  { prefix: "/dashboard/sales/returns", permission: "sale_returns.view" },
  { prefix: "/dashboard/contacts/customers", permission: "customers.view" },
  { prefix: "/dashboard/contacts/suppliers", permission: "suppliers.view" },
  { prefix: "/dashboard/products", permission: "products.view" },
  { prefix: "/dashboard/stock", permission: "stock.view" },
  { prefix: "/dashboard/inventory", permission: "inventory.view" },
  // ⚠ SANS CETTE RÈGLE, `/dashboard/purchases` retombe sur le wildcard
  // `/dashboard` et son `dashboard.view` - que le CAISSIER possède. Il aurait
  // donc atteint les commandes, les règlements et les retours fournisseurs,
  // que le serveur lui refuse endpoint par endpoint : il aurait lu des écrans
  // vides sans savoir pourquoi.
  { prefix: "/dashboard/purchases", permission: "purchases.view" },
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

export function regleDeRoute(pathname: string): RouteRule | undefined {
  return SORTED_RULES.find((rule) => pathname.startsWith(rule.prefix));
}

/** Ce que la règle de cette page exige est-il satisfait ? Sans règle, oui. */
export function pageOuverte(
  pathname: string,
  aLaPermission: (permission: string) => boolean,
): boolean {
  const regle = regleDeRoute(pathname);
  if (!regle) return true;
  if (regle.permission) return aLaPermission(regle.permission);
  return (regle.anyPermissions ?? []).some(aLaPermission);
}
