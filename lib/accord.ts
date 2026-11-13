/**
 * Accorder un mot à son nombre. PUR, sans dépendance.
 *
 * « 3 produit(s) importé(s) » n'est pas une phrase : le nombre est CONNU au
 * moment de l'écrire, et le raccourci laisse le reste sans accord.
 * `lib/accord.test.ts` refuse désormais ce raccourci dans tout libellé.
 *
 * ⚠ Singulier sous DEUX, comme `pluralizeUnit` du noyau et `data/accord.ts`
 *   du terminal : « 0 produit », « 1,5 unité », « 2 produits ».
 */

/** « 1 produit », « 3 produits ». */
export function pluriel(n: number, singulier: string, plur: string): string {
  return `${n} ${accord(n, singulier, plur)}`;
}

/** Le mot seul, accordé : pour un adjectif, un verbe ou un pronom qui suit. */
export function accord(n: number, singulier: string, plur: string): string {
  return Math.abs(n) >= 2 ? plur : singulier;
}
