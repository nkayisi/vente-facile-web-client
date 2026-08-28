/**
 * Réexport depuis `@vente-facile/core`.
 *
 * Ces règles vivaient ici ; elles vivent désormais dans le paquet partagé, pour
 * que le back-office et l'application mobile ne puissent pas en tenir deux
 * versions. Ce fichier n'existe plus que pour laisser inchangés les 8 sites
 * d'import de `@/lib/currency` : le déplacement n'a rien à changer aux écrans.
 *
 * Toute évolution de ces fonctions se fait dans le paquet, jamais ici.
 */

export {
  MONEY_EPS,
  createMoneyHelpers,
} from "@vente-facile/core";

export type {
  MoneyHelpers,
} from "@vente-facile/core";
