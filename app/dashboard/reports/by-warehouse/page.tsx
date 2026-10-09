"use client";

/**
 * Rapport financier VENTILÉ par entrepôt, caisse comprise.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LE FILTRE EXISTAIT, LA VENTILATION NON.                                  │
 * │                                                                          │
 * │ Les huit onglets de « Rapports & statistiques » se filtrent par entrepôt │
 * │ depuis septembre : un gérant peut en lire un à la fois. Mais comparer     │
 * │ deux boutiques demandait de changer le filtre, de relever les chiffres à │
 * │ la main et de les additionner soi-même - avec le risque d'additionner    │
 * │ deux devises. C'est T6 du retour de test.                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ AUCUN FILTRE D'ENTREPÔT ICI, et son absence est le propos : la page REND
 * une ligne par dépôt. Y poser le sélecteur de périmètre reviendrait à offrir
 * de n'en regarder qu'un, c'est-à-dire exactement ce qu'on vient de remplacer.
 * Le périmètre du RÔLE, lui, s'applique toujours - un gérant ne voit que ses
 * dépôts, et c'est le serveur qui le borne.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Building2, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatValue } from "@/components/shared/StatValue";
import { ExportMenu, type ExportTarget } from "@/components/shared/ExportMenu";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { getOrganizationCurrencies, type OrganizationCurrency } from "@/actions/settings.actions";
import { PERIOD_DEFAULT, PERIOD_KEYWORDS, type PeriodKeyword } from "@/lib/reports/periods";
import {
  exportStatistics,
  getWarehouseReport,
  type WarehouseReport,
} from "@/actions/reports.actions";

export default function WarehouseReportPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency } = useCurrency();

  const [period, setPeriod] = useState<PeriodKeyword>(PERIOD_DEFAULT);
  const [report, setReport] = useState<WarehouseReport | null>(null);
  const [devises, setDevises] = useState<OrganizationCurrency[]>([]);
  // Deux états distincts : un spinner plein écran à chaque rechargement
  // démonterait les commandes, et le sélecteur perdrait le focus.
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const jeton = session?.accessToken;
  const orgId = organization?.id;

  const money = useMemo(
    () =>
      createMoneyHelpers(devises, {
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        decimal_places: currency.decimal_places,
      }),
    [devises, currency]
  );

  const charger = useCallback(
    async (premier: boolean) => {
      if (!jeton || !orgId) return;
      if (premier) setIsLoading(true);
      else setIsFetching(true);

      const res = await getWarehouseReport(jeton, orgId, { period });
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        // Un échec ne laisse PAS les chiffres précédents sous une nouvelle
        // période : on dirait alors une fenêtre pour une autre.
        setReport(null);
        toast.error(res.message ?? "Le rapport n'a pas pu être chargé");
      }
      setIsLoading(false);
      setIsFetching(false);
    },
    [jeton, orgId, period]
  );

  useEffect(() => {
    void charger(report === null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jeton, orgId, period]);

  useEffect(() => {
    if (!jeton || !orgId) return;
    getOrganizationCurrencies(jeton, orgId).then((r) => {
      if (r.success && r.data) setDevises(r.data);
    });
  }, [jeton, orgId]);

  const cibleExport: ExportTarget[] = useMemo(
    () => [
      {
        key: "par-entrepot",
        label: "Rapport par entrepôt",
        run: (format) =>
          exportStatistics(jeton!, orgId!, format, "by-warehouse", { period }),
      },
    ],
    [jeton, orgId, period]
  );

  const m = (v: string | number) => money.money(v, report?.currency ?? currency.code);

  /**
   * L'écart entre le total et la somme des lignes.
   *
   * ⚠ IL EST NOMMÉ, jamais tu. Une vente sans entrepôt, une charge
   * d'établissement, un apport sans tiroir n'entrent dans aucune ligne : les
   * imputer à un dépôt gonflerait celui-là, les imputer à tous ferait dépasser
   * le total. Sans cette ligne, le lecteur refait l'addition et conclut à une
   * erreur de calcul.
   */
  const horsEntrepot = useMemo(() => {
    if (!report) return 0;
    const somme = report.warehouses.reduce((t, w) => t + Number(w.sales_total), 0);
    return Number(report.total.sales_total) - somme;
  }, [report]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Rapport par entrepôt</h1>
            <p className="text-sm text-muted-foreground">
              Ventes, dépenses, caisse et stock, dépôt par dépôt
              {report ? ` · du ${report.period.start} au ${report.period.end}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 md:shrink-0">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Période</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKeyword)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_KEYWORDS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ExportMenu
            targets={cibleExport}
            disabled={!report || report.warehouses.length === 0}
            disabledReason="Aucun entrepôt dans votre périmètre"
          />
        </div>
      </div>

      {!report ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <StatValue value={m(report.total.sales_total)} />
                  <p className="text-xs text-muted-foreground">
                    Ventes, en {report.currency}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-destructive/10 p-2">
                  <Wallet className="h-5 w-5 text-destructive" />
                </div>
                <div className="min-w-0 flex-1">
                  <StatValue value={m(report.total.expenses_total)} />
                  <p className="text-xs text-muted-foreground">Dépenses</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-lg bg-muted p-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <StatValue value={m(report.total.stock_value)} />
                  <p className="text-xs text-muted-foreground">
                    Valeur du stock, {report.warehouses.length}{" "}
                    {report.warehouses.length > 1 ? "dépôts" : "dépôt"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className={isFetching ? "opacity-60 transition-opacity" : undefined}>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entrepôt</TableHead>
                      <TableHead className="text-right">Ventes</TableHead>
                      <TableHead className="text-right">Dépenses</TableHead>
                      <TableHead className="text-right">Caisse (net)</TableHead>
                      <TableHead className="text-right">Valeur du stock</TableHead>
                      <TableHead className="text-right">Résultat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.warehouses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                          Aucun entrepôt dans votre périmètre.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.warehouses.map((w) => (
                        <TableRow key={w.warehouse_id}>
                          <TableCell>
                            <span className="font-medium">{w.warehouse_name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {w.warehouse_code}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m(w.sales_total)}
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({w.sales_count})
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m(w.expenses_total)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m(w.cash_net)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m(w.stock_value)}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums font-medium ${
                              Number(w.result) < 0 ? "text-destructive" : ""
                            }`}
                          >
                            {m(w.result)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}

                    <TableRow className="border-t-2 bg-muted/40 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m(report.total.sales_total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m(report.total.expenses_total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m(report.total.cash_net)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m(report.total.stock_value)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          Number(report.total.result) < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {m(report.total.result)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {horsEntrepot !== 0 && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{m(horsEntrepot)}</span> de
              ventes ne sont rattachées à aucun entrepôt et n&apos;entrent donc dans
              aucune ligne : ventes anciennes, ou opérations d&apos;établissement. Elles
              sont comptées dans le total.
            </p>
          )}
        </>
      )}
    </div>
  );
}
