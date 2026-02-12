"use server";

import axios from "@/lib/auth/api-helper";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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

export type ProductType = "physical" | "service" | "bundle";

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  barcode?: string;
  description?: string;
  short_description?: string;
  product_type: ProductType;
  category?: string | null;
  category_name?: string;
  brand?: string | null;
  brand_name?: string;
  unit?: string | null;
  unit_name?: string;
  unit_symbol?: string;
  cost_price: string;
  selling_price: string;
  wholesale_price?: string | null;
  tax_rate: string;
  is_taxable: boolean;
  price_with_tax?: string;
  profit_margin?: string;
  track_inventory: boolean;
  allow_negative_stock: boolean;
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
  stock_by_warehouse?: Array<{
    warehouse_id: string;
    warehouse_name: string;
    quantity: string;
    available: string;
    reserved: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

export interface CreateProductData {
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  short_description?: string;
  product_type?: ProductType;
  category?: string | null;
  brand?: string | null;
  unit?: string | null;
  cost_price: number;
  selling_price: number;
  wholesale_price?: number | null;
  tax_rate?: number;
  is_taxable?: boolean;
  track_inventory?: boolean;
  allow_negative_stock?: boolean;
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
  is_active?: boolean;
  is_featured?: boolean;
  product_type?: ProductType;
  in_stock?: boolean;
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

interface PaginatedResponse<T> {
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
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active));
    if (filters?.is_featured !== undefined) params.append("is_featured", String(filters.is_featured));
    if (filters?.product_type) params.append("product_type", filters.product_type);
    if (filters?.in_stock !== undefined) params.append("in_stock", String(filters.in_stock));
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
  } catch (error: any) {
    console.error("[Products] Get products error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la récupération des produits",
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
  } catch (error: any) {
    console.error("[Products] Get product error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Produit non trouvé",
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

    return {
      success: true,
      message: "Produit créé avec succès",
      data: response.data,
    };
  } catch (error: any) {
    console.error("[Products] Create product error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la création du produit",
      errors: error.response?.data,
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

    return {
      success: true,
      message: "Produit mis à jour avec succès",
      data: response.data,
    };
  } catch (error: any) {
    console.error("[Products] Update product error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la mise à jour du produit",
      errors: error.response?.data,
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

    return {
      success: true,
      message: "Produit supprimé avec succès",
    };
  } catch (error: any) {
    console.error("[Products] Delete product error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la suppression du produit",
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
  } catch (error: any) {
    console.error("[Products] Search barcode error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Produit non trouvé",
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
  } catch (error: any) {
    console.error("[Products] Get low stock error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la récupération des produits en stock bas",
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
  } catch (error: any) {
    console.error("[Products] Bulk update error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la mise à jour en masse",
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
  } catch (error: any) {
    console.error("[Products] Bulk delete error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la suppression en masse",
    };
  }
}

// =============================================================================
// CATEGORIES ACTIONS
// =============================================================================

export async function getCategories(
  accessToken: string,
  organizationId: string,
  filters?: { search?: string; is_active?: boolean; parent?: string | null }
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

    const response = await axios.get(`${API_BASE_URL}/categories/?${params.toString()}`, {
      headers: getHeaders(accessToken, organizationId),
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    console.error("[Products] Get categories error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la récupération des catégories",
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
  } catch (error: any) {
    console.error("[Products] Get category tree error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la récupération de l'arborescence",
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

    return {
      success: true,
      message: "Catégorie créée avec succès",
      data: response.data,
    };
  } catch (error: any) {
    console.error("[Products] Create category error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la création de la catégorie",
      errors: error.response?.data,
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

    return {
      success: true,
      message: "Catégorie mise à jour avec succès",
      data: response.data,
    };
  } catch (error: any) {
    console.error("[Products] Update category error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la mise à jour de la catégorie",
      errors: error.response?.data,
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

    return {
      success: true,
      message: "Catégorie supprimée avec succès",
    };
  } catch (error: any) {
    console.error("[Products] Delete category error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la suppression de la catégorie",
    };
  }
}

// =============================================================================
// BRANDS ACTIONS
// =============================================================================

export async function getBrands(
  accessToken: string,
  organizationId: string,
  filters?: { search?: string; is_active?: boolean }
): Promise<ApiResponse<PaginatedResponse<Brand>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active));

    const response = await axios.get(`${API_BASE_URL}/brands/?${params.toString()}`, {
      headers: getHeaders(accessToken, organizationId),
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    console.error("[Products] Get brands error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la récupération des marques",
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

    return {
      success: true,
      message: "Marque créée avec succès",
      data: response.data,
    };
  } catch (error: any) {
    console.error("[Products] Create brand error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la création de la marque",
      errors: error.response?.data,
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

    return {
      success: true,
      message: "Marque mise à jour avec succès",
      data: response.data,
    };
  } catch (error: any) {
    console.error("[Products] Update brand error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la mise à jour de la marque",
      errors: error.response?.data,
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

    return {
      success: true,
      message: "Marque supprimée avec succès",
    };
  } catch (error: any) {
    console.error("[Products] Delete brand error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la suppression de la marque",
    };
  }
}

// =============================================================================
// UNITS ACTIONS
// =============================================================================

export async function getUnits(
  accessToken: string,
  organizationId: string,
  filters?: { search?: string }
): Promise<ApiResponse<PaginatedResponse<Unit>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);

    const response = await axios.get(`${API_BASE_URL}/units/?${params.toString()}`, {
      headers: getHeaders(accessToken, organizationId),
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    console.error("[Products] Get units error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la récupération des unités",
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

    return {
      success: true,
      message: "Unité créée avec succès",
      data: response.data,
    };
  } catch (error: any) {
    console.error("[Products] Create unit error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la création de l'unité",
      errors: error.response?.data,
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

    return {
      success: true,
      message: "Unité mise à jour avec succès",
      data: response.data,
    };
  } catch (error: any) {
    console.error("[Products] Update unit error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la mise à jour de l'unité",
      errors: error.response?.data,
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

    return {
      success: true,
      message: "Unité supprimée avec succès",
    };
  } catch (error: any) {
    console.error("[Products] Delete unit error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la suppression de l'unité",
    };
  }
}
