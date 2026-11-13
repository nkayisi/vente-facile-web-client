/**
 * Ce que l'opérateur a répondu sur UN paiement, dit en une phrase.
 *
 * Partagé par les incidents et la page des paiements : deux écrans qui
 * résument différemment la même réponse font douter qu'il s'agisse de la même.
 */
import type { ReconcileReport } from "@/actions/admin.actions";

export function resumerReconciliation(r: ReconcileReport): string {
  if (r.reconciled) return "Encaissé : l'abonnement a été activé.";
  if (r.really_failed) return `Échec confirmé par l'opérateur (${r.details.really_failed[0]?.detail ?? ""}).`;
  if (r.still_pending) return "Toujours en attente chez l'opérateur : le client n'a peut-être pas validé.";
  if (r.unresolved) return `Non résolu : ${r.details.unresolved[0]?.detail ?? "réponse inattendue"}.`;
  return "Rien à réconcilier pour cette référence.";
}
