"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CreditCard, TrendingDown, Users } from "lucide-react";
import { toast } from "sonner";
import { StatValue } from "@/components/shared/StatValue";
import { useCurrency } from "@/components/providers/currency-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { getOrganizationCurrencies, OrganizationCurrency } from "@/actions/settings.actions";
import { useOrganization } from "@/components/auth/organization-checker";
import { ExportMenu, type ExportTarget } from "@/components/shared/ExportMenu";
import { exportStatistics } from "@/actions/reports.actions";
import {
  getReceivablesReport,
  type ReceivablesDebtor,
  type ReceivablesReport,
} from "@/actions/reports.actions";
import { AGING_BUCKET_LABELS } from "@/lib/reports/aging";

/**
 * Balance âgée des créances clients.
 *
 * Le seul chiffre disponible jusqu'ici était un total unique converti en devise
 * principale : utile pour un ordre de grandeur, muet sur l'ancienneté et sur la
 * devise réellement due. Un marchand qui relance a besoin de savoir qui doit,
 * combien, dans quelle devise et depuis quand.
 *
 * Les montants ne sont jamais additionnés entre devises : chaque devise a sa
 * propre ligne. Les deux seuls chiffres convertis sont nommés comme tels.
 */
export default function ReceivablesReportPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency: defaultCurrency } = useCurrency();

  const [isLoading, setIsLoading] = useState(true);
  const [orgCurrencies, setOrgCurrencies] = useState<OrganizationCurrency[]>([]);
  const [report, setReport] = useState<ReceivablesReport | null>(null);

  const money = useMemo(
    () => createMoneyHelpers(orgCurrencies, defaultCurrency),
    [orgCurrencies, defaultCurrency]
  );

  /**
   * Le document, fabriqué par le serveur, en PDF / Excel / CSV.
   *
   * Il porte la balance ENTIÈRE : cette page n'a pas de filtre, et l'arrêté
   * imprimé en tête est la seule borne qui compte pour une créance.
   */
  /**
   * Les débiteurs, GROUPÉS PAR DEVISE puis triés par montant.
   *
   * Le serveur les rend déjà triés, mais toutes devises confondues. On ne
   * réordonne donc pas la liste, on la SÉPARE : comparer deux montants n'a de
   * sens que dans la même monnaie.
   *
   * L'ordre des devises suit celui de la balance âgée juste au-dessus, pour
   * que l'œil retrouve les mêmes blocs dans le même ordre.
   */
  const debiteursParDevise = useMemo<[string, ReceivablesDebtor[]][]>(() => {
    if (!report) return [];
    const groupes = new Map<string, ReceivablesDebtor[]>();
    for (const d of report.by_customer) {
      const liste = groupes.get(d.currency) ?? [];
      liste.push(d);
      groupes.set(d.currency, liste);
    }
    const ordre = report.by_currency.map(c => c.currency);
    return [...groupes.entries()]
      .sort((a, b) => ordre.indexOf(a[0]) - ordre.indexOf(b[0]))
      .map(([devise, lignes]) => [
        devise,
        [...lignes].sort(
          (a, b) => parseFloat(b.amount_due) - parseFloat(a.amount_due)
        ),
      ]);
  }, [report]);

  const cibleExport: ExportTarget[] = useMemo(
    () => [
      {
        key: "creances",
        label: "Créances clients",
        run: (format) =>
          exportStatistics(
            session!.accessToken!,
            organization!.id,
            format,
            "receivables"
          ),
      },
    ],
    [session, organization]
  );

  const fetchData = useCallback(async () => {
    // L'organisation vient du contexte d'`OrganizationChecker`, qui ne rend
    // ses enfants qu'une fois celle-ci chargée. La redemander ici mettait un
    // `GET /organizations/` devant les deux requêtes utiles de la page.
    if (!session?.accessToken || !organization) return;
    setIsLoading(true);
    try {
      const org = organization;

      const [reportResult, currenciesResult] = await Promise.all([
        getReceivablesReport(session.accessToken, org.id),
        getOrganizationCurrencies(session.accessToken, org.id),
      ]);

      if (reportResult.success && reportResult.data) {
        setReport(reportResult.data);
      } else {
        toast.error(reportResult.message || "Erreur lors du chargement des créances");
      }
      if (currenciesResult.success && currenciesResult.data) {
        setOrgCurrencies(currenciesResult.data);
      }
    } catch {
      toast.error("Erreur lors du chargement des créances");
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken, organization?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="py-12 text-center">
        <CreditCard className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
        <h3 className="mb-2 text-lg font-medium text-foreground">Créances indisponibles</h3>
        <Button variant="outline" onClick={fetchData}>
          Réessayer
        </Button>
      </div>
    );
  }

  const hasDebt = report.invoice_count > 0;

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
            <h1 className="text-2xl font-bold text-foreground">Créances clients</h1>
            <p className="text-sm text-muted-foreground">
              Factures encore dues au {report.as_of}, classées par ancienneté
            </p>
          </div>
        </div>
        {/* Cette rubrique n'avait AUCUN export : on lit qui relancer à
            l'écran, et rien ne permettait d'emporter la liste. Le document
            vient du serveur, comme les huit rapports, et le terminal reçoit
            exactement le même fichier. */}
        <div className="items-start md:shrink-0">
          <ExportMenu
            targets={cibleExport}
            disabled={!hasDebt}
            disabledReason="Aucune facture due à exporter"
          />
        </div>
      </div>

      {/* Les deux seuls chiffres convertis de la page, explicitement nommés. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-destructive/10 p-2">
              <CreditCard className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <StatValue value={money.money(report.total_primary, report.primary_currency)} />
              <p className="text-xs text-muted-foreground">
                Total dû, converti en {report.primary_currency}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-orange-100 p-2">
              <TrendingDown className="h-5 w-5 text-orange-600" />
            </div>
            <div className="min-w-0 flex-1">
              <StatValue
                value={money.money(report.overdue_primary, report.primary_currency)}
                color={parseFloat(report.overdue_primary) > 0 ? "text-orange-700" : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Échu, converti en {report.primary_currency}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-100 p-2">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <StatValue value={String(report.debtor_count)} />
              <p className="text-xs text-muted-foreground">
                {report.debtor_count > 1 ? "clients débiteurs" : "client débiteur"} ·{" "}
                {report.invoice_count} facture{report.invoice_count > 1 ? "s" : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {!hasDebt ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="mb-1 text-lg font-medium text-foreground">Aucune créance</h3>
            <p className="text-sm text-muted-foreground">
              Toutes les factures sont soldées.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Balance âgée. Une ligne par devise : 50 USD et 40 000 CDF ne
              s'additionnent pas, et un total mélangé ne voudrait rien dire. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Balance âgée par devise</CardTitle>
              <p className="text-sm text-muted-foreground">
                Ancienneté comptée depuis l&apos;échéance de la facture, ou depuis
                sa date de vente quand aucune échéance n&apos;a été fixée.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Devise</th>
                      {report.buckets.map(bucket => (
                        <th key={bucket} className="pb-2 pr-4 text-right font-medium">
                          {AGING_BUCKET_LABELS[bucket]}
                        </th>
                      ))}
                      <th className="pb-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.by_currency.map(row => (
                      <tr key={row.currency} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium">{row.currency}</td>
                        {report.buckets.map(bucket => {
                          const value = parseFloat(row[bucket]);
                          return (
                            <td
                              key={bucket}
                              className={`py-3 pr-4 text-right tabular-nums ${
                                value > 0 && bucket !== "current"
                                  ? "text-orange-700"
                                  : value > 0
                                    ? "text-foreground"
                                    : "text-muted-foreground/40"
                              }`}
                            >
                              {money.amountOnly(row[bucket], row.currency)}
                            </td>
                          );
                        })}
                        <td className="py-3 text-right font-semibold tabular-nums">
                          {money.money(row.total, row.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ┌──────────────────────────────────────────────────────────────┐
              │ UN ORDRE INTER-DEVISES EST AUSSI FAUX QU'UNE SOMME            │
              │ INTER-DEVISES, et c'est le corollaire qu'on oublie parce      │
              │ qu'aucun chiffre faux n'apparaît.                             │
              │                                                              │
              │ Le serveur range `by_customer` par montant décroissant,       │
              │ TOUTES DEVISES CONFONDUES : un client devant 50 000 FC        │
              │ (environ dix-huit dollars) passait au-dessus d'un client      │
              │ devant 3 000 $. Le marchand relance dans l'ordre de la        │
              │ liste - c'est tout l'usage de cet écran - et il commençait    │
              │ donc par le mauvais.                                          │
              │                                                              │
              │ On ne réordonne pas, on SÉPARE : une section par devise,      │
              │ l'ordre à l'intérieur. Deux montants comparés le sont alors   │
              │ toujours dans la même monnaie. Le terminal a été corrigé      │
              │ ainsi ; le web ne l'était pas.                                │
              └──────────────────────────────────────────────────────────────┘ */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Qui relancer</CardTitle>
              <p className="text-sm text-muted-foreground">
                Du montant le plus élevé au plus faible, DEVISE PAR DEVISE. Un
                client qui doit dans deux monnaies apparaît une fois par
                monnaie.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {debiteursParDevise.map(([devise, lignes]) => (
                <div key={devise}>
                  {/* Un en-tête qui ne sépare rien se lirait comme le début
                      d'une seconde liste : il n'apparaît qu'à plusieurs. */}
                  {debiteursParDevise.length > 1 && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {devise}
                    </p>
                  )}
                  <div className="divide-y">
                    {lignes.map(debtor => (
                      <div
                        key={`${debtor.customer_id}-${debtor.currency}`}
                        className="flex items-center justify-between gap-4 py-3"
                      >
                        <Link
                          href={`/dashboard/contacts/customers/${debtor.customer_id}`}
                          className="min-w-0 flex-1 transition-colors hover:opacity-80"
                        >
                          <p className="truncate font-medium">
                            {debtor.customer_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {debtor.invoice_count} facture
                            {debtor.invoice_count > 1 ? "s" : ""}
                            {debtor.oldest_days > 0 && (
                              <> · la plus ancienne échue depuis {debtor.oldest_days} j</>
                            )}
                            {/* On relance au téléphone : le numéro se lit ici,
                                et se dicte parfois à quelqu'un d'autre. */}
                            {debtor.customer_phone && (
                              <> · {debtor.customer_phone}</>
                            )}
                          </p>
                        </Link>
                        <div className="flex shrink-0 items-center gap-3">
                          {parseFloat(debtor.overdue_amount) > 0 && (
                            <Badge variant="destructive" className="font-normal">
                              {money.money(debtor.overdue_amount, debtor.currency)} échus
                            </Badge>
                          )}
                          <span className="font-semibold tabular-nums">
                            {money.money(debtor.amount_due, debtor.currency)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
