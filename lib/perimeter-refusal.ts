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
import { codeDuCorps } from "@/lib/api/drf-error";

export interface ReponseRefusable {
  success: boolean;
  message?: string;
  /** Le code nommé du refus, quand la server action l'a relevé. */
  code?: string;
  errors?: Record<string, string[]> | Record<string, unknown>;
}

/**
 * Les refus qui disent que NOS DROITS SONT PÉRIMÉS.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN REFUS DE PÉRIMÈTRE EST UNE NOUVELLE, PAS SEULEMENT UNE ERREUR.       │
 * │                                                                          │
 * │ « Consultation seule », « entrepôt désactivé », « stock insuffisant » :  │
 * │ l'écran proposait un geste que le serveur refuse, donc ce que l'écran    │
 * │ sait du périmètre (ou du stock) a vieilli. Le propriétaire vient de      │
 * │ retirer une affectation, de désactiver un entrepôt, ou un collègue a     │
 * │ vendu le dernier article. On relit les droits pour que l'écran cesse de  │
 * │ proposer ce qu'il ne peut pas tenir.                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export const CODES_QUI_RELISENT_LES_DROITS: ReadonlySet<string> = new Set([
  "consultation_seule",
  "entrepot_inactif",
  "stock_insuffisant",
]);

/** Le code nommé d'un refus, qu'il voyage seul ou dans le corps d'erreur. */
export function codeDeRefus(reponse: Pick<ReponseRefusable, "success" | "code" | "errors">): string | undefined {
  if (reponse.success) return undefined;
  return reponse.code ?? codeDuCorps(reponse.errors);
}

/** Faut-il relire ses droits après cette réponse ? */
export function doitRelireLesDroits(
  reponse: Pick<ReponseRefusable, "success" | "code" | "errors">,
): boolean {
  const code = codeDeRefus(reponse);
  return code !== undefined && CODES_QUI_RELISENT_LES_DROITS.has(code);
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
  const premier = (cle: string): string | undefined => {
    const v = (reponse.errors as Record<string, unknown> | undefined)?.[cle];
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
    return typeof v === "string" ? v : undefined;
  };
  const champ = premier("warehouse") ?? premier("user");
  return (
    champ ??
    reponse.message ??
    "Ce filtre n'est pas dans votre périmètre. Choisissez-en un autre."
  );
}
