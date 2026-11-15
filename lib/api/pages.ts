/**
 * Lire une liste paginée JUSQU'AU BOUT.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UNE LISTE QUI S'ARRÊTE À LA PREMIÈRE PAGE CACHE CE QUI SUIT.            │
 * │                                                                          │
 * │ `getWarehouses` ne gardait que la page 1 (vingt entrepôts) : au-delà, un │
 * │ entrepôt existant n'apparaissait nulle part, ni dans la page Stock, ni   │
 * │ dans l'affectation d'un membre, et on le croyait perdu.                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ ON INCRÉMENTE LE NUMÉRO DE PAGE, ON NE SUIT PAS L'URL `next`. DRF compose
 * `next` sur l'hôte de la requête : derrière un mandataire, il peut désigner un
 * hôte ou un schéma que la server action ne sait pas joindre. `next` ne sert
 * qu'à savoir s'il en reste.
 *
 * ⚠ LA BORNE EST UNE GARDE DE BOUCLE, PAS UNE TAILLE ATTENDUE : un serveur qui
 * annoncerait toujours une page suivante ne doit pas faire tourner la server
 * action indéfiniment.
 */

/** Ce qu'une page rend : une liste nue (réponse non paginée) ou une enveloppe DRF. */
export type PageServeur<T> = T[] | { results?: T[]; next?: string | null };

export async function lireToutesLesPages<T>(
  lirePage: (page: number) => Promise<PageServeur<T>>,
  options: { pagesMax: number; unePage?: boolean },
): Promise<T[]> {
  const tout: T[] = [];
  for (let page = 1; page <= options.pagesMax; page++) {
    const reponse = await lirePage(page);
    // Une réponse non paginée porte déjà tout.
    if (Array.isArray(reponse)) return [...tout, ...reponse];
    tout.push(...(reponse.results ?? []));
    if (options.unePage || !reponse.next) break;
  }
  return tout;
}
