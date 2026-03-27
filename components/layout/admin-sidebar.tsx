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
  X,
  ArrowLeft,
} from "lucide-react";

const adminMenuItems = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Établissements", href: "/admin/organizations", icon: Building2 },
  { title: "Utilisateurs", href: "/admin/users", icon: Users },
  { title: "Plans", href: "/admin/plans", icon: CreditCard },
  { title: "Abonnements", href: "/admin/subscriptions", icon: Receipt },
];

interface AdminSidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AdminSidebar({ isMobileOpen = false, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();

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
          {adminMenuItems.map((item) => {
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

        <div className="p-3 border-t border-border">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            Retour au dashboard
          </Link>
        </div>
      </aside>
    </>
  );
}
