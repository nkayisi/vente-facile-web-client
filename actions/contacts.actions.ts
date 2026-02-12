"use server";

import axios from "@/lib/auth/api-helper";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// =============================================================================
// TYPES
// =============================================================================

export interface Customer {
  id: string;
  code: string;
  customer_type: "individual" | "business";
  customer_type_display: string;
  name: string;
  company_name: string;
  email: string;
  phone: string;
  address: string;
  tax_id: string;
  credit_limit: string;
  current_balance: string;
  available_credit: string;
  notes: string;
  is_active: boolean;
  created_by: string | null;
  created_by_name: string | null;
  total_purchases: string;
  recent_sales: RecentSale[];
  created_at: string;
  updated_at: string;
}

export interface RecentSale {
  id: string;
  reference: string;
  total: string;
  date: string;
}

export interface CustomerTransaction {
  id: string;
  transaction_type: "credit_sale" | "payment" | "advance" | "adjustment" | "refund";
  transaction_type_display: string;
  amount: string;
  balance_before: string;
  balance_after: string;
  reference: string;
  sale: string | null;
  sale_reference: string;
  payment_method: string;
  notes: string;
  created_by: string | null;
  created_by_name: string;
  created_at: string;
}

export interface DebtSummary {
  total_receivable: string;
  total_advances: string;
  debtors_count: number;
  creditors_count: number;
  top_debtors: Customer[];
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  tax_id: string;
  currency: string;
  current_balance: string;
  bank_name: string;
  bank_account: string;
  is_active: boolean;
  created_by: string | null;
  created_by_name: string | null;
  products: SupplierProduct[];
  total_purchases: string;
  recent_orders: RecentOrder[];
  created_at: string;
  updated_at: string;
}

export interface SupplierProduct {
  id: string;
  product: string;
  product_name: string;
  product_sku: string;
  supplier_code: string;
  supplier_name: string;
  unit_price: string;
  min_order_quantity: string;
  lead_time_days: number;
  is_preferred: boolean;
  is_active: boolean;
}

export interface RecentOrder {
  id: string;
  reference: string;
  total: string;
  status: string;
  date: string;
}

export interface CreateCustomerData {
  name: string;
  customer_type?: "individual" | "business";
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  credit_limit?: number;
  notes?: string;
  is_active?: boolean;
}

export interface CreateSupplierData {
  name: string;
  company_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  tax_id?: string;
  currency?: string;
  bank_name?: string;
  bank_account?: string;
  is_active?: boolean;
}

export interface CustomerStats {
  total: number;
  active: number;
  with_balance: number;
  total_balance: string;
  by_type: { customer_type: string; count: number }[];
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
// CUSTOMER ACTIONS
// =============================================================================

export async function getCustomers(
  accessToken: string,
  organizationId: string,
  filters?: { is_active?: boolean; customer_type?: string; search?: string }
): Promise<ApiResponse<Customer[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active));
    if (filters?.customer_type) params.append("customer_type", filters.customer_type);
    if (filters?.search) params.append("search", filters.search);

    const response = await axios.get(
      `${API_BASE_URL}/customers/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: any) {
    console.error("[Contacts] Get customers error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des clients" };
  }
}

export async function getCustomer(
  accessToken: string,
  organizationId: string,
  customerId: string
): Promise<ApiResponse<Customer>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/customers/${customerId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Contacts] Get customer error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération du client" };
  }
}

export async function createCustomer(
  accessToken: string,
  organizationId: string,
  data: CreateCustomerData
): Promise<ApiResponse<Customer>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/customers/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Contacts] Create customer error:", error.response?.data || error.message);
    return {
      success: false,
      message: "Erreur lors de la création du client",
      errors: error.response?.data,
    };
  }
}

export async function updateCustomer(
  accessToken: string,
  organizationId: string,
  customerId: string,
  data: Partial<CreateCustomerData>
): Promise<ApiResponse<Customer>> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/customers/${customerId}/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Contacts] Update customer error:", error.response?.data || error.message);
    return {
      success: false,
      message: "Erreur lors de la mise à jour du client",
      errors: error.response?.data,
    };
  }
}

export async function deleteCustomer(
  accessToken: string,
  organizationId: string,
  customerId: string
): Promise<ApiResponse<void>> {
  try {
    await axios.delete(
      `${API_BASE_URL}/customers/${customerId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true };
  } catch (error: any) {
    console.error("[Contacts] Delete customer error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la suppression du client" };
  }
}

