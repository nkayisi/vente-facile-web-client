"use server";

import { formatApiErrorBody, formatAxiosErrorMessage } from "@/lib/api/drf-error";
import axios from "@/lib/auth/api-helper";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// =============================================================================
// TYPES
// =============================================================================

export type SaleStatus = "draft" | "pending" | "completed" | "partially_paid" | "cancelled" | "refunded";
export type SaleType = "retail" | "wholesale" | "credit";
export type SessionStatus = "open" | "closed";
export type PaymentMethodType = "cash" | "card" | "mobile_money" | "bank_transfer" | "check" | "credit" | "other";
export type ReturnStatus = "draft" | "pending" | "approved" | "completed" | "rejected";
export type ReturnType = "full" | "partial" | "exchange";
export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";

export interface Register {
  id: string;
  name: string;
  code: string;
  branch: string;
  branch_name: string;
  warehouse: string;
  warehouse_name: string;
  is_active: boolean;
  receipt_header: string;
  receipt_footer: string;
  current_session: {
    id: string;
    opened_by: string;
    opening_balance: string;
    opened_at: string;
  } | null;
  created_at: string;
}

export interface RegisterSession {
  id: string;
  register: string;
  register_name: string;
  warehouse: string | null;
  warehouse_name: string | null;
  opened_by: string;
  opened_by_name: string;
  closed_by: string | null;
  closed_by_name: string | null;
  status: SessionStatus;
  opening_balance: string;
  closing_balance: string | null;
  expected_balance: string | null;
  difference: string | null;
  opened_at: string;
  closed_at: string | null;
  sales_count: number;
  sales_total: string;
  notes: string;
  payments_summary?: { method: string; total: string }[];
}

export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  method_type: PaymentMethodType;
  method_type_display: string;
  is_active: boolean;
  is_default: boolean;
  requires_reference: boolean;
  icon: string;
}

export interface SaleItem {
  id: string;
  product: string;
  product_name: string;
  product_sku: string;
  variant: string | null;
  variant_name: string | null;
  batch: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  cost_price: string;
  discount_amount: string;
  discount_percentage: string;
  tax_rate: string;
  tax_amount: string;
  subtotal: string;
  total: string;
  notes: string;
}

export interface Payment {
  id: string;
  payment_method: string;
  payment_method_name: string;
  amount: string;
  currency: string;
  exchange_rate: string;
  reference: string;
  status: string;
  received_by: string;
  received_by_name: string;
  paid_at: string;
  notes: string;
}

export interface Sale {
  id: string;
  reference: string;
  session: string | null;
  register: string | null;
  register_name: string | null;
  warehouse: string | null;
  warehouse_name: string | null;
  customer: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  sale_type: SaleType;
  sale_type_display: string;
  status: SaleStatus;
  status_display: string;
  price_list: string | null;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  discount_percentage: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  change_amount: string;
  currency: string;
  exchange_rate: string;
  notes: string;
  internal_notes: string;
  sold_by: string;
  sold_by_name: string;
  sale_date: string;
  due_date: string | null;
  is_pos: boolean;
  receipt_printed: boolean;
  items_count: number;
  items?: SaleItem[];
  payments?: Payment[];
  created_at: string;
  updated_at: string;
}

export interface SaleReturnItem {
  id: string;
  original_item: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  total: string;
  reason: string;
  restock: boolean;
}

export interface SaleReturn {
  id: string;
  reference: string;
  original_sale: string;
  original_sale_reference: string;
  return_type: ReturnType;
  status: ReturnStatus;
  status_display: string;
  total_amount: string;
  refund_amount: string;
  reason: string;
  created_by: string;
  created_by_name: string;
  approved_by: string | null;
  approved_by_name: string | null;
  return_date: string;
  approved_at: string | null;
  items?: SaleReturnItem[];
  created_at: string;
}

export interface QuotationItem {
  id: string;
  product: string;
  product_name: string;
  product_sku: string;
  variant: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  discount_percentage: string;
  tax_rate: string;
  total: string;
}

export interface Quotation {
  id: string;
  reference: string;
  customer: string | null;
  customer_name: string | null;
  status: QuotationStatus;
  status_display: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total: string;
  valid_until: string;
  notes: string;
  terms: string;
  created_by: string;
  created_by_name: string;
  converted_sale: string | null;
  items?: QuotationItem[];
  items_count: number;
  created_at: string;
  updated_at: string;
}

