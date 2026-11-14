/**
 * Le signal d'une session coupée, du serveur au navigateur.
 *
 * Le même pont que la suspension (`lib/auth/suspension.ts`) : quand une server
 * action pose un cookie, Next re-rend la page et ses layouts dans le même
 * aller-retour. Les layouts du tableau de bord, du paiement et de
 * l'administration le lisent, et leur coquille déconnecte la page
 * (`use-session-fermee.ts`) au lieu que chaque écran affiche son refus.
 *
 * ⚠ Serveur seulement (`next/headers`) : jamais importé par un composant client.
 */
import type { AxiosError } from "axios";
import { cookies } from "next/headers";

import { cleDeSession, estSessionFermee } from "./signal-session-fermee";

export const NOM_COOKIE_SESSION_FERMEE = "vf_session_fermee";

/**
 * Pose le signal si ce refus est celui d'une session coupée, et le dit.
 *
 * ⚠ Rend `true` même quand le cookie n'a pas pu être posé (rendu d'un composant
 * serveur, où `cookies().set` lève) : le refus reste celui d'une session coupée,
 * et réessayer avec un autre jeton ne servirait à rien, le serveur refusant
 * aussi le rafraîchissement.
 */
export async function signalerSiSessionFermee(error: AxiosError): Promise<boolean> {
  if (error.response?.status !== 401 || !estSessionFermee(error.response.data)) return false;
  const entete = error.config?.headers?.Authorization;
  const jeton = typeof entete === "string" ? entete.replace(/^Bearer\s+/i, "") : null;
  const cle = cleDeSession(jeton);
  if (cle) {
    try {
      (await cookies()).set(NOM_COOKIE_SESSION_FERMEE, cle, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
        secure: process.env.NODE_ENV === "production",
      });
    } catch {
      // Hors d'une server action : aucun moyen de prévenir le navigateur d'ici.
    }
  }
  return true;
}

/** Le signal en attente, lu par les layouts des espaces connectés. */
export async function lireSignalSessionFermee(): Promise<string | null> {
  return (await cookies()).get(NOM_COOKIE_SESSION_FERMEE)?.value ?? null;
}
