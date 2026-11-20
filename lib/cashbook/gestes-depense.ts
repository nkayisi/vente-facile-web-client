/**
 * Ce qu'un membre peut faire d'une dépense, selon son statut et qui l'a saisie.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LE SERVEUR TRANCHE, L'ÉCRAN NE PROPOSE QUE CE QU'IL ACCEPTERA.           │
 * │                                                                          │
 * │ Les règles vivent dans `cashbook/services.py` : un bouton proposé puis   │
 * │ refusé enverrait le marchand chercher un défaut là où il n'y a qu'un     │
 * │ geste qui n'est pas le sien. Copie tenue à la main de                    │
 * │ `mobile/vf-marchand/src/data/gestes-depense.ts`, éprouvée sur les MÊMES  │
 * │ cas.                                                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * - **approuver / rejeter** : propriétaire ou gérant, JAMAIS sur sa propre
 *   dépense (sauf le propriétaire, qui n'a personne au-dessus de lui) ;
 * - **payer** une dépense approuvée : son auteur, ou qui peut approuver.
 *   C'est au paiement que l'argent sort du tiroir ;
 * - **payer directement** un brouillon ou une dépense en attente : vaut une
 *   approbation, donc mêmes règles qu'approuver ;
 * - une dépense **rejetée** ne se paie jamais.
 */

export type StatutDepense = "draft" | "pending" | "approved" | "paid" | "rejected" | "cancelled";

export type GesteDepense = "submit" | "approve" | "reject" | "pay" | "pay_direct" | "cancel";

export interface DroitsDepense {
  /** `cashbook.create_expense` */
  peutCreer: boolean;
  /** `cashbook.approve_expense` */
  peutApprouver: boolean;
  /** `cashbook.pay_expense` */
  peutPayer: boolean;
  /** Le propriétaire approuve aussi ses propres dépenses. */
  proprietaire: boolean;
  /** L'identifiant de celui qui regarde, `null` s'il n'est pas connu. */
  moi: string | null;
}

export function gestesPossibles(
  depense: { status: StatutDepense; created_by: string | null },
  droits: DroitsDepense
): GesteDepense[] {
  const aMoi = droits.moi != null && depense.created_by === droits.moi;
  const peutTrancher = droits.peutApprouver && (droits.proprietaire || !aMoi);
  const gestes: GesteDepense[] = [];

  if (depense.status === "draft" && droits.peutCreer) gestes.push("submit");
  if (depense.status === "pending" && peutTrancher) gestes.push("approve", "reject");
  if (depense.status === "approved" && droits.peutPayer && (aMoi || droits.peutApprouver)) {
    gestes.push("pay");
  }
  if ((depense.status === "draft" || depense.status === "pending") && peutTrancher) {
    gestes.push("pay_direct");
  }
  if (depense.status !== "cancelled" && depense.status !== "rejected" && droits.peutApprouver) {
    gestes.push("cancel");
  }
  return gestes;
}
