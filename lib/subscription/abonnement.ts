import type { Subscription, SubscriptionStatus } from "@/actions/subscription.actions";

/**
 * L'abonnement COMPLET, ou `null` s'il n'y en a pas ou si le lecteur n'en
 * reçoit que le résumé (il n'a pas `subscription.view`).
 *
 * Les écrans qui lisent le prix, l'échéance ou le cycle (la page Abonnement, le
 * paiement) sont réservés à ce droit : ils reçoivent toujours le détail. Ce
 * garde le dit au compilateur, qui ne connaît que l'union, au lieu d'un `as`
 * qui affirmerait la même chose sans la vérifier.
 */
export function abonnementComplet(
  statut: SubscriptionStatus | null | undefined,
): Subscription | null {
  const abonnement = statut?.subscription;
  return abonnement && "current_period_end" in abonnement ? abonnement : null;
}
