/**
 * Factory de handlers ``onSearch`` pour ``SearchableSelectAsync``.
 *
 * Le pattern : chaque handler reçoit ``(query: string)`` et renvoie une promesse
 * de ``AsyncSelectOption[]``. Il encapsule l'appel à la server action paginée
 * correspondante (avec ``?search=...&page_size=...``) et transforme les objets
 * domaines en options ``{value, label}`` exploitables par le composant.
 *
 * Toutes les recherches frappent l'API : le composant ne se contente pas de
 * filtrer une liste pré-chargée. C'est essentiel pour les référentiels
 * paginés (catégories, marques, clients...) où un marchand peut avoir des
 * centaines d'entrées.
 *
 * Ajout d'une nouvelle entité ? Implémenter un getter `getXxxs(token, orgId, filters)`
 * qui supporte au minimum ``search`` et ``page_size``, puis ajouter un
 * ``createXxxSearchHandler`` ici en réutilisant ``createListSearchHandler``.
 */
import { getBrands, getCategories, getUnits } from "@/actions/products.actions";
import type {
  Brand,
  Category,
  Unit,
} from "@/actions/products.actions";
import { getCustomers, getSuppliers } from "@/actions/contacts.actions";
import type { Customer, Supplier } from "@/actions/contacts.actions";
import { getWarehouses } from "@/actions/stock.actions";
import type { Warehouse } from "@/actions/stock.actions";
import { getBranches } from "@/actions/organization.actions";
import type { Branch } from "@/actions/organization.actions";
import { getPaymentMethods } from "@/actions/sales.actions";
import type { PaymentMethod } from "@/actions/sales.actions";

import type { AsyncSelectOption } from "@/components/ui/searchable-select-async";

export type SearchHandler = (query: string) => Promise<AsyncSelectOption[]>;

const DEFAULT_PAGE_SIZE = 30;

/**
 * Factory pour les server actions qui renvoient ``PaginatedResponse<T>``
 * (la majorité : Category, Brand, Unit, Customer, Supplier, Warehouse...).
 */
function createListSearchHandler<T, F extends { search?: string; page_size?: number }>(
  fetchFn: (token: string, orgId: string, filters?: F) => Promise<{
    success: boolean;
    data?: { results: T[] } | T[];
  }>,
  formatLabel: (item: T) => string,
  accessToken: string,
  organizationId: string,
  extraFilters?: Partial<F>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): SearchHandler {
  return async (query: string) => {
    const filters = {
      ...(extraFilters || {}),
      search: query,
      page_size: pageSize,
    } as unknown as F;

    const result = await fetchFn(accessToken, organizationId, filters);
    if (!result.success || !result.data) return [];

    const items = Array.isArray(result.data)
      ? result.data
      : result.data.results || [];
    return items.map((item) => ({
      value: (item as { id: string }).id,
      label: formatLabel(item),
    }));
  };
}

// ---------------------------------------------------------------------------
// Handlers par entité
// ---------------------------------------------------------------------------

/**
 * Cas particulier : produit nécessite un cache local pour le POS (voir
 * ``lib/product-search.ts`` historique). On délègue au handler existant.
 */
export {
  createProductSearchHandler,
} from "@/lib/product-search";

export function createCategorySearchHandler(
  accessToken: string,
  organizationId: string,
  extraFilters?: { parent?: string | null; exclude_descendants_of?: string },
): SearchHandler {
  return createListSearchHandler<Category, { search?: string; page_size?: number; is_active?: boolean; parent?: string | null; exclude_descendants_of?: string }>(
    getCategories as never,
    (cat) => cat.name,
    accessToken,
    organizationId,
    { is_active: true, ...extraFilters },
  );
}

export function createBrandSearchHandler(
  accessToken: string,
  organizationId: string,
): SearchHandler {
  return createListSearchHandler<Brand, { search?: string; page_size?: number; is_active?: boolean }>(
    getBrands as never,
    (brand) => brand.name,
    accessToken,
    organizationId,
    { is_active: true },
  );
}

export function createUnitSearchHandler(
  accessToken: string,
  organizationId: string,
): SearchHandler {
  return createListSearchHandler<Unit, { search?: string; page_size?: number }>(
    getUnits as never,
    (unit) => `${unit.name} (${unit.symbol})`,
    accessToken,
    organizationId,
  );
}

export function createCustomerSearchHandler(
  accessToken: string,
  organizationId: string,
): SearchHandler {
  return createListSearchHandler<Customer, { search?: string; page_size?: number; is_active?: boolean }>(
    getCustomers as never,
    (c) => (c.code ? `${c.name} (${c.code})` : c.name),
    accessToken,
    organizationId,
    { is_active: true },
  );
}

export function createSupplierSearchHandler(
  accessToken: string,
  organizationId: string,
): SearchHandler {
  return createListSearchHandler<Supplier, { search?: string; page_size?: number; is_active?: boolean }>(
    getSuppliers as never,
    (s) => (s.code ? `${s.name} (${s.code})` : s.name),
    accessToken,
    organizationId,
    { is_active: true },
  );
}

export function createWarehouseSearchHandler(
  accessToken: string,
  organizationId: string,
  extraFilters?: { branch?: string; is_active?: boolean },
): SearchHandler {
  return createListSearchHandler<Warehouse, { search?: string; page_size?: number; is_active?: boolean; branch?: string }>(
    getWarehouses as never,
    (w) => w.name,
    accessToken,
    organizationId,
    { is_active: true, ...extraFilters },
  );
}

export function createBranchSearchHandler(
  accessToken: string,
  organizationId: string,
): SearchHandler {
  return createListSearchHandler<Branch, { search?: string; page_size?: number; is_active?: boolean }>(
    getBranches as never,
    (b) => b.name,
    accessToken,
    organizationId,
    { is_active: true },
  );
}

export function createPaymentMethodSearchHandler(
  accessToken: string,
  organizationId: string,
): SearchHandler {
  return createListSearchHandler<PaymentMethod, { search?: string; page_size?: number; is_active?: boolean }>(
    getPaymentMethods as never,
    (pm) => pm.name,
    accessToken,
    organizationId,
    { is_active: true },
  );
}
