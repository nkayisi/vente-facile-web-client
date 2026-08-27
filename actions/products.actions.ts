"use server";

import { revalidatePath } from "next/cache";
import { formatApiErrorBody, formatAxiosErrorMessage, getErrorBody } from "@/lib/api/drf-error";
import axios from "@/lib/auth/api-helper";

const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

// =============================================================================
// TYPES
// =============================================================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent?: string | null;
  parent_name?: string;
  image?: string | null;
  is_active: boolean;
  sort_order: number;
  children_count?: number;
  products_count?: number;
  created_at?: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  is_active: boolean;
  products_count?: number;
  created_at?: string;
}

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  base_unit?: string | null;
  base_unit_name?: string;
  conversion_factor: string;
  created_at?: string;
}

export interface ProductImage {
  id: string;
  image: string;
  alt_text?: string;
  sort_order: number;
  is_primary: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  cost_price?: string | null;
  selling_price?: string | null;
  attributes: Record<string, string>;
  image?: string | null;
  is_active: boolean;
  effective_price?: string;
}

/**
 * Forme sous laquelle un produit est vendu.
 * `retail_only` est le comportement historique de tous les produits existants.
 */
export type SellingMode =
  | "retail_only"
  | "wholesale_only"
  | "wholesale_and_retail";

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  barcode?: string;
  short_description?: string;
  category?: string | null;
  category_name?: string;
  brand?: string | null;
  brand_name?: string;
  unit?: string | null;
  unit_name?: string;
  unit_symbol?: string;
  /** Forme sous laquelle le produit est vendu */
  selling_mode?: SellingMode;
  /** Unité de gros (paquet, carton, casier…) */
  packaging_unit?: string | null;
  packaging_unit_name?: string;
  packaging_unit_symbol?: string;
  /** Nombre d'unités de détail dans un conditionnement */
  units_per_package?: number | null;
  allow_auto_unpacking?: boolean;
  /** Phrase de confirmation calculée par le backend */
  packaging_summary?: string | null;
  cost_price: string;
  selling_price: string;
  /**
   * Prix d'un conditionnement entier lorsque `selling_mode` n'est pas
   * `retail_only`. En vente au détail seule, conserve son sens historique de
   * prix de gros indicatif à la pièce.
   */
  wholesale_price?: string | null;
  /** Prix d'achat d'un contenant entier (confort de saisie) */
  package_cost_price?: string | null;
  tax_rate: string;
  is_taxable: boolean;
  price_with_tax?: string;
  profit_margin?: string;
  track_inventory: boolean;
  allow_negative_stock: boolean;
  has_expiry_date: boolean;
  min_stock_level: number;
  max_stock_level?: number | null;
  reorder_point: number;
  reorder_quantity: number;
  weight?: string | null;
  dimensions?: Record<string, number>;
  image?: string | null;
  images?: ProductImage[];
  is_active: boolean;
  is_featured: boolean;
  is_sellable: boolean;
  is_purchasable: boolean;
  expiry_tracking: boolean;
  batch_tracking: boolean;
  serial_tracking: boolean;
  attributes?: Record<string, string>;
  variants?: ProductVariant[];
  stock_quantity?: number | null;
  /** Emplacement (rayon, allée) dans l'entrepôt filtré (?warehouse=) */
  stock_location?: string | null;
  /** Nom de l'entrepôt du stock affiché */
  warehouse_name?: string | null;
  /**
   * Conditionnements scellés disponibles. `null` hors périmètre d'un entrepôt
   * unique : le nombre de paquets n'est pas dérivable d'un stock multi-entrepôts.
   * Ne jamais traiter `null` comme `0`.
   */
  stock_packages?: number | null;
  /** Unités hors emballage scellé, `null` dans les mêmes conditions */
  stock_loose?: string | null;
  /** Stock prêt à afficher : « 1 paquet + 10 bouteilles » */
  stock_display?: string | null;
  stock_by_warehouse?: Array<{
    warehouse_id: string;
    warehouse_name: string;
    quantity: string;
    available: string;
    reserved: string;
    /** DISPONIBLE prêt à afficher : c'est le sens historique de ce champ */
    display?: string;
    packages?: number;
    loose?: string;
    /** Total en rayon, dans les mêmes termes : « 3 casiers + 7 bouteilles » */
    quantity_display?: string;
    quantity_packages?: number;
    quantity_loose?: string;
    /** Réservé en unité de détail nommée, jamais traduit en contenants */
    reserved_display?: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProductData {
  name: string;
  sku: string;
  barcode?: string;
  short_description?: string;
  category?: string | null;
  brand?: string | null;
  unit?: string | null;
  selling_mode?: SellingMode;
  packaging_unit?: string | null;
  units_per_package?: number | null;
  allow_auto_unpacking?: boolean;
  cost_price: number;
  selling_price: number;
  wholesale_price?: number | null;
  package_cost_price?: number | null;
  tax_rate?: number;
  is_taxable?: boolean;
  track_inventory?: boolean;
  allow_negative_stock?: boolean;
  has_expiry_date?: boolean;
  min_stock_level?: number;
  max_stock_level?: number | null;
  reorder_point?: number;
  reorder_quantity?: number;
  is_active?: boolean;
  is_featured?: boolean;
  image?: File | null;
}

export interface UpdateProductData extends Partial<CreateProductData> { }

export interface ProductFilters {
  search?: string;
  category?: string;
  brand?: string;
  warehouse?: string;
  is_active?: boolean;
  is_featured?: boolean;
  in_stock?: boolean;
  /** Liste catalogue dashboard : tous les produits de l’org (POS inchangé sans ce flag). */
  full_catalog?: boolean;
  ordering?: string;
  page?: number;
  page_size?: number;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getHeaders(accessToken: string, organizationId?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  if (organizationId) {
    headers["X-Organization-ID"] = organizationId;
  }
  return headers;
}

// =============================================================================
// PRODUCTS ACTIONS
// =============================================================================

export async function getProducts(
  accessToken: string,
  organizationId: string,
  filters?: ProductFilters
): Promise<ApiResponse<PaginatedResponse<Product>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.brand) params.append("brand", filters.brand);
    if (filters?.warehouse) params.append("warehouse", filters.warehouse);
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active));
    if (filters?.is_featured !== undefined) params.append("is_featured", String(filters.is_featured));
    if (filters?.in_stock !== undefined) params.append("in_stock", String(filters.in_stock));
    if (filters?.full_catalog !== undefined)
      params.append("full_catalog", String(filters.full_catalog));
    if (filters?.ordering) params.append("ordering", filters.ordering);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(`${API_BASE_URL}/products/?${params.toString()}`, {
      headers: getHeaders(accessToken, organizationId),
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Get products error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la récupération des produits"),
    };
  }
}

