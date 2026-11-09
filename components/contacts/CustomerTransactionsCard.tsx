"use client";

/**
 * Le grand livre d'un client : ce qu'il a pris à crédit, ce qu'il a réglé.
 *
 * Extrait de la fiche client, qui portait dix sections sur un seul écran. Il
 * charge ses propres lignes : la sous-page « Historique » reste alors mince, et
 * la fiche n'a plus rien à aller chercher pour un bloc qu'elle ne rend plus.
 *
 * ⚠ CHAQUE MONTANT DANS LA DEVISE DE SON ÉCRITURE. Une dette se tient devise
 * par devise, et rendre une ligne en francs sous le symbole du dollar donnerait
 * un chiffre qui n'existe pas.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Banknote,
  CreditCard,
  DollarSign,
  History,
  Loader2,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import type { MoneyHelpers } from "@/lib/currency";
import {
  getCustomerTransactions,
  type CustomerTransaction,
} from "@/actions/contacts.actions";

const MOYENS: Record<string, string> = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
  check: "Chèque",
};

function iconeDe(type: string) {
  switch (type) {
    case "credit_sale":
      return <ArrowUpRight className="h-4 w-4 text-red-500" />;
    case "payment":
      return <CreditCard className="h-4 w-4 text-green-500" />;
    case "advance":
      return <Banknote className="h-4 w-4 text-blue-500" />;
    case "adjustment":
      return <DollarSign className="h-4 w-4 text-orange-500" />;
    case "refund":
      return <ArrowUpRight className="h-4 w-4 text-purple-500" />;
    default:
      return <DollarSign className="h-4 w-4 text-gray-500" />;
  }
}

function couleurDe(type: string) {
  switch (type) {
    case "credit_sale":
      return "text-red-600";
    case "payment":
      return "text-green-600";
    case "advance":
      return "text-blue-600";
    case "adjustment":
      return "text-orange-600";
    case "refund":
      return "text-purple-600";
    default:
      return "text-gray-600";
  }
}

/** Ce qui CREUSE la dette porte un plus ; ce qui la réduit, un moins. */
function signeDe(type: string) {
  return type === "credit_sale" || type === "refund" ? "+" : "-";
}

export function CustomerTransactionsCard({
  accessToken,
  organizationId,
  customerId,
  money,
  defaultCurrency,
}: {
  accessToken: string | undefined;
  organizationId: string;
  customerId: string;
  /**
   * ⚠ REÇU, JAMAIS REFABRIQUÉ. En monter un second ici donnerait deux tables
   * de taux sur la même page, et c'est par là qu'un même montant finit affiché
   * de deux façons.
   */
  money: MoneyHelpers;
  defaultCurrency: string;
}) {
  const [filtre, setFiltre] = useState("all");
  const [lignes, setLignes] = useState<CustomerTransaction[]>([]);
  const [charge, setCharge] = useState(true);

  const charger = useCallback(async () => {
    if (!accessToken) return;
    // ⚠ TOUT LE CORPS EST DANS UN `try`, ET SON `finally` N'EST PAS COSMÉTIQUE :
    //   sans lui, une exception laisse la carte sur son tourniquet, pour
    //   toujours.
    try {
      setCharge(true);
      const r = await getCustomerTransactions(
        accessToken,
        organizationId,
        customerId,
        filtre === "all" ? undefined : filtre
      );
      if (r.success && r.data) {
        setLignes(r.data);
      } else {
        // Sans ce message, un échec affichait « Aucun mouvement » : impossible
        // de distinguer un client sans historique d'une requête en erreur.
        setLignes([]);
        toast.warning("Historique des mouvements non chargé.");
      }
    } catch {
      setLignes([]);
    } finally {
      setCharge(false);
    }
  }, [accessToken, organizationId, customerId, filtre]);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-orange-500" />
            Mouvements du compte
          </CardTitle>
          <Select value={filtre} onValueChange={setFiltre}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les mouvements</SelectItem>
              <SelectItem value="credit_sale">Achats à crédit</SelectItem>
              <SelectItem value="payment">Paiements reçus</SelectItem>
              <SelectItem value="advance">Avances données</SelectItem>
              <SelectItem value="adjustment">Corrections</SelectItem>
              <SelectItem value="refund">Remboursements</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {charge ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : lignes.length === 0 ? (
          <div className="py-8 text-center">
            <History className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">
              {filtre === "all"
                ? "Aucun mouvement"
                : "Aucun mouvement de ce genre"}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {filtre === "all"
                ? "Les paiements, avances et achats à crédit apparaîtront ici"
                : "Choisissez « Tous les mouvements » pour voir le reste."}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {lignes.map((txn) => (
              <div
                key={txn.id}
                className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-50"
              >
                <div className="rounded-full bg-gray-100 p-2">
                  {iconeDe(txn.transaction_type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {txn.transaction_type_display}
                    </p>
                    {txn.sale_reference && (
                      <Link
                        href={`/dashboard/sales/${txn.sale}`}
                        className="text-xs text-orange-600 hover:underline"
                      >
                        {txn.sale_reference}
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{formatDateTime(txn.created_at)}</span>
                    {txn.payment_method && (
                      <span>
                        · {MOYENS[txn.payment_method] ?? txn.payment_method}
                      </span>
                    )}
                    {txn.reference && <span>· Réf: {txn.reference}</span>}
                  </div>
                  {txn.notes && (
                    <p className="mt-0.5 truncate text-xs text-gray-400">
                      {txn.notes}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${couleurDe(
                      txn.transaction_type
                    )}`}
                  >
                    {signeDe(txn.transaction_type)}
                    {money.money(txn.amount, txn.currency || defaultCurrency)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Dette après :{" "}
                    {money.money(
                      txn.balance_after,
                      txn.currency || defaultCurrency
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
