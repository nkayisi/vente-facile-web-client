"use client";

import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SearchableSelectAsyncWithEmpty } from "@/components/ui/searchable-select-async-empty";
import { ChannelPriceBlock } from "@/components/products/channel-price-block";
import { createUnitSearchHandler } from "@/lib/select-search-handlers";
import { pluralizeUnit } from "@/lib/units";
import { packageEquivalent, retailEquivalent } from "@/lib/pricing";
import { formatPrice } from "@/lib/format";
import type { SellingMode } from "@/actions/products.actions";

const SELLING_MODES: Array<{ value: SellingMode; label: string; hint: string }> = [
  {
    value: "retail_only",
    label: "Au détail",
    hint: "À la pièce uniquement",
  },
  {
    value: "wholesale_only",
    label: "En gros",
    hint: "Par contenant entier uniquement",
  },
  {
    value: "wholesale_and_retail",
    label: "En gros et au détail",
    hint: "Les deux, avec deux prix",
  },
];

export interface SellingSetupValues {
  selling_mode?: SellingMode;
  unit?: string | null;
  packaging_unit?: string | null;
  units_per_package?: number | null;
  allow_auto_unpacking?: boolean;
  cost_price: number;
  package_cost_price?: number | null;
  selling_price: number;
  wholesale_price?: number | null;
}

interface SellingSetupFieldsProps {
  values: SellingSetupValues;
  onChange: (field: keyof SellingSetupValues, value: unknown) => void;
  errors: Record<string, string>;
  accessToken: string;
  organizationId: string;
  currencySymbol: string;
  unitLabel?: string;
  packagingUnitLabel?: string;
  /** Mode enregistré en base, pour détecter un changement de sens des prix. */
  initialSellingMode?: SellingMode;
  hadWholesalePrice?: boolean;
}

/**
 * Bloc « Vente et prix » du formulaire produit.
 *
 * Regroupe le type de vente, les unités et les quatre prix au même endroit :
 * le marchand décide comment il vend, puis saisit les prix correspondants.
 * Les champs sans objet pour le mode choisi ne sont pas affichés : c'est ce qui
 * garde le formulaire court.
 *
 * Partagé par les pages de création et de modification, qui ont chacune leur
 * propre formulaire.
 */
