/**
 * Mise au pluriel des libellés d'unités saisis par le marchand.
 *
 * Ces libellés sont du texte libre et arrivent tels quels : « pièce »,
 * « PLAQUETTE », « Carton ». Ajouter un « s » minuscule à un mot saisi en
 * majuscules donnait « 10 PIECEs », ce qui saute aux yeux dans une fiche
 * produit. On suit donc la casse du mot d'origine.
 */
export function pluralizeUnit(word: string, count: number): string {
  const mot = (word || "").trim();
  if (!mot) return "";
  if (Math.abs(count) < 2) return mot;
  // Déjà au pluriel ou invariable.
  if (/[sxz]$/i.test(mot)) return mot;

  // Un mot entièrement en capitales prend une capitale, pas une minuscule.
  const enCapitales = mot === mot.toUpperCase() && /[A-ZÀ-Ÿ]/.test(mot);
  return `${mot}${enCapitales ? "S" : "s"}`;
}

/**
 * Formate une quantité avec son unité accordée : « 10 PIECES », « 1 paquet ».
 */
export function formatUnitQuantity(count: number, word: string): string {
  return `${count} ${pluralizeUnit(word, count)}`.trim();
}
