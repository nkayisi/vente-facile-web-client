"use server";

import axios from "@/lib/auth/api-helper";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// =============================================================================
// TYPES
// =============================================================================

export type InventorySessionStatus = "draft" | "in_progress" | "review" | "validated" | "cancelled";
export type InventoryScopeType = "full" | "category" | "product";

export interface InventoryCount {
  id: string;
  session: string;
  product: string;
  product_name: string;
  product_sku: string;
  product_category_name?: string;
  variant?: string | null;
  variant_name?: string;
  quantity_expected: string;
  quantity_counted: string;
  quantity_difference: string;
  unit_cost: string;
  difference_value: string;
  is_counted: boolean;
  counted_by?: string;
  counted_by_name?: string;
  counted_at?: string;
  unit_name?: string;
  notes?: string;
}

export interface InventorySession {
  id: string;
  reference: string;
  name: string;
  warehouse: string;
  warehouse_name: string;
  scope_type: InventoryScopeType;
  scope_type_display: string;
  status: InventorySessionStatus;
  status_display: string;
  is_stock_locked: boolean;
  notes?: string;
  progress_percentage: number;
  items_total: number;
  items_counted: number;
  items_with_difference: number;
  total_expected_quantity: string;
  total_counted_quantity: string;
  total_difference_quantity: string;
  total_difference_value: string;
  counts?: InventoryCount[];
  category_names?: string[];
  product_names?: string[];
  created_by?: string;
  created_by_name?: string;
  validated_by?: string;
  validated_by_name?: string;
  started_at?: string;
  completed_at?: string;
  validated_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateInventorySessionData {
  name: string;
  warehouse: string;
  scope_type: InventoryScopeType;
  notes?: string;
  category_ids?: string[];
  product_ids?: string[];
}

export interface InventorySessionFilters {
  status?: InventorySessionStatus;
  scope_type?: InventoryScopeType;
  warehouse?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface InventoryCountFilters {
  is_counted?: boolean;
  has_difference?: boolean;
  search?: string;
  category?: string;
  page?: number;
}

export interface CountItemData {
  id: string;
  quantity_counted: number;
  notes?: string;
}

export interface PrintData {
  session: InventorySession;
  warehouse: {
    name: string;
    code: string;
    address: string;
  };
  categories: Record<string, InventoryCount[]>;
  summary: {
    total_products: number;
    counted_products: number;
    products_with_difference: number;
    total_expected_quantity: string;
    total_counted_quantity: string;
    total_difference_quantity: string;
    total_difference_value: string;
  };
  printed_at: string;
  printed_by: string;
}

// Response types
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

function getHeaders(accessToken: string, organizationId: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Organization-ID": organizationId,
  };
}

// =============================================================================
// INVENTORY SESSION ACTIONS
// =============================================================================

export async function getInventorySessions(
  accessToken: string,
  organizationId: string,
  filters?: InventorySessionFilters
): Promise<ApiResponse<PaginatedResponse<InventorySession>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.scope_type) params.append("scope_type", filters.scope_type);
    if (filters?.warehouse) params.append("warehouse", filters.warehouse);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(
      `${API_BASE_URL}/inventory-sessions/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[inventory] Get sessions error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des inventaires" };
  }
}

export async function getInventorySession(
  accessToken: string,
  organizationId: string,
  sessionId: string
): Promise<ApiResponse<InventorySession>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/inventory-sessions/${sessionId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[inventory] Get session error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération de l'inventaire" };
  }
}

export async function createInventorySession(
  accessToken: string,
  organizationId: string,
  data: CreateInventorySessionData
): Promise<ApiResponse<InventorySession>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/inventory-sessions/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, message: "Inventaire créé avec succès", data: response.data };
  } catch (error: any) {
    console.error("[inventory] Create session error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.detail || error.response?.data?.warehouse?.[0] || "Erreur lors de la création de l'inventaire",
      errors: error.response?.data,
    };
  }
}

export async function deleteInventorySession(
  accessToken: string,
  organizationId: string,
  sessionId: string
): Promise<ApiResponse<void>> {
  try {
    await axios.delete(
      `${API_BASE_URL}/inventory-sessions/${sessionId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, message: "Inventaire supprimé" };
  } catch (error: any) {
    console.error("[inventory] Delete session error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de la suppression",
    };
  }
}

export async function startInventorySession(
  accessToken: string,
  organizationId: string,
  sessionId: string
): Promise<ApiResponse<InventorySession>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/inventory-sessions/${sessionId}/start/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, message: "Inventaire démarré", data: response.data };
  } catch (error: any) {
    console.error("[inventory] Start session error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors du démarrage de l'inventaire",
    };
  }
}

export async function submitInventoryCounts(
  accessToken: string,
  organizationId: string,
  sessionId: string,
  counts: CountItemData[]
): Promise<ApiResponse<{ status: string; updated_count: number; updated_ids: string[] }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/inventory-sessions/${sessionId}/count/`,
      { counts },
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, message: "Comptages enregistrés", data: response.data };
  } catch (error: any) {
    console.error("[inventory] Submit counts error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de l'enregistrement des comptages",
    };
  }
}

export async function submitForReview(
  accessToken: string,
  organizationId: string,
  sessionId: string
): Promise<ApiResponse<InventorySession>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/inventory-sessions/${sessionId}/submit/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, message: "Inventaire soumis pour révision", data: response.data };
  } catch (error: any) {
    console.error("[inventory] Submit for review error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de la soumission",
    };
  }
}

export async function validateInventorySession(
  accessToken: string,
  organizationId: string,
  sessionId: string
): Promise<ApiResponse<InventorySession>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/inventory-sessions/${sessionId}/validate/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, message: "Inventaire validé et stock ajusté", data: response.data };
  } catch (error: any) {
    console.error("[inventory] Validate session error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de la validation",
    };
  }
}

export async function cancelInventorySession(
  accessToken: string,
  organizationId: string,
  sessionId: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/inventory-sessions/${sessionId}/cancel/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, message: "Inventaire annulé", data: response.data };
  } catch (error: any) {
    console.error("[inventory] Cancel session error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de l'annulation",
    };
  }
}

export async function getInventoryCounts(
  accessToken: string,
  organizationId: string,
  sessionId: string,
  filters?: InventoryCountFilters
): Promise<ApiResponse<PaginatedResponse<InventoryCount>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.is_counted !== undefined) params.append("is_counted", String(filters.is_counted));
    if (filters?.has_difference) params.append("has_difference", "true");
    if (filters?.search) params.append("search", filters.search);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.page) params.append("page", String(filters.page));

    const response = await axios.get(
      `${API_BASE_URL}/inventory-sessions/${sessionId}/counts/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[inventory] Get counts error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des comptages" };
  }
}

export async function getInventoryPrintData(
  accessToken: string,
  organizationId: string,
  sessionId: string
): Promise<ApiResponse<PrintData>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/inventory-sessions/${sessionId}/print-data/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[inventory] Get print data error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des données d'impression" };
  }
}

export interface LockedProductsResponse {
  locked_product_ids: string[];
  active_sessions: {
    id: string;
    reference: string;
    name: string;
    warehouse__name: string;
    status: string;
  }[];
  has_active_inventory: boolean;
}

export async function getLockedProducts(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<LockedProductsResponse>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/inventory-sessions/locked-products/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[inventory] Get locked products error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des produits bloqués" };
  }
}
