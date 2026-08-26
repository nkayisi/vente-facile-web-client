/**
 * Formatage monétaire du ticket.
 *
 * Deux contraintes que le générateur précédent ignorait :
 *
 * 1. **Décimales par devise.** `formatAmount(x, 2)` était codé en dur, alors que
 *    le CDF, devise par défaut de la plateforme, n'a pas de décimales. Un ticket
 *    imprimait « 1 250 036.40 CDF » au lieu de « 1 250 036 FC » : trois
 *    caractères de bruit et cinq millimètres perdus sur un papier de 53 mm
 *    utiles, là où la place manque déjà.
 *
 * 2. **Séparateur de milliers ASCII.** `Intl.NumberFormat("fr-*")` groupe avec
 *    une espace fine insécable (U+202F) que la police helvetica intégrée à jsPDF
 *    rend en « / ». On groupe donc à la main avec une espace ordinaire. Ne pas
 *    remplacer par `Intl` sans embarquer une police qui couvre U+202F.
 */

import { getCurrencyByCode } from "@/lib/currencies";

/** Décimales et symbole propres à l'organisation, quand elle les redéfinit. */
export interface CurrencyOverride {
  decimals?: number;
  symbol?: string;
}

export type CurrencyOverrides = Record<string, CurrencyOverride>;

export function decimalsOf(code: string, overrides?: CurrencyOverrides): number {
  const override = overrides?.[code]?.decimals;
  if (typeof override === "number") return override;
  return getCurrencyByCode(code)?.decimal_places ?? 2;
}

export function symbolOf(code: string, overrides?: CurrencyOverrides): string {
  return overrides?.[code]?.symbol || getCurrencyByCode(code)?.symbol || code;
}

/** « 1250036.4 » → « 1 250 036 » (0 décimale) ou « 1 250 036.40 » (2). */
export function formatAmount(amount: number | string, decimals: number): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const safe = Number.isFinite(n) ? n : 0;
  const parts = safe.toFixed(Math.max(0, decimals)).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.join(".");
}

/** Montant dans sa devise : « 1 250 036 FC », « 2 500.00 $ ». */
export function formatMoney(
  amount: number | string,
  code: string,
  overrides?: CurrencyOverrides
): string {
  return `${formatAmount(amount, decimalsOf(code, overrides))} ${symbolOf(code, overrides)}`;
}

/** Montant sans devise, pour les colonnes où l'unité est déjà annoncée. */
export function formatBare(
  amount: number | string,
  code: string,
  overrides?: CurrencyOverrides
): string {
  return formatAmount(amount, decimalsOf(code, overrides));
}

/**
 * Points de fidélité.
 *
 * Fractionnaires par nature : 1 % d'un panier de 58 $ vaut 0,58 point, et
 * arrondir à l'entier revenait à ne rien créditer. On garde la fraction, mais
 * seulement quand elle existe : « 3 pts », pas « 3.00 pts ».
 */
export function formatPoints(points: number | undefined | null): string {
  const n = points ?? 0;
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : formatAmount(rounded, 2);
}

/** Quantité : 3 décimales possibles, mais on ne les imprime pas pour rien. */
export function formatQuantity(quantity: number | string): string {
  const n = typeof quantity === "string" ? parseFloat(quantity) : quantity;
  const safe = Number.isFinite(n) ? n : 0;
  const rounded = Math.round(safe * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * Retire les diacritiques.
 *
 * Le chemin PDF (web, relayé par Thermer qui rend une image) restitue les
 * accents correctement : on écrit donc les libellés en français correct, une
 * seule fois. Le chemin natif NYX envoie du texte brut à l'imprimante, dont la
 * page de code les casse : c'est le rendu texte qui appelle cette fonction, pas
 * les documents. C'est ce qui met fin aux deux conventions qui coexistaient
 * dans l'ancien fichier (« Recu » d'un côté, « Reçu par: » de l'autre).
 */
export function deaccent(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
