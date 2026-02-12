/**
 * Utilitaires de formatage pour l'affichage des nombres et prix.
 * Tous les chiffres sont affichés en entier (pas d'abréviation k/M).
 */

/**
 * Formate un prix en CDF avec séparateur de milliers.
 * Ex: 20000 → "20 000 CDF", 1500.50 → "1 501 CDF"
 */
export function formatPrice(price: string | number): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "0 CDF";
  return new Intl.NumberFormat("fr-CD", {
    style: "currency",
    currency: "CDF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
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