export async function getProduct(
  accessToken: string,
  organizationId: string,
  productId: string
): Promise<ApiResponse<Product>> {
  try {
    const response = await axios.get(`${API_BASE_URL}/products/${productId}/`, {
      headers: getHeaders(accessToken, organizationId),
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Get product error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Produit non trouvé"),
    };
  }
}

/**
 * Fetchers par ID pour les référentiels (utilisés par ``useInitialOption``
 * lors de l'édition d'une entité qui référence une catégorie / marque /
 * unité hors de la première page de résultats de la recherche async).
 */
export async function getCategory(
  accessToken: string,
  organizationId: string,
  categoryId: string
): Promise<ApiResponse<Category>> {
  try {
    const response = await axios.get(`${API_BASE_URL}/categories/${categoryId}/`, {
      headers: getHeaders(accessToken, organizationId),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Catégorie introuvable"),
    };
  }
}

export async function getBrand(
  accessToken: string,
  organizationId: string,
  brandId: string
): Promise<ApiResponse<Brand>> {
  try {
    const response = await axios.get(`${API_BASE_URL}/brands/${brandId}/`, {
      headers: getHeaders(accessToken, organizationId),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Marque introuvable"),
    };
  }
}

export async function getUnit(
  accessToken: string,
  organizationId: string,
  unitId: string
): Promise<ApiResponse<Unit>> {
  try {
    const response = await axios.get(`${API_BASE_URL}/units/${unitId}/`, {
      headers: getHeaders(accessToken, organizationId),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Unité introuvable"),
    };
  }
}

export async function createProduct(
  accessToken: string,
  organizationId: string,
  data: CreateProductData
): Promise<ApiResponse<Product>> {
  try {
    const response = await axios.post(`${API_BASE_URL}/products/`, data, {
      headers: getHeaders(accessToken, organizationId),
    });

    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: "Produit créé avec succès",
      data: response.data,
    };
  } catch (error: unknown) {
    const body = getErrorBody(error);
    console.error("[Products] Create product error:", body || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la création du produit"),
      errors: body as ApiResponse<Product>["errors"],
    };
  }
}

/**
 * Envoie la photo d'un produit.
 *
 * Séparée de la création : celle-ci transmet du JSON, or un fichier exige un
 * envoi multipart. Appeler cette action juste après avoir créé le produit
 * évite de basculer toute la création en multipart pour un champ facultatif.
 */
export async function uploadProductImage(
  accessToken: string,
  organizationId: string,
  productId: string,
  image: File
): Promise<ApiResponse<Product>> {
  try {
    const formData = new FormData();
    formData.append("image", image);

    const response = await axios.patch(
      `${API_BASE_URL}/products/${productId}/`,
      formData,
      {
        headers: {
          ...getHeaders(accessToken, organizationId),
          "Content-Type": "multipart/form-data",
        },
      }
    );

    revalidatePath("/dashboard/products");
    revalidatePath(`/dashboard/products/${productId}`);

    return {
      success: true,
      message: "Photo enregistrée",
      data: response.data,
    };
  } catch (error: unknown) {
    const body = getErrorBody(error);
    console.error("[Products] Upload image error:", body || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "La photo n'a pas pu être enregistrée"),
      errors: body as ApiResponse<Product>["errors"],
    };
  }
}

export async function updateProduct(
  accessToken: string,
  organizationId: string,
  productId: string,
  data: UpdateProductData
): Promise<ApiResponse<Product>> {
  try {
    const response = await axios.patch(`${API_BASE_URL}/products/${productId}/`, data, {
      headers: getHeaders(accessToken, organizationId),
    });

    revalidatePath("/dashboard/products");
    revalidatePath(`/dashboard/products/${productId}`);

    return {
      success: true,
      message: "Produit mis à jour avec succès",
      data: response.data,
    };
  } catch (error: unknown) {
    const body = getErrorBody(error);
    console.error("[Products] Update product error:", body || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la mise à jour du produit"),
      errors: body as ApiResponse<Product>["errors"],
    };
  }
}

export async function deleteProduct(
  accessToken: string,
  organizationId: string,
  productId: string
): Promise<ApiResponse<void>> {
  try {
    await axios.delete(`${API_BASE_URL}/products/${productId}/`, {
      headers: getHeaders(accessToken, organizationId),
    });

    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: "Produit supprimé avec succès",
    };
  } catch (error: unknown) {
    console.error("[Products] Delete product error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la suppression du produit"),
    };
  }
}

