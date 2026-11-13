"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Précédent / suivant et la position. Les listes de l'administration se
 * parcourent, elles ne se sautent pas : vingt lignes par page, et la recherche
 * pour aller plus loin.
 */
export function AdminPagination({
  page,
  total,
  taille = 20,
  onPage,
}: {
  page: number;
  total: number;
  taille?: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / taille));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground">
        Page {page} sur {pages}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Précédent</span>
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <span className="sr-only sm:not-sr-only sm:mr-1">Suivant</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
