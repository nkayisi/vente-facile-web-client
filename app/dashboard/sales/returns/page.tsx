"use client";

/**
 * Les retours de vente, au back-office.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LE BACKEND ÉTAIT COMPLET, LES SERVER ACTIONS ÉCRITES, ET AUCUNE PAGE NE │
 * │ LES APPELAIT.                                                            │
 * │                                                                          │
 * │ `createSaleReturn`, `approveSaleReturn` et `rejectSaleReturn` vivaient   │
 * │ dans `actions/sales.actions.ts` avec ZÉRO appelant. Le terminal a ses    │
 * │ écrans depuis le lot 11 ; le back-office n'en a jamais eu, si bien qu'un │
 * │ retour enregistré au comptoir ne pouvait être ni relu ni approuvé depuis │
 * │ un ordinateur.                                                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * **Aucun bouton « Nouveau » ici, et c'est délibéré.** Un retour se crée
 * DEPUIS SA VENTE : chaque ligne désigne une ligne de facture (`original_item`),
 * sans quoi le serveur ne sait ni quoi remettre en stock ni combien rembourser.
 * L'état vide conduit donc à l'historique des ventes plutôt que de laisser le
 * lecteur dans un cul-de-sac.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Loader2, PackageX, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DataPagination } from "@/components/shared/DataPagination";
import {
  ReturnStatusBadge,
  returnTypeLabel,
} from "@/components/shared/ReturnStatusBadge";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { getSaleReturns, type ReturnStatus, type SaleReturn } from "@/actions/sales.actions";

/** Les puces de statut, dans l'ordre du cycle de vie. */
const STATUTS: { valeur: ReturnStatus | "all"; label: string }[] = [
  { valeur: "all", label: "Tous" },
  { valeur: "draft", label: "Brouillon" },
  { valeur: "pending", label: "En attente" },
  { valeur: "approved", label: "Approuvé" },
  { valeur: "completed", label: "Terminé" },
  { valeur: "rejected", label: "Rejeté" },
];

const PAGE_SIZE = 20;