export async function searchProductByBarcode(
  accessToken: string,
  organizationId: string,
  barcode: string
): Promise<ApiResponse<Product>> {
  try {
    const response = await axios.get(`${API_BASE_URL}/products/search-barcode/?barcode=${barcode}`, {
      headers: getHeaders(accessToken, organizationId),
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Search barcode error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.error || "Produit non trouvé",
    };
  }
}

export async function getLowStockProducts(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<Product[]>> {
  try {
    const response = await axios.get(`${API_BASE_URL}/products/low-stock/`, {
      headers: getHeaders(accessToken, organizationId),
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Get low stock error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la récupération des produits en stock bas"),
    };
  }
}

export async function bulkUpdateProducts(
  accessToken: string,
  organizationId: string,
  ids: string[],
  data: { is_active?: boolean; is_featured?: boolean; category?: string; brand?: string }
): Promise<ApiResponse<{ updated: number }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/products/bulk-update/`,
      { ids, ...data },
      { headers: getHeaders(accessToken, organizationId) }
    );

    return {
      success: true,
      message: `${response.data.updated} produit(s) mis à jour`,
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Bulk update error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la mise à jour en masse"),
    };
  }
}

export async function bulkDeleteProducts(
  accessToken: string,
  organizationId: string,
  ids: string[]
): Promise<ApiResponse<{ deleted: number }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/products/bulk-delete/`,
      { ids },
      { headers: getHeaders(accessToken, organizationId) }
    );

    return {
      success: true,
      message: `${response.data.deleted} produit(s) supprimé(s)`,
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Bulk delete error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la suppression en masse"),
    };
  }
}

