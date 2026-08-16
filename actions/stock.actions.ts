"use server";

import { revalidatePath } from "next/cache";
import { formatAxiosErrorMessage, getErrorBody } from "@/lib/api/drf-error";
import axios from "@/lib/auth/api-helper";

const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

// =============================================================================
// TYPES
// =============================================================================

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  branch?: string | null;
  branch_name?: string;
  address?: string;
  manager?: string | null;
  manager_name?: string;
  is_default: boolean;
  is_active: boolean;
  allow_negative_stock: boolean;
  stock_value?: string;
  locations?: StockLocation[];
  created_at?: string;
  updated_at?: string;
}

export interface StockLocation {
  id: string;
  name: string;
  code: string;
  warehouse: string;
  warehouse_name?: string;
  parent?: string | null;
  parent_name?: string;
  is_active: boolean;
}

export interface Stock {
  id: string;
  product: string;
  product_name: string;
  product_sku: string;
  /** Photo du produit, absente pour la plupart d'entre eux */
  product_image?: string | null;
  variant?: string | null;
  variant_name?: string;
  warehouse: string;
  warehouse_name: string;
  location?: string | null;
  location_name?: string;
  quantity: string;
  reserved_quantity: string;
  available_quantity: string;
  /** Part du stock hors emballage scellé (produits vendus en gros) */
  loose_quantity?: string;
  /** Quantité prête à afficher : « 1 paquet + 10 bouteilles » */
  stock_display?: string;
  /** Conditionnements scellés, `null` pour un produit vendu à l'unité */
  stock_packages?: number | null;
  stock_loose?: string | null;
  unit_symbol?: string | null;
  avg_cost: string;
  stock_value?: string;
  last_counted_at?: string;
  last_movement_at?: string;
}

export interface StockBatch {
  id: string;
  product: string;
  product_name: string;
  variant?: string | null;
  warehouse: string;
  warehouse_name: string;
  batch_number: string;
  quantity: string;
  cost_price: string;
  manufacturing_date?: string;
  expiry_date?: string;
  is_expired: boolean;
  days_until_expiry?: number;
  received_at: string;
  notes?: string;
}

export type MovementType =
  | "purchase" | "sale" | "return_in" | "return_out"
  | "transfer_in" | "transfer_out" | "adjustment_in" | "adjustment_out"
  | "damage" | "expired" | "initial" | "production_in" | "production_out"
  // Produit par le serveur lors de l'ouverture d'un conditionnement. Ne change
  // pas la quantité totale : il déplace du scellé vers le vrac.
  | "unpack";

export interface StockMovement {
  id: string;
  product: string;
  product_name: string;
  product_sku?: string;
  variant?: string | null;
  warehouse: string;
  warehouse_name: string;
  batch?: string | null;
  batch_number?: string;
  movement_type: MovementType;
  movement_type_display: string;
  quantity: string;
  /** Quantité dans les termes de la saisie : « 10 cartons + 5 bouteilles » */
  quantity_display?: string;
  /** Unités par conditionnement au moment du mouvement, null si vente à l'unité */
  packaging_factor?: number | null;
  unit_cost: string;
  quantity_before: string;
  quantity_after: string;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
}

export type TransferStatus = "draft" | "pending" | "in_transit" | "completed" | "cancelled";

export interface StockTransferItem {
  id: string;
  product: string;
  product_name: string;
  product_sku: string;
  variant?: string | null;
  batch?: string | null;
  quantity_requested: string;
  quantity_shipped?: string;
  quantity_received?: string;
  /** Contenants entiers demandés (produits vendus en gros) */
  package_quantity?: string;
  /** Unités demandées hors contenant */
  loose_quantity?: string;
  packaging_factor?: number | null;
  /** Demande prête à afficher : « 4 cartons + 3 bouteilles » */
  requested_display?: string;
  notes?: string;
}

export interface StockTransfer {
  id: string;
  reference: string;
  source_warehouse: string;
  source_warehouse_name: string;
  destination_warehouse: string;
  destination_warehouse_name: string;
  status: TransferStatus;
  status_display: string;
  notes?: string;
  items?: StockTransferItem[];
  items_count?: number;
  requested_by?: string;
  requested_by_name?: string;
  approved_by?: string;
  approved_by_name?: string;
  requested_at: string;
  shipped_at?: string;
  received_at?: string;
  created_at?: string;
  updated_at?: string;
}