export default function SaleReturnsPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency } = useCurrency();
  const money = useMemo(() => createMoneyHelpers([], currency), [currency]);

  const [returns, setReturns] = useState<SaleReturn[]>([]);
  // ┌──────────────────────────────────────────────────────────────────────┐
  // │ DEUX ÉTATS, ET C'EST LE CHAMP DE RECHERCHE QUI L'EXIGE.              │
  // │                                                                      │
  // │ Un `isLoading` remis à VRAI à chaque requête remplace la carte par   │
  // │ des squelettes à chaque frappe : l'input se démonte et PERD LE       │
  // │ FOCUS, si bien qu'on ne peut pas taper deux caractères. C'est le     │
  // │ défaut que la page « Historique des ventes » a dû corriger.          │
  // │                                                                      │
  // │ `isLoading` ne concerne donc que le PREMIER chargement.              │
  // └──────────────────────────────────────────────────────────────────────┘
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(true);
  const [statut, setStatut] = useState<ReturnStatus | "all">("all");
  const [recherche, setRecherche] = useState("");
  const [terme, setTerme] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Le champ garde le focus : la temporisation vit ici, et l'écran ne se
  // démonte pas à chaque frappe. C'est le défaut corrigé sur l'historique.
  useEffect(() => {
    // ⚠ La remise en page 1 vit DANS le rappel de temporisation, pas dans un
    // effet qui dépendrait de `terme` : un `setState` synchrone dans un corps
    // d'effet déclenche un rendu en cascade, et surtout une requête sur
    // l'ANCIENNE page avant celle de la page 1. Ici les deux partent ensemble.
    const t = setTimeout(() => {
      setTerme(recherche.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [recherche]);

  // ⚠ Le jeton est extrait AVANT le rappel : lire `session?.accessToken` DANS
  // le corps fait inférer `session` entier au compilateur React, qui refuse
  // alors d'optimiser le composant.
  const jeton = session?.accessToken;

  // ┌────────────────────────────────────────────────────────────────────────┐
  // │ LE STATUT SE FILTRE AU SERVEUR, ET LA LISTE SE PAGINE.                 │
  // │                                                                        │
  // │ La page ne demandait que la PREMIÈRE page de DRF et triait les statuts │
  // │ en mémoire : au-delà de vingt retours, les suivants n'étaient          │
  // │ atteignables par aucun geste, le titre annonçait « 20 retours » et les │
  // │ puces comptaient sur cette tranche - « Approuvé (4) » pour neuf        │
  // │ retours approuvés. Un décompte faux sous un total faux ne se remarque  │
  // │ pas : on en conclut que les retours manquants ont été perdus.          │
  // │                                                                        │
  // │ Les puces ne portent donc plus de nombre : le serveur n'en rend qu'un, │
  // │ celui du filtre actif, et six requêtes pour six pastilles coûteraient  │
  // │ plus que ce qu'elles apprennent. Une puce sans nombre ne ment pas.     │
  // └────────────────────────────────────────────────────────────────────────┘
  const charger = useCallback(async () => {
    if (!jeton || !organization) return;
    setIsFetching(true);
    const reponse = await getSaleReturns(jeton, organization.id, {
      search: terme || undefined,
      status: statut === "all" ? undefined : statut,
      page,
      page_size: PAGE_SIZE,
    });
    setReturns(reponse.success && reponse.data ? reponse.data.results : []);
    setTotal(reponse.success && reponse.data ? reponse.data.count : 0);
    setIsFetching(false);
    setIsLoading(false);
  }, [jeton, organization, terme, statut, page]);

  // La garde est AU SITE DE L'EFFET, comme sur l'historique et les
  // règlements : elle évite l'appel avant que l'organisation ne soit là, et
  // c'est ce qui distingue les pages qui lintent propre des autres.
  useEffect(() => {
    if (organization) charger();
  }, [organization, charger]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="mt-0.5">
            <Link href="/dashboard/sales" aria-label="Retour aux ventes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Retours de vente</h1>
            <p className="text-sm text-muted-foreground">
              Ni le stock ni la caisse ne bougent avant l&apos;approbation.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isLoading
              ? "Chargement…"
              : `${total} retour${total > 1 ? "s" : ""}`}
            {isFetching && !isLoading && (
              <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Référence du retour ou de la vente…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUTS.map((s) => (
              <Button
                key={s.valeur}
                size="sm"
                variant={statut === s.valeur ? "default" : "outline"}
                onClick={() => {
                  setStatut(s.valeur);
                  setPage(1);
                }}
              >
                {s.label}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : returns.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <PackageX className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {terme || statut !== "all"
                    ? "Aucun retour ne correspond à ce filtre"
                    : "Aucun retour enregistré"}
                </p>
                {/* Un état vide qui ne dit pas où aller est un cul-de-sac : un
                    retour se crée depuis sa vente, et nulle part ailleurs. */}
                <p className="text-sm text-muted-foreground">
                  Un retour se crée depuis la vente concernée.
                </p>
              </div>
              {/* Un état vide SOUS UN FILTRE ne dit pas que rien n'existe : il
                  faut pouvoir revenir à la liste entière sans deviner. */}
              <div className="flex flex-wrap justify-center gap-2">
                {(terme || statut !== "all") && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRecherche("");
                      setStatut("all");
                    }}
                  >
                    Voir tous les retours
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link href="/dashboard/sales/history">
                    Ouvrir l&apos;historique des ventes
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Vente</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Remboursement</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {/* Un `<Link>` et non un `onClick` sur la rangée :
                            atteignable au clavier, et pas de double navigation
                            quand le clic remonte. */}
                        <Link
                          href={`/dashboard/sales/returns/${r.id}`}
                          className="hover:underline"
                        >
                          {r.reference}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/dashboard/sales/${r.original_sale}`}
                          className="text-muted-foreground hover:underline"
                        >
                          {r.original_sale_reference}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline">{returnTypeLabel(r.return_type)}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {formatDate(r.return_date)}
                      </TableCell>
                      <TableCell>
                        <ReturnStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {money.money(parseFloat(r.refund_amount || "0"), money.primaryCode)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="border-t border-border pt-4">
              <DataPagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                hasNext={page < totalPages}
                hasPrevious={page > 1}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
