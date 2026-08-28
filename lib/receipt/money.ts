/**
 * Réexport depuis `@vente-facile/core`.
 *
 * Ces règles vivaient ici ; elles vivent désormais dans le paquet partagé, pour
 * que le back-office et l'application mobile ne puissent pas en tenir deux
 * versions. Ce fichier n'existe plus que pour laisser inchangés les 3 sites
 * d'import de `@/lib/receipt/money` : le déplacement n'a rien à changer aux écrans.
 *
 * Toute évolution de ces fonctions se fait dans le paquet, jamais ici.
 */

export {
  decimalsOf,
  symbolOf,
  formatAmount,
  formatMoney,
  formatBare,
  formatPoints,
  formatQuantity,
  deaccent,
} from "@vente-facile/core/receipt";

export type {
  CurrencyOverride,
  CurrencyOverrides,
} from "@vente-facile/core/receipt";
