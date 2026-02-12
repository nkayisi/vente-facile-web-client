"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getUserOrganizations, Organization } from "@/actions/organization.actions";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  ShoppingBag,
  Boxes,
  FileText,
  Bell,
  BarChart3,
  UserCog,
  ChevronRight,
  X,
  Store,
} from "lucide-react";

const menuItems = [
  {
    label: "Tableau de bord",
    icon: LayoutDashboard,
    href: "/dashboard",
    badge: null,
  },
  {
    label: "Ventes",
    icon: ShoppingCart,
    href: "/dashboard/sales",
    badge: null,
  },
  {
    label: "Produits",
    icon: Package,
    href: "/dashboard/products",
    badge: null,
  },
  {
    label: "Stock",
    icon: Boxes,
    href: "/dashboard/stock",
    badge: null,
  },
  {
    label: "Clients & fournisseurs",
    icon: Users,
    href: "/dashboard/contacts",
    badge: null,
  },
  {
    label: "Rapports",
    icon: BarChart3,
    href: "/dashboard/reports",
    badge: null,
  },
  {
    label: "Utilisateurs",
    icon: UserCog,
    href: "/dashboard/users",
    badge: null,
  },
  {
    label: "Abonnements",
    icon: FileText,
    href: "/dashboard/subscriptions",
    badge: null,
  },
  {
    label: "Notifications",
    icon: Bell,
    href: "/dashboard/notifications",
    badge: null,
  },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [organization, setOrganization] = useState<Organization | null>(null);

  useEffect(() => {
    async function fetchOrganization() {
      if (session?.accessToken) {
        const result = await getUserOrganizations(session.accessToken);
        if (result.success && result.data && result.data.length > 0) {
          setOrganization(result.data[0]);
        }
      }
    }
    fetchOrganization();
  }, [session]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col transition-transform duration-300 ease-in-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-gray-200">
          <Link href="/dashboard" className="flex items-center">
            <Image src="/logo.png" alt="Vente Facile" width={68} height={68} className="object-contain" />
            <span className="text-xl font-bold">
              Vente<span className="text-orange-500">Facile</span>
            </span>
          </Link>
          {/* Close button for mobile */}
          <button
            onClick={onMobileClose}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Organization Info */}
        {organization && (
          <div className="px-4 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Store className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {organization.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {organization.business_type_display}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            // Un menu est actif uniquement s'il correspond au chemin le plus long
            // Exemple: /dashboard/products active "Produits", pas "Dashboard"
            const matchingItems = menuItems.filter(m =>
              pathname === m.href || pathname?.startsWith(`${m.href}/`)
            );
            const longestMatch = matchingItems.reduce((longest, current) =>
              current.href.length > longest.href.length ? current : longest
              , matchingItems[0] || { href: '' });
            const isActive = longestMatch?.href === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors group",
                  isActive
                    ? "bg-orange-500 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {item.badge && (
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded",
                        isActive
                          ? "bg-orange-600 text-white"
                          : "bg-gray-200 text-gray-600"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 transition-opacity",
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                  />
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
