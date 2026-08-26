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
import { getUserOrganizations } from "@/actions/organization.actions";
import { getOrganizationCurrencies, OrganizationCurrency } from "@/actions/settings.actions";
import {
  getReceivablesReport,
  AGING_BUCKET_LABELS,
  ReceivablesReport,
} from "@/actions/reports.actions";

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
  const { currency: defaultCurrency } = useCurrency();

  const [isLoading, setIsLoading] = useState(true);
  const [orgCurrencies, setOrgCurrencies] = useState<OrganizationCurrency[]>([]);
  const [report, setReport] = useState<ReceivablesReport | null>(null);

  const money = useMemo(
    () => createMoneyHelpers(orgCurrencies, defaultCurrency),
    [orgCurrencies, defaultCurrency]
  );

  const fetchData = useCallback(async () => {
    if (!session?.accessToken) return;
    setIsLoading(true);
    try {
      const orgResult = await getUserOrganizations(session.accessToken);
      if (!orgResult.success || !orgResult.data?.length) return;

      const org = orgResult.data[0];

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
  }, [session?.accessToken]);

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
        <CreditCard className="mx-auto mb-4 h-12 w-12 text-gray-300" />
        <h3 className="mb-2 text-lg font-medium text-gray-900">Créances indisponibles</h3>
        <Button variant="outline" onClick={fetchData}>
          Réessayer
        </Button>
      </div>
    );
  }

  const hasDebt = report.invoice_count > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/reports">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Créances clients</h1>
          <p className="text-sm text-gray-500">
            Factures encore dues au {report.as_of}, classées par ancienneté
          </p>
        </div>
      </div>

      {/* Les deux seuls chiffres convertis de la page, explicitement nommés. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-red-100 p-2">
              <CreditCard className="h-5 w-5 text-red-600" />
            </div>
            <div className="min-w-0 flex-1">
              <StatValue value={money.money(report.total_primary, report.primary_currency)} />
              <p className="text-xs text-gray-500">
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
              <p className="text-xs text-gray-500">
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
              <p className="text-xs text-gray-500">
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
            <CreditCard className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-1 text-lg font-medium text-gray-900">Aucune créance</h3>
            <p className="text-sm text-gray-500">
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
              <p className="text-sm text-gray-500">
                Ancienneté comptée depuis l&apos;échéance de la facture, ou depuis
                sa date de vente quand aucune échéance n&apos;a été fixée.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-gray-500">
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
                                    ? "text-gray-900"
                                    : "text-gray-300"
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

          {/* Qui relancer, et depuis quand. Une ligne par couple client-devise :
              un client peut devoir dans deux devises à la fois. */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Débiteurs</CardTitle>
              <p className="text-sm text-gray-500">
                Du montant le plus élevé au plus faible. Un client qui doit dans
                deux devises apparaît une fois par devise.
              </p>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {report.by_customer.map(debtor => (
                  <Link
                    key={`${debtor.customer_id}-${debtor.currency}`}
                    href={`/dashboard/contacts/customers/${debtor.customer_id}`}
                    className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">
                        {debtor.customer_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {debtor.invoice_count} facture{debtor.invoice_count > 1 ? "s" : ""}
                        {debtor.oldest_days > 0 && (
                          <> · la plus ancienne échue depuis {debtor.oldest_days} j</>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {parseFloat(debtor.overdue_amount) > 0 && (
                        <Badge variant="destructive" className="font-normal">
                          {money.money(debtor.overdue_amount, debtor.currency)} échus
                        </Badge>
                      )}
                      <span className="font-semibold tabular-nums text-gray-900">
                        {money.money(debtor.amount_due, debtor.currency)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
