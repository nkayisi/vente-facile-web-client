/**
 * Les `code` qu'un refus de connexion porte de `authorize` jusqu'à la page.
 *
 * Module sans dépendance : la page de connexion est un composant CLIENT, et
 * importer ces valeurs depuis `lib/auth/config.ts` y tirerait la configuration
 * serveur de NextAuth.
 *
 * ⚠ Le `code` voyage dans l'URL : il ne nomme jamais la cause précise.
 */

/** Le verrou de connexion : `verrouillee_<minutes>`, seul ce nombre voyage. */
export const PREFIXE_VERROU = "verrouillee_";

/** Les minutes d'attente portées par un code de verrou, ou `null`. */
export function minutesDuVerrou(code: string | null | undefined): number | null {
  if (!code?.startsWith(PREFIXE_VERROU)) return null;
  const minutes = Number(code.slice(PREFIXE_VERROU.length));
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

/** Tous les établissements du compte sont suspendus par Vente Facile. */
export const CODE_SUSPENDU = "etablissement_suspendu";

/** La phrase du serveur, reprise mot pour mot : le support la reconnaît. */
export const PHRASE_SUSPENDU = "Cet établissement est suspendu par Vente Facile. Contactez le support.";
