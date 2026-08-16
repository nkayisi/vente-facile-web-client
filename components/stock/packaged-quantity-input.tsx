"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pluralizeUnit } from "@/lib/units";
import { formatPackaged, toBaseQuantity, type Packaging } from "@/lib/packaging";

interface PackagedQuantityInputProps {
  /** Conditionnement du produit. `null` : le champ retombe sur une saisie simple. */
  packaging: Packaging | null;
  packages?: number;
  loose?: number;
  quantity?: number;
  onChange: (next: { packages?: number; loose?: number; quantity?: number }) => void;
  /** Verbe de l'opération, pour le récapitulatif : « comptez », « transférez »… */
  verb?: string;
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
 * convertir : le total affiché ici n'est qu'un contrôle visuel.
 */
export function PackagedQuantityInput({
  packaging,
  packages,
  loose,
  quantity,
  onChange,
  verb = "saisissez",
  simpleLabel = "Quantité",
  disabled = false,
  idPrefix = "qty",
}: PackagedQuantityInputProps) {
  if (!packaging) {
    return (
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}_quantity`}>{simpleLabel}</Label>
        <Input
          id={`${idPrefix}_quantity`}
          type="number"
          min="0"
          step="1"
          value={quantity ?? ""}
          disabled={disabled}
          onChange={e =>
            onChange({ quantity: e.target.value ? parseFloat(e.target.value) : undefined })
          }
        />
      </div>
    );
  }

  const packageWordPlural = pluralizeUnit(packaging.packageWord, 2);
  const retailWordPlural = pluralizeUnit(packaging.retailWord, 2);
  const total = toBaseQuantity(packaging, packages ?? 0, loose ?? 0);

  return (
    <div className="space-y-2">
      <div className={`grid gap-4 ${packaging.packageOnly ? "" : "sm:grid-cols-2"}`}>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}_packages`}>Nombre de {packageWordPlural}</Label>
          <Input
            id={`${idPrefix}_packages`}
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={packages ?? ""}
            disabled={disabled}
            onChange={e =>
              onChange({
                packages: e.target.value ? parseFloat(e.target.value) : undefined,
                loose,
              })
            }
          />
        </div>

        {!packaging.packageOnly && (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}_loose`}>
              Nombre de {retailWordPlural} à l&apos;unité
            </Label>
            <Input
              id={`${idPrefix}_loose`}
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={loose ?? ""}
              disabled={disabled}
              onChange={e =>
                onChange({
                  packages,
                  loose: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
            />
          </div>
        )}
      </div>

      {total > 0 && (
        <p className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          Vous {verb} {formatPackaged(packaging, total, loose ?? 0)} ={" "}
          {total} {pluralizeUnit(packaging.retailWord, total)}.
        </p>
      )}
    </div>
  );
}
