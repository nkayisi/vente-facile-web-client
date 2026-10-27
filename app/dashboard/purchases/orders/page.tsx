"use client";

/**
 * Les commandes d'achat, au back-office.
 *
 * Gabarit de `sales/returns` : deux états de chargement, recherche temporisée,
 * périmètre, puces de statut, pagination remise à 1 par le GESTE. Chacun de ces
 * points est un défaut que ce back-office a déjà payé ailleurs.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, FileText, Loader2, Plus, Search } from "lucide-react";

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
import { ExportMenu } from "@/components/shared/ExportMenu";
import { PurchaseOrderStatusBadge } from "@/components/shared/PurchaseStatusBadge";
import { PerimeterFilters, type PerimeterValue } from "@/components/filters/perimeter-filters";
import { usePerimeter } from "@/hooks/use-perimeter";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { usePermissions } from "@/components/auth/permissions-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { messageDeRefus } from "@/lib/perimeter-refusal";
import {
  exportPurchaseOrders,
  getPurchaseOrders,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from "@/actions/purchases.actions";
import {
  getOrganizationCurrencies,
  type OrganizationCurrency,
} from "@/actions/settings.actions";

/** Les puces de statut, dans l'ordre du cycle de vie d'une commande. */
const STATUTS: { valeur: PurchaseOrderStatus | "all"; label: string }[] = [
  { valeur: "all", label: "Toutes" },
  { valeur: "draft", label: "Brouillon" },
  { valeur: "confirmed", label: "Confirmée" },
  { valeur: "sent", label: "Envoyée" },
  { valeur: "partially_received", label: "Partiellement reçue" },
  { valeur: "received", label: "Reçue" },
  { valeur: "cancelled", label: "Annulée" },
];

const PAGE_SIZE = 20;

