/**
 * Réexport depuis `@vente-facile/core`.
 *
 * Ces règles vivaient ici ; elles vivent désormais dans le paquet partagé, pour
 * que le back-office et l'application mobile ne puissent pas en tenir deux
 * versions. Ce fichier n'existe plus que pour laisser inchangés les 5 sites
 * d'import de `@/lib/receipt/tokens` : le déplacement n'a rien à changer aux écrans.
 *
 * Toute évolution de ces fonctions se fait dans le paquet, jamais ici.
 */

export {
  FONTS,
  tokensFor,
  leading,
  leadingOf,
} from "@vente-facile/core/receipt";

export type {
  PaperWidth,
  FontRole,
  FontSpec,
  SpaceSize,
  RuleWeight,
  Tokens,
} from "@vente-facile/core/receipt";