export function SellingSetupFields({
  values,
  onChange,
  errors,
  accessToken,
  organizationId,
  currencySymbol,
  unitLabel,
  packagingUnitLabel,
  initialSellingMode = "retail_only",
  hadWholesalePrice = false,
}: SellingSetupFieldsProps) {
  const mode = values.selling_mode ?? "retail_only";
  const isPackaged = mode !== "retail_only";
  const factor = values.units_per_package ?? 0;

  const [pickedRetailLabel, setPickedRetailLabel] = useState<string | null>(null);
  const [pickedPackageLabel, setPickedPackageLabel] = useState<string | null>(null);

  const retailWord = (pickedRetailLabel ?? unitLabel ?? "").trim() || "unité";
  const packageWord =
    (pickedPackageLabel ?? packagingUnitLabel ?? "").trim() || "contenant";
  const retailPlural = pluralizeUnit(retailWord, 2);

  // Basculer un produit vendu au détail vers le gros redéfinit le sens du prix
  // de gros déjà saisi : on le signale plutôt que de le réinterpréter en silence.
  const showWholesaleWarning =
    isPackaged && initialSellingMode === "retail_only" && hadWholesalePrice;

  /**
   * Dernière valeur proposée automatiquement pour chaque champ de prix.
   *
   * C'est ce qui permet de proposer sans jamais écraser : on ne recalcule un
   * prix que s'il est vide ou s'il vaut encore exactement ce qu'on avait
   * proposé. Un prix tapé par le marchand n'est donc jamais détruit, et il
   * peut légitimement s'écarter du ratio : acheter le carton 6 000 et vendre
   * la bouteille 550 plutôt que 500, c'est précisément sa marge de détail.
   */
  const suggested = useRef<Partial<Record<keyof SellingSetupValues, number | null>>>({});

  const canOverwrite = (field: keyof SellingSetupValues) => {
    const current = values[field] as number | null | undefined;
    return !current || current === suggested.current[field];
  };

  const suggest = (field: keyof SellingSetupValues, value: number | null) => {
    if (value === null || !canOverwrite(field)) return;
    suggested.current[field] = value;
    onChange(field, value);
  };

  /** Saisie d'un prix au conditionnement : propose l'équivalent à l'unité. */
  const setPackagePrice = (
    field: "package_cost_price" | "wholesale_price",
    value: number | null
  ) => {
    onChange(field, value);
    const retailField = field === "package_cost_price" ? "cost_price" : "selling_price";
    suggest(retailField, retailEquivalent(value, factor));
  };

  /** Saisie d'un prix à l'unité : propose l'équivalent au conditionnement. */
  const setRetailPrice = (
    field: "cost_price" | "selling_price",
    value: number | null
  ) => {
    onChange(field, value ?? 0);
    const packageField = field === "cost_price" ? "package_cost_price" : "wholesale_price";
    suggest(packageField, packageEquivalent(value, factor));
  };

  /** Prix de gros ramené à l'unité, pour comparer ce qui est comparable. */
  const wholesaleUnitPrice = retailEquivalent(values.wholesale_price, factor);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Vente et prix</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Type de vente</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {SELLING_MODES.map((option) => {
              const selected = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange("selling_mode", option.value)}
                  aria-pressed={selected}
                  className={`rounded-lg border px-3 py-2.5 text-left transition ${
                    selected
                      ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="block text-sm font-medium text-gray-900">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Unité {isPackaged && "(détail)"}</Label>
            <SearchableSelectAsyncWithEmpty
              value={values.unit ?? ""}
              onValueChange={(value, label) => {
                onChange("unit", value);
                setPickedRetailLabel(label ?? "");
              }}
              onSearch={createUnitSearchHandler(accessToken, organizationId)}
              placeholder="Pièce, bouteille, kg…"
              emptyLabel="Aucune unité"
            />
            {errors.unit && <p className="text-sm text-red-500">{errors.unit}</p>}
          </div>

          {isPackaged && (
            <div className="space-y-2">
              <Label>Contenant *</Label>
              <SearchableSelectAsyncWithEmpty
                value={values.packaging_unit ?? ""}
                onValueChange={(value, label) => {
                  onChange("packaging_unit", value);
                  setPickedPackageLabel(label ?? "");
                }}
                onSearch={createUnitSearchHandler(accessToken, organizationId)}
                placeholder="Paquet, carton, casier…"
                emptyLabel="Aucun contenant"
              />
              {errors.packaging_unit && (
                <p className="text-sm text-red-500">{errors.packaging_unit}</p>
              )}
            </div>
          )}
        </div>

        {/* Le nombre par contenant gouverne les deux canaux à la fois : il est
            placé au-dessus des deux blocs, sous forme de phrase, plutôt que
            rangé dans l'un des deux, ce qui laisserait croire qu'il n'appartient
            qu'à celui-là. */}
        {isPackaged && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
              <span>1 {packageWord} contient</span>
              <Input
                id="units_per_package"
                type="number"
                min="2"
                step="1"
                value={values.units_per_package ?? ""}
                onChange={(e) =>
                  onChange(
                    "units_per_package",
                    e.target.value ? parseInt(e.target.value, 10) : null
                  )
                }
                placeholder="12"
                className={`w-24 ${errors.units_per_package ? "border-red-500" : ""}`}
              />
              <span>{retailPlural} *</span>
            </div>
            {errors.units_per_package && (
              <p className="text-sm text-red-500">{errors.units_per_package}</p>
            )}
          </div>
        )}

        {/* Un bloc par canal de vente : le marchand lit d'un trait ce que lui
            coûte et ce que lui rapporte la bouteille, puis le carton. */}
        <div className="space-y-3 border-t pt-4">
          {mode !== "wholesale_only" && (
            <ChannelPriceBlock
              channel="retail"
              title={`Vente au détail · ${retailWord}`}
              currencySymbol={currencySymbol}
              costLabel={`Prix d'achat d'une ${retailWord}`}
              sellingLabel={`Prix de vente d'une ${retailWord} *`}
              costPrice={values.cost_price || null}
              sellingPrice={values.selling_price || null}
              onCostChange={(value) => setRetailPrice("cost_price", value)}
              onSellingChange={(value) => setRetailPrice("selling_price", value)}
              errors={errors}
              costErrorKey="cost_price"
              sellingErrorKey="selling_price"
            />
          )}

          {isPackaged && (
            <ChannelPriceBlock
              channel="wholesale"
              title={`Vente en gros · ${packageWord}`}
              conversionHint={
                factor > 1 ? `1 ${packageWord} = ${factor} ${retailPlural}` : undefined
              }
              currencySymbol={currencySymbol}
              costLabel={`Prix d'achat d'un ${packageWord}`}
              sellingLabel={`Prix de vente d'un ${packageWord} *`}
              costPrice={values.package_cost_price ?? null}
              sellingPrice={values.wholesale_price ?? null}
              onCostChange={(value) => setPackagePrice("package_cost_price", value)}
              onSellingChange={(value) => setPackagePrice("wholesale_price", value)}
              errors={errors}
              costErrorKey="package_cost_price"
              sellingErrorKey="wholesale_price"
              footnote={
                mode === "wholesale_and_retail" && wholesaleUnitPrice
                  ? `Soit ${formatPrice(wholesaleUnitPrice, currencySymbol)} la ${retailWord} achetée en gros`
                  : undefined
              }
            />
          )}

          {showWholesaleWarning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-900">
                Ce prix était enregistré comme prix de gros à la pièce. Vérifiez
                qu&apos;il correspond bien au prix d&apos;un {packageWord} entier.
              </p>
            </div>
          )}
        </div>

        {mode === "wholesale_and_retail" && (
          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
            <div className="pr-4">
              <Label htmlFor="allow_auto_unpacking">
                Ouvrir un {packageWord} automatiquement
              </Label>
              <p className="text-sm text-gray-500">
                Quand il ne reste plus de {retailPlural} à l&apos;unité, un{" "}
                {packageWord} est ouvert tout seul pour servir le client.
              </p>
            </div>
            <Switch
              id="allow_auto_unpacking"
              checked={values.allow_auto_unpacking ?? true}
              onCheckedChange={(checked) => onChange("allow_auto_unpacking", checked)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Validation partagée. Le backend reste l'autorité. */
export function validateSellingSetup(
  values: SellingSetupValues
): Record<string, string> {
  const errors: Record<string, string> = {};
  const mode = values.selling_mode ?? "retail_only";

  if (mode !== "wholesale_only") {
    if (!values.selling_price || values.selling_price <= 0) {
      errors.selling_price = "Indiquez le prix de vente";
    } else if (values.selling_price < (values.cost_price ?? 0)) {
      errors.selling_price =
        "Le prix de vente ne peut pas être inférieur au prix d'achat";
    }
  }

  if (mode === "retail_only") return errors;

  if (!values.packaging_unit) {
    errors.packaging_unit = "Indiquez le contenant";
  }
  if (!values.unit) {
    errors.unit = "Indiquez l'unité de détail";
  }
  if (!values.units_per_package || values.units_per_package < 2) {
    errors.units_per_package = "Indiquez le nombre par contenant (au moins 2)";
  }
  if (!values.wholesale_price || values.wholesale_price <= 0) {
    errors.wholesale_price = "Indiquez le prix de vente du contenant";
  }

  // En gros seul, aucun prix d'achat au détail n'est saisi : c'est celui du
  // contenant qui fait foi, le serveur en déduit le prix unitaire.
  if (
    mode === "wholesale_only" &&
    !values.package_cost_price &&
    !values.cost_price
  ) {
    errors.package_cost_price = "Indiquez le prix d'achat du contenant";
  }

  // Pas de règle bloquante entre prix de vente et prix d'achat du contenant :
  // des produits enregistrés avant cette page sont déjà dans ce cas et
  // deviendraient impossibles à modifier. Une marge négative s'affiche en rouge
  // dans le bloc concerné, ce qui suffit à alerter sans enfermer le marchand.

  return errors;
}
