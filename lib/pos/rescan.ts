/**
 * Un scan de douchette pendant que la saisie de quantité est ouverte.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LE CODE-BARRES S'ÉCRIVAIT DANS LE CHAMP QUANTITÉ, PUIS ENTRÉE VALIDAIT.  │
 * │                                                                          │
 * │ La douchette « tape » : re-scanner l'article pendant que sa quantité est │
 * │ ouverte écrivait 600123456789 dans le champ, et l'Entrée de la rafale    │
 * │ ajoutait cette quantité au panier. Le scan est désormais reconnu dans le │
 * │ champ même : la saisie est rétablie telle qu'avant la rafale, le même    │
 * │ article ajoute 1 (scanner deux fois donne 2), un autre est refusé.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Les caractères de la rafale atteignent le champ avant qu'on sache que c'est
 * un scan : on mémorise donc l'état de la saisie avant la rafale, et on le
 * rend au code lu. « Avant la rafale », c'est la dernière touche venue après
 * une pause plus longue que ce qu'une douchette tolère entre son dernier
 * caractère et Entrée : un premier caractère lu en retard (scan tronqué en
 * tête) ne déplace donc pas ce point de reprise.
 *
 * Module PUR : l'instant de chaque touche est injecté.
 */
import {
  candidatsDuScan,
  DOUCHETTE_AU_REPOS,
  ECART_ENTREE_MAX_MS,
  frapper,
  type EtatDouchette,
} from "./douchette";

export interface EtatRescan<T> {
  douchette: EtatDouchette;
  /** L'état de la saisie avant la rafale en cours, `null` au repos. */
  avant: T | null;
  /** Tout ce qui a été tapé depuis `avant`, pour un scan tronqué en tête. */
  brut: string;
  dernier: number | null;
}

export function rescanAuRepos<T>(): EtatRescan<T> {
  return { douchette: DOUCHETTE_AU_REPOS, avant: null, brut: "", dernier: null };
}

export interface ScanDansLaSaisie<T> {
  /** Les codes à essayer, dans l'ordre (`candidatsDuScan`). */
  candidats: string[];
  /** La saisie à rétablir : celle d'avant la rafale. */
  avant: T;
}

/**
 * Une touche dans le champ quantité. `courant` est l'état de la saisie AVANT
 * cette touche (un `keydown` précède la frappe).
 */
export function frapperDansLaSaisie<T>(
  etat: EtatRescan<T>,
  touche: string,
  instant: number,
  courant: T
): { etat: EtatRescan<T>; scan: ScanDansLaSaisie<T> | null } {
  const r = frapper(etat.douchette, touche, instant);

  if (touche === "Enter") {
    const scan =
      r.code && etat.avant !== null
        ? { candidats: candidatsDuScan(r.code, etat.brut), avant: etat.avant }
        : null;
    return { etat: rescanAuRepos<T>(), scan };
  }

  if (touche.length !== 1) return { etat: { ...etat, douchette: r.etat }, scan: null };

  const pause = etat.dernier == null || instant - etat.dernier > ECART_ENTREE_MAX_MS;
  return {
    etat: {
      douchette: r.etat,
      avant: pause ? courant : etat.avant,
      brut: (pause ? "" : etat.brut) + touche,
      dernier: instant,
    },
    scan: null,
  };
}

/** Le code lu désigne-t-il cet article (code-barres ou SKU, casse ignorée) ? */
export function estLeMemeArticle(
  candidats: string[],
  article: { barcode?: string | null; sku?: string | null }
): boolean {
  const codes = [article.barcode, article.sku]
    .map((c) => (c ?? "").trim().toLowerCase())
    .filter(Boolean);
  return candidats.some((c) => codes.includes(c.trim().toLowerCase()));
}
