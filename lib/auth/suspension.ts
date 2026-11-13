/**
 * Le signal d'un établissement suspendu, du serveur au navigateur.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN SEUL ENDROIT VOIT LE REFUS, ET IL N'A PAS DE NAVIGATEUR.              │
 * │                                                                          │
 * │ Tous les appels du marchand passent par `serverAxios`, mais dans une     │
 * │ server action, et les quelque deux cent cinquante blocs `catch` des      │
 * │ actions changent l'erreur en `{ success: false }`. Chaque écran recevait │
 * │ donc son propre 403, jusqu'au rechargement suivant des établissements.   │
 * │                                                                          │
 * │ Le pont est un COOKIE : quand une server action en pose un, Next 16      │
 * │ re-rend la page et ses layouts côté serveur dans le même aller-retour,   │
 * │ sans démonter le client. Le layout du tableau de bord le lit et le passe │
 * │ à `OrganizationChecker`, qui bascule tout le tableau de bord sur l'écran │
 * │ de suspension. Ni sondage, ni `catch` à modifier.                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ `redirect()` ne pouvait pas servir : levé dans l'intercepteur, il serait
 * avalé par ces mêmes `catch`.
 *
 * ⚠ Serveur seulement (`next/headers`) : jamais importé par un composant client.
 * La lecture pure du refus et du signal vit dans `lib/auth/signal-suspension.ts`.
 */
import { cookies } from "next/headers";

export const NOM_COOKIE_SUSPENSION = "vf_etablissement_suspendu";

/**
 * Pose le signal. `<établissement>.<horodatage>` : l'horodatage fait d'une
 * seconde suspension du même établissement un NOUVEAU signal.
 *
 * ⚠ `cookies().set` lève hors d'une server action (rendu d'un composant
 * serveur, gestionnaire de route) : on n'y peut rien signaler, et l'écran
 * garde alors son comportement actuel plutôt que de planter.
 */
export async function signalerSuspension(organisationId: string): Promise<void> {
  try {
    (await cookies()).set(NOM_COOKIE_SUSPENSION, `${organisationId}.${Date.now()}`, {
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

/** Le signal en attente, lu par les layouts qui montent `OrganizationChecker`. */
export async function lireSignalSuspension(): Promise<string | null> {
  return (await cookies()).get(NOM_COOKIE_SUSPENSION)?.value ?? null;
}
