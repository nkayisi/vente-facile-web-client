"use client";

/**
 * Les règlements fournisseurs, au back-office.
 *
 * **Aucun bouton « Nouveau » ici.** Un règlement s'impute sur des commandes :
 * il se crée depuis la commande qu'il solde, et l'état vide y conduit. Le
 * serveur sait aussi imputer seul, de la plus ancienne commande ouverte à la
 * plus récente, mais un écran ne doit pas laisser cette imputation devenir une
 * surprise.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, CreditCard, Loader2, Search, XCircle } from "lucide-react";

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataPagination } from "@/components/shared/DataPagination";
import { ExportMenu } from "@/components/shared/ExportMenu";
import { PerimeterFilters, type PerimeterValue } from "@/components/filters/perimeter-filters";
import { usePerimeter } from "@/hooks/use-perimeter";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { usePermissions } from "@/components/auth/permissions-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { messageDeRefus } from "@/lib/perimeter-refusal";
import {
  cancelSupplierPayment,
  exportSupplierPayments,
  getSupplierPayments,
  type SupplierPayment,
} from "@/actions/purchases.actions";
import {
  getOrganizationCurrencies,
  type OrganizationCurrency,
} from "@/actions/settings.actions";

const STATUTS = [
  { valeur: "all", label: "Tous" },
  { valeur: "completed", label: "Terminé" },
  { valeur: "cancelled", label: "Annulé" },
] as const;

const PAGE_SIZE = 20;

export default function SupplierPaymentsPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency: defaultCurrency } = useCurrency();
  const { hasPermission } = usePermissions();

  const [devises, setDevises] = useState<OrganizationCurrency[]>([]);
  const money = useMemo(
    () => createMoneyHelpers(devises, defaultCurrency),
    [devises, defaultCurrency]
  );

  const [reglements, setReglements] = useState<SupplierPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(true);
  const [statut, setStatut] = useState<string>("all");
  const [recherche, setRecherche] = useState("");
  const [terme, setTerme] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [aAnnuler, setAAnnuler] = useState<SupplierPayment | null>(null);
  const [enCours, setEnCours] = useState(false);

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
      const reponse = await getSupplierPayments(jeton, organization.id, {
        ...filtres,
        page,
        page_size: PAGE_SIZE,
      });
      const refus = messageDeRefus(reponse);
      if (refus) toast.error(refus);
      setReglements(reponse.success && reponse.data ? reponse.data.results : []);
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

  const annuler = async () => {
    if (!jeton || !organization || !aAnnuler) return;
    setEnCours(true);
    const r = await cancelSupplierPayment(jeton, organization.id, aAnnuler.id);
    setEnCours(false);
    setAAnnuler(null);
    if (r.success) {
      toast.success("Règlement annulé");
      charger();
    } else {
      toast.error(r.message ?? "L'annulation n'a pas abouti");
    }
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
            <h1 className="text-2xl font-bold">Règlements fournisseurs</h1>
            <p className="text-sm text-muted-foreground">
              Chaque règlement s&apos;impute sur des commandes et sort du tiroir.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            disabled={!jeton || !organization || total === 0}
            disabledReason="Aucun règlement à exporter"
            targets={[
              {
                key: "supplier-payments",
                label: "Journal des règlements",
                run: (format) =>
                  exportSupplierPayments(jeton!, organization!.id, format, filtres),
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
              : `${total} règlement${total > 1 ? "s" : ""}`}
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
              placeholder="Référence, fournisseur ou n° de pièce…"
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
          ) : reglements.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {filtreActif
                    ? "Aucun règlement ne correspond à ce filtre"
                    : "Aucun règlement enregistré"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Un règlement se crée depuis la commande qu&apos;il solde.
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
                    Voir tous les règlements
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <Link href="/dashboard/purchases/orders?status=partially_received">
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
                    <TableHead className="hidden lg:table-cell">Imputé sur</TableHead>
                    <TableHead className="hidden md:table-cell">Moyen</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reglements.map((p) => {
                    const annule = p.status === "cancelled";
                    const imputations = (p.allocations ?? [])
                      .map((a) => a.purchase_order_reference)
                      .filter(Boolean);
                    return (
                      <TableRow key={p.id} className={annule ? "opacity-60" : undefined}>
                        <TableCell className="font-medium">{p.reference}</TableCell>
                        <TableCell>{p.supplier_name}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {formatDate(p.payment_date)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {/* « Acompte » et non une case vide : un règlement
                              sans imputation est un versement d'avance, pas une
                              donnée manquante. */}
                          {imputations.length > 0 ? (
                            imputations.join(", ")
                          ) : (
                            <Badge variant="outline">Acompte</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {p.payment_method_name || "-"}
                        </TableCell>
                        {/* La devise vient de la LIGNE, jamais du contexte. */}
                        <TableCell className="text-right font-mono">
                          {annule ? (
                            <span className="line-through text-muted-foreground">
                              {money.money(parseFloat(p.amount || "0"), p.currency)}
                            </span>
                          ) : (
                            money.money(parseFloat(p.amount || "0"), p.currency)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!annule && hasPermission("purchases.edit") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAAnnuler(p)}
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              Annuler
                            </Button>
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

      <AlertDialog
        open={Boolean(aAnnuler)}
        onOpenChange={(o) => !o && setAAnnuler(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Annuler le règlement {aAnnuler?.reference} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              La dette du fournisseur sera restituée, les commandes imputées
              redeviendront dues, et une entrée de caisse contrepassera la sortie
              d&apos;origine. Le règlement reste visible, barré : sa trace est ce
              qui explique le solde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne rien faire</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={annuler}
            >
              {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Annuler le règlement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
