/**
 * Construit un reçu à partir d'une vente telle que l'API la renvoie.
 *
 * Chemin unique de la réimpression, partagé par toutes les pages qui repartent
 * d'une vente enregistrée. Le POS, lui, imprime depuis son panier local avant
 * même d'avoir relu la vente : c'est le seul appelant qui mappe à la main.
 */

import type { OrganizationSettings } from "@/actions/settings.actions";
import type { Sale } from "@/actions/sales.actions";
import type { ReceiptChrome } from "../identity";
import type { SaleReceiptData, SaleReceiptItem } from "./sale";

const num = (value: string | number | null | undefined): number => {
  const parsed = typeof value === "number" ? value : parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
};

export interface FromSaleOptions {
  chrome: ReceiptChrome;
  settings?: OrganizationSettings | null;
  /** Réimpression : le ticket sort marqué DUPLICATA. */
  isDuplicate?: boolean;
}

export function saleReceiptFromSale(
  sale: Sale,
  options: FromSaleOptions
): SaleReceiptData {
  const isCredit = sale.sale_type === "credit" || num(sale.amount_due) > 0;

  const items: SaleReceiptItem[] = (sale.items ?? []).map((item) => ({
    name: item.product_name,
    quantity: num(item.quantity),
    // Le libellé de conditionnement n'a de sens que pour un produit vendu en
    // paquets : sur un article à l'unité, il répéterait la quantité.
    quantityLabel: item.packaging_factor ? item.quantity_display : undefined,
    unitPrice: num(item.unit_price),
    discountPercentage: num(item.discount_percentage),
    total: num(item.total),
  }));

  return {
    kind: isCredit ? "credit_sale" : "sale",
    chrome: options.chrome,
    number: sale.reference,
    date: new Date(sale.sale_date).toLocaleString("fr-CD"),
    registerName: sale.register_name || undefined,
    cashierName: sale.sold_by_name || undefined,
    warehouseName: sale.warehouse_name || undefined,
    customerName: sale.customer_name || undefined,
    customerPhone: sale.customer_phone || undefined,
    dueDate: sale.due_date
      ? new Date(sale.due_date).toLocaleDateString("fr-CD")
      : undefined,
    isDuplicate: options.isDuplicate,

    items,
    subtotal: num(sale.subtotal),
    taxAmount: num(sale.tax_amount),
    discountAmount: num(sale.discount_amount),
    globalDiscountPercent: num(sale.discount_percentage) || undefined,
    loyaltyRedemptionAmount: num(sale.loyalty_redemption_amount),
    total: num(sale.total),
    currency: sale.currency,

    payments: (sale.payments ?? []).map((p) => ({
      method: p.payment_method_name,
      amount: num(p.amount),
      currency: p.currency,
    })),
    changeAmount: num(sale.change_amount),
    amountDue: num(sale.amount_due),

    // Une réimpression doit être identique à l'original : les valeurs viennent
    // du serveur, jamais d'un recalcul de barème côté client.
    loyalty: {
      show: Boolean(
        options.settings?.show_loyalty_points_on_receipt &&
          sale.customer &&
          sale.loyalty_program_active
      ),
      earned: sale.loyalty_points_earned ?? 0,
      used: sale.loyalty_points_used ?? 0,
      balance: sale.loyalty_points_balance ?? 0,
    },
  };
}
