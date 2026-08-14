/**
 * Helpers monétaires multi-devise.
 *
 * Convention du projet (identique côté backend) :
 * `OrganizationCurrency.exchange_rate` = nombre d'unités de la devise
 * PRINCIPALE pour 1 unité de cette devise (1 USD = 2800 CDF ⇒ taux 2800).
 * La devise principale a toujours un taux de 1.
 *   - vers la principale : montant × taux
 *   - depuis la principale : montant ÷ taux
 *   - entre deux devises : on passe par la principale.
 *
 * Chaque montant est formaté avec le symbole ET le nombre de décimales de SA
 * devise (CDF = 0, USD/EUR = 2). On n'additionne jamais deux devises.
 */
import type { OrganizationCurrency } from "@/actions/settings.actions";
import type { CurrencyInfo } from "@/actions/organization.actions";

/** Tolérance de comparaison partagée entre affichage et validation. */
export const MONEY_EPS = 1e-6;

export interface MoneyHelpers {
  /** Devises actives de l'organisation, telles que renvoyées par l'API. */
  currencies: OrganizationCurrency[];
  /** Code de la devise principale. */
  primaryCode: string;
  /** Décimales d'affichage d'une devise (CDF = 0, USD = 2). */
  decimalsOf: (code: string) => number;
  /** Symbole d'une devise (repli : le code lui-même). */
  symbolOf: (code: string) => string;
  /** Taux vers la devise principale (toujours > 0). */
  rateOf: (code: string) => number;
  /** Convertit un montant d'une devise à une autre, via la principale. */
  convertAmount: (amount: number, from: string, to: string) => number;
  /** Arrondit au nombre de décimales de la devise. */
  roundMoney: (amount: number, code: string) => number;
  /** Convertit puis arrondit dans la devise cible. */
  convMoney: (amount: number, from: string, to: string) => number;
  /** Montant formaté avec son symbole : « 46 000 FC ». */
  money: (amount: string | number, code: string) => string;
  /** Montant formaté SANS symbole (quand le code est déjà affiché à côté). */
  amountOnly: (amount: string | number, code: string) => string;
}

/**
 * Construit les helpers à partir des devises de l'organisation.
 *
 * `fallback` sert tant que la liste n'est pas chargée, ou pour une devise
 * inconnue (données historiques) : c'est la devise par défaut de l'org exposée
 * par `useCurrency()`.
 */
export function createMoneyHelpers(
  currencies: OrganizationCurrency[],
  fallback: CurrencyInfo
): MoneyHelpers {
  const find = (code: string) =>
    currencies.find((c) => c.currency_code === code);

  const decimalsOf = (code: string) => {
    const c = find(code);
    return c ? c.currency_decimal_places : fallback.decimal_places ?? 2;
  };

  const symbolOf = (code: string) =>
    find(code)?.currency_symbol ||
    (code === fallback.code ? fallback.symbol : code);

  const rateOf = (code: string) => {
    const raw = parseFloat(find(code)?.exchange_rate ?? "1");
    return raw > 0 ? raw : 1;
  };

  const convertAmount = (amount: number, from: string, to: string) =>
    from === to ? amount : (amount * rateOf(from)) / rateOf(to);

  const roundMoney = (amount: number, code: string) => {
    const factor = 10 ** decimalsOf(code);
    return Math.round((amount + Number.EPSILON) * factor) / factor;
  };

  const convMoney = (amount: number, from: string, to: string) =>
    roundMoney(convertAmount(amount, from, to), to);

  const format = (amount: string | number, code: string) => {
    const n = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("fr-CD", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimalsOf(code),
    }).format(isNaN(n) ? 0 : n);
  };

  return {
    currencies,
    primaryCode:
      currencies.find((c) => c.is_primary)?.currency_code || fallback.code,
    decimalsOf,
    symbolOf,
    rateOf,
    convertAmount,
    roundMoney,
    convMoney,
    money: (amount, code) => `${format(amount, code)} ${symbolOf(code)}`,
    amountOnly: format,
  };
}
