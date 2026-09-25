/**
 * Ce qu'on dit quand le serveur REFUSE un périmètre.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN CHARGEMENT QUI ÉCHOUE NE DOIT PAS LAISSER LA LISTE PRÉCÉDENTE.       │
 * │                                                                          │
 * │ Les pages font `if (res.success && res.data) { … }` sans `else` : un     │
 * │ refus laissait donc les lignes d'avant sous les NOUVELLES puces -        │
 * │ « Entrepôt B » au-dessus des chiffres de A, le défaut exact que ce       │
 * │ chantier ferme.                                                          │
 * │                                                                          │
 * │ Le serveur refuse désormais un `warehouse`/`user` hors périmètre au lieu │
 * │ de rendre vide (c'est la doctrine de `warehouse_scope` : zéro ligne se   │
 * │ lit « il n'y a rien » là où la vérité est « vous n'y avez pas accès »).  │
 * │ Traiter ce refus fait donc partie du même geste.                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ Le cas est RARE depuis que le sélecteur ne propose que des valeurs
 * recevables : il reste atteignable par un roster daté ou une URL forgée.
 * C'est précisément pourquoi il doit se DIRE plutôt que de se deviner.
 */
export interface ReponseRefusable {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

/**
 * Le message à montrer, ou `null` quand la réponse n'est pas un refus.
 *
 * On préfère le message de CHAMP du serveur : il nomme ce qui est refusé
 * (« Utilisateur hors de votre périmètre »), là où un message générique
 * enverrait chercher une panne de réseau.
 */
export function messageDeRefus(reponse: ReponseRefusable): string | null {
  if (reponse.success) return null;
  const champ = reponse.errors?.warehouse?.[0] ?? reponse.errors?.user?.[0];
  return (
    champ ??
    reponse.message ??
    "Ce filtre n'est pas dans votre périmètre. Choisissez-en un autre."
  );
}
