"use client";

import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { formatPrice } from "@/lib/format";
import { computeMargin } from "@/lib/pricing";

export type PriceChannel = "retail" | "wholesale";

interface ChannelPriceBlockProps {
  channel: PriceChannel;
  /** « Vente au détail », « Au détail · bouteille »… */
  title: string;
  /** Rappel de la conversion, affiché dans l'en-tête : « 1 carton = 12 bouteilles » */
  conversionHint?: string;
  currencySymbol: string;
  costLabel: string;
  sellingLabel: string;
  costPrice: number | null | undefined;
  sellingPrice: number | null | undefined;
  onCostChange: (value: number | null) => void;
  onSellingChange: (value: number | null) => void;
  costPlaceholder?: string;
  sellingPlaceholder?: string;
  errors?: Record<string, string>;
  costErrorKey?: string;
  sellingErrorKey?: string;
  /** Quantité saisie, rendue par le modale de mouvement seulement */
  quantitySlot?: ReactNode;
  /** Précision sous les champs : équivalent à l'unité, portée des prix… */
  footnote?: ReactNode;
  disabled?: boolean;
}

const CHANNEL_STYLES: Record<PriceChannel, { border: string; badge: string }> = {
  retail: {
    border: "border-slate-200",
    badge: "bg-slate-100 text-slate-700",
  },
  wholesale: {
    border: "border-orange-200",
    badge: "bg-orange-100 text-orange-700",
  },
};

/**
 * Un canal de vente et ses deux prix, dans un encadré à lui.
 *
 * C'est la brique qui rend la frontière gros/détail visible : au lieu de ranger
 * les champs par nature (les deux prix d'achat sur une ligne, les deux prix de
 * vente sur la suivante), chaque canal a son bloc, son unité et sa marge. Le
 * marchand lit « le carton, je l'achète 5 400 et je le vends 6 000 » sans
 * jamais avoir à rapprocher deux lignes éloignées.
 *
 * Partagé par la fiche produit et par le modale d'approvisionnement, qui y
 * glisse en plus une quantité via `quantitySlot`.
 */
export function ChannelPriceBlock({
  channel,
  title,
  conversionHint,
  currencySymbol,
  costLabel,
  sellingLabel,
  costPrice,
  sellingPrice,
  onCostChange,
  onSellingChange,
  costPlaceholder,
  sellingPlaceholder,
  errors = {},
  costErrorKey,
  sellingErrorKey,
  quantitySlot,
  footnote,
  disabled = false,
}: ChannelPriceBlockProps) {
  const styles = CHANNEL_STYLES[channel];
  const margin = computeMargin(costPrice, sellingPrice);
  const costError = costErrorKey ? errors[costErrorKey] : undefined;
  const sellingError = sellingErrorKey ? errors[sellingErrorKey] : undefined;

  const toNumber = (raw: string) => (raw === "" ? null : parseFloat(raw));

  return (
    <div className={`rounded-lg border ${styles.border} p-3 space-y-3`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles.badge}`}
        >
          {title}
        </span>
        {conversionHint && (
          <span className="text-xs text-gray-500">{conversionHint}</span>
        )}
      </div>

      {quantitySlot}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${channel}-cost`}>{costLabel}</Label>
          <InputGroup>
            <InputGroupInput
              id={`${channel}-cost`}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={costPrice ?? ""}
              onChange={e => onCostChange(toNumber(e.target.value))}
              placeholder={costPlaceholder}
              disabled={disabled}
              aria-invalid={!!costError}
            />
            <InputGroupAddon align="inline-end">
              <span className="text-sm text-muted-foreground">{currencySymbol}</span>
            </InputGroupAddon>
          </InputGroup>
          {costError && <p className="text-sm text-red-500">{costError}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${channel}-selling`}>{sellingLabel}</Label>
          <InputGroup>
            <InputGroupInput
              id={`${channel}-selling`}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={sellingPrice ?? ""}
              onChange={e => onSellingChange(toNumber(e.target.value))}
              placeholder={sellingPlaceholder}
              disabled={disabled}
              aria-invalid={!!sellingError}
            />
            <InputGroupAddon align="inline-end">
              <span className="text-sm text-muted-foreground">{currencySymbol}</span>
            </InputGroupAddon>
          </InputGroup>
          {sellingError && <p className="text-sm text-red-500">{sellingError}</p>}
        </div>
      </div>

      {margin && (
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border px-2.5 py-1.5 text-xs ${
            margin.isNonPositive
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200/70 bg-emerald-50/70 text-emerald-900"
          }`}
        >
          <span className="text-muted-foreground">Marge sur prix de vente</span>
          <span className="font-semibold tabular-nums">
            {margin.rate.toFixed(1)} %
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="tabular-nums">{formatPrice(margin.profit)}</span>
          {margin.isNonPositive && (
            <span className="font-medium text-red-700">
              Vous vendez à perte
            </span>
          )}
        </div>
      )}

      {footnote && <div className="text-xs text-gray-500">{footnote}</div>}
    </div>
  );
}
