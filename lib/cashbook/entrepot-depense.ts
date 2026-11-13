/**
 * Quel entrepôt une dépense saisie au back-office doit porter.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UNE DÉPENSE SANS ENTREPÔT EST INVISIBLE À SON PROPRE AUTEUR.            │
 * │                                                                          │
 * │ `ExpenseViewSet` borne un gérant ou un magasinier à SES entrepôts, sans  │
 * │ les lignes qui n'en portent aucun - délibérément : loyer et salaires     │
 * │ restent au propriétaire. Or la boîte « Nouvelle dépense » n'envoyait     │
 * │ jamais d'entrepôt : le gérant qui saisissait une dépense la perdait de   │
 * │ vue à la seconde où elle partait, et la ressaisissait.                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Miroir de `mobile/vf-marchand/src/features/caisse/perimetre.ts` : deux
 * surfaces qui rattachent la même pièce à deux dépôts différents font douter
 * qu'il s'agisse de la même règle. ⚠ Copie tenue à la main tant que le
 * back-office n'a pas de lanceur de tests et que la règle ne vit pas dans
 * `@vente-facile/core` : les cas de référence sont ceux du terminal.
 *
 * ⚠ LE DÉFAUT SE PREND DANS LES ENTREPÔTS ACCESSIBLES, JAMAIS DANS TOUTE LA
 *   TABLE : `create_expense` refuse un entrepôt hors périmètre, et proposer
 *   l'entrepôt principal à un gérant affecté ailleurs ferait refuser chacune de
 *   ses dépenses.
 */

export interface EntrepotDeDepense {
  id: string;
  name: string;
  is_default?: boolean;
}

/** Les rôles que le serveur borne par entrepôt, sans les dépenses « sans dépôt ». */
export const ROLES_BORNES_PAR_ENTREPOT = ["manager", "stock_keeper"] as const;

/**
 * L'entrepôt est-il OBLIGATOIRE pour ce rôle ? Seuls les rôles bornés par
 * entrepôt perdraient de vue une dépense sans dépôt ; le caissier est borné par
 * AUTEUR, et le propriétaire voit tout.
 */
export function entrepotExige(role: string | null | undefined): boolean {
  return (ROLES_BORNES_PAR_ENTREPOT as readonly string[]).includes(role ?? "");
}

/**
 * L'entrepôt à proposer d'emblée : le principal, sinon l'unique.
 *
 * Rend `null` entre plusieurs dépôts sans principal : deviner rattacherait la
 * dépense au mauvais établissement, et le marchand ne s'en apercevrait qu'en
 * cherchant une pièce qu'il ne retrouve pas.
 */
export function entrepotParDefaut(accessibles: EntrepotDeDepense[]): string | null {
  const principal = accessibles.find((e) => e.is_default);
  if (principal) return principal.id;
  return accessibles.length === 1 ? accessibles[0].id : null;
}

/** Seul le propriétaire peut ne rattacher aucun dépôt : c'est une charge d'établissement. */
export function peutNeRattacherAucunDepot(role: string | null | undefined): boolean {
  return role === "owner";
}

/** Envoyée ainsi, la dépense échapperait à la vue de son auteur. */
export function depenseSeraitInvisible(
  role: string | null | undefined,
  entrepot: string | null | undefined
): boolean {
  return !entrepot && entrepotExige(role);
}

/** Un rôle borné sans aucune affectation : le formulaire le dit au lieu d'enregistrer. */
export function saisieSansIssue(
  role: string | null | undefined,
  accessibles: EntrepotDeDepense[]
): boolean {
  return entrepotExige(role) && accessibles.length === 0;
}
