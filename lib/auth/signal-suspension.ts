/**
 * Lire un refus de suspension et le signal qui en naît, sans dépendance.
 *
 * Module PUR, importable des deux côtés : l'intercepteur serveur y lit le
 * refus, `OrganizationChecker` (composant client) y lit le signal. Les
 * fonctions qui touchent aux cookies vivent à part, dans `lib/auth/suspension.ts`,
 * parce que `next/headers` n'a rien à faire dans un composant client.
 */

import { corpsLisible } from "./corps-du-refus";

const CODE_SUSPENDU = "organization_suspended";

/** L'établissement suspendu que désigne ce refus, ou `null` si ce n'est pas une suspension. */
export function suspensionDuRefus(corps: unknown): { organisation: string | null } | null {
  const objet = corpsLisible(corps);
  if (objet?.code !== CODE_SUSPENDU) return null;
  const id = objet.organization;
  return { organisation: typeof id === "string" && id ? id : null };
}

/**
 * L'établissement que désigne un signal `<établissement>.<horodatage>`, ou `null`.
 *
 * ⚠ L'identifiant est un UUID, qui ne contient aucun point : le DERNIER point
 * sépare donc toujours l'horodatage.
 */
export function organisationDuSignal(signal: string | null | undefined): string | null {
  if (!signal) return null;
  const point = signal.lastIndexOf(".");
  return (point > 0 ? signal.slice(0, point) : signal) || null;
}
