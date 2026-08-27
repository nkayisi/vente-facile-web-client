/**
 * Vocabulaire de conditionnement côté navigateur.
 *
 * Miroir strict de `apps/inventory/packaging.py` : mêmes règles de partage
 * scellé/vrac et même formatage, pour que l'écran annonce exactement ce que le
 * serveur enregistrera. Le serveur reste l'autorité : rien ici ne calcule une
 * quantité qui serait ensuite envoyée telle quelle, on n'envoie que la saisie.
 */
import { pluralizeUnit } from "@/lib/units";

export interface PackagedProductLike {
  selling_mode?: string | null;
  units_per_package?: number | null;
  unit_name?: string | null;
  packaging_unit_name?: string | null;
}

export interface Packaging {
  /** Nombre d'unités de détail par contenant */
  factor: number;
  /** Libellé de l'unité de détail : bouteille, pièce, sachet… */
  retailWord: string;
  /** Libellé du contenant : carton, casier, paquet… */
  packageWord: string;
  /** Le produit ne se vend que par contenant entier */
  packageOnly: boolean;
}

/**
 * Conditionnement d'un produit, ou `null` s'il se vend à l'unité seule.
 *
 * Un produit mal configuré (mode gros sans nombre d'unités) est traité comme
 * mono-unité plutôt que de faire échouer l'écran, comme le fait
 * `PackagingService.factor` côté serveur.
 */
export function getPackaging(product?: PackagedProductLike | null): Packaging | null {
  if (!product) return null;
  const mode = product.selling_mode ?? "retail_only";
  if (mode === "retail_only") return null;

  const factor = product.units_per_package ?? 0;
  if (!factor || factor < 2) return null;

  return {
    factor,
    retailWord: (product.unit_name || "").trim() || "unité",
    packageWord: (product.packaging_unit_name || "").trim() || "contenant",
    packageOnly: mode === "wholesale_only",
  };
}

/**
 * Partage une quantité de base en (contenants scellés, unités en vrac).
 *
 * Le reste de la division rejoint le vrac : un contenant entamé ne se rescelle
 * pas. Même règle que `PackagingService.split`.
 */
export function splitPackaged(
  baseQuantity: number,
  looseQuantity: number,
  factor: number
): { packages: number; loose: number } {
  if (!factor || factor < 2) return { packages: 0, loose: baseQuantity };

  const loose = Math.max(0, Math.min(looseQuantity, Math.max(baseQuantity, 0)));
  const sealedBase = baseQuantity - loose;
  if (sealedBase < 0) return { packages: 0, loose: baseQuantity };

  const packages = Math.floor(sealedBase / factor);
  return { packages, loose: loose + (sealedBase - packages * factor) };
}

/** Rend une quantité lisible : « 3 cartons + 2 bouteilles ». */
export function formatPackaged(
  packaging: Packaging | null,
  baseQuantity: number,
  looseQuantity = 0
): string {
  if (!packaging) return String(baseQuantity);

  const { packages, loose } = splitPackaged(baseQuantity, looseQuantity, packaging.factor);
  const parts: string[] = [];
  if (packages) {
    parts.push(`${packages} ${pluralizeUnit(packaging.packageWord, packages)}`);
  }
  if (loose || parts.length === 0) {
    parts.push(`${loose} ${pluralizeUnit(packaging.retailWord, loose)}`);
  }
  return parts.join(" + ");
}

/**
 * Rend un partage DÉJÀ connu, sans le recalculer : « 3 casiers + 7 bouteilles ».
 *
 * Miroir de `PackagingService.format_split`. À préférer à `formatPackaged` dès
 * que les deux compteurs sont disponibles : repasser par une division du total
 * réécrirait « 3 casiers + 27 bouteilles » en « 4 casiers + 3 bouteilles ».
 */
export function formatPackagedSplit(
  packaging: Packaging | null,
  packages: number,
  loose: number
): string {
  if (!packaging) return String(loose);

  const parts: string[] = [];
  if (packages) {
    parts.push(`${packages} ${pluralizeUnit(packaging.packageWord, packages)}`);
  }
  if (loose || parts.length === 0) {
    parts.push(`${loose} ${pluralizeUnit(packaging.retailWord, loose)}`);
  }
  return parts.join(" + ");
}

/**
 * Rend un ÉCART par canal : « -2 casiers, +5 bouteilles ».
 *
 * Miroir de `PackagingService.format_signed_split`. Un manquant de contenants
 * scellés et un surplus d'unités isolées se compensent dans le total et
 * disparaissent : ventilés, ils désignent chacun leur cause. La virgule
 * remplace le « + » de `formatPackagedSplit` pour qu'on ne lise pas un signe
 * comme une addition.
 */
export function formatPackagedDifference(
  packaging: Packaging | null,
  packageDelta: number,
  looseDelta: number
): string {
  const signed = (value: number, word: string) =>
    `${value > 0 ? "+" : ""}${value} ${pluralizeUnit(word, value)}`;

  if (!packaging) return `${looseDelta > 0 ? "+" : ""}${looseDelta}`;

  const parts: string[] = [];
  if (packageDelta) parts.push(signed(packageDelta, packaging.packageWord));
  if (looseDelta || parts.length === 0) {
    parts.push(signed(looseDelta, packaging.retailWord));
  }
  return parts.join(", ");
}

/** Somme d'une saisie « X contenants + Y unités » en unité de détail. */
export function toBaseQuantity(
  packaging: Packaging | null,
  packages = 0,
  loose = 0
): number {
  if (!packaging) return loose;
  return packages * packaging.factor + loose;
}

/** Ce que les deux canaux d'un stock offrent encore. */
export interface ChannelAvailability {
  /** Contenants encore scellés, `null` si le partage n'est pas connu. */
  sealed: number | null;
  /** Unités déjà hors emballage, `null` si le partage n'est pas connu. */
  loose: number | null;
}

/**
 * Retranche d'un stock ce qu'une saisie consomme déjà, canal par canal.
 *
 * Rejoue l'ordre exact du serveur (`SaleStockService.apply_decrement`) : la
 * part en contenants sort du scellé, puis la part au détail puise dans le vrac
 * et, s'il ne suffit pas, ouvre autant de contenants que nécessaire. Sans cette
 * simulation, deux lignes du même produit dans le panier se comptent mal et le
 * caissier découvre le refus seulement à l'encaissement.
 *
 * `null` en entrée signifie « partage inconnu » (stock multi-entrepôts, produit
 * non suivi) et se propage : on n'invente jamais un zéro bloquant.
 */
export function remainingChannels(
  stock: ChannelAvailability,
  used: { packages: number; loose: number },
  factor: number
): ChannelAvailability {
  if (stock.sealed === null || stock.loose === null || !factor || factor < 2) {
    return { sealed: stock.sealed, loose: stock.loose };
  }

  const sealed = stock.sealed - Math.max(0, used.packages);
  let loose = stock.loose;
  let remainingSealed = sealed;

  const neededLoose = Math.max(0, used.loose);
  if (neededLoose > loose) {
    // Ouverture : le déficit se comble par contenants entiers, jamais l'inverse.
    const toOpen = Math.ceil((neededLoose - loose) / factor);
    remainingSealed -= toOpen;
    loose += toOpen * factor;
  }
  loose -= neededLoose;

  return { sealed: remainingSealed, loose };
}
