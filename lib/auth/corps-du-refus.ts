/**
 * Le corps d'un refus de l'API sous forme d'objet, qu'il le soit déjà ou qu'il
 * arrive en octets.
 *
 * ⚠ Les exports demandent `responseType: "arraybuffer"` : un refus y arrive en
 * octets, et son `code` ne se lit qu'une fois décodé.
 *
 * Module PUR, importable des deux côtés.
 */
export function corpsLisible(corps: unknown): Record<string, unknown> | null {
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
