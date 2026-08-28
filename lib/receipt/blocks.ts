/**
 * Réexport depuis `@vente-facile/core`.
 *
 * Ces règles vivaient ici ; elles vivent désormais dans le paquet partagé, pour
 * que le back-office et l'application mobile ne puissent pas en tenir deux
 * versions. Ce fichier n'existe plus que pour laisser inchangés les 4 sites
 * d'import de `@/lib/receipt/blocks` : le déplacement n'a rien à changer aux écrans.
 *
 * Toute évolution de ces fonctions se fait dans le paquet, jamais ici.
 */

export {
  compact,
} from "@vente-facile/core/receipt";

export type {
  KvRow,
  AmountRow,
  ItemRow,
  Block,
} from "@vente-facile/core/receipt";
