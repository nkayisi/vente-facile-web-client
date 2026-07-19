"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Coins, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard/settings", label: "Infos générales", icon: Settings },
  { href: "/dashboard/settings/currencies", label: "Devises", icon: Coins },
  { href: "/dashboard/settings/loyalty", label: "Fidélité", icon: Gift },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-orange-600">
          <Settings className="h-6 w-6 text-orange-500" />
          Paramètres
        </h1>
        <p className="text-gray-500 text-sm">Configuration de votre établissement</p>
      </div>

      {/* Navigation par onglets (chaque onglet est une page) */}
      <nav className="flex items-center gap-1 border-b overflow-x-auto">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                active
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-orange-600"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