export type AdjustmentType = "count" | "damage" | "theft" | "expired" | "correction" | "other";
export type AdjustmentStatus = "draft" | "pending" | "approved" | "rejected";

export interface StockAdjustmentItem {
  id?: string;
  product: string;
  product_name?: string;
  product_sku?: string;
  variant?: string | null;
  batch?: string | null;
  quantity_counted: number;
  quantity_expected: number;
  quantity_difference?: number;
  /** Contenants scellés comptés (produits vendus en gros) */
  counted_package_quantity?: number | null;
  /** Unités comptées hors contenant */
  counted_loose_quantity?: number | null;
  packaging_factor?: number | null;
  /** Comptage prêt à afficher : « 3 cartons + 2 bouteilles » */
  counted_display?: string;
  expected_display?: string;
  unit_cost: number;
  notes?: string;
}

export interface StockAdjustment {
  id: string;
  reference: string;
  warehouse: string;
  warehouse_name: string;
  adjustment_type: AdjustmentType;
  adjustment_type_display: string;
  status: AdjustmentStatus;
  status_display: string;
  reason?: string;
  items?: StockAdjustmentItem[];
  items_count?: number;
  total_difference?: string;
  created_by?: string;
  created_by_name?: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface WarehouseStockSummary {
  total_products: number;
  total_quantity: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
}

// Create/Update types
export interface CreateWarehouseData {
  name: string;
  code: string;
  branch?: string | null;
  address?: string;
  manager?: string | null;
  is_default?: boolean;
  is_active?: boolean;
  allow_negative_stock?: boolean;
}

export interface CreateStockLocationData {
  name: string;
  code: string;
  warehouse: string;
  parent?: string | null;
  is_active?: boolean;
}

export interface CreateStockMovementData {
  product: string;
  variant?: string | null;
  warehouse: string;
  batch?: string | null;
  movement_type: MovementType;
  /**
   * Quantité en unité de base. Optionnelle si la saisie est faite en
   * conditionnements (`package_quantity` / `loose_quantity`) : le serveur fait
   * alors la conversion, seule source de vérité.
   */
  quantity?: number;
  /** Nombre de conditionnements entiers saisis */
  package_quantity?: number;
  /** Nombre d'unités saisies hors conditionnement */
  loose_quantity?: number;
  /** Prix d'achat d'une unité de détail */
  unit_cost?: number;
  /**
   * Prix d'achat d'un conditionnement entier. Peut coexister avec `unit_cost` :
   * le serveur en tire un coût unitaire pondéré par les quantités saisies.
   */
  package_unit_cost?: number;
  /**
   * Reporte les prix saisis sur la fiche produit. Sans ce drapeau, les prix ne
   * valorisent que ce mouvement.
   */
  update_product_prices?: boolean;
  /** Nouveau prix de vente au détail, envoyé seulement si le report est demandé */
  selling_price?: number;
  /** Nouveau prix de vente du conditionnement, même condition */
  wholesale_price?: number;
  notes?: string;
  location?: string;
  expiry_date?: string;
}

export interface CreateStockTransferData {
  source_warehouse: string;
  destination_warehouse: string;
  notes?: string;
  items: {
    product: string;
    variant?: string | null;
    batch?: string | null;
    /**
     * Quantité en unité de détail. Optionnelle quand la demande est saisie en
     * contenants : le serveur fait la conversion, seule source de vérité.
     */
    quantity_requested?: number;
    /** Contenants entiers demandés */
    package_quantity?: number;
    /** Unités demandées hors contenant */
    loose_quantity?: number;
    notes?: string;
  }[];
}

export interface CreateStockAdjustmentData {
  warehouse: string;
  adjustment_type: AdjustmentType;
  reason?: string;
  items: {
    product: string;
    variant?: string | null;
    batch?: string | null;
    /**
     * Quantité comptée en unité de détail. Optionnelle quand le comptage est
     * saisi en contenants : le serveur recompose le total.
     */
    quantity_counted?: number;
    /** Contenants scellés comptés */
    counted_package_quantity?: number;
    /** Unités comptées hors contenant */
    counted_loose_quantity?: number;
    quantity_expected: number;
    unit_cost?: number;
    /** Coût d'un contenant entier ; converti en coût unitaire par le serveur */
    package_unit_cost?: number;
    notes?: string;
  }[];
}

// Filter types
export interface WarehouseFilters {
  is_active?: boolean;
  is_default?: boolean;
  branch?: string;
  search?: string;
}

export interface StockFilters {
  warehouse?: string;
  product?: string;
  search?: string;
  ordering?: string;
}

export interface StockMovementFilters {
  warehouse?: string;
  product?: string;
  movement_type?: MovementType;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface StockTransferFilters {
  status?: TransferStatus;
  source_warehouse?: string;
  destination_warehouse?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface StockAdjustmentFilters {
  status?: AdjustmentStatus;
  adjustment_type?: AdjustmentType;
  warehouse?: string;
  search?: string;
  page?: number;
  page_size?: number;
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
// WAREHOUSE ACTIONS
// =============================================================================

export async function getWarehouses(
  accessToken: string,
  organizationId: string,
  filters?: WarehouseFilters
): Promise<ApiResponse<Warehouse[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active));
    if (filters?.is_default !== undefined) params.append("is_default", String(filters.is_default));
    if (filters?.branch) params.append("branch", filters.branch);
    if (filters?.search) params.append("search", filters.search);

    const response = await axios.get(
      `${API_BASE_URL}/warehouses/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    // Handle both paginated and non-paginated responses
    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: unknown) {
    console.error("[stock] Get warehouses error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des entrepôts" };
  }
}

export async function getWarehouse(
  accessToken: string,
  organizationId: string,
  warehouseId: string
): Promise<ApiResponse<Warehouse>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/warehouses/${warehouseId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Get warehouse error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération de l'entrepôt" };
  }
}

export async function createWarehouse(
  accessToken: string,
  organizationId: string,
  data: CreateWarehouseData
): Promise<ApiResponse<Warehouse>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/warehouses/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    revalidatePath("/dashboard/stock");

    return { success: true, message: "Entrepôt créé avec succès", data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Create warehouse error:", (error as any).response?.data || (error as Error).message);
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de la création de l'entrepôt"),
      errors: (error as any).response?.data,
    };
  }
}

export async function updateWarehouse(
  accessToken: string,
  organizationId: string,
  warehouseId: string,
  data: Partial<CreateWarehouseData>
): Promise<ApiResponse<Warehouse>> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/warehouses/${warehouseId}/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    revalidatePath("/dashboard/stock");
    revalidatePath(`/dashboard/stock/${warehouseId}`);

    return { success: true, message: "Entrepôt mis à jour avec succès", data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Update warehouse error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors de la mise à jour de l'entrepôt",
      errors: getErrorBody(error),
    };
  }
}

export async function deleteWarehouse(
  accessToken: string,
  organizationId: string,
  warehouseId: string
): Promise<ApiResponse<void>> {
  try {
    await axios.delete(
      `${API_BASE_URL}/warehouses/${warehouseId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    revalidatePath("/dashboard/stock");

    return { success: true, message: "Entrepôt supprimé avec succès" };
  } catch (error: unknown) {
    console.error("[stock] Delete warehouse error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors de la suppression de l'entrepôt",
    };
  }
}

export async function getWarehouseStockSummary(
  accessToken: string,
  organizationId: string,
  warehouseId: string
): Promise<ApiResponse<WarehouseStockSummary>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/warehouses/${warehouseId}/stock-summary/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Get stock summary error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération du résumé de stock" };
  }
}

// =============================================================================
// STOCK LOCATION ACTIONS
// =============================================================================

export async function getStockLocations(
  accessToken: string,
  organizationId: string,
  warehouseId?: string
): Promise<ApiResponse<StockLocation[]>> {
  try {
    const params = new URLSearchParams();
    if (warehouseId) params.append("warehouse", warehouseId);

    const response = await axios.get(
      `${API_BASE_URL}/stock-locations/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: unknown) {
    console.error("[stock] Get stock locations error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des emplacements" };
  }
}

export async function getLocationsByWarehouse(
  accessToken: string,
  organizationId: string,
  warehouseId: string
): Promise<ApiResponse<StockLocation[]>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/stock-locations/by-warehouse/${warehouseId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Get locations by warehouse error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des emplacements" };
  }
}

export async function createStockLocation(
  accessToken: string,
  organizationId: string,
  data: CreateStockLocationData
): Promise<ApiResponse<StockLocation>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/stock-locations/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, message: "Emplacement créé avec succès", data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Create stock location error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors de la création de l'emplacement",
      errors: getErrorBody(error),
    };
  }
}

// =============================================================================
// STOCK ACTIONS
// =============================================================================

export async function getStocks(
  accessToken: string,
  organizationId: string,
  filters?: StockFilters
): Promise<ApiResponse<Stock[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.warehouse) params.append("warehouse", filters.warehouse);
    if (filters?.product) params.append("product", filters.product);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.ordering) params.append("ordering", filters.ordering);

    const response = await axios.get(
      `${API_BASE_URL}/stocks/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: unknown) {
    console.error("[stock] Get stocks error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération du stock" };
  }
}

export async function getStockByProduct(
  accessToken: string,
  organizationId: string,
  productId: string
): Promise<ApiResponse<Stock[]>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/stocks/by-product/${productId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: unknown) {
    console.error("[stock] Get stock by product error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération du stock" };
  }
}

export async function getStockByWarehouse(
  accessToken: string,
  organizationId: string,
  warehouseId: string
): Promise<ApiResponse<Stock[]>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/stocks/by-warehouse/${warehouseId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: unknown) {
    console.error("[stock] Get stock by warehouse error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération du stock" };
  }
}