// =============================================================================
// CATEGORIES ACTIONS
// =============================================================================

export interface CategoryFilters {
  search?: string;
  is_active?: boolean;
  parent?: string | null;
  warehouse?: string;
  with_stock?: boolean;
  /** Exclut la catégorie {id} et tous ses descendants (édition d'un parent). */
  exclude_descendants_of?: string;
  page?: number;
  page_size?: number;
}

export async function getCategories(
  accessToken: string,
  organizationId: string,
  filters?: CategoryFilters
): Promise<ApiResponse<PaginatedResponse<Category>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active));
    if (filters?.parent !== undefined) {
      if (filters.parent === null) {
        params.append("parent__isnull", "true");
      } else {
        params.append("parent", filters.parent);
      }
    }
    if (filters?.warehouse) params.append("warehouse", filters.warehouse);
    if (filters?.with_stock !== undefined) params.append("with_stock", String(filters.with_stock));
    if (filters?.exclude_descendants_of)
      params.append("exclude_descendants_of", filters.exclude_descendants_of);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(`${API_BASE_URL}/categories/?${params.toString()}`, {
      headers: getHeaders(accessToken, organizationId),
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Get categories error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la récupération des catégories"),
    };
  }
}

export async function getCategoryTree(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<Category[]>> {
  try {
    const response = await axios.get(`${API_BASE_URL}/categories/tree/`, {
      headers: getHeaders(accessToken, organizationId),
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Get category tree error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la récupération de l'arborescence"),
    };
  }
}

export async function createCategory(
  accessToken: string,
  organizationId: string,
  data: { name: string; slug?: string; description?: string; parent?: string | null; is_active?: boolean }
): Promise<ApiResponse<Category>> {
  try {
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const response = await axios.post(
      `${API_BASE_URL}/categories/`,
      { ...data, slug },
      { headers: getHeaders(accessToken, organizationId) }
    );

    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: "Catégorie créée avec succès",
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Create category error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la création de la catégorie"),
      errors: getErrorBody(error),
    };
  }
}

export async function updateCategory(
  accessToken: string,
  organizationId: string,
  categoryId: string,
  data: Partial<{ name: string; slug: string; description: string; parent: string | null; is_active: boolean }>
): Promise<ApiResponse<Category>> {
  try {
    const response = await axios.patch(`${API_BASE_URL}/categories/${categoryId}/`, data, {
      headers: getHeaders(accessToken, organizationId),
    });

    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: "Catégorie mise à jour avec succès",
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Update category error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la mise à jour de la catégorie"),
      errors: getErrorBody(error),
    };
  }
}

export async function deleteCategory(
  accessToken: string,
  organizationId: string,
  categoryId: string
): Promise<ApiResponse<void>> {
  try {
    await axios.delete(`${API_BASE_URL}/categories/${categoryId}/`, {
      headers: getHeaders(accessToken, organizationId),
    });

    revalidatePath("/dashboard/products");

    return {
      success: true,
      message: "Catégorie supprimée avec succès",
    };
  } catch (error: unknown) {
    console.error("[Products] Delete category error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la suppression de la catégorie"),
    };
  }
}

// =============================================================================
// BRANDS ACTIONS
// =============================================================================

export interface BrandFilters {
  search?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

export async function getBrands(
  accessToken: string,
  organizationId: string,
  filters?: BrandFilters
): Promise<ApiResponse<PaginatedResponse<Brand>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active));
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(`${API_BASE_URL}/brands/?${params.toString()}`, {
      headers: getHeaders(accessToken, organizationId),
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Get brands error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la récupération des marques"),
    };
  }
}

export async function createBrand(
  accessToken: string,
  organizationId: string,
  data: { name: string; slug?: string; is_active?: boolean }
): Promise<ApiResponse<Brand>> {
  try {
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const response = await axios.post(
      `${API_BASE_URL}/brands/`,
      { ...data, slug },
      { headers: getHeaders(accessToken, organizationId) }
    );

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/products/brands");

    return {
      success: true,
      message: "Marque créée avec succès",
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Create brand error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la création de la marque"),
      errors: getErrorBody(error),
    };
  }
}

