"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Raccourci de navigation, qui doit se voir comme tel.
 *
 * Ces tuiles portaient un liseré de couleur à gauche pour se distinguer des
 * cartes de chiffres. Un trait de couleur n'est pas une affordance : il décore
 * sans rien promettre. Ce qui dit « ceci se clique », c'est le comportement -
 * la tuile se soulève au survol, sa flèche avance, elle s'enfonce à l'appui et
 * porte un anneau de focus au clavier.
 *
 * L'icône garde sa pastille colorée : elle sert de repère de rubrique, pas de
 * signal d'interactivité.
 */
export function ActionTile({
  href,
  title,
  description,
  icon: Icon,
  accent = "orange",
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent?: "purple" | "indigo" | "cyan" | "amber" | "orange";
}) {
  const accents: Record<string, string> = {
    purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
    indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
    cyan: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100",
    amber: "bg-amber-50 text-amber-600 group-hover:bg-amber-100",
    orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
  };

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3.5",
        "shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        "transition-[box-shadow,border-color,translate,scale] duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_6px_16px_-4px_rgba(16,24,40,0.12)]",
        "active:translate-y-0 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
      )}
    >
      {/* Rayons concentriques : la tuile est en `rounded-xl` (12px) avec 14px de
          marge, la pastille reste donc en `rounded-lg` (8px) pour ne pas
          paraître plus ronde que le contenant. */}
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200",
          accents[accent]
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-gray-900">{title}</span>
        <span className="block truncate text-xs text-gray-500">{description}</span>
      </span>

      <ArrowRight
        className={cn(
          "h-4 w-4 shrink-0 text-gray-300",
          "transition-[color,translate] duration-200 ease-out",
          "group-hover:translate-x-0.5 group-hover:text-gray-500",
          "motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        )}
      />
    </Link>
  );
}