export async function getLowStock(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<Stock[]>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/stocks/low-stock/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: unknown) {
    console.error("[stock] Get low stock error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération du stock bas" };
  }
}

export async function getExpiringBatches(
  accessToken: string,
  organizationId: string,
  days: number = 30
): Promise<ApiResponse<StockBatch[]>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/stocks/expiring/?days=${days}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: unknown) {
    console.error("[stock] Get expiring batches error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des lots expirants" };
  }
}

// =============================================================================
// STOCK BATCH ACTIONS
// =============================================================================

export async function getStockBatches(
  accessToken: string,
  organizationId: string,
  filters?: { warehouse?: string; product?: string }
): Promise<ApiResponse<StockBatch[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.warehouse) params.append("warehouse", filters.warehouse);
    if (filters?.product) params.append("product", filters.product);

    const response = await axios.get(
      `${API_BASE_URL}/stock-batches/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: unknown) {
    console.error("[stock] Get stock batches error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des lots" };
  }
}

// =============================================================================
// STOCK MOVEMENT ACTIONS
// =============================================================================

export async function getStockMovements(
  accessToken: string,
  organizationId: string,
  filters?: StockMovementFilters
): Promise<ApiResponse<PaginatedResponse<StockMovement>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.warehouse) params.append("warehouse", filters.warehouse);
    if (filters?.product) params.append("product", filters.product);
    if (filters?.movement_type) params.append("movement_type", filters.movement_type);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(
      `${API_BASE_URL}/stock-movements/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Get stock movements error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des mouvements" };
  }
}