export interface SalesStats {
  summary: {
    total_sales: string;
    total_tax: string;
    total_discount: string;
    count: number;
    average: string;
  };
  by_payment_method: { payment_method__name: string; total: string; count: number }[];
  by_type: { sale_type: string; total: string; count: number }[];
}

// Create/Update types
export interface CreateRegisterData {
  name: string;
  code: string;
  branch: string;
  warehouse: string;
  is_active?: boolean;
  receipt_header?: string;
  receipt_footer?: string;
}

export interface OpenSessionData {
  register: string;
}

/** Corps vide : le backend calcule solde de fermeture et ignore les notes. */
export type CloseSessionData = Record<string, never>;

export interface CreatePaymentMethodData {
  name: string;
  code: string;
  method_type: PaymentMethodType;
  is_active?: boolean;
  is_default?: boolean;
  requires_reference?: boolean;
  icon?: string;
}

export interface CreateSaleItemData {
  product: string;
  variant?: string;
  batch?: string;
  quantity: number;
  unit_price?: number;
  discount_percentage?: number;
  tax_rate?: number;
  notes?: string;
}

export interface CreatePaymentData {
  payment_method: string;
  amount: number;
  currency?: string;
  exchange_rate?: number;
  reference?: string;
  notes?: string;
}

export interface CreateSaleData {
  register?: string;
  warehouse?: string;
  customer?: string;
  sale_type?: SaleType;
  price_list?: string;
  discount_percentage?: number;
  /** Remise globale en montant fixe (prioritaire sur discount_percentage) */
  global_discount_amount?: number;
  currency?: string;
  exchange_rate?: number;
  notes?: string;
  internal_notes?: string;
  due_date?: string;
  is_pos?: boolean;
  items: CreateSaleItemData[];
  payments?: CreatePaymentData[];
  points_used?: number;
}

export interface AddPaymentData {
  payment_method: string;
  amount: number;
  reference?: string;
  notes?: string;
}

export interface CreateSaleReturnItemData {
  original_item: string;
  quantity: number;
  reason?: string;
  restock?: boolean;
}

export interface CreateSaleReturnData {
  original_sale: string;
  return_type: ReturnType;
  reason: string;
  items: CreateSaleReturnItemData[];
}

export interface CreateQuotationItemData {
  product: string;
  variant?: string;
  description?: string;
  quantity: number;
  unit_price?: number;
  discount_percentage?: number;
  tax_rate?: number;
}

export interface CreateQuotationData {
  customer?: string;
  valid_until: string;
  notes?: string;
  terms?: string;
  items: CreateQuotationItemData[];
}

// Filters
export interface SaleFilters {
  status?: SaleStatus;
  sale_type?: SaleType;
  customer?: string;
  register?: string;
  is_pos?: boolean;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

// =============================================================================
// HELPERS
// =============================================================================

function getHeaders(accessToken: string, organizationId: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Organization-ID": organizationId,
  };
}

type AxiosLikeError = {
  response?: { data?: unknown; status?: number };
  message?: string;
};

function asAxiosError(error: unknown): AxiosLikeError {
  if (error && typeof error === "object") {
    return error as AxiosLikeError;
  }
  return {};
}

function salesResponseData(error: unknown): unknown {
  return asAxiosError(error).response?.data;
}

function salesValidationErrors(error: unknown): Record<string, string[]> | undefined {
  const data = salesResponseData(error);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, string[]>;
  }
  return undefined;
}

function logSalesError(context: string, error: unknown) {
  const err = asAxiosError(error);
  console.error(`[Sales] ${context}:`, err.response?.data ?? err.message ?? error);
}

