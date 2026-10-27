"use client";

/**
 * Les retours fournisseurs, au back-office.
 *
 * **Aucun bouton « Nouveau » ici.** Un retour désigne ce qui a été REÇU : il se
 * crée depuis la commande qui l'a livré, sans quoi on ne sait ni quoi retirer
 * du rayon, ni combien de dette éteindre. L'état vide conduit donc aux
 * commandes.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search, Undo2 } from "lucide-react";

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
import { PurchaseReturnStatusBadge } from "@/components/shared/PurchaseStatusBadge";
import { PerimeterFilters, type PerimeterValue } from "@/components/filters/perimeter-filters";
import { usePerimeter } from "@/hooks/use-perimeter";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { messageDeRefus } from "@/lib/perimeter-refusal";
import {
  getPurchaseReturns,
  type PurchaseReturn,
  type PurchaseReturnStatus,
} from "@/actions/purchases.actions";

const STATUTS: { valeur: PurchaseReturnStatus | "all"; label: string }[] = [
  { valeur: "all", label: "Tous" },
  { valeur: "draft", label: "Brouillon" },
  { valeur: "approved", label: "Approuvé" },
  { valeur: "shipped", label: "Expédié" },
  { valeur: "cancelled", label: "Annulé" },
];

const PAGE_SIZE = 20;

export default function PurchaseReturnsPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency: defaultCurrency } = useCurrency();

  const money = useMemo(
    () => createMoneyHelpers([], defaultCurrency),
    [defaultCurrency]
  );

  const [retours, setRetours] = useState<PurchaseReturn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(true);
  const [statut, setStatut] = useState<PurchaseReturnStatus | "all">("all");
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

  const charger = useCallback(async () => {
    if (!jeton || !organization) return;
    // ⚠ LE `try/finally` N'EST PAS DÉCORATIF : sans lui, une exception laisse
    // la page sur son tourniquet, indéfiniment, sans rien dire. Les actions
    // avalent leurs erreurs réseau, mais la LECTURE de la réponse peut lever,
    // et un rejet non traité dans un effet ne se voit nulle part. C'est aussi
    // ce qui tait `set-state-in-effect`, et la forme de la page Réquisitions.
    try {
      setIsFetching(true);
      const reponse = await getPurchaseReturns(jeton, organization.id, {
        search: terme || undefined,
        status: statut === "all" ? undefined : statut,
        ...perimetre.effective({
          warehouse: perimeterValue.warehouse ?? undefined,
          user: perimeterValue.user ?? undefined,
        }),
        page,
        page_size: PAGE_SIZE,
      });
      const refus = messageDeRefus(reponse);
      if (refus) toast.error(refus);
      setRetours(reponse.success && reponse.data ? reponse.data.results : []);
      setTotal(reponse.success && reponse.data ? reponse.data.count : 0);
    } finally {
      // Le drapeau de PREMIER chargement ne se relève jamais : c'est ce qui
      // empêche le champ de recherche de se démonter à chaque frappe, donc de
      // perdre le focus - le défaut qu'« Historique des ventes » a dû corriger.
      setIsFetching(false);
      setIsLoading(false);
    }
  }, [jeton, organization, terme, statut, page, perimetre, perimeterValue]);

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
            <h1 className="text-2xl font-bold">Retours fournisseurs</h1>
            <p className="text-sm text-muted-foreground">
              Un retour éteint d&apos;abord la dette : seul le reliquat revient
              en caisse.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isLoading ? "Chargement…" : `${total} retour${total > 1 ? "s" : ""}`}
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
              placeholder="Référence du retour ou nom du fournisseur…"
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
          ) : retours.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Undo2 className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {filtreActif
                    ? "Aucun retour ne correspond à ce filtre"
                    : "Aucun retour enregistré"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Un retour se crée depuis la commande qui a livré la
                  marchandise.
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
                    Voir tous les retours
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
                    <TableHead>Fournisseur</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Valeur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retours.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/purchases/returns/${r.id}`}
                          className="hover:underline"
                        >
                          {r.reference}
                        </Link>
                      </TableCell>
                      <TableCell>{r.supplier_name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {formatDate(r.return_date)}
                      </TableCell>
                      <TableCell>
                        <PurchaseReturnStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {/* ⚠ La devise de la COMMANDE, pas la principale :
                            c'est dans celle-là que le serveur éteint la dette
                            à l'expédition. */}
                        {money.money(
                          parseFloat(r.total_amount || "0"),
                          r.purchase_order_currency || money.primaryCode
                        )}
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