export async function createStockMovement(
  accessToken: string,
  organizationId: string,
  data: CreateStockMovementData
): Promise<ApiResponse<StockMovement>> {
  try {
    // Nettoyer les champs optionnels vides
    const cleanedData = { ...data };
    if (!cleanedData.location || cleanedData.location === "") {
      delete cleanedData.location;
    }
    if (!cleanedData.expiry_date || cleanedData.expiry_date === "") {
      delete cleanedData.expiry_date;
    }

    const response = await axios.post(
      `${API_BASE_URL}/stock-movements/`,
      cleanedData,
      { headers: getHeaders(accessToken, organizationId) }
    );

    revalidatePath("/dashboard/stock");

    return { success: true, message: "Mouvement créé avec succès", data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Create stock movement error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors de la création du mouvement",
      errors: getErrorBody(error),
    };
  }
}

// =============================================================================
// STOCK TRANSFER ACTIONS
// =============================================================================

export async function getStockTransfers(
  accessToken: string,
  organizationId: string,
  filters?: StockTransferFilters
): Promise<ApiResponse<PaginatedResponse<StockTransfer>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.source_warehouse) params.append("source_warehouse", filters.source_warehouse);
    if (filters?.destination_warehouse) params.append("destination_warehouse", filters.destination_warehouse);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(
      `${API_BASE_URL}/stock-transfers/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Get stock transfers error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des transferts" };
  }
}

export async function getStockTransfer(
  accessToken: string,
  organizationId: string,
  transferId: string
): Promise<ApiResponse<StockTransfer>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/stock-transfers/${transferId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Get stock transfer error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération du transfert" };
  }
}

export async function createStockTransfer(
  accessToken: string,
  organizationId: string,
  data: CreateStockTransferData
): Promise<ApiResponse<StockTransfer>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/stock-transfers/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    revalidatePath("/dashboard/stock");

    return { success: true, message: "Transfert créé avec succès", data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Create stock transfer error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors de la création du transfert",
      errors: getErrorBody(error),
    };
  }
}

export async function approveStockTransfer(
  accessToken: string,
  organizationId: string,
  transferId: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/stock-transfers/${transferId}/approve/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, message: "Transfert approuvé", data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Approve transfer error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.error || "Erreur lors de l'approbation du transfert",
    };
  }
}

export async function shipStockTransfer(
  accessToken: string,
  organizationId: string,
  transferId: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/stock-transfers/${transferId}/ship/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, message: "Transfert expédié", data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Ship transfer error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.error || "Erreur lors de l'expédition du transfert",
    };
  }
}

export async function receiveStockTransfer(
  accessToken: string,
  organizationId: string,
  transferId: string,
  /**
   * Quantités réellement déchargées. Pour un produit vendu en gros, le
   * magasinier compte en contenants : `package_quantity` / `loose_quantity`
   * priment alors sur `quantity_received`, que le serveur recompose.
   */
  items?: {
    id: string;
    quantity_received?: number;
    package_quantity?: number;
    loose_quantity?: number;
  }[]
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/stock-transfers/${transferId}/receive/`,
      { items },
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, message: "Transfert reçu", data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Receive transfer error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.error || "Erreur lors de la réception du transfert",
    };
  }
}

