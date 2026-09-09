"use client";

/**
 * Historique des ventes.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ QUATRE DÉFAUTS, DONT UN QUI RENDAIT LA RECHERCHE INUTILISABLE.          │
 * │                                                                          │
 * │ 1. `isLoading` remplaçait TOUTE la page par un spinner à chaque          │
 * │    rechargement. Le champ de recherche se démontait donc à chaque        │
 * │    frappe, perdait le focus, et l'on ne pouvait pas taper deux           │
 * │    caractères d'affilée. Deux états distincts désormais : la page reste  │
 * │    montée, seules les lignes deviennent des squelettes.                  │
 * │                                                                          │
 * │ 2. `formatPrice(sale.total)` sans devise. La fonction applique le        │
 * │    symbole GLOBAL posé par `CurrencyProvider`, c'est-à-dire celui de la  │
 * │    devise principale : une facture de 50 $ s'écrivait « 50 FC ». Chaque  │
 * │    montant passe maintenant par `money.money(x, sale.currency)`.         │
 * │                                                                          │
 * │ 3. Une requête par touche, sans délai.                                   │
 * │                                                                          │
 * │ 4. La ligne portait `onClick` sur un `<tr>` - donc inatteignable au      │
 * │    clavier - ET un bouton œil imbriqué dont le clic remontait, ce qui    │
 * │    déclenchait deux navigations. La référence est un `<Link>`.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Les couleurs passent par les jetons. **Le back-office n'a pas de bascule de
 * thème** (`defaultTheme="light"`, aucun appel à `setTheme`) : ce n'est donc
 * pas un mode sombre livré, c'est un écran qui cessera d'être faux le jour où
 * la bascule existera.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Search,
  Loader2,
  Receipt,
  Filter,
  Calendar,
  Banknote,
  AlertTriangle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime, formatDate } from "@/lib/format";
import { isOverdue, daysLate } from "@/lib/due-date";
import { createMoneyHelpers } from "@/lib/currency";
import {
  getSales,
  exportSales,
  Sale,
  SaleStatus,
  SaleFilters,
} from "@/actions/sales.actions";
import {
  getOrganizationCurrencies,
  OrganizationCurrency,
} from "@/actions/settings.actions";
import { DataPagination } from "@/components/shared/DataPagination";
import { ExportMenu } from "@/components/shared/ExportMenu";
import { MultiCurrencyTotal } from "@/components/shared/MultiCurrencyTotal";
import { StatStrip, StatStripItem } from "@/components/shared/StatStrip";
import {
  SaleStatusBadge,
  saleStatusLabel,
} from "@/components/shared/SaleStatusBadge";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";

const STATUSES: SaleStatus[] = [
  "draft",
  "pending",
  "completed",
  "partially_paid",
  "cancelled",
  "refunded",
];

const PAGE_SIZE = 20;

export default function SalesHistoryPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency: defaultCurrency } = useCurrency();

  const [sales, setSales] = useState<Sale[]>([]);
  const [orgCurrencies, setOrgCurrencies] = useState<OrganizationCurrency[]>([]);

  /** Premier chargement : la page n'existe pas encore. */
  const [isLoading, setIsLoading] = useState(true);
  /** Rechargement du tableau seul : la page reste montée, les lignes se grisent. */
  const [isFetching, setIsFetching] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  /** Requête réellement envoyée : sans délai, chaque frappe déclencherait un appel. */
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  const money = useMemo(
    () => createMoneyHelpers(orgCurrencies, defaultCurrency),
    [orgCurrencies, defaultCurrency]
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Tout changement de filtre remet à la première page : rester en page trois
  // sur un filtre qui n'a que deux pages affiche un tableau vide sans rien dire.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedStatus, dateFrom, dateTo]);

  /** Les filtres SANS la page : ce sont ceux que l'export doit recevoir. */
  const exportFilters = useMemo<Omit<SaleFilters, "page" | "page_size">>(() => {
    const filters: Omit<SaleFilters, "page" | "page_size"> = {};
    if (selectedStatus !== "all") filters.status = selectedStatus as SaleStatus;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (debouncedSearch) filters.search = debouncedSearch;
    return filters;
  }, [selectedStatus, dateFrom, dateTo, debouncedSearch]);

  const fetchSales = useCallback(async () => {
    if (!session?.accessToken || !organization) return;
    setIsFetching(true);
    try {
      const result = await getSales(session.accessToken, organization.id, {
        ...exportFilters,
        page: currentPage,
        page_size: PAGE_SIZE,
      });
      if (result.success && result.data) {
        setSales(result.data.results || []);
        setTotalCount(result.data.count || 0);
        setHasNext(result.data.next !== null);
        setHasPrevious(result.data.previous !== null);
      }
    } catch {
      toast.error("Erreur lors du chargement des ventes");
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  }, [session?.accessToken, organization, currentPage, exportFilters]);

  useEffect(() => {
    if (organization) fetchSales();
  }, [organization, fetchSales]);

  // Les devises de l'établissement ne dépendent d'aucun filtre : une seule fois.
  useEffect(() => {
    if (!session?.accessToken || !organization) return;
    getOrganizationCurrencies(session.accessToken, organization.id).then((r) => {
      if (r.success && r.data) setOrgCurrencies(r.data);
    });
  }, [session?.accessToken, organization]);

  const hasActiveFilters =
    searchQuery !== "" || selectedStatus !== "all" || dateFrom !== "" || dateTo !== "";

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedStatus("all");
    setDateFrom("");
    setDateTo("");
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const dueRows = sales
    .filter((s) => Number(s.amount_due) > 0)
    .map((s) => ({ amount: s.amount_due, currency: s.currency }));
  const overdueRows = sales
    .filter((s) => Number(s.amount_due) > 0 && s.due_date && isOverdue(s.due_date))
    .map((s) => ({ amount: s.amount_due, currency: s.currency }));

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/sales">
            <Button variant="ghost" size="icon" aria-label="Retour aux ventes">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Historique des ventes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalCount} {totalCount > 1 ? "ventes" : "vente"}
            </p>
          </div>
        </div>
        <ExportMenu
          disabled={!session?.accessToken || !organization?.id || totalCount === 0}
          disabledReason="Aucune vente à exporter"
          targets={[
            {
              key: "sales",
              label: "Journal des ventes",
              description: "Les ventes telles que filtrées",
              run: (format) =>
                exportSales(
                  session!.accessToken as string,
                  organization!.id,
                  format,
                  exportFilters
                ),
            },
          ]}
        />
      </div>

      {/* Deux chiffres, et ce sont ceux qui appellent une action : ce qui reste
          à encaisser, et ce qui est DÉJÀ en retard. Ventilés par devise -
          additionner des francs et des dollars donne un nombre qui n'existe
          pas et qui a l'air juste. */}
      <StatStrip className="lg:grid-cols-2 2xl:grid-cols-2">
        <StatStripItem label="Reste à encaisser (page)" icon={Banknote} tone="warn">
          <MultiCurrencyTotal rows={dueRows} money={money} />
        </StatStripItem>
        <StatStripItem
          label="Dont en retard (page)"
          icon={AlertTriangle}
          tone={overdueRows.length > 0 ? "alert" : "neutral"}
        >
          <MultiCurrencyTotal
            rows={overdueRows}
            money={money}
            color={overdueRows.length > 0 ? "text-destructive" : undefined}
          />
        </StatStripItem>
      </StatStrip>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par référence ou client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Rechercher une vente"
          />
        </div>

        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-full" aria-label="Filtrer par statut">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {saleStatusLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="pl-9"
            aria-label="Date de début"
          />
        </div>

        <div className="relative">
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="pl-9"
            aria-label="Date de fin"
          />
        </div>
      </div>

      <Card className="overflow-hidden py-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">Ventes</p>
            {/* Un indicateur DISCRET, jamais un spinner plein écran : la page
                doit rester lisible et le champ de recherche monté. */}
            {isFetching && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="mr-1 h-4 w-4" />
              Effacer les filtres
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="hidden lg:table-cell text-center">Articles</TableHead>
                <TableHead className="text-center">Statut</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Reste dû</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFetching && sales.length === 0 ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="mx-auto h-5 w-8 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="mx-auto h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-foreground">
                      {hasActiveFilters ? "Aucune vente ne correspond" : "Aucune vente"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {hasActiveFilters
                        ? "Essayez une autre référence, un autre statut ou une autre période."
                        : "Aucune vente n'a encore été enregistrée."}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                        Effacer les filtres
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale) => {
                  const due = Number(sale.amount_due);
                  const late = sale.due_date && due > 0 && isOverdue(sale.due_date);
                  return (
                    <TableRow key={sale.id} className="hover:bg-muted/50">
                      <TableCell>
                        {/* Un `<Link>` sur la référence, et non un `onClick` sur
                            la rangée : celui-ci n'est atteignable ni au clavier
                            ni au lecteur d'écran, et le bouton œil qu'il
                            portait déclenchait une seconde navigation. */}
                        <Link
                          href={`/dashboard/sales/${sale.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {sale.reference}
                        </Link>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {sale.customer_name || "Client anonyme"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {formatDateTime(sale.sale_date)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center">
                        <Badge variant="secondary">{sale.items_count}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {/* Le retard prime sur le statut : c'est lui qui décide
                            s'il faut appeler le client aujourd'hui. */}
                        {late ? (
                          <Badge className="border-transparent bg-destructive/15 text-destructive">
                            En retard de {daysLate(sale.due_date!)} j
                          </Badge>
                        ) : (
                          <SaleStatusBadge status={sale.status} />
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground tabular-nums">
                        {/* Chaque montant dans SA devise. */}
                        {money.money(sale.total, sale.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {/* « 0 » sous chaque vente soldée est du bruit qui masque
                            les vraies créances : on n'écrit que ce qui reste. */}
                        {due > 0 ? (
                          <span className="font-medium text-warning">
                            {money.money(sale.amount_due, sale.currency)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {sale.due_date && due > 0 && !late && (
                          <p className="text-xs text-muted-foreground">
                            échéance {formatDate(sale.due_date)}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-border p-4">
            <DataPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              hasNext={hasNext}
              hasPrevious={hasPrevious}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
