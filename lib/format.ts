/**
 * Utilitaires de formatage pour l'affichage des nombres et prix.
 * Tous les chiffres sont affichés en entier (pas d'abréviation k/M).
 */

// Module-level default currency (set by CurrencyProvider at mount)
let _defaultSymbol = "FC";
let _defaultDecimals = 0;
let _defaultCode = "CDF";

export function setDefaultCurrency(symbol: string, decimalPlaces: number, code?: string) {
  _defaultSymbol = symbol;
  _defaultDecimals = decimalPlaces;
  if (code) _defaultCode = code;
}

export function getDefaultCurrency() {
  return { symbol: _defaultSymbol, decimal_places: _defaultDecimals, code: _defaultCode };
}

/**
 * Formate un prix avec séparateur de milliers et symbole de devise.
 * Utilise la devise par défaut de l'organisation si aucun paramètre n'est fourni.
 * Ex: formatPrice(20000) → "20 000 FC"
 * Ex: formatPrice(10, "$", 2) → "10,00 $"
 */
export function formatPrice(
  price: string | number,
  symbol?: string,
  decimalPlaces?: number
): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  const sym = symbol || _defaultSymbol;
  const decimals = decimalPlaces ?? _defaultDecimals;
  if (isNaN(num)) return `0 ${sym}`;
  const formatted = new Intl.NumberFormat("fr-CD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num);
  return `${formatted} ${sym}`;
}

/**
 * Formate un nombre entier avec séparateur de milliers.
 * Ex: 20000 → "20 000", 1500 → "1 500"
 */
export function formatNumber(num: number | string): string {
  const n = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(n)) return "0";
  return new Intl.NumberFormat("fr-CD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Formate un nombre décimal (ex: quantités) avec séparateur de milliers.
 * Ex: 20000.500 → "20 000,500"
 */
export function formatDecimal(num: number | string, decimals: number = 3): string {
  const n = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(n)) return "0";
  return new Intl.NumberFormat("fr-CD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n);
}

/**
 * Formate un pourcentage.
 * Ex: 15.5 → "15,5%"
 */
export function formatPercent(num: number | string): string {
  const n = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(n)) return "0%";
  return new Intl.NumberFormat("fr-CD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n) + "%";
}

/**
 * Formate une date en format court français.
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-CD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Formate une date avec heure.
 */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-CD", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
