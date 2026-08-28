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
} from "@vente-facile/core";

export type {
  PackagedProductLike,
  Packaging,
  ChannelAvailability,
} from "@vente-facile/core";
