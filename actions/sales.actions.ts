"use server";

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
  warehouse: string | null;
  warehouse_name: string | null;
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
  warehouse?: string;
  is_active?: boolean;
  receipt_header?: string;
  receipt_footer?: string;
}

export interface OpenSessionData {
  register: string;
  opening_balance: number;
  notes?: string;
}

export interface CloseSessionData {
  closing_balance: number;
  notes?: string;
}

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
  } catch (error: any) {
    console.error("[Sales] Get registers error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Get register error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Create register error:", error.response?.data || error.message);
    return {
      success: false,
      message: "Erreur lors de la création de la caisse",
      errors: error.response?.data,
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
  } catch (error: any) {
    console.error("[Sales] Update register error:", error.response?.data || error.message);
    return {
      success: false,
      message: "Erreur lors de la mise à jour de la caisse",
      errors: error.response?.data,
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
  } catch (error: any) {
    console.error("[Sales] Delete register error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Get sessions error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Get session error:", error.response?.data || error.message);
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
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { success: false, message: "Aucune session ouverte" };
    }
    console.error("[Sales] Get current session error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Open session error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de l'ouverture de la session",
    };
  }
}

export async function closeSession(
  accessToken: string,
  organizationId: string,
  sessionId: string,
  data: CloseSessionData
): Promise<ApiResponse<RegisterSession>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/register-sessions/${sessionId}/close/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Sales] Close session error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de la fermeture de la session",
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
  } catch (error: any) {
    console.error("[Sales] Get payment methods error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Create payment method error:", error.response?.data || error.message);
    return {
      success: false,
      message: "Erreur lors de la création de la méthode de paiement",
      errors: error.response?.data,
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
  } catch (error: any) {
    console.error("[Sales] Update payment method error:", error.response?.data || error.message);
    return {
      success: false,
      message: "Erreur lors de la mise à jour de la méthode de paiement",
      errors: error.response?.data,
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
  } catch (error: any) {
    console.error("[Sales] Delete payment method error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Get sales error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Get sale error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Get today sales error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Get sales stats error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Create sale error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.items || "Erreur lors de la création de la vente",
      errors: error.response?.data,
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
  } catch (error: any) {
    console.error("[Sales] Add payment error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de l'ajout du paiement",
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
  } catch (error: any) {
    console.error("[Sales] Cancel sale error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de l'annulation de la vente",
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
  } catch (error: any) {
    console.error("[Sales] Mark receipt printed error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de la mise à jour du reçu",
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
  } catch (error: any) {
    console.error("[Sales] Get sale returns error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Get sale return error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Create sale return error:", error.response?.data || error.message);
    return {
      success: false,
      message: "Erreur lors de la création du retour",
      errors: error.response?.data,
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
  } catch (error: any) {
    console.error("[Sales] Approve return error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de l'approbation du retour",
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
  } catch (error: any) {
    console.error("[Sales] Reject return error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors du rejet du retour",
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
  } catch (error: any) {
    console.error("[Sales] Get quotations error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Get quotation error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Create quotation error:", error.response?.data || error.message);
    return {
      success: false,
      message: "Erreur lors de la création du devis",
      errors: error.response?.data,
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
  } catch (error: any) {
    console.error("[Sales] Update quotation error:", error.response?.data || error.message);
    return {
      success: false,
      message: "Erreur lors de la mise à jour du devis",
      errors: error.response?.data,
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
  } catch (error: any) {
    console.error("[Sales] Delete quotation error:", error.response?.data || error.message);
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
  } catch (error: any) {
    console.error("[Sales] Convert quotation error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de la conversion du devis",
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
  } catch (error: any) {
    console.error("[Sales] Send quotation error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de l'envoi du devis",
    };
  }
}
