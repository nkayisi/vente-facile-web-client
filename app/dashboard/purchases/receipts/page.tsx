"use client";

/**
 * Les réceptions de marchandises, au back-office.
 *
 * **Aucun bouton « Nouvelle » ici, et c'est délibéré.** Une réception désigne
 * les lignes d'une commande : elle se crée DEPUIS sa commande, et l'état vide
 * y conduit plutôt que de laisser le lecteur dans un cul-de-sac. C'est la règle
 * déjà posée sur les retours de vente.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, PackageCheck, Search } from "lucide-react";

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
import { GoodsReceiptStatusBadge } from "@/components/shared/PurchaseStatusBadge";
import { PerimeterFilters, type PerimeterValue } from "@/components/filters/perimeter-filters";
import { usePerimeter } from "@/hooks/use-perimeter";
import { useOrganization } from "@/components/auth/organization-checker";
import { formatDateTime } from "@/lib/format";
import { messageDeRefus } from "@/lib/perimeter-refusal";
import {
  exportGoodsReceipts,
  getGoodsReceipts,
  type GoodsReceipt,
  type GoodsReceiptStatus,
} from "@/actions/purchases.actions";

const STATUTS: { valeur: GoodsReceiptStatus | "all"; label: string }[] = [
  { valeur: "all", label: "Toutes" },
  { valeur: "draft", label: "Brouillon" },
  { valeur: "completed", label: "Validée" },
  { valeur: "cancelled", label: "Annulée" },
];

const PAGE_SIZE = 20;

export default function GoodsReceiptsPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();

  const [receptions, setReceptions] = useState<GoodsReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(true);
  const [statut, setStatut] = useState<GoodsReceiptStatus | "all">("all");
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
      const reponse = await getGoodsReceipts(jeton, organization.id, {
        ...filtres,
        page,
        page_size: PAGE_SIZE,
      });
      const refus = messageDeRefus(reponse);
      if (refus) toast.error(refus);
      setReceptions(reponse.success && reponse.data ? reponse.data.results : []);
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

  const changerPerimetre = (v: PerimeterValue) => {
    setPerimeterValue(v);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtreActif = Boolean(terme) || statut !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="mt-0.5">
            <Link href="/dashboard/purchases" aria-label="Retour aux achats">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Réceptions</h1>
            <p className="text-sm text-muted-foreground">
              Un brouillon n&apos;entre rien en rayon : tout bouge à la
              validation.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            disabled={!jeton || !organization || total === 0}
            disabledReason="Aucune réception à exporter"
            targets={[
              {
                key: "goods-receipts",
                label: "Journal des réceptions",
                run: (format) =>
                  exportGoodsReceipts(jeton!, organization!.id, format, filtres),
              },
            ]}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isLoading
              ? "Chargement…"
              : `${total} réception${total > 1 ? "s" : ""}`}
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
              placeholder="Référence ou n° de facture fournisseur…"
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
          ) : receptions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <PackageCheck className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {filtreActif
                    ? "Aucune réception ne correspond à ce filtre"
                    : "Aucune réception enregistrée"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Une réception se crée depuis la commande concernée.
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
                    Voir toutes les réceptions
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link href="/dashboard/purchases/orders">
                    Ouvrir les commandes
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
                    <TableHead>Commande</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="hidden lg:table-cell">Entrepôt</TableHead>
                    <TableHead className="hidden md:table-cell">Facture</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receptions.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/purchases/receipts/${r.id}`}
                          className="hover:underline"
                        >
                          {r.reference}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/dashboard/purchases/orders/${r.purchase_order}`}
                          className="text-muted-foreground hover:underline"
                        >
                          {r.purchase_order_reference}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {formatDateTime(r.receipt_date)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {r.warehouse_name}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {r.supplier_invoice || "-"}
                      </TableCell>
                      <TableCell>
                        <GoodsReceiptStatusBadge status={r.status} />
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
