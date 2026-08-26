/**
 * Modèle déclaratif du ticket.
 *
 * Un document ne se dessine plus : il se décrit. C'est ce qui met fin à la
 * duplication structurelle de l'ancien générateur, où chaque document existait
 * en double (une fonction qui traçait, une fonction miroir qui rejouait les
 * mêmes conditions pour estimer la hauteur en millimètres). Il fallait corriger
 * deux fois, sinon le PDF finissait par une bande blanche ou tronquait sa
 * dernière ligne.
 *
 * Ici, `render-pdf.ts` parcourt cette liste UNE fois : il en tire à la fois la
 * hauteur et les primitives de tracé. Mesure et rendu ne peuvent plus diverger.
 */

import type { FontRole, RuleWeight, SpaceSize } from "./tokens";

/** Ligne clé / valeur. */
export interface KvRow {
  label: string;
  value: string;
  /** Met la valeur en gras : réservé à la ligne qui porte le sens du bloc. */
  strong?: boolean;
}

/** Ligne de montant : la valeur est un montant déjà formaté. */
export interface AmountRow {
  label: string;
  value: string;
  strong?: boolean;
}

export interface ItemRow {
  name: string;
  /** Quantité brute, telle qu'elle tient dans la colonne. */
  quantity: string;
  unitPrice: string;
  total: string;
  /**
   * Conditionnement lisible par le client : « 2 cartons + 3 bouteilles ».
   * La colonne quantité est trop étroite pour le porter, il passe en dessous.
   */
  quantityLabel?: string;
  /** Remise de ligne, en pourcentage. */
  discountPercentage?: number;
}

export type Block =
  /**
   * Logo déjà chargé en dataURL, avec son rapport largeur / hauteur : la mise en
   * page se calcule avant tout tracé et ne peut donc pas interroger l'image.
   * Bloc simplement absent si le chargement a échoué.
   */
  | { kind: "logo"; dataUrl: string; format: "PNG" | "JPEG"; aspectRatio: number }
  /** Texte, replié sur la largeur utile. */
  | {
      kind: "text";
      text: string;
      role: FontRole;
      align?: "left" | "center";
      italic?: boolean;
      muted?: boolean;
      indent?: boolean;
    }
  /**
   * Bandeau d'identification du document, en vidéo inversée.
   * Sur du papier thermique monochrome, c'est le seul dispositif qui se repère
   * dans une liasse sans avoir à lire.
   */
  | { kind: "band"; text: string; sub?: string }
  /** Pastille inversée, plus courte que le bandeau : DUPLICATA, DETTE SOLDÉE. */
  | { kind: "chip"; text: string }
  /**
   * Bloc clé / valeur.
   * `inline` colle la valeur au libellé et replie en retrait : c'est le mode des
   * champs d'identité, où justifier à droite laissait 28 mm de vide entre
   * « Client: » et le nom sur un ticket de 53 mm.
   * `justified` pousse la valeur à droite : réservé aux colonnes de chiffres,
   * là où l'œil balaie verticalement.
   */
  | {
      kind: "kv";
      rows: KvRow[];
      mode: "inline" | "justified";
      role?: FontRole;
    }
  /** Tableau des articles, en-tête compris. */
  | { kind: "items"; rows: ItemRow[] }
  /** Colonne de montants justifiés, mesurés avant tracé. */
  | { kind: "amounts"; rows: AmountRow[]; role?: FontRole }
  /** Le chiffre du document : libellé discret, montant en grand dessous. */
  | { kind: "total"; label: string; value: string }
  | { kind: "rule"; weight: RuleWeight }
  | { kind: "space"; size: SpaceSize };

/**
 * Retire les entrées absentes pour que les documents s'écrivent en une seule
 * expression, conditions comprises. Générique : sert autant aux blocs qu'aux
 * lignes clé / valeur.
 */
export function compact<T>(items: (T | null | false | undefined | "")[]): T[] {
  return items.filter((item): item is T => Boolean(item));
}
