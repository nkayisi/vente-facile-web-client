"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PeriodMode = "all" | "today" | "week" | "month" | "custom";

/**
 * Valeur portée par le filtre. `date_from` / `date_to` sont dérivés du mode,
 * sauf en mode personnalisé où l'utilisateur les saisit, et en mode mois où
 * c'est `month` qui fait foi (le serveur borne le mois entier lui-même, ce qui
 * évite de faire deviner à l'utilisateur si un mois compte 30 ou 31 jours).
 */
export interface PeriodValue {
  mode: PeriodMode;
  month?: string;
  date_from?: string;
  date_to?: string;
}

const MODE_OPTIONS: Array<{ value: PeriodMode; label: string }> = [
  { value: "all", label: "Tout l'historique" },
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "7 derniers jours" },
  { value: "month", label: "Un mois précis" },
  { value: "custom", label: "Période personnalisée" },
];

function isoDay(date: Date): string {
  // Découpe locale et non `toISOString()`, qui repasse en UTC et décale la
  // journée d'un cran pour toute la soirée à Kinshasa (UTC+1).
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Traduit un mode en paramètres de requête compris par le backend.
 * Exportée pour que les pages construisent leurs filtres sans dupliquer la règle.
 */
export function periodToParams(value: PeriodValue): {
  month?: string;
  date_from?: string;
  date_to?: string;
} {
  const today = new Date();

  switch (value.mode) {
    case "today":
      return { date_from: isoDay(today), date_to: isoDay(today) };
    case "week": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { date_from: isoDay(start), date_to: isoDay(today) };
    }
    case "month":
      return { month: value.month || currentMonth() };
    case "custom":
      return { date_from: value.date_from, date_to: value.date_to };
    default:
      return {};
  }
}

interface PeriodFilterProps {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  className?: string;
  label?: string;
}

/**
 * Sélecteur de période, aligné sur celui de la page Rapports.
 *
 * Volontairement bâti sur `<input type="date">` natif : le dépôt n'embarque ni
 * `react-day-picker` ni composant calendrier, et l'input natif est déjà celui
 * qu'utilisent les autres écrans de rapport.
 */
export function PeriodFilter({
  value,
  onChange,
  className = "",
  label = "Période",
}: PeriodFilterProps) {
  return (
    <div className={`flex flex-wrap items-end gap-3 ${className}`}>
      <div className="min-w-[190px] flex-1 sm:flex-none">
        <Label className="mb-1.5 block text-xs text-muted-foreground">
          {label}
        </Label>
        <Select
          value={value.mode}
          onValueChange={(mode) =>
            onChange({
              ...value,
              mode: mode as PeriodMode,
              month:
                mode === "month" ? value.month || currentMonth() : value.month,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choisir une période" />
          </SelectTrigger>
          <SelectContent>
            {MODE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.mode === "month" && (
        <div className="min-w-[160px]">
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Mois
          </Label>
          <Input
            type="month"
            value={value.month || currentMonth()}
            onChange={(event) =>
              onChange({ ...value, month: event.target.value })
            }
          />
        </div>
      )}

      {value.mode === "custom" && (
        <>
          <div className="min-w-[150px]">
            <Label className="mb-1.5 block text-xs text-muted-foreground">
              Du
            </Label>
            <Input
              type="date"
              value={value.date_from || ""}
              max={value.date_to || undefined}
              onChange={(event) =>
                onChange({ ...value, date_from: event.target.value })
              }
            />
          </div>
          <div className="min-w-[150px]">
            <Label className="mb-1.5 block text-xs text-muted-foreground">
              Au
            </Label>
            <Input
              type="date"
              value={value.date_to || ""}
              min={value.date_from || undefined}
              onChange={(event) =>
                onChange({ ...value, date_to: event.target.value })
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
