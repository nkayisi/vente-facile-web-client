"use client";

import { ChevronDownIcon } from "lucide-react";

import type { MoneyHelpers } from "@/lib/currency";
import type { OrganizationCurrency } from "@/actions/settings.actions";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CurrencyAmountInputProps {
  label: string;
  amount: string;
  currency: string;
  currencies: OrganizationCurrency[];
  money: MoneyHelpers;
  onAmountChange: (amount: string) => void;
  /** Reçoit la devise choisie ET le montant reconverti dans celle-ci. */
  onCurrencyChange: (currency: string, convertedAmount: string) => void;
  id?: string;
  placeholder?: string;
}

/**
 * Saisie d'un montant avec sa devise, pour les surfaces multi-devise
 * (dépenses, entrées de caisse).
 *
 * Le sélecteur de devise est un addon DANS le champ plutôt qu'une rangée de
 * puces au-dessus : la ligne de label reste alignée sur les autres champs du
 * formulaire, et la devise se lit là où on lit le montant.
 *
 * Il n'apparaît que si l'établissement a plusieurs devises activées — une
 * boutique mono-devise voit un champ ordinaire.
 */
export function CurrencyAmountInput({
  label,
  amount,
  currency,
  currencies,
  money,
  onAmountChange,
  onCurrencyChange,
  id = "amount",
  placeholder = "0.00",
}: CurrencyAmountInputProps) {
  const isMultiCurrency = currencies.length > 1;
  const parsed = parseFloat(amount);
  const showConversion =
    isMultiCurrency &&
    currency !== money.primaryCode &&
    !isNaN(parsed) &&
    parsed > 0;

  function selectCurrency(next: string) {
    // Le montant déjà saisi est ré-exprimé dans la devise choisie : changer de
    // devise ne doit pas changer la valeur voulue par le marchand.
    const converted =
      !isNaN(parsed) && parsed > 0
        ? money.convMoney(parsed, currency, next).toString()
        : amount;
    onCurrencyChange(next, converted);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label} *</Label>
      <InputGroup>
        <InputGroupInput
          id={id}
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder={placeholder}
        />
        <InputGroupAddon align="inline-end">
          {isMultiCurrency ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <InputGroupButton className="text-muted-foreground tabular-nums">
                  {currency}
                  <ChevronDownIcon />
                </InputGroupButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-16">
                <DropdownMenuGroup>
                  {currencies.map((c) => (
                    <DropdownMenuItem
                      key={c.currency_code}
                      onClick={() => selectCurrency(c.currency_code)}
                    >
                      <span className="tabular-nums">{c.currency_code}</span>
                      <span className="text-muted-foreground">
                        {c.currency_symbol}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-sm text-muted-foreground tabular-nums">
              {money.symbolOf(currency)}
            </span>
          )}
        </InputGroupAddon>
      </InputGroup>
      {showConversion && (
        <p className="text-xs text-muted-foreground">
          = {money.money(money.convMoney(parsed, currency, money.primaryCode), money.primaryCode)}
          {"  ·  "}
          {money.rateLabel(currency, money.primaryCode)}
        </p>
      )}
    </div>
  );
}
