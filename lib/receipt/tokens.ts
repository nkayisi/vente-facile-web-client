/**
 * Jetons de mise en page du ticket thermique.
 *
 * Tout est en millimètres, unité native du PDF produit. L'ancien générateur
 * semait des `y += 0.5`, `y += 1`, `y += 1.5` sans échelle : le rythme vertical
 * était illisible et impossible à corriger sans tout remesurer. Ici, une seule
 * échelle d'espacement et trois épaisseurs de filet porteuses de sens.
 */

export type PaperWidth = 58 | 80;

/**
 * Rôles typographiques. Le ticket précédent écrivait presque tout en 9 pt, d'où
 * l'absence de hiérarchie : le client ne savait pas où poser l'œil.
 */
export type FontRole =
  | "orgName"
  | "band"
  | "total"
  | "chip"
  | "body"
  | "label"
  | "legal";

export interface FontSpec {
  size: number;
  bold: boolean;
}

export const FONTS: Record<FontRole, FontSpec> = {
  orgName: { size: 12, bold: true },
  band: { size: 10, bold: true },
  total: { size: 13, bold: true },
  chip: { size: 9, bold: true },
  body: { size: 9, bold: false },
  label: { size: 8, bold: false },
  legal: { size: 7, bold: false },
};

export type SpaceSize = "xs" | "sm" | "md" | "lg";
export type RuleWeight = "heavy" | "light" | "hair";

export interface Tokens {
  paperWidth: number;
  margin: number;
  /** Largeur réellement écrivable, filets compris. */
  contentWidth: number;
  /** Blanc de tête : confort de découpe sur imprimante thermique. */
  topPadding: number;
  /** Blanc de pied : l'avance papier ne doit pas rogner la dernière ligne. */
  bottomPadding: number;
  space: Record<SpaceSize, number>;
  rule: Record<RuleWeight, number>;
  /** Blanc minimal entre un libellé et son montant sur une ligne justifiée. */
  minGap: number;
  /** Retrait des lignes secondaires (conditionnement, remise de ligne). */
  indent: number;
  /** Hauteur maximale du logo. */
  logoMaxHeight: number;
  /** Bornes horizontales des colonnes du tableau d'articles, en fraction. */
  itemCols: { name: number; qty: number; unitPrice: number };
}

const BASE = {
  margin: 2.5,
  topPadding: 5,
  bottomPadding: 6,
  space: { xs: 1, sm: 2, md: 3, lg: 5 },
  rule: { heavy: 0.4, light: 0.15, hair: 0.08 },
  minGap: 2,
  indent: 2,
  logoMaxHeight: 12,
} as const;

export function tokensFor(paperWidth: PaperWidth): Tokens {
  return {
    ...BASE,
    space: { ...BASE.space },
    rule: { ...BASE.rule },
    paperWidth,
    contentWidth: paperWidth - BASE.margin * 2,
    itemCols:
      paperWidth === 80
        ? { name: 0.46, qty: 0.6, unitPrice: 0.78 }
        : { name: 0.4, qty: 0.45, unitPrice: 0.7 },
  };
}

/**
 * Interligne d'un corps donné.
 *
 * Le facteur 0,385 reproduit l'ancien couple (11 pt → 4,2 mm ; 9 pt → 3,5 mm)
 * pour que la densité du ticket reste celle que les marchands connaissent.
 */
export function leading(size: number): number {
  return Math.round(size * 0.385 * 100) / 100;
}

export function leadingOf(role: FontRole): number {
  return leading(FONTS[role].size);
}
