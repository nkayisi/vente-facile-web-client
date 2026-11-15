/**
 * Les verrous d'inventaire qui pèsent sur le comptoir : identifiant d'article
 * vers la référence de la session qui le bloque.
 *
 * Module PUR : il traduit la réponse de `inventory-sessions/locked-products/`
 * en la carte que `motifsEncaissement` du noyau attend.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN VERROU NE VAUT QUE DANS L'ENTREPÔT DE LA CAISSE.                     │
 * │                                                                          │
 * │ Le serveur refuse une vente sur un article verrouillé DANS L'ENTREPÔT DE │
 * │ LA VENTE, jamais ailleurs : le même article se vend librement à la       │
 * │ boutique pendant qu'on compte la réserve. Fermer « Encaisser » pour un   │
 * │ inventaire d'un autre dépôt serait un refus que le serveur n'oppose pas. │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ La requête porte `?warehouse=` : un serveur qui l'honore ne rend que les
 * verrous de la caisse. Un serveur antérieur l'ignore et rend ceux de tous les
 * entrepôts LISIBLES ; on écarte alors ce qu'on peut écarter sans deviner, par
 * le nom d'entrepôt des sessions actives. Quand des sessions de plusieurs
 * dépôts coexistent, la réponse ne dit pas quel article relève de laquelle :
 * on garde tout, c'est-à-dire le côté strict, et la référence reste vide.
 */

export interface SessionVerrouillante {
  reference?: string | null;
  warehouse__name?: string | null;
}

export interface ReponseVerrous {
  locked_product_ids: string[];
  active_sessions: SessionVerrouillante[];
}

export function verrousDeLaCaisse(
  reponse: ReponseVerrous | null | undefined,
  entrepotDeLaCaisse: string | null | undefined
): Map<string, string> {
  const verrous = new Map<string, string>();
  if (!reponse || reponse.locked_product_ids.length === 0) return verrous;

  const sessions = reponse.active_sessions ?? [];
  const ici = entrepotDeLaCaisse
    ? sessions.filter((s) => s.warehouse__name === entrepotDeLaCaisse)
    : sessions;

  // Des sessions sont actives, aucune dans l'entrepôt de la caisse : les
  // articles bloqués le sont ailleurs, rien ne ferme ce comptoir.
  if (entrepotDeLaCaisse && sessions.length > 0 && ici.length === 0) return verrous;

  const reference = ici.length === 1 ? ici[0].reference ?? "" : "";
  for (const id of reponse.locked_product_ids) verrous.set(id, reference);
  return verrous;
}