export async function cancelStockTransfer(
  accessToken: string,
  organizationId: string,
  transferId: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/stock-transfers/${transferId}/cancel/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, message: "Transfert annulé", data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Cancel transfer error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.error || "Erreur lors de l'annulation du transfert",
    };
  }
}

// =============================================================================
// STOCK ADJUSTMENT ACTIONS
// =============================================================================

export async function getStockAdjustments(
  accessToken: string,
  organizationId: string,
  filters?: StockAdjustmentFilters
): Promise<ApiResponse<PaginatedResponse<StockAdjustment>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.adjustment_type) params.append("adjustment_type", filters.adjustment_type);
    if (filters?.warehouse) params.append("warehouse", filters.warehouse);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(
      `${API_BASE_URL}/stock-adjustments/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Get stock adjustments error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des ajustements" };
  }
}

export async function getStockAdjustment(
  accessToken: string,
  organizationId: string,
  adjustmentId: string
): Promise<ApiResponse<StockAdjustment>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/stock-adjustments/${adjustmentId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Get stock adjustment error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération de l'ajustement" };
  }
}

export async function createStockAdjustment(
  accessToken: string,
  organizationId: string,
  data: CreateStockAdjustmentData
): Promise<ApiResponse<StockAdjustment>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/stock-adjustments/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    revalidatePath("/dashboard/stock");
    revalidatePath("/dashboard/inventory");

    return { success: true, message: "Ajustement créé avec succès", data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Create stock adjustment error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors de la création de l'ajustement",
      errors: getErrorBody(error),
    };
  }
}

export async function approveStockAdjustment(
  accessToken: string,
  organizationId: string,
  adjustmentId: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/stock-adjustments/${adjustmentId}/approve/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, message: "Ajustement approuvé et appliqué", data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Approve adjustment error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.error || "Erreur lors de l'approbation de l'ajustement",
    };
  }
}

export async function rejectStockAdjustment(
  accessToken: string,
  organizationId: string,
  adjustmentId: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/stock-adjustments/${adjustmentId}/reject/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, message: "Ajustement rejeté", data: response.data };
  } catch (error: unknown) {
    console.error("[stock] Reject adjustment error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.error || "Erreur lors du rejet de l'ajustement",
    };
  }
}
