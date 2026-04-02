import { getProducts, type Product, type ProductFilters } from "@/actions/products.actions";
import type { AsyncSelectOption } from "@/components/ui/searchable-select-async";

export interface ProductSearchHandlerOptions {
  /** Filtres API additionnels (ex. `in_stock: true`) */
  extraFilters?: Partial<ProductFilters>;
  pageSize?: number;
  /** Libellé affiché dans le select (défaut : `nom (SKU)`) */
  formatLabel?: (product: Product) => string;
  /** Appelé avec les produits bruts retournés par l’API (pour cache local) */
  onResults?: (products: Product[]) => void;
}

const defaultLabel = (p: Product) => `${p.name} (${p.sku})`;

/**
 * Fabrique une fonction compatible avec `SearchableSelectAsync.onSearch` : recherche produits via l’API.
 */
export function createProductSearchHandler(
  accessToken: string,
  organizationId: string,
  options?: ProductSearchHandlerOptions
): (query: string) => Promise<AsyncSelectOption[]> {
  const pageSize = options?.pageSize ?? 30;
  const formatLabel = options?.formatLabel ?? defaultLabel;
  const extra = options?.extraFilters ?? {};

  return async (query: string) => {
    const result = await getProducts(accessToken, organizationId, {
      search: query,
      page_size: pageSize,
      is_active: true,
      ...extra,
    });
    if (result.success && result.data) {
      const results = result.data.results || [];
      options?.onResults?.(results);
      return results.map(p => ({ value: p.id, label: formatLabel(p) }));
    }
    return [];
  };
}
