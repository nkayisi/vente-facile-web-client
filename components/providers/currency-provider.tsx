"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { CurrencyInfo } from "@/actions/organization.actions";
import { setDefaultCurrency } from "@/lib/format";

interface CurrencyContextValue {
  currency: CurrencyInfo;
  formatPrice: (amount: string | number) => string;
  formatPriceRaw: (amount: string | number) => { value: string; symbol: string };
}

const DEFAULT_CURRENCY: CurrencyInfo = {
  code: "CDF",
  name: "Franc Congolais",
  symbol: "FC",
  decimal_places: 0,
};

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT_CURRENCY,
  formatPrice: () => "0 FC",
  formatPriceRaw: () => ({ value: "0", symbol: "FC" }),
});

export function CurrencyProvider({
  children,
  currencyInfo,
}: {
  children: React.ReactNode;
  currencyInfo?: CurrencyInfo | null;
}) {
  const currency = currencyInfo || DEFAULT_CURRENCY;

  // Sync module-level default currency so all formatPrice() calls use the right currency
  useEffect(() => {
    setDefaultCurrency(currency.symbol, currency.decimal_places, currency.code);
  }, [currency]);

  const value = useMemo<CurrencyContextValue>(() => {
    const formatPrice = (amount: string | number): string => {
      const num = typeof amount === "string" ? parseFloat(amount) : amount;
      if (isNaN(num)) return `0 ${currency.symbol}`;

      const formatted = new Intl.NumberFormat("fr-CD", {
        minimumFractionDigits: 0,
        maximumFractionDigits: currency.decimal_places,
      }).format(num);

      return `${formatted} ${currency.symbol}`;
    };

    const formatPriceRaw = (amount: string | number) => {
      const num = typeof amount === "string" ? parseFloat(amount) : amount;
      if (isNaN(num)) return { value: "0", symbol: currency.symbol };

      const formatted = new Intl.NumberFormat("fr-CD", {
        minimumFractionDigits: 0,
        maximumFractionDigits: currency.decimal_places,
      }).format(num);

      return { value: formatted, symbol: currency.symbol };
    };

    return { currency, formatPrice, formatPriceRaw };
  }, [currency]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

export { DEFAULT_CURRENCY };
export type { CurrencyInfo };