function salesErrorMessage(error: unknown, fallback: string, field?: string): string {
  const data = salesResponseData(error);
  if (field && data && typeof data === "object" && !Array.isArray(data)) {
    const value = (data as Record<string, unknown>)[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return formatApiErrorBody(data as Record<string, unknown>, fallback);
  }
  return formatAxiosErrorMessage(error, fallback);
}

// =============================================================================
// REGISTER ACTIONS
// =============================================================================

export async function getRegisters(
  accessToken: string,
  organizationId: string,
  filters?: { is_active?: boolean; branch?: string; search?: string }
): Promise<ApiResponse<Register[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active));
    if (filters?.branch) params.append("branch", filters.branch);
    if (filters?.search) params.append("search", filters.search);

    const response = await axios.get(
      `${API_BASE_URL}/registers/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: unknown) {
    console.error("[Sales] Get registers error:", error);
    return { success: false, message: "Erreur lors de la récupération des caisses" };
  }
}

export async function getRegister(
  accessToken: string,
  organizationId: string,
  registerId: string
): Promise<ApiResponse<Register>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/registers/${registerId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Get register error", error);
    return { success: false, message: "Erreur lors de la récupération de la caisse" };
  }
}

export async function createRegister(
  accessToken: string,
  organizationId: string,
  data: CreateRegisterData
): Promise<ApiResponse<Register>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/registers/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Create register error", error);
    return {
      success: false,
      message: "Erreur lors de la création de la caisse",
      errors: salesValidationErrors(error),
    };
  }
}

export async function updateRegister(
  accessToken: string,
  organizationId: string,
  registerId: string,
  data: Partial<CreateRegisterData>
): Promise<ApiResponse<Register>> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/registers/${registerId}/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Update register error", error);
    return {
      success: false,
      message: "Erreur lors de la mise à jour de la caisse",
      errors: salesValidationErrors(error),
    };
  }
}

export async function deleteRegister(
  accessToken: string,
  organizationId: string,
  registerId: string
): Promise<ApiResponse<void>> {
  try {
    await axios.delete(
      `${API_BASE_URL}/registers/${registerId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true };
  } catch (error: unknown) {
    logSalesError("Delete register error", error);
    return { success: false, message: "Erreur lors de la suppression de la caisse" };
  }
}

// =============================================================================
// REGISTER SESSION ACTIONS
// =============================================================================

export async function getRegisterSessions(
  accessToken: string,
  organizationId: string,
  filters?: { status?: SessionStatus; register?: string; opened_by?: string }
): Promise<ApiResponse<RegisterSession[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.register) params.append("register", filters.register);
    if (filters?.opened_by) params.append("opened_by", filters.opened_by);

    const response = await axios.get(
      `${API_BASE_URL}/register-sessions/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: unknown) {
    logSalesError("Get sessions error", error);
    return { success: false, message: "Erreur lors de la récupération des sessions" };
  }
}

export async function getRegisterSession(
  accessToken: string,
  organizationId: string,
  sessionId: string
): Promise<ApiResponse<RegisterSession>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/register-sessions/${sessionId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Get session error", error);
    return { success: false, message: "Erreur lors de la récupération de la session" };
  }
}

export async function getCurrentSession(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<RegisterSession>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/register-sessions/current/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    if (asAxiosError(error).response?.status === 404) {
      return { success: false, message: "Aucune session ouverte" };
    }
    logSalesError("Get current session error", error);
    return { success: false, message: "Erreur lors de la récupération de la session" };
  }
}

export async function openSession(
  accessToken: string,
  organizationId: string,
  data: OpenSessionData
): Promise<ApiResponse<RegisterSession>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/register-sessions/open/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Open session error", error);
    return {
      success: false,
      message: salesErrorMessage(error, "Erreur lors de l'ouverture de la session", "error"),
    };
  }
}

export async function closeSession(
  accessToken: string,
  organizationId: string,
  sessionId: string,
  data: CloseSessionData = {}
): Promise<ApiResponse<RegisterSession>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/register-sessions/${sessionId}/close/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Close session error", error);
    return {
      success: false,
      message: salesErrorMessage(error, "Erreur lors de la fermeture de la session", "error"),
    };
  }
}

// =============================================================================
// PAYMENT METHOD ACTIONS
// =============================================================================

export async function getPaymentMethods(
  accessToken: string,
  organizationId: string,
  filters?: { is_active?: boolean; method_type?: PaymentMethodType }
): Promise<ApiResponse<PaymentMethod[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active));
    if (filters?.method_type) params.append("method_type", filters.method_type);

    const response = await axios.get(
      `${API_BASE_URL}/payment-methods/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: unknown) {
    logSalesError("Get payment methods error", error);
    return { success: false, message: "Erreur lors de la récupération des méthodes de paiement" };
  }
}

