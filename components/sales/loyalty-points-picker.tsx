"use client";

import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatPoints } from "@/lib/format";

/**
 * Saisie du nombre de points à déduire d'une facture, en popover.
 *
 * Le POS gardait un champ déplié dans la modale d'encaissement, qui coûtait
 * trois lignes en permanence pour un geste ponctuel. Le popover rend la place
 * au récapitulatif et au montant reçu.
 *
 * Le composant ne connaît aucune règle métier : tous les plafonds lui sont
 * passés, calculés par l'appelant, qui reste le miroir du serveur.
 */

/** Arrondi d'une saisie de points au centième (les points sont fractionnaires). */
function roundPoints(value: number): number {
  return Math.floor(value * 100) / 100;
}

interface LoyaltyPointsPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** L'ancre du popover. Reçoit le `onClick` de bascule via `asChild`. */
  children: React.ReactNode;
  /** Solde du client, affiché pour situer la saisie. */
  balance: number;
  /** Seuil du programme en dessous duquel aucune réduction n'est accordée. */
  minPoints: number;
  /** Plus grand nombre de points utilisable sur cette facture. */
  maxPoints: number;
  /** Valeur monétaire d'un point, en devise principale. */
  pointValue: number;
  /** Part de la facture réglable en points, en devise principale. */
  maxAmount: number;
  /** Formatage monétaire fourni par l'appelant (devise, décimales). */
  formatAmount: (amount: number) => string;
  /** Valeur courante à l'ouverture, pour permettre la reprise. */
  initial?: number;
  onConfirm: (points: number) => void;
}

export function LoyaltyPointsPicker({
  open,
  onOpenChange,
  children,
  balance,
  minPoints,
  maxPoints,
  pointValue,
  maxAmount,
  formatAmount,
  initial = 0,
  onConfirm,
}: LoyaltyPointsPickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl border-amber-200 p-3 shadow-lg"
      >
        {/* Corps monté seulement à l'ouverture : la saisie repart de la valeur
            courante à chaque fois, sans état résiduel d'une session passée. */}
        {open && (
          <PickerBody
            balance={balance}
            minPoints={minPoints}
            maxPoints={maxPoints}
            pointValue={pointValue}
            maxAmount={maxAmount}
            formatAmount={formatAmount}
            initial={initial}
            onConfirm={(points) => {
              onConfirm(points);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

type PickerBodyProps = Omit<
  LoyaltyPointsPickerProps,
  "open" | "onOpenChange" | "children"
> & { onCancel: () => void };

function PickerBody({
  balance,
  minPoints,
  maxPoints,
  pointValue,
  maxAmount,
  formatAmount,
  initial = 0,
  onConfirm,
  onCancel,
}: PickerBodyProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(initial > 0 ? String(initial) : "");
  // Vrai quand la dernière frappe a été ramenée au plafond : le vendeur doit
  // savoir que sa valeur a bougé sous ses doigts.
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    // `onOpenAutoFocus` du popover pose le focus sur le premier élément ; on le
    // veut sur le champ, sélectionné, pour que la frappe remplace la valeur.
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => clearTimeout(timer);
  }, []);

  const parsed = parseFloat(draft.replace(",", "."));
  const points = Number.isFinite(parsed) ? roundPoints(parsed) : 0;
  const amount = points >= minPoints ? Math.min(points * pointValue, maxAmount) : 0;
  const canSubmit = points >= minPoints && points > 0;

  /**
   * Filtre la frappe et ramène au plafond.
   *
   * On garde une saisie libre (chiffres, un séparateur décimal) plutôt qu'un
   * `type="number"` : le clamp doit se voir dans le champ, pas seulement au
   * moment de valider.
   */
  const handleDraft = (raw: string) => {
    const cleaned = raw.replace(/[^\d.,]/g, "").replace(/[.,](?=.*[.,])/g, "");
    const value = parseFloat(cleaned.replace(",", "."));
    if (Number.isFinite(value) && roundPoints(value) > maxPoints) {
      setDraft(String(maxPoints));
      setClamped(true);
      return;
    }
    setDraft(cleaned);
    setClamped(false);
  };

  const useMaximum = () => {
    setDraft(String(maxPoints));
    setClamped(false);
  };

  return (
    <div
      className="flex flex-col gap-2.5"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (canSubmit) onConfirm(points);
        }
      }}
    >
      <div className="flex items-center gap-2 text-amber-800">
        <Star className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="text-sm font-semibold">
          {formatPoints(balance)} pts disponibles
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => handleDraft(e.target.value)}
          placeholder="0"
          aria-label="Nombre de points à déduire"
          className="h-11 w-full rounded-lg border border-amber-200 bg-white px-3 text-center text-lg font-bold tabular-nums text-amber-900 outline-none focus:border-amber-500"
        />
        <Button
          type="button"
          variant="outline"
          onClick={useMaximum}
          className="h-11 shrink-0 border-amber-300 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50"
        >
          Maximum
        </Button>
      </div>

      <div className="space-y-1 text-xs">
        <p className="text-amber-700">
          Déduction : <span className="font-semibold">{formatAmount(amount)}</span>
        </p>
        <p className="text-amber-500">
          Maximum {formatPoints(maxPoints)} pts sur cette facture, soit{" "}
          {formatAmount(maxAmount)}.
        </p>
        {clamped && (
          <p className="font-medium text-amber-700">
            Ramené à {formatPoints(maxPoints)} pts : c&apos;est le plafond de
            cette facture.
          </p>
        )}
        {points > 0 && points < minPoints && (
          <p className="font-medium text-red-600">
            En dessous de {formatPoints(minPoints)} pts, aucune réduction
            n&apos;est appliquée.
          </p>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-10 flex-1 rounded-lg text-[13px] font-semibold"
        >
          Annuler
        </Button>
        <Button
          type="button"
          onClick={() => onConfirm(points)}
          disabled={!canSubmit}
          className="h-10 flex-[2] rounded-lg bg-amber-600 text-[13px] font-bold text-white transition-transform hover:bg-amber-700 active:scale-[0.96] disabled:opacity-50"
        >
          Appliquer
        </Button>
      </div>
    </div>
  );
}
