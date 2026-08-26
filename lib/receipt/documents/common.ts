/**
 * Briques partagées par tous les documents : bandeau d'identification, bloc
 * d'infos, bloc fidélité, bloc de dette. Écrites une fois, elles garantissent
 * qu'un reçu de vente et un reçu de règlement se ressemblent là où ils parlent
 * de la même chose.
 */

import { compact, type Block, type KvRow } from "../blocks";
import { formatMoney, formatPoints, type CurrencyOverrides } from "../money";
import {
  DOCUMENT_IDENTITIES,
  DUPLICATE_CHIP,
  type DocumentKind,
} from "./types";

export interface BaseDocumentData {
  kind: DocumentKind;
  /** Numéro du document, préfixé par type. */
  number: string;
  date: string;
  cashierName?: string;
  registerName?: string;
  customerName?: string;
  customerPhone?: string;
  /** Réimpression : le ticket sort marqué DUPLICATA. */
  isDuplicate?: boolean;
  currencyOverrides?: CurrencyOverrides;
}

/** Bandeau du type de document, suivi de la pastille de réimpression. */
export function identityBlocks(data: BaseDocumentData): Block[] {
  const identity = DOCUMENT_IDENTITIES[data.kind];
  return compact<Block>([
    { kind: "space", size: "xs" },
    { kind: "band", text: identity.band, sub: identity.sub },
    data.isDuplicate && { kind: "space", size: "xs" },
    data.isDuplicate && { kind: "chip", text: DUPLICATE_CHIP },
    { kind: "space", size: "sm" },
  ]);
}

/**
 * Bloc d'identification, en mode `inline`.
 *
 * L'ancien reçu de règlement justifiait ces lignes à droite : « Client: » d'un
 * bord et « Nelly Kayisi » de l'autre, avec 28 mm de vide entre les deux sur un
 * ticket qui en fait 53. La valeur suit maintenant son libellé.
 */
export function infoBlocks(
  data: BaseDocumentData,
  extra: KvRow[] = [],
  /** « Servi par » convient à une vente, pas à une sortie de caisse. */
  cashierLabel = "Servi par"
): Block[] {
  const identity = DOCUMENT_IDENTITIES[data.kind];
  const rows = compact<KvRow>([
    { label: identity.numberLabel, value: data.number, strong: true },
    { label: "Date", value: data.date },
    data.registerName && { label: "Caisse", value: data.registerName },
    data.cashierName && { label: cashierLabel, value: data.cashierName },
    data.customerName && { label: "Client", value: data.customerName },
    data.customerPhone && { label: "Tél.", value: data.customerPhone },
    ...extra,
  ]);

  return [
    { kind: "kv", rows, mode: "inline", role: "body" },
    { kind: "space", size: "xs" },
    { kind: "rule", weight: "light" },
  ];
}

export interface LoyaltyData {
  show?: boolean;
  earned?: number;
  used?: number;
  balance?: number;
}

/**
 * Bloc fidélité.
 *
 * Il s'imprime dès qu'un programme est actif et qu'un client est rattaché, même
 * si la vente ne rapporte rien : le client vient justement lire son cumul. La
 * garde d'origine (« points gagnés > 0 ») faisait disparaître le solde sur toute
 * vente sous le seuil de gain.
 */
export function showsLoyalty(loyalty: LoyaltyData | undefined): boolean {
  if (!loyalty?.show) return false;
  return (
    (loyalty.earned ?? 0) > 0 ||
    (loyalty.used ?? 0) > 0 ||
    loyalty.balance !== undefined
  );
}

export function loyaltyBlocks(loyalty: LoyaltyData | undefined): Block[] {
  if (!showsLoyalty(loyalty) || !loyalty) return [];

  const rows = compact<KvRow>([
    (loyalty.earned ?? 0) > 0 && {
      label: "Points gagnés",
      value: `+${formatPoints(loyalty.earned)} pts`,
    },
    (loyalty.used ?? 0) > 0 && {
      label: "Points utilisés",
      value: `-${formatPoints(loyalty.used)} pts`,
    },
    loyalty.balance !== undefined && {
      label: "Solde de points",
      value: `${formatPoints(loyalty.balance)} pts`,
      strong: true,
    },
  ]);

  if (!rows.length) return [];

  return [
    { kind: "space", size: "sm" },
    { kind: "rule", weight: "light" },
    { kind: "text", text: "Fidélité", role: "label", align: "center" },
    { kind: "space", size: "xs" },
    { kind: "amounts", rows, role: "body" },
  ];
}

export interface DebtData {
  /** Solde du client avant l'opération, dans la devise de l'opération. */
  before?: number;
  /** Solde après. Zéro ou négatif signifie que la dette est éteinte. */
  after?: number;
  currency: string;
}

/**
 * Bloc dette avant / après.
 *
 * Le générateur savait déjà le tracer, mais aucun appelant ne le remplissait :
 * le reçu de dette n'affichait donc jamais la dette. `balance_before` et
 * `balance_after` sont pourtant exposés par l'API depuis l'origine.
 */
export function debtBlocks(
  debt: DebtData | undefined,
  overrides?: CurrencyOverrides
): Block[] {
  if (!debt || debt.before === undefined || debt.after === undefined) return [];

  const settled = debt.after <= 0.005;
  const rows: KvRow[] = [
    {
      label: "Dette avant",
      value: formatMoney(debt.before, debt.currency, overrides),
    },
  ];
  if (!settled) {
    rows.push({
      label: "Dette restante",
      value: formatMoney(debt.after, debt.currency, overrides),
      strong: true,
    });
  }

  return compact<Block>([
    { kind: "space", size: "sm" },
    { kind: "rule", weight: "light" },
    { kind: "amounts", rows, role: "body" },
    settled && { kind: "space", size: "sm" },
    // Pastille inversée plutôt qu'un « SOLDÉE » de 9 pt noyé dans une ligne :
    // c'est l'information que le client est venu chercher.
    settled && { kind: "chip", text: "DETTE SOLDÉE" },
  ]);
}