export async function updateBrand(
  accessToken: string,
  organizationId: string,
  brandId: string,
  data: Partial<{ name: string; slug: string; is_active: boolean }>
): Promise<ApiResponse<Brand>> {
  try {
    const response = await axios.patch(`${API_BASE_URL}/brands/${brandId}/`, data, {
      headers: getHeaders(accessToken, organizationId),
    });

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/products/brands");

    return {
      success: true,
      message: "Marque mise à jour avec succès",
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Update brand error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la mise à jour de la marque"),
      errors: getErrorBody(error),
    };
  }
}

export async function deleteBrand(
  accessToken: string,
  organizationId: string,
  brandId: string
): Promise<ApiResponse<void>> {
  try {
    await axios.delete(`${API_BASE_URL}/brands/${brandId}/`, {
      headers: getHeaders(accessToken, organizationId),
    });

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/products/brands");

    return {
      success: true,
      message: "Marque supprimée avec succès",
    };
  } catch (error: unknown) {
    console.error("[Products] Delete brand error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la suppression de la marque"),
    };
  }
}

// =============================================================================
// UNITS ACTIONS
// =============================================================================

export interface UnitFilters {
  search?: string;
  page?: number;
  page_size?: number;
}

export async function getUnits(
  accessToken: string,
  organizationId: string,
  filters?: UnitFilters
): Promise<ApiResponse<PaginatedResponse<Unit>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(`${API_BASE_URL}/units/?${params.toString()}`, {
      headers: getHeaders(accessToken, organizationId),
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Get units error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la récupération des unités"),
    };
  }
}

export async function createUnit(
  accessToken: string,
  organizationId: string,
  data: { name: string; symbol: string; base_unit?: string | null; conversion_factor?: number }
): Promise<ApiResponse<Unit>> {
  try {
    const response = await axios.post(`${API_BASE_URL}/units/`, data, {
      headers: getHeaders(accessToken, organizationId),
    });

    revalidatePath("/dashboard/products/units");

    return {
      success: true,
      message: "Unité créée avec succès",
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Create unit error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la création de l'unité"),
      errors: getErrorBody(error),
    };
  }
}

export async function updateUnit(
  accessToken: string,
  organizationId: string,
  unitId: string,
  data: Partial<{ name: string; symbol: string; base_unit: string | null; conversion_factor: number }>
): Promise<ApiResponse<Unit>> {
  try {
    const response = await axios.patch(`${API_BASE_URL}/units/${unitId}/`, data, {
      headers: getHeaders(accessToken, organizationId),
    });

    revalidatePath("/dashboard/products/units");

    return {
      success: true,
      message: "Unité mise à jour avec succès",
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Update unit error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la mise à jour de l'unité"),
      errors: getErrorBody(error),
    };
  }
}

export async function deleteUnit(
  accessToken: string,
  organizationId: string,
  unitId: string
): Promise<ApiResponse<void>> {
  try {
    await axios.delete(`${API_BASE_URL}/units/${unitId}/`, {
      headers: getHeaders(accessToken, organizationId),
    });

    revalidatePath("/dashboard/products/units");

    return {
      success: true,
      message: "Unité supprimée avec succès",
    };
  } catch (error: unknown) {
    console.error("[Products] Delete unit error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la suppression de l'unité"),
    };
  }
}

// =============================================================================
// IMPORT / EXPORT
// =============================================================================

export interface ImportResult {
  success: boolean;
  /** Chaîne ou objet (ex. détail quota) renvoyé par l’API */
  error?: string | Record<string, unknown>;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{
    row: number;
    name: string;
    errors: string[];
  }>;
}

export interface DuplicateCheckResult {
  has_duplicate: boolean;
  duplicates: {
    sku: { id: string; name: string } | null;
    barcode: { id: string; name: string } | null;
  };
}

