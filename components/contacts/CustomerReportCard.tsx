"use client";

/**
 * Le compte d'un client sur une période, sur sa fiche.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ AUCUN ÉCRAN NE RENDAIT CE COMPTE BORNÉ DANS LE TEMPS.                    │
 * │                                                                          │
 * │ La fiche montre ses ventes et ses écritures, jamais ce qu'il a rapporté   │
 * │ sur un mois - et nulle part sa fidélité GAGNÉE contre celle déjà          │
 * │ UTILISÉE. Le marchand additionnait sa liste de ventes à la main.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LA CAGNOTTE DISPONIBLE N'A PAS DE PÉRIODE, et c'est la seule valeur du
 * rapport dans ce cas : c'est un solde d'AUJOURD'HUI. L'écran le DIT, sinon
 * elle se lit comme un chiffre de la fenêtre choisie - et le marchand croirait
 * que son client a gagné cette somme ce mois-ci.
 *
 * ⚠ UN RELEVÉ VIDE VAUT « 0 FC », JAMAIS UNE PHRASE : un cadran se lit en
 * balayant une colonne de montants, et une phrase y casse le balayage.
 */

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Gift, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportMenu } from "@/components/shared/ExportMenu";
import { MultiCurrencyTotal } from "@/components/shared/MultiCurrencyTotal";
import {
  PeriodFilter,
  periodToParams,
  type PeriodValue,
} from "@/components/shared/PeriodFilter";
import { StatStrip, StatStripItem } from "@/components/shared/StatStrip";
import type { MoneyHelpers } from "@/lib/currency";
import {
  exportCustomerReport,
  getCustomerReport,
  type CustomerReport,
} from "@/actions/contacts.actions";

export function CustomerReportCard({
  accessToken,
  organizationId,
  customerId,
  money,
}: {
  accessToken: string | undefined;
  organizationId: string;
  customerId: string;
  /**
   * ⚠ REÇU, JAMAIS REFABRIQUÉ. La fiche construit déjà ses helpers avec les
   * devises de l'établissement (`createMoneyHelpers(orgCurrencies, …)`) : en
   * monter un second ici donnerait deux tables de taux sur la même page, et
   * c'est exactement par là qu'un même montant finit affiché de deux façons.
   */
  money: MoneyHelpers;
}) {
  // ⚠ LA FENÊTRE PAR DÉFAUT EST LE MOIS, pas tout l'historique : un rapport
  //   sans borne sur un client de trois ans ne répond à aucune question qu'on
  //   se pose devant sa fiche.
  const [periode, setPeriode] = useState<PeriodValue>({ mode: "month" });
  const [rapport, setRapport] = useState<CustomerReport | null>(null);
  const [charge, setCharge] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);

  const bornes = periodToParams(periode);

  // ⚠ TOUT LE CORPS EST DANS UN `try`, ET SON `finally` N'EST PAS COSMÉTIQUE :
  //   sans lui, une exception laisse la carte sur son tourniquet
  //   indéfiniment. C'est la forme des pages voisines du stock.
  const charger = useCallback(async () => {
    if (!accessToken) return;
    try {
      setCharge(true);
      const r = await getCustomerReport(accessToken, organizationId, customerId, {
        date_from: bornes.date_from,
        date_to: bornes.date_to,
      });
      if (r.success && r.data) {
        setRapport(r.data);
        setEchec(null);
        return;
      }
      // ⚠ ON GARDE LE DERNIER ÉTAT CONNU et on DIT qu'il est daté : effacer
      //   les chiffres qu'on était en train de lire est pire que de les
      //   montrer périmés. C'est la règle du verrou d'inventaire au comptoir.
      setEchec(r.message || "Le rapport n'a pas pu être chargé");
    } finally {
      setCharge(false);
    }
  }, [accessToken, organizationId, customerId, bornes.date_from, bornes.date_to]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Tout montant converti est en devise PRINCIPALE : c'est elle que le
  // serveur annonce dans `rapport.currency`, et un montant sans devise est
  // interdit par la doctrine.
  const f = (montant: string) => money.money(Number(montant) || 0, money.primaryCode);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-orange-500" />
            Rapport du client
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter value={periode} onChange={setPeriode} />
            <ExportMenu
              disabled={!accessToken || !rapport}
              disabledReason="Chargez le rapport d'abord"
              variant="outline"
              size="sm"
              targets={[
                {
                  key: "customer-report",
                  label: "Rapport du client",
                  run: (format) =>
                    exportCustomerReport(
                      accessToken as string,
                      organizationId,
                      customerId,
                      format,
                      { date_from: bornes.date_from, date_to: bornes.date_to },
                    ),
                },
              ]}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {echec ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {echec}
            {rapport ? " Les chiffres ci-dessous sont ceux du dernier chargement." : ""}
          </div>
        ) : null}

        {charge && !rapport ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : rapport ? (
          <>
            <StatStrip>
              <StatStripItem
                label="Chiffre d'affaires"
                value={f(rapport.sales.revenue)}
                hint={`Converti en ${rapport.currency}, au taux figé sur chaque facture.`}
              />
              <StatStripItem label="Ventes" value={String(rapport.sales.count)} />
              <StatStripItem
                label="Panier moyen"
                value={f(rapport.sales.average_basket)}
              />
              <StatStripItem
                label="Articles achetés"
                value={Number(rapport.sales.items_sold).toLocaleString("fr-FR")}
              />
              <StatStripItem label="Encaissé" value={f(rapport.sales.collected)} />
              <StatStripItem
                label="Reste dû"
                value={f(rapport.sales.outstanding)}
                tone={Number(rapport.sales.outstanding) > 0 ? "warn" : "neutral"}
              />
            </StatStrip>

            {/* La ventilation par devise : jamais sommée nativement. Elle ne
            paraît que sur une période réellement multi-devise, sinon elle
            répéterait le chiffre d'affaires juste au-dessus. */}
            {rapport.by_currency.length > 1 ? (
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Facturé par devise
                </p>
                <div className="space-y-1 text-sm">
                  {rapport.by_currency.map((d) => (
                    <div key={d.currency} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {d.currency} · {d.count} vente(s)
                      </span>
                      <span className="font-medium">
                        {money.money(Number(d.native_total), d.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {rapport.loyalty.has_program ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                <p className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-900">
                  <Gift className="h-4 w-4" />
                  Cagnotte de fidélité
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Gagnée sur la période
                    </p>
                    <p className="font-semibold">{f(rapport.loyalty.earned)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Utilisée sur la période
                    </p>
                    <p className="font-semibold">{f(rapport.loyalty.used)}</p>
                  </div>
                  <div>
                    {/* ⚠ CE CHIFFRE N'A PAS DE PÉRIODE, et l'étiquette le dit. */}
                    <p className="text-xs text-muted-foreground">
                      Disponible au {rapport.period.as_of}
                    </p>
                    <p className="font-semibold text-amber-900">
                      {f(rapport.loyalty.balance)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {rapport.debt.length > 0 ? (
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {/* Dette et avance COEXISTENT chez le même client dès que les
                  devises diffèrent : trancher sur un seul signe tairait la
                  moitié de la situation. */}
                  Compte au {rapport.period.as_of}, hors période
                </p>
                <MultiCurrencyTotal
                  rows={rapport.debt.map((d) => ({
                    amount: d.amount,
                    currency: d.currency,
                  }))}
                  money={money}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
