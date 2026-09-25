"use client";

/**
 * Les devis, au back-office.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA TUILE « DEVIS » DU CONCENTRATEUR MENAIT À UNE PAGE QUI N'EXISTAIT PAS.│
 * │                                                                          │
 * │ `QUICK_LINKS` de `sales/page.tsx` pointait sur `/dashboard/sales/`       │
 * │ `quotations` depuis toujours, et le dossier n'a jamais été créé : un 404 │
 * │ en production, sur un raccourci mis en avant. Les server actions,        │
 * │ elles, étaient écrites - avec zéro appelant.                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * **Un devis n'engage PAS le stock**, et l'écran le dit : la réservation
 * n'a lieu qu'à la conversion, qui inscrit une DETTE comme une vente à crédit.
 */

import { toast } from "sonner";
import { messageDeRefus } from "@/lib/perimeter-refusal";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Loader2, FileText, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DataPagination } from "@/components/shared/DataPagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  QuotationStatusBadge,
  isQuotationExpired,
} from "@/components/shared/QuotationStatusBadge";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import {
  getQuotations,
  type Quotation,
  type QuotationStatus,
} from "@/actions/sales.actions";
import { QuotationDialog } from "@/components/sales/QuotationDialog";
import { PerimeterFilters, type PerimeterValue } from "@/components/filters/perimeter-filters";
import { usePerimeter } from "@/hooks/use-perimeter";

const STATUTS: { valeur: QuotationStatus | "all"; label: string }[] = [
  { valeur: "all", label: "Tous" },
  { valeur: "draft", label: "Brouillon" },
  { valeur: "sent", label: "Envoyé" },
  { valeur: "accepted", label: "Accepté" },
  { valeur: "converted", label: "Converti" },
  { valeur: "rejected", label: "Refusé" },
  // ⚠ PAS de puce « Périmé » : `expired` est un statut que RIEN dans le dépôt
  // n'assigne jamais. Elle ouvrirait donc une liste vide à tout coup, et une
  // puce qui ne rend jamais rien apprend à ne plus lire la rangée. La
  // péremption se lit sur la ligne, à partir de `valid_until`.
];

const PAGE_SIZE = 20;

