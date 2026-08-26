/**
 * Reçu de vente, vente à crédit et facture proforma.
 *
 * Les trois partagent le même corps et ne diffèrent que par leur bandeau, leur
 * pied et la présence du bloc de règlement : c'est bien un seul document à trois
 * états, pas trois documents.
 */

import { compact, type Block, type ItemRow, type KvRow } from "../blocks";
import { orgHeaderBlocks, footerBlocks, type ReceiptChrome } from "../identity";
import { formatBare, formatMoney, formatQuantity } from "../money";
import {
  debtBlocks,
  identityBlocks,
  infoBlocks,
  loyaltyBlocks,
  type BaseDocumentData,
  type DebtData,
  type LoyaltyData,
} from "./common";

export interface SaleReceiptItem {
  name: string;
  quantity: number;
  /** « 2 cartons + 3 bouteilles » : ce que le client emporte réellement. */
  quantityLabel?: string;
  unitPrice: number;
  discountPercentage?: number;
  total: number;
}

export interface SaleReceiptPayment {
  method: string;
  amount: number;
  currency: string;
}

export interface SaleReceiptData extends BaseDocumentData {
  kind: "sale" | "credit_sale" | "proforma";
  chrome: ReceiptChrome;
  warehouseName?: string;
  items: SaleReceiptItem[];
  subtotal: number;
  taxAmount: number;
  /** Remise totale, part payée en points comprise. */
  discountAmount: number;
  /** Remise globale en montant fixe, telle que saisie au POS. */
  globalDiscountAmount?: number;
  /** Remise globale en pourcentage, chemin historique. */
  globalDiscountPercent?: number;
  /**
   * Part du total réglée par les points, déjà comprise dans `discountAmount`.
   * On l'isole pour que le client voie que ses points ont payé, au lieu de lire
   * une remise anonyme.
   */
  loyaltyRedemptionAmount?: number;
  total: number;
  currency: string;
  payments: SaleReceiptPayment[];
  changeAmount?: number;
  amountDue?: number;
  dueDate?: string;
  loyalty?: LoyaltyData;
  debt?: DebtData;
}

const PROFORMA_FOOTER = [
  "Document sans valeur comptable.",
  "Ne constitue pas une facture.",
  "Stocks non réservés.",
];

const SALE_FOOTER = ["Merci pour votre achat !", "À bientôt."];

const CREDIT_FOOTER = [
  "Merci pour votre achat !",
  "Conservez ce reçu jusqu'au règlement complet.",
];

/**
 * Sépare la remise affichée en remise commerciale et remise fidélité.
 *
 * `discountAmount` inclut déjà la part payée en points : les afficher l'une sous
 * l'autre sans retrancher ferait apparaître la même somme deux fois. Leur somme
 * redonne bien `discountAmount`.
 */
function splitDiscount(data: SaleReceiptData) {
  const loyalty = Math.max(0, data.loyaltyRedemptionAmount ?? 0);
  return { commercial: Math.max(0, data.discountAmount - loyalty), loyalty };
}

function discountLabel(data: SaleReceiptData): string {
  if ((data.globalDiscountAmount ?? 0) > 0) return "Remise";
  if ((data.globalDiscountPercent ?? 0) > 0) {
    return `Remise (${data.globalDiscountPercent} %)`;
  }
  return "Remises";
}

export function buildSaleReceipt(data: SaleReceiptData): Block[] {
  const money = (amount: number, currency = data.currency) =>
    formatMoney(amount, currency, data.currencyOverrides);
  const bare = (amount: number) =>
    formatBare(amount, data.currency, data.currencyOverrides);

  const isProforma = data.kind === "proforma";
  const discounts = splitDiscount(data);

  const items: ItemRow[] = data.items.map((item) => ({
    name: item.name,
    quantity: formatQuantity(item.quantity),
    unitPrice: bare(item.unitPrice),
    total: bare(item.total),
    quantityLabel: item.quantityLabel,
    discountPercentage: item.discountPercentage,
  }));

  const totalRows = compact<KvRow>([
    { label: "Sous-total", value: bare(data.subtotal) },
    discounts.commercial > 0 && {
      label: discountLabel(data),
      value: `-${bare(discounts.commercial)}`,
    },
    discounts.loyalty > 0 && {
      label: "Réglé en points",
      value: `-${bare(discounts.loyalty)}`,
    },
    data.taxAmount > 0 && {
      label: "TVA",
      value: `+${bare(data.taxAmount)}`,
    },
  ]);

  const settlementRows = compact<KvRow>([
    ...data.payments.map((p) => ({
      label: p.method,
      value: money(p.amount, p.currency),
    })),
    (data.changeAmount ?? 0) > 0 && {
      label: "Monnaie rendue",
      value: money(data.changeAmount as number),
    },
    (data.amountDue ?? 0) > 0 && {
      label: "Reste à payer",
      value: money(data.amountDue as number),
      strong: true,
    },
  ]);

  const extraInfo = compact<KvRow>([
    data.warehouseName && { label: "Dépôt", value: data.warehouseName },
    data.dueDate && { label: "À régler avant le", value: data.dueDate },
  ]);

  return compact<Block>([
    ...orgHeaderBlocks(data.chrome),
    ...identityBlocks(data),
    ...infoBlocks(data, extraInfo),

    { kind: "space", size: "sm" },
    { kind: "items", rows: items },
    { kind: "space", size: "xs" },
    { kind: "rule", weight: "light" },
    { kind: "amounts", rows: totalRows, role: "body" },
    { kind: "space", size: "sm" },

    {
      kind: "total",
      label: isProforma ? "Total estimatif" : "Total à payer",
      value: money(data.total),
    },

    !isProforma && settlementRows.length > 0 && { kind: "space", size: "sm" },
    !isProforma &&
      settlementRows.length > 0 && {
        kind: "amounts",
        rows: settlementRows,
        role: "body",
      },

    ...(isProforma ? [] : debtBlocks(data.debt, data.currencyOverrides)),
    ...(isProforma ? [] : loyaltyBlocks(data.loyalty)),

    ...footerBlocks(
      // Une proforma n'est pas un reçu : son pied ne doit pas pouvoir être
      // remplacé par le message de remerciement configuré pour les ventes.
      isProforma ? { org: data.chrome.org } : data.chrome,
      isProforma
        ? PROFORMA_FOOTER
        : data.kind === "credit_sale"
          ? CREDIT_FOOTER
          : SALE_FOOTER
    ),
  ]);
}