export async function createPaymentMethod(
  accessToken: string,
  organizationId: string,
  data: CreatePaymentMethodData
): Promise<ApiResponse<PaymentMethod>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/payment-methods/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Create payment method error", error);
    return {
      success: false,
      message: "Erreur lors de la création de la méthode de paiement",
      errors: salesValidationErrors(error),
    };
  }
}

export async function updatePaymentMethod(
  accessToken: string,
  organizationId: string,
  methodId: string,
  data: Partial<CreatePaymentMethodData>
): Promise<ApiResponse<PaymentMethod>> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/payment-methods/${methodId}/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Update payment method error", error);
    return {
      success: false,
      message: "Erreur lors de la mise à jour de la méthode de paiement",
      errors: salesValidationErrors(error),
    };
  }
}

export async function deletePaymentMethod(
  accessToken: string,
  organizationId: string,
  methodId: string
): Promise<ApiResponse<void>> {
  try {
    await axios.delete(
      `${API_BASE_URL}/payment-methods/${methodId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true };
  } catch (error: unknown) {
    logSalesError("Delete payment method error", error);
    return { success: false, message: "Erreur lors de la suppression de la méthode de paiement" };
  }
}

// =============================================================================
// SALE ACTIONS
// =============================================================================

export async function getSales(
  accessToken: string,
  organizationId: string,
  filters?: SaleFilters
): Promise<ApiResponse<PaginatedResponse<Sale>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.sale_type) params.append("sale_type", filters.sale_type);
    if (filters?.customer) params.append("customer", filters.customer);
    if (filters?.register) params.append("register", filters.register);
    if (filters?.is_pos !== undefined) params.append("is_pos", String(filters.is_pos));
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(
      `${API_BASE_URL}/sales/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data: PaginatedResponse<Sale> = Array.isArray(response.data)
      ? { count: response.data.length, next: null, previous: null, results: response.data }
      : response.data;

    return { success: true, data };
  } catch (error: unknown) {
    logSalesError("Get sales error", error);
    return { success: false, message: "Erreur lors de la récupération des ventes" };
  }
}

export async function getSale(
  accessToken: string,
  organizationId: string,
  saleId: string
): Promise<ApiResponse<Sale>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/sales/${saleId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Get sale error", error);
    return { success: false, message: "Erreur lors de la récupération de la vente" };
  }
}

export async function getTodaySales(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<Sale[]>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/sales/today/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: unknown) {
    logSalesError("Get today sales error", error);
    return { success: false, message: "Erreur lors de la récupération des ventes du jour" };
  }
}

export async function getSalesStats(
  accessToken: string,
  organizationId: string,
  period: "today" | "week" | "month" = "today"
): Promise<ApiResponse<SalesStats>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/sales/stats/?period=${period}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Get sales stats error", error);
    return { success: false, message: "Erreur lors de la récupération des statistiques" };
  }
}

export async function createSale(
  accessToken: string,
  organizationId: string,
  data: CreateSaleData
): Promise<ApiResponse<Sale>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/sales/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Create sale error", error);
    return {
      success: false,
      message: salesErrorMessage(error, "Erreur lors de la création de la vente", "items"),
      errors: salesValidationErrors(error),
    };
  }
}

export async function addPaymentToSale(
  accessToken: string,
  organizationId: string,
  saleId: string,
  data: AddPaymentData
): Promise<ApiResponse<Sale>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/sales/${saleId}/add-payment/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Add payment error", error);
    return {
      success: false,
      message: salesErrorMessage(error, "Erreur lors de l'ajout du paiement", "error"),
    };
  }
}

export async function cancelSale(
  accessToken: string,
  organizationId: string,
  saleId: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/sales/${saleId}/cancel/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Cancel sale error", error);
    return {
      success: false,
      message: salesErrorMessage(error, "Erreur lors de l'annulation de la vente", "error"),
    };
  }
}

export async function markReceiptPrinted(
  accessToken: string,
  organizationId: string,
  saleId: string
): Promise<ApiResponse<Sale>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/sales/${saleId}/mark_receipt_printed/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Mark receipt printed error", error);
    return {
      success: false,
      message: salesErrorMessage(error, "Erreur lors de la mise à jour du reçu", "error"),
    };
  }
}

// =============================================================================
// SALE RETURN ACTIONS
// =============================================================================