export default function PurchaseOrdersPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency: defaultCurrency } = useCurrency();
  const { hasPermission } = usePermissions();

  const [devises, setDevises] = useState<OrganizationCurrency[]>([]);
  const money = useMemo(
    () => createMoneyHelpers(devises, defaultCurrency),
    [devises, defaultCurrency]
  );

  const [commandes, setCommandes] = useState<PurchaseOrder[]>([]);
  // Deux états : `isLoading` ne concerne que le PREMIER chargement, sinon le
  // champ de recherche se démonte à chaque frappe et perd le focus.
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(true);
  const [statut, setStatut] = useState<PurchaseOrderStatus | "all">("all");
  const [recherche, setRecherche] = useState("");
  const [terme, setTerme] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const perimetre = usePerimeter();
  const [perimeterValue, setPerimeterValue] = useState<PerimeterValue>({
    warehouse: null,
    user: null,
  });

  useEffect(() => {
    // La remise en page 1 vit DANS le rappel de temporisation : un effet qui
    // dépendrait de `terme` ferait partir une requête sur l'ANCIENNE page.
    const t = setTimeout(() => {
      setTerme(recherche.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [recherche]);

  const jeton = session?.accessToken;

  const filtres = useMemo(
    () => ({
      search: terme || undefined,
      status: statut === "all" ? undefined : statut,
      ...perimetre.effective({
        warehouse: perimeterValue.warehouse ?? undefined,
        user: perimeterValue.user ?? undefined,
      }),
    }),
    [terme, statut, perimetre, perimeterValue]
  );

  const charger = useCallback(async () => {
    if (!jeton || !organization) return;
    // ⚠ LE `try/finally` N'EST PAS DÉCORATIF : sans lui, une exception laisse
    // la page sur son tourniquet, indéfiniment, sans rien dire. Les actions
    // avalent leurs erreurs réseau, mais la LECTURE de la réponse peut lever,
    // et un rejet non traité dans un effet ne se voit nulle part. C'est aussi
    // ce qui tait `set-state-in-effect`, et la forme de la page Réquisitions.
    try {
      setIsFetching(true);
      const reponse = await getPurchaseOrders(jeton, organization.id, {
        ...filtres,
        page,
        page_size: PAGE_SIZE,
      });
      const refus = messageDeRefus(reponse);
      if (refus) toast.error(refus);
      setCommandes(reponse.success && reponse.data ? reponse.data.results : []);
      setTotal(reponse.success && reponse.data ? reponse.data.count : 0);
    } finally {
      // Le drapeau de PREMIER chargement ne se relève jamais : c'est ce qui
      // empêche le champ de recherche de se démonter à chaque frappe, donc de
      // perdre le focus - le défaut qu'« Historique des ventes » a dû corriger.
      setIsFetching(false);
      setIsLoading(false);
    }
  }, [jeton, organization, filtres, page]);

  useEffect(() => {
    if (organization) charger();
  }, [organization, charger]);

  useEffect(() => {
    if (!jeton || !organization) return;
    getOrganizationCurrencies(jeton, organization.id).then((r) => {
      if (r.success && r.data) setDevises(r.data);
    });
  }, [jeton, organization]);

  const changerPerimetre = (v: PerimeterValue) => {
    setPerimeterValue(v);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtreActif = Boolean(terme) || statut !== "all";

  return (
    <div className="space-y-6">
      {/* ⚠ `flex-wrap` sur le groupe d'actions : sans lui le bouton sort de
          l'écran au téléphone, ce que vingt-quatre groupes ont déjà payé. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="mt-0.5">
            <Link href="/dashboard/purchases" aria-label="Retour aux achats">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Commandes d&apos;achat</h1>
            <p className="text-sm text-muted-foreground">
              Une commande n&apos;engage ni le stock ni la caisse : tout bouge à
              la réception.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            disabled={!jeton || !organization || total === 0}
            disabledReason="Aucune commande à exporter"
            targets={[
              {
                key: "purchase-orders",
                label: "Commandes d'achat",
                run: (format) =>
                  exportPurchaseOrders(jeton!, organization!.id, format, filtres),
              },
            ]}
          />
          {hasPermission("purchases.create") && (
            <Button asChild>
              <Link href="/dashboard/purchases/orders/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle commande
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isLoading
              ? "Chargement…"
              : `${total} commande${total > 1 ? "s" : ""}`}
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
              placeholder="Référence ou nom du fournisseur…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>

          <PerimeterFilters value={perimeterValue} onChange={changerPerimetre} />

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
          ) : commandes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {filtreActif
                    ? "Aucune commande ne correspond à ce filtre"
                    : "Aucune commande enregistrée"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {filtreActif
                    ? "Élargissez le filtre pour voir le reste."
                    : "Les réquisitions disent ce qui manque en rayon : c'est de là qu'une commande part."}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {filtreActif && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRecherche("");
                      setStatut("all");
                      setPage(1);
                    }}
                  >
                    Voir toutes les commandes
                  </Button>
                )}
                {!filtreActif && (
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/stock/requisitions">
                      Voir les réquisitions
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Référence</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="hidden lg:table-cell">Attendu le</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Reste dû</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commandes.map((po) => {
                    const du = parseFloat(po.amount_due || "0");
                    return (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/dashboard/purchases/orders/${po.id}`}
                            className="hover:underline"
                          >
                            {po.reference}
                          </Link>
                        </TableCell>
                        <TableCell>{po.supplier_name}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {formatDate(po.order_date)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {po.expected_date ? formatDate(po.expected_date) : "-"}
                        </TableCell>
                        <TableCell>
                          <PurchaseOrderStatusBadge status={po.status} />
                        </TableCell>
                        {/* ⚠ La devise vient de la LIGNE, jamais du contexte :
                            une commande de 50 $ s'écrivait « 50 FC » sur la
                            page Historique avant qu'on ne corrige ce défaut. */}
                        <TableCell className="text-right font-mono">
                          {money.money(parseFloat(po.total || "0"), po.currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {du > 0 ? (
                            <span className="text-warning">
                              {money.money(du, po.currency)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
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
    </div>
  );
}
