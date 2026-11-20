"use client";

/**
 * « Créer cet article », proposé quand une recherche ne trouve rien.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA CRÉATION S'OUVRE DANS UN NOUVEL ONGLET, ET C'EST VOULU.               │
 * │                                                                          │
 * │ Le panier du point de vente, le bordereau d'une réquisition, la boîte   │
 * │ d'un mouvement de stock vivent dans l'état de LEUR page : y quitter la  │
 * │ page pour créer l'article les perdrait. L'onglet de création se ferme   │
 * │ seul une fois l'article créé, et l'écran d'origine le retrouve à la     │
 * │ recherche suivante.                                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * N'apparaît que pour qui a `products.create` : un bouton proposé puis refusé
 * enverrait chercher un défaut là où il n'y a qu'un droit manquant.
 */

import Link from "next/link";
import { PackagePlus } from "lucide-react";
import { usePermissions } from "@/components/auth/permissions-provider";
import { Button } from "@/components/ui/button";
import { lienCreationArticle, preRemplissageDeCreation } from "@/lib/products/terme-creation";

export function CreateProductSuggestion({
  terme,
  scanne = false,
  origine,
  className,
}: {
  terme: string;
  /** Le terme sort d'un scanner : c'est un code, même alphanumérique. */
  scanne?: boolean;
  /**
   * D'où l'on vient (`pos`, `requisition`…) : la création s'ouvre dans un
   * NOUVEL onglet, qui se ferme une fois l'article créé. Absent, elle s'ouvre
   * dans celui-ci : l'écran d'origine n'a rien à perdre (la liste des articles).
   */
  origine?: string;
  className?: string;
}) {
  const { hasPermission } = usePermissions();
  const lien = lienCreationArticle(terme, { scanne, origine });
  const pre = preRemplissageDeCreation(terme, scanne);
  if (!lien || !pre || !hasPermission("products.create")) return null;

  const libelle =
    pre.champ === "nom" ? `Créer « ${pre.valeur} »` : `Créer l'article du code ${pre.valeur}`;

  if (!origine) {
    return (
      <Button asChild type="button" variant="outline" size="sm" className={className}>
        <Link href={lien}>
          <PackagePlus className="mr-2 h-4 w-4" />
          {libelle}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => window.open(lien, "_blank")}
    >
      <PackagePlus className="mr-2 h-4 w-4" />
      {libelle}
    </Button>
  );
}
