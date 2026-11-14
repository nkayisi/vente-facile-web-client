/**
 * Une session coupée par l'administration, et le signal qui en naît.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ POURQUOI UN SIGNAL, ET POURQUOI CETTE CLÉ.                               │
 * │                                                                          │
 * │ Après une réinitialisation de mot de passe, le serveur refuse le jeton   │
 * │ d'un onglet resté ouvert (401 `session_revoked`). Mais le refus tombe    │
 * │ dans une server action, que deux cent cinquante `catch` changent en      │
 * │ `{ success: false }` : sans signal, chaque écran affichait son erreur    │
 * │ pendant trente minutes, jusqu'au rafraîchissement programmé suivant.     │
 * │                                                                          │
 * │ La CLÉ désigne la session et non un jeton : le compte, plus la marque    │
 * │ que le serveur pose dans le jeton (`srv`, `apps.users.jetons`). Un `jti` │
 * │ ne suffirait pas : le jeton qu'une page tient en mémoire n'est pas       │
 * │ toujours celui du cookie, que le serveur a pu faire tourner entre-temps. │
 * │ La rotation, elle, recopie la marque. Et la session ouverte APRÈS la     │
 * │ coupure porte une autre marque : un signal resté posé ne la déconnecte   │
 * │ pas.                                                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Module PUR, importable des deux côtés. Le cookie vit dans
 * `lib/auth/session-fermee.ts` (serveur), le geste dans `use-session-fermee.ts`.
 */
import { chargeDuJeton } from "./charge-du-jeton";
import { corpsLisible } from "./corps-du-refus";

export const CODE_SESSION_FERMEE = "session_revoked";

/** Le paramètre que la page de connexion lit pour dire pourquoi on y revient. */
export const ERREUR_SESSION_FERMEE = "SessionRevoked";

/** Ce refus est-il celui d'une session coupée ? */
export function estSessionFermee(corps: unknown): boolean {
  return corpsLisible(corps)?.code === CODE_SESSION_FERMEE;
}

/** La session que désigne ce jeton : `<compte>:<marque>`, ou `null` s'il est illisible. */
export function cleDeSession(jeton: unknown): string | null {
  const charge = chargeDuJeton(jeton);
  const compte = charge?.user_id;
  if (typeof compte !== "string" || !compte) return null;
  const marque = charge?.srv;
  return `${compte}:${typeof marque === "number" ? marque : "-"}`;
}

/** Le signal désigne-t-il la session que tient ce jeton ? */
export function signalDeCetteSession(signal: string | null | undefined, jeton: unknown): boolean {
  if (!signal) return false;
  return cleDeSession(jeton) === signal;
}