export async function downloadImportTemplate(
  accessToken: string,
  organizationId: string
): Promise<{ data: number[]; contentType: string } | null> {
  try {
    const response = await axios.get(`${API_BASE_URL}/products/import-template/`, {
      headers: getHeaders(accessToken, organizationId),
      responseType: 'arraybuffer',
    });

    // Vérifier le content-type de la réponse
    const contentType = response.headers['content-type'] || '';

    // Si c'est du JSON, c'est une erreur
    if (contentType.includes('application/json')) {
      const text = new TextDecoder().decode(response.data);
      const errorData = JSON.parse(text);
      console.error("[Products] Download template error:", errorData);
      throw new Error(
        formatApiErrorBody(errorData as Record<string, unknown>, "Erreur lors du téléchargement")
      );
    }

    // Convertir ArrayBuffer en tableau de nombres pour la sérialisation
    const uint8Array = new Uint8Array(response.data);
    return {
      data: Array.from(uint8Array),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  } catch (error: unknown) {
    console.error("[Products] Download template error:", getErrorBody(error) || (error as Error)?.message);
    throw error;
  }
}

export async function importProducts(
  accessToken: string,
  organizationId: string,
  file: File
): Promise<ApiResponse<ImportResult>> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${API_BASE_URL}/products/import/`, formData, {
      headers: {
        ...getHeaders(accessToken, organizationId),
        'Content-Type': 'multipart/form-data',
      },
    });

    const body = response.data as Record<string, unknown> | undefined;
    if (body && body.success === false) {
      return {
        success: false,
        message: formatApiErrorBody(body, "Erreur lors de l'importation"),
        data: body as unknown as ImportResult,
      };
    }

    return {
      success: true,
      message: "Importation terminée",
      data: response.data,
    };
  } catch (error: unknown) {
    const raw = (error as { response?: { data?: unknown } }).response?.data;
    const logLine =
      typeof raw === "string" && /^\s*</.test(raw)
        ? "[Products] Import: le backend a renvoyé une page HTML (erreur 500 typique). Voir docker compose logs vente_facile_backend_dev."
        : raw ?? (error as Error).message;
    console.error("[Products] Import error:", logLine);
    const data = (error as any)?.response?.data;
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de l'importation"),
      data: data as unknown as ImportResult | undefined,
    };
  }
}

export async function exportProductsExcel(
  accessToken: string,
  organizationId: string
): Promise<{ data: number[]; contentType: string; filename: string } | null> {
  try {
    const response = await axios.get(`${API_BASE_URL}/products/export/excel/`, {
      headers: getHeaders(accessToken, organizationId),
      responseType: "arraybuffer",
    });

    const contentType = response.headers["content-type"] || "";
    if (contentType.includes("application/json")) {
      const text = new TextDecoder().decode(response.data);
      const errorData = JSON.parse(text);
      console.error("[Products] Export Excel error:", errorData);
      throw new Error(
        formatApiErrorBody(errorData as Record<string, unknown>, "Erreur lors de l'export")
      );
    }

    const uint8Array = new Uint8Array(response.data);
    const disposition = (response.headers["content-disposition"] as string) || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] || `produits_export.xlsx`;

    return {
      data: Array.from(uint8Array),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename,
    };
  } catch (error: unknown) {
    console.error("[Products] Export Excel error:", getErrorBody(error) || (error as Error)?.message);
    throw error;
  }
}

export async function exportProductsPdf(
  accessToken: string,
  organizationId: string
): Promise<{ data: number[]; contentType: string; filename: string } | null> {
  try {
    const response = await axios.get(`${API_BASE_URL}/products/export/pdf/`, {
      headers: getHeaders(accessToken, organizationId),
      responseType: "arraybuffer",
    });

    const contentType = response.headers["content-type"] || "";
    if (contentType.includes("application/json")) {
      const text = new TextDecoder().decode(response.data);
      const errorData = JSON.parse(text);
      console.error("[Products] Export PDF error:", errorData);
      throw new Error(
        formatApiErrorBody(errorData as Record<string, unknown>, "Erreur lors de l'export")
      );
    }

    const uint8Array = new Uint8Array(response.data);
    const disposition = (response.headers["content-disposition"] as string) || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] || `produits_export.pdf`;

    return {
      data: Array.from(uint8Array),
      contentType: "application/pdf",
      filename,
    };
  } catch (error: unknown) {
    console.error("[Products] Export PDF error:", getErrorBody(error) || (error as Error)?.message);
    throw error;
  }
}

export async function checkProductDuplicate(
  accessToken: string,
  organizationId: string,
  sku?: string,
  barcode?: string,
  excludeId?: string
): Promise<ApiResponse<DuplicateCheckResult>> {
  try {
    const response = await axios.post(`${API_BASE_URL}/products/check-duplicate/`, {
      sku,
      barcode,
      exclude_id: excludeId,
    }, {
      headers: getHeaders(accessToken, organizationId),
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Products] Check duplicate error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la vérification des doublons"),
    };
  }
}
