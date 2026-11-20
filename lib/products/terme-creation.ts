/**
 * Ce qu'une recherche sans résultat pré-remplit dans la création d'un article.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN CODE SCANNÉ EST UN CODE-BARRES, UN MOT EST UN NOM.                    │
 * │                                                                          │
 * │ Le vendeur cherche « savon omo » ou scanne 6001087011234 : rien ne sort. │
 * │ La création s'ouvre avec ce qu'il a déjà donné, pour qu'il ne retape     │
 * │ rien. Un terme fait uniquement de 8 à 14 chiffres est un code EAN, UPC   │
 * │ ou ITF tapé à la main ; tout ce qui sort d'un scanner l'est aussi, même  │
 * │ alphanumérique (Code 128, QR).                                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Copie tenue à la main de `mobile/vf-marchand/src/data/terme-creation.ts`,
 * éprouvée sur les MÊMES cas.
 */

export type PreRemplissage = { champ: "nom" | "code_barres"; valeur: string };

/** Un code numérique de 8 à 14 chiffres : EAN-8, UPC-A, EAN-13, ITF-14. */
const CODE_NUMERIQUE = /^\d{8,14}$/;

export function preRemplissageDeCreation(
  terme: string,
  scanne = false
): PreRemplissage | null {
  const valeur = terme.trim();
  if (!valeur) return null;
  if (scanne || CODE_NUMERIQUE.test(valeur)) return { champ: "code_barres", valeur };
  return { champ: "nom", valeur };
}

/**
 * L'adresse de la page de création, pré-remplie.
 *
 * `origine` dit d'où l'on vient : la page ferme alors son onglet une fois
 * l'article créé, pour rendre la main à l'écran qui l'a ouvert.
 */
export function lienCreationArticle(
  terme: string,
  options: { scanne?: boolean; origine?: string } = {}
): string | null {
  const pre = preRemplissageDeCreation(terme, options.scanne);
  if (!pre) return null;
  const params = new URLSearchParams();
  params.set(pre.champ === "nom" ? "name" : "barcode", pre.valeur);
  if (options.origine) params.set("origine", options.origine);
  return `/dashboard/products/new?${params.toString()}`;
}
