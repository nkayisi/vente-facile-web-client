/**
 * Liste complète des devises supportées par la plateforme
 */

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  // Afrique
  { code: "CDF", name: "Franc Congolais", symbol: "FC", decimal_places: 0 },
  { code: "XAF", name: "Franc CFA (CEMAC)", symbol: "FCFA", decimal_places: 0 },
  { code: "XOF", name: "Franc CFA (UEMOA)", symbol: "FCFA", decimal_places: 0 },
  { code: "ZAR", name: "Rand Sud-Africain", symbol: "R", decimal_places: 2 },
  { code: "NGN", name: "Naira Nigérian", symbol: "₦", decimal_places: 2 },
  { code: "KES", name: "Shilling Kenyan", symbol: "KSh", decimal_places: 2 },
  { code: "GHS", name: "Cedi Ghanéen", symbol: "GH₵", decimal_places: 2 },
  { code: "TZS", name: "Shilling Tanzanien", symbol: "TSh", decimal_places: 2 },
  { code: "UGX", name: "Shilling Ougandais", symbol: "USh", decimal_places: 0 },
  { code: "RWF", name: "Franc Rwandais", symbol: "FRw", decimal_places: 0 },
  { code: "MAD", name: "Dirham Marocain", symbol: "DH", decimal_places: 2 },
  { code: "EGP", name: "Livre Égyptienne", symbol: "E£", decimal_places: 2 },
  
  // Devises internationales majeures
  { code: "USD", name: "Dollar Américain", symbol: "$", decimal_places: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimal_places: 2 },
  { code: "GBP", name: "Livre Sterling", symbol: "£", decimal_places: 2 },
  { code: "CHF", name: "Franc Suisse", symbol: "CHF", decimal_places: 2 },
  { code: "CAD", name: "Dollar Canadien", symbol: "C$", decimal_places: 2 },
  { code: "AUD", name: "Dollar Australien", symbol: "A$", decimal_places: 2 },
  { code: "JPY", name: "Yen Japonais", symbol: "¥", decimal_places: 0 },
  { code: "CNY", name: "Yuan Chinois", symbol: "¥", decimal_places: 2 },
  { code: "INR", name: "Roupie Indienne", symbol: "₹", decimal_places: 2 },
];

/**
 * Obtenir une devise par son code
 */
export function getCurrencyByCode(code: string): CurrencyOption | undefined {
  return SUPPORTED_CURRENCIES.find(c => c.code === code);
}

/**
 * Obtenir le symbole d'une devise par son code
 */
export function getCurrencySymbol(code: string): string {
  const currency = getCurrencyByCode(code);
  return currency?.symbol || code;
}

/**
 * Obtenir le nom complet d'une devise par son code
 */
export function getCurrencyName(code: string): string {
  const currency = getCurrencyByCode(code);
  return currency?.name || code;
}
