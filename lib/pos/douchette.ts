/**
 * Reconnaître une douchette (lecteur de codes-barres) dans le flux du clavier.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UNE DOUCHETTE EST UN CLAVIER QUI TAPE TRÈS VITE, PUIS ENTRÉE.            │
 * │                                                                          │
 * │ Branchée en USB ou en Bluetooth, elle « tape » le code lu caractère par  │
 * │ caractère, à quelques millisecondes d'intervalle, et finit par Entrée.   │
 * │ Personne ne tape quatre caractères à moins de quarante millisecondes     │
 * │ l'un de l'autre : c'est ce qui sépare un scan d'une frappe, sans rien    │
 * │ demander au vendeur ni lui imposer de cliquer dans un champ.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Module PUR : l'instant de chaque touche est INJECTÉ, pour que la règle
 * s'éprouve sans navigateur ni horloge.
 */

/** L'écart maximal entre deux caractères d'un même scan. */
export const ECART_MAX_MS = 40;
/** Le délai toléré entre le dernier caractère et Entrée. */
export const ECART_ENTREE_MAX_MS = 120;
/** En deçà, c'est trop court pour un code-barres. */
export const LONGUEUR_MIN = 4;

export interface EtatDouchette {
  /** Les caractères de la rafale en cours, tous tapés à moins d'`ECART_MAX_MS`. */
  tampon: string;
  /** L'instant de la dernière touche, `null` avant la première. */
  dernier: number | null;
}

export const DOUCHETTE_AU_REPOS: EtatDouchette = { tampon: "", dernier: null };

/**
 * Une touche de plus. Rend le nouvel état, et le code lu quand la rafale se
 * termine par Entrée.
 *
 * `touche` est `KeyboardEvent.key` : un caractère imprimable fait une seule
 * lettre, Entrée s'écrit « Enter ». Toute autre touche (Maj, flèches) est
 * ignorée sans rompre la rafale : une douchette en azerty envoie Maj pour
 * chaque chiffre.
 */
export function frapper(
  etat: EtatDouchette,
  touche: string,
  instant: number
): { etat: EtatDouchette; code: string | null } {
  const ecart = etat.dernier == null ? Infinity : instant - etat.dernier;

  if (touche === "Enter") {
    const code =
      etat.tampon.length >= LONGUEUR_MIN && ecart <= ECART_ENTREE_MAX_MS ? etat.tampon : null;
    return { etat: DOUCHETTE_AU_REPOS, code };
  }

  if (touche.length !== 1) return { etat, code: null };

  // Trop lent : une frappe humaine. La rafale repart de cette touche.
  const tampon = ecart <= ECART_MAX_MS ? etat.tampon + touche : touche;
  return { etat: { tampon, dernier: instant }, code: null };
}

/**
 * Les codes à essayer, dans l'ordre, pour un scan tapé dans la recherche.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN SCAN TRONQUÉ EN TÊTE NE DOIT PAS PROPOSER UN MAUVAIS ARTICLE.         │
 * │                                                                          │
 * │ Si le tout premier caractère arrive un peu tard (lecteur Bluetooth,      │
 * │ poste chargé), la rafale repart du deuxième : « 87687GJHGD » se lit     │
 * │ « 7687GJHGD ». Introuvable, il proposerait de CRÉER un article sous un   │
 * │ code faux. Tapé dans la recherche, le champ porte pourtant le code      │
 * │ entier : il devient le second candidat, essayé si le premier ne trouve  │
 * │ rien. Hors de la recherche il n'y a pas de champ, donc rien à rattraper. │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export function candidatsDuScan(code: string, valeurDuChamp: string | null): string[] {
  const complet = (valeurDuChamp ?? "").trim();
  if (complet && complet !== code && complet.endsWith(code)) return [code, complet];
  return [code];
}
