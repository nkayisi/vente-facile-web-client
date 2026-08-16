"use client";

import { formatPrice } from "@/lib/format";
import { getPackaging, type PackagedProductLike } from "@/lib/packaging";
import { pluralizeUnit } from "@/lib/units";

/**
 * Cellules de tableau partagées pour les produits vendus en gros et au détail.
 *
 * Elles existent pour qu'un même produit se lise pareil partout : catalogue,
 * niveaux de stock, rapports. Un marchand qui vend au carton doit voir ses
 * cartons sur chaque écran, pas un total en bouteilles ici et des cartons là.
 */

interface PriceCellProps {
  product: PackagedProductLike & {
    selling_price?: string | number | null;
    cost_price?: string | number | null;
    wholesale_price?: string | number | null;
    package_cost_price?: string | number | null;
  };
}

const toNumber = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "string" ? parseFloat(value) : value;
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Prix de vente au détail, prix d'achat en second.
 *
 * Un produit vendu en gros seul n'a pas de prix de détail : afficher 0 y
 * ferait croire qu'il se donne, un tiret dit qu'il ne se vend pas ainsi.
 */
export function RetailPriceCell({ product }: PriceCellProps) {
  const packaging = getPackaging(product);
  if (packaging?.packageOnly) {
    return <span className="text-muted-foreground">-</span>;
  }

  const selling = toNumber(product.selling_price);
  const cost = toNumber(product.cost_price);

  return (
    <div className="flex flex-col items-end gap-0.5 tabular-nums">
      <span className="font-medium text-foreground">
        {selling !== null ? formatPrice(selling) : "-"}
      </span>
      {cost !== null && cost > 0 && (
        <span className="text-xs text-muted-foreground">{formatPrice(cost)}</span>
      )}
    </div>
  );
}

/** Prix de vente du contenant, prix d'achat en second, unité rappelée. */
export function WholesalePriceCell({ product }: PriceCellProps) {
  const packaging = getPackaging(product);
  if (!packaging) {
    return <span className="text-muted-foreground">-</span>;
  }

  const selling = toNumber(product.wholesale_price);
  const cost = toNumber(product.package_cost_price);

  return (
    <div className="flex flex-col items-end gap-0.5 tabular-nums">
      <span className="font-medium text-foreground">
        {selling !== null ? formatPrice(selling) : "-"}
      </span>
      <span className="text-xs text-muted-foreground">
        {cost !== null && cost > 0 ? `${formatPrice(cost)} · ` : ""}
        le {packaging.packageWord}
      </span>
    </div>
  );
}

interface StockCellProps {
  product: PackagedProductLike & {
    track_inventory?: boolean;
    unit_symbol?: string | null;
    /** Quantité totale en unité de détail */
    stock_quantity?: number | string | null;
    /** Rendu serveur « 12 cartons + 3 bouteilles », quand il est disponible */
    stock_display?: string | null;
  };
}

/**
 * Stock lisible : le partage en contenants d'abord, le total en unités ensuite.
 *
 * Le total reste affiché car c'est lui qui compte pour un réassort ; le partage
 * répond à la question du comptoir, « puis-je servir 3 cartons ? ».
 */
export function StockCell({ product }: StockCellProps) {
  if (product.track_inventory === false) {
    return <span className="text-muted-foreground">-</span>;
  }

  const packaging = getPackaging(product);
  const quantity = toNumber(product.stock_quantity) ?? 0;
  const unitWord = packaging
    ? pluralizeUnit(packaging.retailWord, quantity)
    : (product.unit_symbol || "").trim();

  if (!packaging) {
    return (
      <span className="tabular-nums text-muted-foreground">
        {quantity}
        {unitWord ? ` ${unitWord}` : ""}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5 tabular-nums">
      <span className="font-medium text-foreground">
        {product.stock_display?.trim() || `${quantity} ${unitWord}`}
      </span>
      <span className="text-xs text-muted-foreground">
        {quantity} {unitWord} au total
      </span>
    </div>
  );
}
