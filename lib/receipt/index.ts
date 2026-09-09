/**
 * Fabrique de tickets thermiques.
 *
 * Point d'entrée unique : les pages construisent une donnée de document, la
 * fabrique en tire des blocs, le moteur les rend en PDF.
 */

export type { Block, ItemRow, KvRow, AmountRow } from "./blocks";
export { compact } from "./blocks";
export type { PaperWidth, FontRole } from "./tokens";
export { tokensFor, FONTS } from "./tokens";
export {
  decimalsOf,
  symbolOf,
  formatAmount,
  formatMoney,
  formatBare,
  formatPoints,
  formatQuantity,
  deaccent,
  type CurrencyOverrides,
} from "./money";
export {
  orgHeaderBlocks,
  footerBlocks,
  loadLogo,
  type OrgIdentity,
  type LoadedLogo,
  type ReceiptChrome,
} from "./identity";
export { renderReceipt, renderReceiptUrl } from "./render-pdf";
export {
  DOCUMENT_IDENTITIES,
  DUPLICATE_CHIP,
  type DocumentKind,
  type DocumentIdentity,
} from "./documents/types";
export type {
  BaseDocumentData,
  DebtData,
  LoyaltyData,
} from "./documents/common";
export {
  buildSaleReceipt,
  type SaleReceiptData,
  type SaleReceiptItem,
  type SaleReceiptPayment,
} from "./documents/sale";
export {
  buildPaymentReceipt,
  type PaymentReceiptData,
} from "./documents/payment";
export { saleReceiptFromSale, type FromSaleOptions } from "./documents/from-sale";
export {
  buildCashSessionReceipt,
  buildExpenseReceipt,
  type CashSessionReceiptData,
  type CashSessionCurrencyLine,
  type ExpenseReceiptData,
} from "./documents/cash-session";
