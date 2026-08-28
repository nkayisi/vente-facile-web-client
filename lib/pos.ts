/**
 * Réexport depuis `@vente-facile/core`.
 *
 * L'arithmétique du point de vente vivait en fermetures dans la page POS ; elle
 * vit désormais dans le paquet partagé, pour que le back-office et
 * l'application mobile ne puissent pas en tenir deux versions. C'est ce qui
 * décide de l'argent : un écart d'un centième entre les deux surfaces ne se
 * verrait qu'au moment où un client conteste sa monnaie.
 *
 * L'extraction est prouvée fidèle par `core/test/pos-parity.test.ts`, qui
 * rejoue le code d'origine contre le code extrait sur 2 000 paniers.
 *
 * Toute évolution de ces fonctions se fait dans le paquet, jamais ici.
 */

export {
  MONEY_EPS,
  r2,
  createCurrencyTable,
  basketTotals,
  maxGlobalDiscount,
  totalInSaleCurrency,
  tendersIn,
  lineGross,
  packagingFactorOf,
  looseQuantityOf,
  roundPoints,
  pointValue,
  minPointsToRedeem,
  maxLoyaltyAmount,
  maxUsablePoints,
  loyaltyDiscount,
  evaluateCredit,
} from "@vente-facile/core/pos";

export type {
  OrganizationCurrencyLike,
  CurrencyFallback,
  CurrencyTable,
  BasketProduct,
  BasketLine,
  BasketTotals,
  BasketInput,
  SaleCurrencyInput,
  TenderLike,
  LoyaltyProgramLike,
  CreditCustomerLike,
  CreditVerdict,
} from "@vente-facile/core/pos";
