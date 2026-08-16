"use client";

import { cn } from "@/lib/utils";

interface StatValueProps {
  value: string;
  className?: string;
  color?: string;
}

/**
 * Composant pour afficher les valeurs de statistiques dans les cartes.
 * Réduit automatiquement la taille du texte pour les montants longs
 * afin d'éviter le dépassement des cartes.
 */
export function StatValue({ value, className, color }: StatValueProps) {
  const length = value.length;
  
  let sizeClass = "text-2xl";
  if (length > 18) {
    sizeClass = "text-base";
  } else if (length > 14) {
    sizeClass = "text-lg";
  } else if (length > 10) {
    sizeClass = "text-xl";
  }

  return (
    <div
      className={cn(
        // `text-base` figurait ici après `sizeClass` : twMerge gardant la
        // dernière classe d'un même groupe, toute la réduction progressive
        // était annulée et chaque montant s'affichait en petit.
        "font-bold truncate tabular-nums",
        sizeClass,
        color,
        className
      )}
      title={value}
    >
      {value}
    </div>
  );
}
