"use client";

import { StatValue } from "@/components/shared/StatValue";
import type { MoneyHelpers } from "@/lib/currency";

interface MultiCurrencyTotalProps {
  /** Lignes à totaliser. La devise de CHAQUE ligne est celle du montant. */
  rows: Array<{ amount: string | number; currency?: string | null }>;
  money: MoneyHelpers;
  className?: string;
  color?: string;
}

/**
 * Total d'une liste de montants, ventilé par devise.
 *
 * Un `reduce` sur `amount_due` en ignorant `sale.currency` additionnait 50 USD
 * et 40 000 CDF en un nombre qui ne veut rien dire, puis l'affichait avec le
 * symbole de la devise principale. Une créance de 50 $ se lisait « 50 FC ».
 *
 * Ici chaque devise garde sa ligne. Quand il n'y en a qu'une - le cas courant -
 * l'affichage est identique à un total simple : aucune verbosité inutile.
 */
export function MultiCurrencyTotal({
  rows,
  money,
  className,
  color,
}: MultiCurrencyTotalProps) {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const code = row.currency || money.primaryCode;
    const value =
      typeof row.amount === "string" ? parseFloat(row.amount) : row.amount;
    if (isNaN(value)) continue;
    totals.set(code, (totals.get(code) ?? 0) + value);
  }

  if (totals.size === 0) {
    return (
      <StatValue
        value={money.money(0, money.primaryCode)}
        className={className}
        color={color}
      />
    );
  }

  const lines = [...totals.entries()].sort(([a], [b]) => a.localeCompare(b));

  if (lines.length === 1) {
    const [code, amount] = lines[0];
    return (
      <StatValue
        value={money.money(amount, code)}
        className={className}
        color={color}
      />
    );
  }

  return (
    <div className="space-y-0.5">
      {lines.map(([code, amount]) => (
        <StatValue
          key={code}
          value={money.money(amount, code)}
          className={className}
          color={color}
        />
      ))}
    </div>
  );
}
