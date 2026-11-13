"use client";

import { useEffect, useMemo, useState } from "react";

import { getRegister, type Register } from "@/actions/sales.actions";

/**
 * La caisse dont le ticket porte l'en-tête et le pied.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ L'EN-TÊTE D'UNE CAISSE ÉTAIT RÉGLABLE ET JAMAIS IMPRIMÉ.                 │
 * │                                                                          │
 * │ `Register.receipt_header` et `receipt_footer` se règlent au back-office, │
 * │ et `buildChrome` sait les faire primer sur ceux de l'établissement -     │
 * │ mais aucun écran ne passait la caisse à `useReceiptChrome`. Un marchand  │
 * │ qui écrivait « Boutique du marché central » sur sa seconde caisse        │
 * │ voyait ses tickets sortir avec l'adresse du siège, sans qu'aucune erreur │
 * │ ne le dise.                                                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LA CAISSE N'EST RENDUE QUE SI ELLE EST CELLE DEMANDÉE. Changer de session
 *   ne remet pas l'état à zéro par un `setState` dans l'effet (le lint le
 *   refuse, et à raison) : on compare l'identifiant au rendu. Sans cette garde,
 *   le premier ticket d'une nouvelle caisse sortirait avec l'en-tête de
 *   l'ancienne, le temps que la réponse arrive.
 *
 * ⚠ UN ÉCHEC DE LECTURE N'EMPÊCHE PAS D'IMPRIMER : le ticket sort alors avec
 *   l'en-tête de l'établissement, ce qui vaut mieux que pas de ticket.
 */
export function useCaisseDuTicket(
  accessToken: string | undefined,
  organizationId: string | undefined,
  registerId: string | null | undefined
): Pick<Register, "receipt_header" | "receipt_footer"> | null {
  const [caisse, setCaisse] = useState<Register | null>(null);

  useEffect(() => {
    if (!accessToken || !organizationId || !registerId) return;
    let annule = false;
    getRegister(accessToken, organizationId, registerId).then((r) => {
      if (!annule && r.success && r.data) setCaisse(r.data);
    });
    return () => {
      annule = true;
    };
  }, [accessToken, organizationId, registerId]);

  // Mémoïsé : `useReceiptChrome` le compte parmi ses dépendances, et un objet
  // neuf à chaque rendu reconstruirait le chrome à chaque frappe.
  return useMemo(() => {
    if (!caisse || !registerId || caisse.id !== registerId) return null;
    return { receipt_header: caisse.receipt_header, receipt_footer: caisse.receipt_footer };
  }, [caisse, registerId]);
}