// =============================================================================
// CUSTOMER TRANSACTION / CREDIT ACTIONS
// =============================================================================

export async function getCustomerTransactions(
  accessToken: string,
  organizationId: string,
  customerId: string,
  type?: string
): Promise<ApiResponse<CustomerTransaction[]>> {
  try {
    const params = new URLSearchParams();
    if (type) params.append("type", type);

    const response = await axios.get(
      `${API_BASE_URL}/customers/${customerId}/transactions/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: any) {
    console.error("[Contacts] Get transactions error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des transactions" };
  }
}

export async function recordCustomerPayment(
  accessToken: string,
  organizationId: string,
  customerId: string,
  data: { amount: number; payment_method?: string; reference?: string; notes?: string }
): Promise<ApiResponse<{ transaction: CustomerTransaction; new_balance: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/customers/${customerId}/record-payment/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Contacts] Record payment error:", error.response?.data || error.message);
    return { success: false, message: error.response?.data?.error || "Erreur lors de l'enregistrement du paiement" };
  }
}

export async function recordCustomerAdvance(
  accessToken: string,
  organizationId: string,
  customerId: string,
  data: { amount: number; payment_method?: string; reference?: string; notes?: string }
): Promise<ApiResponse<{ transaction: CustomerTransaction; new_balance: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/customers/${customerId}/record-advance/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Contacts] Record advance error:", error.response?.data || error.message);
    return { success: false, message: error.response?.data?.error || "Erreur lors de l'enregistrement de l'avance" };
  }
}

export async function adjustCustomerBalance(
  accessToken: string,
  organizationId: string,
  customerId: string,
  data: { amount: number; notes?: string }
): Promise<ApiResponse<{ transaction: CustomerTransaction; new_balance: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/customers/${customerId}/adjust-balance/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Contacts] Adjust balance error:", error.response?.data || error.message);
    return { success: false, message: error.response?.data?.error || "Erreur lors de l'ajustement" };
  }
}

export async function getCustomersWithBalance(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<Customer[]>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/customers/with-balance/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Contacts] Get debtors error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des débiteurs" };
  }
}

export async function getDebtSummary(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<DebtSummary>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/customers/debt-summary/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Contacts] Get debt summary error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération du résumé des dettes" };
  }
}

// =============================================================================
// SUPPLIER ACTIONS
// =============================================================================

export async function getSuppliers(
  accessToken: string,
  organizationId: string,
  filters?: { is_active?: boolean; search?: string }
): Promise<ApiResponse<Supplier[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active));
    if (filters?.search) params.append("search", filters.search);

    const response = await axios.get(
      `${API_BASE_URL}/suppliers/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return { success: true, data };
  } catch (error: any) {
    console.error("[Contacts] Get suppliers error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des fournisseurs" };
  }
}

export async function getSupplier(
  accessToken: string,
  organizationId: string,
  supplierId: string
): Promise<ApiResponse<Supplier>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/suppliers/${supplierId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Contacts] Get supplier error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération du fournisseur" };
  }
}

export async function createSupplier(
  accessToken: string,
  organizationId: string,
  data: CreateSupplierData
): Promise<ApiResponse<Supplier>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/suppliers/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Contacts] Create supplier error:", error.response?.data || error.message);
    return {
      success: false,
      message: "Erreur lors de la création du fournisseur",
      errors: error.response?.data,
    };
  }
}

export async function updateSupplier(
  accessToken: string,
  organizationId: string,
  supplierId: string,
  data: Partial<CreateSupplierData>
): Promise<ApiResponse<Supplier>> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/suppliers/${supplierId}/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Contacts] Update supplier error:", error.response?.data || error.message);
    return {
      success: false,
      message: "Erreur lors de la mise à jour du fournisseur",
      errors: error.response?.data,
    };
  }
}

export async function deleteSupplier(
  accessToken: string,
  organizationId: string,
  supplierId: string
): Promise<ApiResponse<void>> {
  try {
    await axios.delete(
      `${API_BASE_URL}/suppliers/${supplierId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true };
  } catch (error: any) {
    console.error("[Contacts] Delete supplier error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la suppression du fournisseur" };
  }
}

// =============================================================================
// STATS ACTIONS
// =============================================================================

export async function getCustomerStats(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<CustomerStats>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/customers/stats/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Contacts] Get customer stats error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des statistiques" };
  }
}

// getCustomersWithBalance is defined above in the CUSTOMER TRANSACTION section