export default function QuotationsPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency } = useCurrency();
  const money = useMemo(() => createMoneyHelpers([], currency), [currency]);

  const [devis, setDevis] = useState<Quotation[]>([]);
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
  const [statut, setStatut] = useState<QuotationStatus | "all">("all");
  const [recherche, setRecherche] = useState("");
  const [terme, setTerme] = useState("");
  const [ouvertCreation, setOuvertCreation] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

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

  // ⚠ Le jeton est extrait AVANT le rappel, et c'est ce qui compte : lire
  // `session?.accessToken` DANS le corps fait inférer `session` entier au
  // compilateur React, qui refuse alors d'optimiser le composant. Le dépôt a
  // par ailleurs déjà payé la dépendance à `session` complet - cinq effets se
  // relançaient à chaque rotation de jeton.
  const jeton = session?.accessToken;

  // Le statut se filtre AU SERVEUR et la liste se pagine : la page ne
  // demandait que la première page de DRF, si bien qu'au-delà de vingt devis
  // les suivants n'étaient atteignables par aucun geste, sous un compteur et
  // des puces calculés sur cette seule tranche. Voir le bloc équivalent des
  // retours pour le raisonnement complet.
  const perimetre = usePerimeter();
  const [perimeterValue, setPerimeterValue] = useState<PerimeterValue>({
    warehouse: null,
    user: null,
  });

  const charger = useCallback(async () => {
    if (!jeton || !organization) return;
    setIsFetching(true);
    const reponse = await getQuotations(jeton, organization.id, {
      // ⚠ Pas de `warehouse` : un devis n'est rattaché à aucun entrepôt.
      ...perimetre.effective({ user: perimeterValue.user ?? undefined }),
      search: terme || undefined,
      status: statut === "all" ? undefined : statut,
      page,
      page_size: PAGE_SIZE,
    });
    const refus = messageDeRefus(reponse);
    if (refus) toast.error(refus);
    setDevis(reponse.success && reponse.data ? reponse.data.results : []);
    setTotal(reponse.success && reponse.data ? reponse.data.count : 0);
    setIsFetching(false);
    setIsLoading(false);
  }, [jeton, organization, terme, statut, page, perimetre, perimeterValue]);

  // La garde est AU SITE DE L'EFFET, comme sur l'historique et les
  // règlements : elle évite l'appel avant que l'organisation ne soit là, et
  // c'est ce qui distingue les pages qui lintent propre des autres.
  useEffect(() => {
    if (organization) charger();
  }, [organization, charger]);

  /**
   * Changer de périmètre revient à la page 1.
   *
   * Le geste, pas un effet : `page` est une dépendance du chargeur, donc sans
   * cette remise la page 3 d'un filtre est demandée sur le suivant et la liste
   * rend « Aucun résultat » alors qu'elle en a. Et un `setState` dans un effet
   * est un rendu de plus - que le lint de ces deux pages refuse, à raison.
   */
  const changerPerimetre = (v: PerimeterValue) => {
    setPerimeterValue(v);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="mt-0.5">
            <Link href="/dashboard/sales" aria-label="Retour aux ventes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Devis</h1>
            {/* La règle la plus utile de cet écran, et la moins évidente. */}
            <p className="text-sm text-muted-foreground">
              Un devis n&apos;engage pas le stock : la réservation n&apos;a lieu
              qu&apos;à la conversion.
            </p>
          </div>
        </div>
        {/* ⚠ `sales.create`, PAS `quotations.create` : `QuotationViewSet`
            garde ses actions par les permissions de VENTE. Un code faux ne
            lève rien - `hasPermission` rend `false`, le bouton disparaît, et
            le marchand conclut que la fonction n'existe pas. */}
        <PermissionGate permission="sales.create">
          <Button onClick={() => setOuvertCreation(true)} className="md:self-start">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau devis
          </Button>
        </PermissionGate>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isLoading ? "Chargement…" : `${total} devis`}
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
              placeholder="Référence ou client…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>

          <PerimeterFilters
            value={perimeterValue}
            onChange={changerPerimetre}
            withWarehouse={false}
          />
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
          ) : devis.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="font-medium">
                {terme || statut !== "all"
                  ? "Aucun devis ne correspond à ce filtre"
                  : "Aucun devis"}
              </p>
              {(terme || statut !== "all") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setRecherche("");
                    setStatut("all");
                  }}
                >
                  Voir tous les devis
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="hidden sm:table-cell">Valable jusqu&apos;au</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Articles</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devis.map((d) => {
                    // Le statut en base ne bascule pas tout seul : un devis
                    // « envoyé » dont la validité est passée reste `sent`, et
                    // le serveur refusera pourtant sa conversion.
                    const perime =
                      d.status !== "converted" && isQuotationExpired(d.valid_until);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/dashboard/sales/quotations/${d.id}`}
                            className="hover:underline"
                          >
                            {d.reference}
                          </Link>
                        </TableCell>
                        <TableCell>{d.customer_name || "Client anonyme"}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className={perime ? "text-warning" : "text-muted-foreground"}>
                            {formatDate(d.valid_until)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right font-mono">
                          {d.items_count}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <QuotationStatusBadge status={d.status} />
                            {perime && d.status !== "expired" && (
                              <Badge
                                variant="outline"
                                className="border-warning/40 bg-warning/10 text-warning"
                              >
                                Périmé
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {money.money(parseFloat(d.total || "0"), money.primaryCode)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      {session?.accessToken && organization?.id && (
        <QuotationDialog
          open={ouvertCreation}
          onOpenChange={setOuvertCreation}
          accessToken={session.accessToken}
          organizationId={organization.id}
          onCreated={charger}
        />
      )}
    </div>
  );
}
