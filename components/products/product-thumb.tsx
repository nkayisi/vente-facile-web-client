"use client";

import { Package } from "lucide-react";

import { cn } from "@/lib/utils";

const TAILLES = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
} as const;

const TAILLES_ICONE = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
  xl: "h-10 w-10",
} as const;

interface ProductThumbProps {
  /** URL de la photo, absente pour la plupart des produits. */
  src?: string | null;
  alt?: string;
  size?: keyof typeof TAILLES;
  className?: string;
  /** Grise la vignette, par exemple pour un produit bloqué par un inventaire. */
  muted?: boolean;
}

/**
 * Vignette d'un produit.
 *
 * Retombe sur l'icône colis quand aucune photo n'est enregistrée, ce qui est le
 * cas de la majorité des produits : le repli doit rester discret et identique
 * partout, sinon les listes paraissent incohérentes.
 */
export function ProductThumb({
  src,
  alt = "",
  size = "md",
  className,
  muted = false,
}: ProductThumbProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md bg-slate-100 ring-1 ring-black/[0.06]",
        TAILLES[size],
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={cn("h-full w-full object-cover", muted && "grayscale")}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Package className={cn(TAILLES_ICONE[size], "text-slate-300")} />
        </div>
      )}
    </div>
  );
}
