/**
 * Arithmétique des prix, gros et détail.
 *
 * Miroir client de `apps/products/pricing.py` et de la partie prix de
 * `apps/inventory/packaging.py`. Le serveur reste l'autorité : ces fonctions
 * ne servent qu'à afficher une marge ou une conversion pendant la saisie.
 */

export interface Margin {
  /** Bénéfice par unité vendue, dans la devise de l'organisation */
  profit: number;
  /** Taux de marge sur le prix de vente, en pourcentage */
  rate: number;
  /** Vrai quand le prix de vente ne couvre pas le prix d'achat */
  isNonPositive: boolean;
}

/**
 * Marge sur prix de vente : (PV - PA) / PV.
 *
 * Convention unique de l'application. La marge sur prix d'achat (le taux de
 * marque) donne des nombres qui ne parlent à personne : un produit acheté 100
 * et revendu 1 000 y affiche 900 %, alors que la marge sur PV dit 90 %, et
 * qu'elle reste bornée à 100 % quel que soit le produit.
 *
 * Retourne `null` tant que les deux prix ne sont pas renseignés : afficher
 * « 100 % de marge » sur un prix d'achat encore vide serait un mensonge.
 */
export function computeMargin(
  costPrice: number | null | undefined,
  sellingPrice: number | null | undefined
): Margin | null {
  const cost = Number(costPrice ?? 0);
  const selling = Number(sellingPrice ?? 0);
  if (!(selling > 0) || !(cost > 0)) return null;

  const profit = selling - cost;
  return {
    profit,
    rate: (profit / selling) * 100,
    isNonPositive: profit <= 0,
  };
}

/** Prix d'une unité de détail déduit du prix d'un conditionnement. */
export function retailEquivalent(
  packagePrice: number | null | undefined,
  factor: number | null | undefined
): number | null {
  const price = Number(packagePrice ?? 0);
  const perPackage = Number(factor ?? 0);
  if (!(price > 0) || perPackage < 2) return null;
  return Math.round((price / perPackage) * 100) / 100;
}

/** Prix d'un conditionnement déduit du prix d'une unité de détail. */
export function packageEquivalent(
  unitPrice: number | null | undefined,
  factor: number | null | undefined
): number | null {
  const price = Number(unitPrice ?? 0);
  const perPackage = Number(factor ?? 0);
  if (!(price > 0) || perPackage < 2) return null;
  return Math.round(price * perPackage * 100) / 100;
}

/**
 * Coût unitaire d'une entrée achetée en partie au conditionnement, en partie à
 * l'unité : ce qui a été payé, divisé par ce qui a été reçu.
 *
 * Reproduit `PackagingService.blended_unit_cost`. Le prix manquant est complété
 * par conversion, exactement comme le fait le serveur.
 */
export function blendedUnitCost({
  packageQuantity,
  packageCost,
  looseQuantity,
  looseCost,
  factor,
}: {
  packageQuantity?: number | null;
  packageCost?: number | null;
  looseQuantity?: number | null;
  looseCost?: number | null;
  factor?: number | null;
}): number | null {
  const packages = Number(packageQuantity ?? 0);
  const loose = Number(looseQuantity ?? 0);
  const perPackage = Number(factor ?? 0);

  let packagePrice = Number(packageCost ?? 0) || null;
  let loosePrice = Number(looseCost ?? 0) || null;
  if (packagePrice === null && loosePrice === null) return null;

  if (perPackage < 2) return loosePrice;

  if (packagePrice === null) packagePrice = packageEquivalent(loosePrice, perPackage);
  if (loosePrice === null) loosePrice = retailEquivalent(packagePrice, perPackage);

  const baseQuantity = packages * perPackage + loose;
  if (!(baseQuantity > 0)) return loosePrice;

  const total = packages * (packagePrice ?? 0) + loose * (loosePrice ?? 0);
  return Math.round((total / baseQuantity) * 100) / 100;
}
