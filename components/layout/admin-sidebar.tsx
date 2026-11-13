"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  Receipt,
  Smartphone,
  X,
  LogOut,
  Siren,
  TrendingUp,
  ScrollText,
  ShieldCheck,
  Eye,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { signOut } from "next-auth/react";
import { useAdminPermissions } from "@/components/admin/admin-permissions-provider";

interface EntreeMenu {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Le code du catalogue PLATEFORME qui ouvre l'entrée. */
  platformPermission: string;
}

/**
 * ⚠ Une entrée qu'un rôle ne peut pas ouvrir DISPARAÎT, elle ne mène pas à un
 * écran qui répondrait « rôle insuffisant ». Les codes sont vérifiés par
 * `pnpm check:permissions` contre le catalogue de la plateforme.
 */
const adminMenuItems: EntreeMenu[] = [
  { title: "Tableau de bord", href: "/admin", icon: LayoutDashboard, platformPermission: "organizations.view" },
  { title: "Incidents", href: "/admin/incidents", icon: Siren, platformPermission: "incidents.view" },
  { title: "Établissements", href: "/admin/organizations", icon: Building2, platformPermission: "organizations.view" },
  { title: "Utilisateurs", href: "/admin/users", icon: Users, platformPermission: "users.view" },
  { title: "Abonnements", href: "/admin/subscriptions", icon: Receipt, platformPermission: "subscriptions.view" },
  { title: "Plans", href: "/admin/plans", icon: CreditCard, platformPermission: "plans.view" },
  { title: "Statistiques", href: "/admin/statistiques", icon: TrendingUp, platformPermission: "metrics.view" },
  { title: "Journal d'audit", href: "/admin/audit-log", icon: ScrollText, platformPermission: "audit_log.view" },
  { title: "Prises en main", href: "/admin/impersonations", icon: Eye, platformPermission: "audit_log.view" },
  { title: "Administrateurs", href: "/admin/administrators", icon: ShieldCheck, platformPermission: "platform_admins.view" },
  { title: "Application mobile", href: "/admin/application", icon: Smartphone, platformPermission: "app_release.view" },
];

interface AdminSidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AdminSidebar({ isMobileOpen = false, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { hasPlatformPermission, me } = useAdminPermissions();
  const entrees = adminMenuItems.filter((item) => hasPlatformPermission(item.platformPermission));

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-border flex flex-col transition-transform duration-200",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-border">
          <Link href="/admin" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Vente Facile" width={36} height={36} />
            <div className="flex items-baseline gap-1">
              <span className="font-semibold text-foreground">Admin</span>
              <span className="text-xs text-muted-foreground">VF</span>
            </div>
          </Link>
          <button
            onClick={onMobileClose}
            className="lg:hidden p-2 hover:bg-muted rounded-lg"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {entrees.map((item) => {
            const isActive = item.href === "/admin"
              ? pathname === "/admin"
              : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          {me?.role_display && (
            <p className="px-1 text-xs text-muted-foreground">
              Rôle : <span className="font-medium text-foreground">{me.role_display}</span>
            </p>
          )}
          <Button variant="outline"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Déconnexion
          </Button>
        </div>
      </aside>
    </>
  );
}
