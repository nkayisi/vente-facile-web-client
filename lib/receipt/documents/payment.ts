/**
 * Reçu de règlement de dette.
 *
 * C'est le document qui a motivé la refonte : il sortait sans adresse ni
 * téléphone, avec un numéro fabriqué dans le navigateur, des libellés collés à
 * leur montant, et rien pour le distinguer d'un ticket de vente.
 */

import { compact, type Block, type KvRow } from "../blocks";
import { orgHeaderBlocks, footerBlocks, type ReceiptChrome } from "../identity";
import { formatMoney } from "../money";
import {
  debtBlocks,
  identityBlocks,
  infoBlocks,
  loyaltyBlocks,
  type BaseDocumentData,
  type DebtData,
  type LoyaltyData,
} from "./common";

export interface PaymentReceiptData extends BaseDocumentData {
  kind: "debt_payment" | "advance" | "adjustment";
  chrome: ReceiptChrome;
  /** Moyen de paiement, tel que nommé par l'organisation. */
  paymentMethod?: string;
  /** Référence externe : numéro de transaction mobile money, de chèque… */
  paymentReference?: string;
  amountPaid: number;
  currency: string;
  /**
   * Montant réellement remis, quand il est dans une autre devise que celle de
   * l'imputation. Sans lui, un client qui paie en francs une facture en dollars
   * ne lit sur son reçu aucun des billets qu'il a sortis.
   */
  tenderedAmount?: number;
  tenderedCurrency?: string;
  /** Facture réglée, s'il s'agit d'un règlement imputé à une facture précise. */
  invoice?: {
    reference: string;
    total: number;
    previouslyPaid: number;
    remaining: number;
    /** Devise de la facture, qui fait foi pour les trois montants ci-dessus. */
    currency: string;
  };
  /** Factures soldées d'un coup par un règlement global. */
  settledInvoices?: string[];
  debt?: DebtData;
  loyalty?: LoyaltyData;
  notes?: string;
}

const FOOTER_BY_KIND: Record<PaymentReceiptData["kind"], string[]> = {
  debt_payment: ["Merci pour votre règlement !", "Ce reçu fait foi de paiement."],
  advance: [
    "Merci pour votre versement !",
    "Cette avance sera imputée sur vos prochains achats.",
  ],
  adjustment: ["Pièce interne de régularisation de compte."],
};

function totalLabel(kind: PaymentReceiptData["kind"]): string {
  if (kind === "advance") return "Avance versée";
  if (kind === "adjustment") return "Montant ajusté";
  return "Montant réglé";
}

export function buildPaymentReceipt(data: PaymentReceiptData): Block[] {
  const money = (amount: number, currency: string) =>
    formatMoney(amount, currency, data.currencyOverrides);

  const invoiceRows = data.invoice
    ? compact<KvRow>([
        { label: "Facture", value: data.invoice.reference, strong: true },
        {
          label: "Montant facture",
          value: money(data.invoice.total, data.invoice.currency),
        },
        {
          label: "Déjà réglé",
          value: money(data.invoice.previouslyPaid, data.invoice.currency),
        },
        {
          label: "Reste à payer",
          value: money(data.invoice.remaining, data.invoice.currency),
          strong: true,
        },
      ])
    : [];

  const settlementRows = compact<KvRow>([
    data.paymentMethod && { label: "Mode", value: data.paymentMethod },
    data.paymentReference && { label: "Référence", value: data.paymentReference },
    // Le montant remis n'apparaît que s'il diffère de l'imputation : sinon la
    // même somme s'imprimerait deux fois à deux lignes d'intervalle.
    data.tenderedAmount !== undefined &&
      data.tenderedCurrency !== undefined &&
      data.tenderedCurrency !== data.currency && {
        label: "Remis par le client",
        value: money(data.tenderedAmount, data.tenderedCurrency),
      },
  ]);

  return compact<Block>([
    ...orgHeaderBlocks(data.chrome),
    ...identityBlocks(data),
    ...infoBlocks(data, [], "Reçu par"),

    invoiceRows.length > 0 && { kind: "space", size: "sm" },
    invoiceRows.length > 0 && {
      kind: "amounts",
      rows: invoiceRows,
      role: "body",
    },

    (data.settledInvoices?.length ?? 0) > 0 && { kind: "space", size: "sm" },
    (data.settledInvoices?.length ?? 0) > 0 && {
      kind: "text",
      text: "Factures soldées",
      role: "label",
      align: "left",
    },
    ...(data.settledInvoices ?? []).map(
      (reference): Block => ({
        kind: "text",
        text: reference,
        role: "body",
        align: "left",
        indent: true,
      })
    ),

    settlementRows.length > 0 && { kind: "space", size: "sm" },
    settlementRows.length > 0 && {
      kind: "kv",
      rows: settlementRows,
      mode: "inline",
      role: "body",
    },

    { kind: "space", size: "sm" },
    {
      kind: "total",
      label: totalLabel(data.kind),
      value: money(data.amountPaid, data.currency),
    },

    ...debtBlocks(data.debt, data.currencyOverrides),
    ...loyaltyBlocks(data.loyalty),

    data.notes && { kind: "space", size: "sm" },
    data.notes && {
      kind: "text",
      text: data.notes,
      role: "label",
      align: "left",
      italic: true,
    },

    ...footerBlocks(data.chrome, FOOTER_BY_KIND[data.kind]),
  ]);
}
