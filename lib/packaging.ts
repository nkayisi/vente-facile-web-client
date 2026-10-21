/**
 * Réexport depuis `@vente-facile/core`.
 *
 * Ces règles vivaient ici ; elles vivent désormais dans le paquet partagé, pour
 * que le back-office et l'application mobile ne puissent pas en tenir deux
 * versions. Ce fichier n'existe plus que pour laisser inchangés les 6 sites
 * d'import de `@/lib/packaging` : le déplacement n'a rien à changer aux écrans.
 *
 * Toute évolution de ces fonctions se fait dans le paquet, jamais ici.
 */

export {
  getPackaging,
  splitPackaged,
  formatPackaged,
  formatPackagedSplit,
  formatPackagedDifference,
  toBaseQuantity,
  remainingChannels,
  // Quantités décimales : la règle vit dans le paquet, pas ici. Trois
  // décimales et douze chiffres entiers, soit `decimal_places` et
  // `max_digits` de tout champ de quantité du serveur.
  roundQuantity,
  formatQuantity,
  MIN_QUANTITY,
  MAX_QUANTITY,
  QUANTITY_DECIMALS,
  QUANTITY_INTEGER_DIGITS,
} from "@vente-facile/core";

export type {
  PackagedProductLike,
  Packaging,
  ChannelAvailability,
} from "@vente-facile/core";