export async function getSaleReturns(
  accessToken: string,
  organizationId: string,
  filters?: { status?: ReturnStatus; return_type?: ReturnType; search?: string }
): Promise<ApiResponse<SaleReturn[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.return_type) params.append("return_type", filters.return_type);
    if (filters?.search) params.append("search", filters.search);

    const response = await axios.get(
      `${API_BASE_URL}/sale-returns/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: unknown) {
    logSalesError("Get sale returns error", error);
    return { success: false, message: "Erreur lors de la récupération des retours" };
  }
}

export async function getSaleReturn(
  accessToken: string,
  organizationId: string,
  returnId: string
): Promise<ApiResponse<SaleReturn>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/sale-returns/${returnId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Get sale return error", error);
    return { success: false, message: "Erreur lors de la récupération du retour" };
  }
}

export async function createSaleReturn(
  accessToken: string,
  organizationId: string,
  data: CreateSaleReturnData
): Promise<ApiResponse<SaleReturn>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/sale-returns/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Create sale return error", error);
    return {
      success: false,
      message: "Erreur lors de la création du retour",
      errors: salesValidationErrors(error),
    };
  }
}

export async function approveSaleReturn(
  accessToken: string,
  organizationId: string,
  returnId: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/sale-returns/${returnId}/approve/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Approve return error", error);
    return {
      success: false,
      message: salesErrorMessage(error, "Erreur lors de l'approbation du retour", "error"),
    };
  }
}

export async function rejectSaleReturn(
  accessToken: string,
  organizationId: string,
  returnId: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/sale-returns/${returnId}/reject/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Reject return error", error);
    return {
      success: false,
      message: salesErrorMessage(error, "Erreur lors du rejet du retour", "error"),
    };
  }
}

// =============================================================================
// QUOTATION ACTIONS
// =============================================================================

export async function getQuotations(
  accessToken: string,
  organizationId: string,
  filters?: { status?: QuotationStatus; customer?: string; search?: string }
): Promise<ApiResponse<Quotation[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.customer) params.append("customer", filters.customer);
    if (filters?.search) params.append("search", filters.search);

    const response = await axios.get(
      `${API_BASE_URL}/quotations/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: unknown) {
    logSalesError("Get quotations error", error);
    return { success: false, message: "Erreur lors de la récupération des devis" };
  }
}

export async function getQuotation(
  accessToken: string,
  organizationId: string,
  quotationId: string
): Promise<ApiResponse<Quotation>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/quotations/${quotationId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Get quotation error", error);
    return { success: false, message: "Erreur lors de la récupération du devis" };
  }
}

export async function createQuotation(
  accessToken: string,
  organizationId: string,
  data: CreateQuotationData
): Promise<ApiResponse<Quotation>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/quotations/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Create quotation error", error);
    return {
      success: false,
      message: "Erreur lors de la création du devis",
      errors: salesValidationErrors(error),
    };
  }
}

export async function updateQuotation(
  accessToken: string,
  organizationId: string,
  quotationId: string,
  data: Partial<CreateQuotationData>
): Promise<ApiResponse<Quotation>> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/quotations/${quotationId}/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Update quotation error", error);
    return {
      success: false,
      message: "Erreur lors de la mise à jour du devis",
      errors: salesValidationErrors(error),
    };
  }
}

export async function deleteQuotation(
  accessToken: string,
  organizationId: string,
  quotationId: string
): Promise<ApiResponse<void>> {
  try {
    await axios.delete(
      `${API_BASE_URL}/quotations/${quotationId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true };
  } catch (error: unknown) {
    logSalesError("Delete quotation error", error);
    return { success: false, message: "Erreur lors de la suppression du devis" };
  }
}

export async function convertQuotation(
  accessToken: string,
  organizationId: string,
  quotationId: string
): Promise<ApiResponse<{ status: string; sale_id: string; sale_reference: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/quotations/${quotationId}/convert/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Convert quotation error", error);
    return {
      success: false,
      message: salesErrorMessage(error, "Erreur lors de la conversion du devis", "error"),
    };
  }
}

export async function sendQuotation(
  accessToken: string,
  organizationId: string,
  quotationId: string
): Promise<ApiResponse<{ status: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/quotations/${quotationId}/send/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    logSalesError("Send quotation error", error);
    return {
      success: false,
      message: salesErrorMessage(error, "Erreur lors de l'envoi du devis", "error"),
    };
  }
}
