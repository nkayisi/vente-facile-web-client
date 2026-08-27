"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { statValueSize } from "@/components/shared/StatValue";

/**
 * Bandeau de mesure : une rangée de relevés, à lire, jamais à cliquer.
 *
 * Les chiffres de tête vivaient jusqu'ici dans des cartes en tout point
 * semblables aux raccourcis de navigation posés juste en dessous : neuf boîtes
 * de même taille, même ombre, même rayon, dont quatre seulement réagissaient au
 * clic. Rien ne disait lesquelles.
 *
 * Le bandeau tranche par sa forme : un seul panneau, des cellules séparées par
 * un filet, aucune ombre, aucun coin qui flotte. Il se lit comme un cadran
 * d'instrument, et l'affordance de clic reste tout entière aux tuiles d'action.
 */
export function StatStrip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Les filets viennent du fond qui transparaît dans un `gap-px`, et non
        // de `divide-x/y`. La grille change de nombre de colonnes selon la
        // largeur : avec `divide-*` il faudrait neutraliser la bordure haute de
        // la première rangée à chaque palier, et un palier oublié laisse soit
        // un trait en trop au bord, soit deux rangées sans séparation.
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl",
        "border border-gray-200 bg-gray-200",
        // Six colonnes seulement sur les très grands écrans. Un montant s'écrit
        // en entier : il lui faut de la place, et six cellules sur un portable
        // n'en laissent pas assez. Trois et six divisent tous deux six relevés
        // en rangées pleines, contrairement à quatre ou cinq.
        "lg:grid-cols-3 2xl:grid-cols-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatStripItem({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
}: {
  label: string;
  /**
   * Valeur affichée EN ENTIER. Aucun montant n'est abrégé sur la plateforme :
   * quand la place manque, c'est la taille du texte qui cède, jamais le nombre
   * de chiffres.
   */
  value: string;
  icon?: LucideIcon;
  /**
   * `alert` et `warn` ne colorent que si la valeur est non nulle : un « 0 en
   * rupture » écrit en rouge crie sans raison, et à force de crier pour rien
   * on finit par ne plus voir le vrai rouge.
   */
  tone?: "neutral" | "warn" | "alert" | "accent";
  hint?: string;
}) {
  const isZero = value.trim() === "0";
  const valueTone =
    (tone === "alert" && !isZero && "text-red-600") ||
    (tone === "warn" && !isZero && "text-orange-600") ||
    (tone === "accent" && "text-gray-900") ||
    "text-gray-900";

  const iconTone =
    (tone === "alert" && !isZero && "text-red-500") ||
    (tone === "warn" && !isZero && "text-orange-500") ||
    (tone === "accent" && "text-emerald-600") ||
    "text-gray-400";

  return (
    <div className="min-w-0 bg-white px-4 py-3.5">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={cn("h-3.5 w-3.5 shrink-0", iconTone)} />}
        <p className="truncate text-xs font-medium text-gray-500" title={hint || label}>
          {label}
        </p>
      </div>
      {/* La valeur occupe toute la largeur de la cellule : l'icône est montée
          dans la ligne du libellé pour ne plus lui disputer d'espace, ce qui
          était la première cause des montants rognés. */}
      <p
        className={cn(
          "mt-1 truncate font-semibold leading-tight tabular-nums",
          statValueSize(value),
          valueTone
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
