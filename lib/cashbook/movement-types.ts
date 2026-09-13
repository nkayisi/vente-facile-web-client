/**
 * Les douze types de mouvement de caisse, et leur libellé.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA TABLE EXISTAIT EN DEUX COPIES, ET ELLES AVAIENT DÉJÀ DIVERGÉ.        │
 * │                                                                          │
 * │ `cashbook/page.tsx` et `cashbook/reports/page.tsx` en portaient chacune  │
 * │ une. Les deux OMETTAIENT `change` (« Monnaie rendue »), pourtant déclaré │
 * │ par `CashMovement.MovementType` depuis toujours, et écrivaient           │
 * │ « Ajustement » là où le serveur dit « Ajustement de caisse ».            │
 * │                                                                          │
 * │ Le repli `|| m.movement_type_display` masquait l'omission sur la liste   │
 * │ (le serveur renvoie son propre libellé), mais pas sur le résumé par type │
 * │ du rapport, dont le repli est `|| item.movement_type` : un rendu de      │
 * │ monnaie y sortait sous son CODE TECHNIQUE, au milieu de libellés         │
 * │ français.                                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ Ce fichier n'est PAS dans `actions/` : un module `"use server"` ne peut
 * exporter que des fonctions asynchrones, et un objet y casse tout le tableau
 * de bord au chargement - sans que l'erreur désigne le fichier fautif. C'est
 * le défaut qu'`AGING_BUCKET_LABELS` a coûté.
 *
 * Régénérer par :
 *   sed -n '/class MovementType/,/^$/p' backend/apps/cashbook/models.py
 */
export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  sale: "Vente",
  sale_return: "Remboursement client",
  expense: "Dépense",
  purchase: "Achat fournisseur",
  supplier_refund: "Remboursement fournisseur",
  debt_collection: "Recouvrement dette",
  fund_in: "Apport de fonds",
  fund_out: "Retrait de fonds",
  adjustment: "Ajustement de caisse",
  change: "Monnaie rendue",
  other_in: "Autre entrée",
  other_out: "Autre sortie",
};

/**
 * Le libellé d'un type, ou le code s'il est inconnu.
 *
 * Le repli rend le CODE et non « Inconnu » : un code affiché se cherche dans
 * le dépôt, un « Inconnu » ne mène nulle part.
 */
export function movementTypeLabel(code: string, fallback?: string): string {
  return MOVEMENT_TYPE_LABELS[code] || fallback || code;
}
