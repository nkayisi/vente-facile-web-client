"use client";

import { AlertTriangle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  libelleCanal,
  motCanal,
  rappelConditionnement,
  type ErreursQuantite,
} from "@/lib/stock/lignes-conditionnees";
import { type Packaging } from "@/lib/packaging";

interface PackagedQuantityInputProps {
  /** Conditionnement du produit. `null` : le champ retombe sur une saisie simple. */
  packaging: Packaging | null;
  packages?: number;
  loose?: number;
  quantity?: number;
  onChange: (next: { packages?: number; loose?: number; quantity?: number }) => void;
  /** Récapitulatif de conversion, déjà composé : « Vous transférez … = … ». */
  recap?: string | null;
  /** Dépassement du disponible : un AVERTISSEMENT, jamais un refus. */
  alerte?: string | null;
  /** Messages sous les champs fautifs. */
  erreurs?: ErreursQuantite;
  /** Libellé du champ en saisie simple */
  simpleLabel?: string;
  disabled?: boolean;
  idPrefix?: string;
}

/**
 * Saisie d'une quantité dans la forme sous laquelle le marchand la manipule.
 *
 * Un produit vendu par contenant se compte « 3 cartons + 2 bouteilles », jamais
 * 38 : c'est ce que l'opérateur a sous les yeux dans l'entrepôt, et lui faire
 * poser la multiplication est la première source d'erreur de stock. Un produit
 * vendu uniquement en gros n'expose pas la case au détail, un contenant ne s'y
 * ouvrant pas.
 *
 * Les valeurs saisies partent telles quelles au serveur, qui reste seul à
 * convertir : le total affiché ici n'est qu'un contrôle de relecture.
 *
 * ⚠ `step="1"` a été retiré : les quantités portent TROIS décimales dans ce
 * projet, et un pas entier fait rejeter « 1,5 » par la validation native du
 * navigateur, sans message que l'écran contrôle.
 */
export function PackagedQuantityInput({
  packaging,
  packages,
  loose,
  quantity,
  onChange,
  recap,
  alerte,
  erreurs = {},
  simpleLabel = "Quantité",
  disabled = false,
  idPrefix = "qty",
}: PackagedQuantityInputProps) {
  const lire = (v: string) => (v === "" ? undefined : parseFloat(v.replace(",", ".")));

  if (!packaging) {
    return (
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}_quantity`}>{simpleLabel}</Label>
        <Input
          id={`${idPrefix}_quantity`}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          placeholder="0"
          value={quantity ?? ""}
          disabled={disabled}
          aria-invalid={Boolean(erreurs.vrac)}
          aria-describedby={erreurs.vrac ? `${idPrefix}_quantity_error` : undefined}
          onChange={e => onChange({ quantity: lire(e.target.value) })}
        />
        {erreurs.vrac && (
          <p id={`${idPrefix}_quantity_error`} className="text-sm text-destructive">
            {erreurs.vrac}
          </p>
        )}
        {alerte && <Avertissement message={alerte} />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Le facteur EN TÊTE, pas en pied : il se lit avant de taper, sinon il
          ne sert qu'à constater l'erreur après coup. */}
      <p className="text-xs text-muted-foreground">{rappelConditionnement(packaging)}</p>

      <div className={`grid gap-4 ${packaging.packageOnly ? "" : "sm:grid-cols-2"}`}>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}_packages`}>{libelleCanal(packaging.packageWord)}</Label>
          <Input
            id={`${idPrefix}_packages`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="0"
            value={packages ?? ""}
            disabled={disabled}
            aria-invalid={Boolean(erreurs.contenants)}
            aria-describedby={erreurs.contenants ? `${idPrefix}_packages_error` : undefined}
            onChange={e => onChange({ packages: lire(e.target.value), loose })}
          />
          {erreurs.contenants && (
            <p id={`${idPrefix}_packages_error`} className="text-sm text-destructive">
              {erreurs.contenants}
            </p>
          )}
        </div>

        {!packaging.packageOnly && (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}_loose`}>{libelleCanal(packaging.retailWord)}</Label>
            <Input
              id={`${idPrefix}_loose`}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="0"
              value={loose ?? ""}
              disabled={disabled}
              aria-invalid={Boolean(erreurs.vrac)}
              aria-describedby={erreurs.vrac ? `${idPrefix}_loose_error` : undefined}
              onChange={e => onChange({ packages, loose: lire(e.target.value) })}
            />
            {erreurs.vrac && (
              <p id={`${idPrefix}_loose_error`} className="text-sm text-destructive">
                {erreurs.vrac}
              </p>
            )}
          </div>
        )}
      </div>

      {packaging.packageOnly && (
        <p className="text-xs text-muted-foreground">
          {/* « en X » et non « des X » : le GENRE d'un nom de contenant n'est
              pas dérivable sans lexique, et le nom vient du marchand. */}
          {`Aucune unité isolée : cet article se manipule uniquement en ${motCanal(
            packaging.packageWord
          )}.`}
        </p>
      )}

      {recap && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{recap}</p>
      )}

      {alerte && <Avertissement message={alerte} />}
    </div>
  );
}

/**
 * L'avertissement de disponible.
 *
 * Il porte les jetons `--warning`, posés dans les deux thèmes : les couleurs en
 * dur (`bg-orange-50`, `text-orange-900`) qu'il portait avant ne veulent rien
 * dire hors du thème clair, et l'orange est déjà la couleur de MARQUE de ce
 * back-office - un avertissement peint en orange s'y lit comme une mise en
 * avant, pas comme une réserve.
 */
function Avertissement({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <span>{message}</span>
    </p>
  );
}
