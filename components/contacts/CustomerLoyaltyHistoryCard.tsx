"use client";

/**
 * Le registre de la cagnotte d'un client : ce qu'il a gagné, ce qu'il a employé.
 *
 * Il existait côté serveur depuis l'origine et n'était affiché nulle part ; il
 * a rejoint la fiche client, qui portait alors dix sections. Il vit désormais
 * dans la sous-page « Historique », avec les deux autres lectures du passé.
 *
 * ⚠ LA CAGNOTTE EST LIBELLÉE EN DEVISE PRINCIPALE, toujours : c'est en elle que
 * le programme la calcule et que le comptoir l'emploie. D'où `formatPrice`,
 * qui la rend dans la devise de l'établissement, et non un helper par ligne.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatPrice } from "@/lib/format";
import {
  getCustomerLoyalty,
  getCustomerLoyaltyTransactions,
  type LoyaltyTransaction,
} from "@/actions/settings.actions";

export function CustomerLoyaltyHistoryCard({
  accessToken,
  organizationId,
  customerId,
}: {
  accessToken: string | undefined;
  organizationId: string;
  customerId: string;
}) {
  const [lignes, setLignes] = useState<LoyaltyTransaction[]>([]);
  const [charge, setCharge] = useState(true);
  const [echec, setEchec] = useState(false);

  const charger = useCallback(async () => {
    if (!accessToken) return;
    try {
      setCharge(true);
      setEchec(false);
      // Le registre pend à la FICHE de fidélité, pas au client : il faut donc
      // d'abord la retrouver. Un client sans fiche n'a jamais rien gagné.
      const fiche = await getCustomerLoyalty(accessToken, organizationId, customerId);
      if (!fiche.success || !fiche.data) {
        setLignes([]);
        return;
      }
      const r = await getCustomerLoyaltyTransactions(
        accessToken,
        organizationId,
        fiche.data.id
      );
      if (r.success && r.data) {
        setLignes(r.data);
      } else {
        // ⚠ UNE LISTE VIDE SE LIRAIT « IL N'A RIEN GAGNÉ », ce qui est faux
        //   quand on n'a rien pu mesurer. L'échec se dit.
        setLignes([]);
        setEchec(true);
      }
    } catch {
      setLignes([]);
      setEchec(true);
    } finally {
      setCharge(false);
    }
  }, [accessToken, organizationId, customerId]);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
          Mouvements de la cagnotte
        </CardTitle>
      </CardHeader>
      <CardContent>
        {charge ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : echec ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">
              Le registre de la cagnotte n&apos;a pas pu être chargé.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Ce n&apos;est pas « aucun mouvement » : réessayez dans un instant.
            </p>
          </div>
        ) : lignes.length === 0 ? (
          <div className="py-8 text-center">
            <Star className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-500">Aucun mouvement de cagnotte</p>
            <p className="mt-1 text-xs text-gray-400">
              Les gains et les emplois apparaîtront ici
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {lignes.map((txn) => (
              <div
                key={txn.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {txn.transaction_type_display}
                    {txn.sale_reference && (
                      <span className="ml-2 text-xs text-gray-400">
                        {txn.sale_reference}
                      </span>
                    )}
                  </p>
                  {txn.description && (
                    <p className="truncate text-xs text-gray-400">
                      {txn.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {formatDateTime(txn.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${
                      Number(txn.amount) >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {Number(txn.amount) >= 0 ? "+" : ""}
                    {formatPrice(txn.amount)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Cagnotte : {formatPrice(txn.balance_after)}
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
