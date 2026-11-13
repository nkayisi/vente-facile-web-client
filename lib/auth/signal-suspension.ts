/**
 * Lire un refus de suspension et le signal qui en naît, sans dépendance.
 *
 * Module PUR, importable des deux côtés : l'intercepteur serveur y lit le
 * refus, `OrganizationChecker` (composant client) y lit le signal. Les
 * fonctions qui touchent aux cookies vivent à part, dans `lib/auth/suspension.ts`,
 * parce que `next/headers` n'a rien à faire dans un composant client.
 */

const CODE_SUSPENDU = "organization_suspended";

/**
 * Le corps d'un refus sous forme d'objet, qu'il le soit déjà ou qu'il arrive en octets.
 *
 * ⚠ Les exports demandent `responseType: "arraybuffer"` : un refus y arrive en
 * octets, et son `code` ne se lit qu'une fois décodé.
 */
function corpsLisible(corps: unknown): Record<string, unknown> | null {
  let objet: unknown = corps;
  if (corps instanceof ArrayBuffer || ArrayBuffer.isView(corps)) {
    try {
      objet = JSON.parse(new TextDecoder().decode(corps as ArrayBuffer | ArrayBufferView));
    } catch {
      return null;
    }
  }
  return objet && typeof objet === "object" ? (objet as Record<string, unknown>) : null;
}

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
