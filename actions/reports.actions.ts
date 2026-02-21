"use server";

import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function getHeaders(accessToken: string, organizationId: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Organization-ID": organizationId,
  };
}

// =============================================================================
// TYPES
// =============================================================================

export interface SalesStats {
  total_sales: string;
  total_orders: number;
  average_order_value: string;
  total_items_sold: number;
  completed_sales: number;
  pending_sales: number;
  cancelled_sales: number;
  sales_growth: string | null;
  orders_growth: string | null;
}

export interface StockStats {
  total_products: number;
  total_stock_value: string;
  low_stock_count: number;
  out_of_stock_count: number;
  expiring_soon_count: number;
}

export interface CashbookStats {
  current_balance: string;
  total_income: string;
  total_expenses: string;
  net_flow: string;
  pending_expenses: number;
}

export interface CustomerStats {
  total_customers: number;
  active_customers: number;
  new_customers_period: number;
  total_receivables: string;
  customers_with_debt: number;
}

export interface DashboardSummary {
  sales: SalesStats;
  stock: StockStats;
  cashbook: CashbookStats;
  customers: CustomerStats;
}

export interface SalesByPeriod {
  period: string;
  total: string;
  count: number;
}

export interface SalesByCategory {
  category_id: string | null;
  category_name: string;
  total_revenue: string;
  quantity_sold: number;
  percentage: string;
}

export interface SalesByPaymentMethod {
  payment_method: string;
  payment_method_name: string;
  total: string;
  count: number;
  percentage: string;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity_sold: number;
  total_revenue: string;
}

export interface TopCustomer {
  customer_id: string;
  customer_name: string;
  total_purchases: string;
  order_count: number;
  current_balance: string;
}

export interface CashFlowByPeriod {
  period: string;
  income: string;
  expenses: string;
  net: string;
}

export interface ReportFilters {
  period?: "today" | "week" | "month" | "quarter" | "year";
  date_from?: string;
  date_to?: string;
  group_by?: "day" | "week" | "month";
  limit?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

// =============================================================================
// API ACTIONS
// =============================================================================

export async function getDashboardSummary(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<DashboardSummary>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/summary/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get dashboard summary error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération du résumé" };
  }
}

export async function getSalesStats(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<SalesStats>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/sales/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get sales stats error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des statistiques de ventes" };
  }
}

export async function getSalesByPeriod(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<SalesByPeriod[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.group_by) params.append("group_by", filters.group_by);

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/sales_by_period/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get sales by period error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des ventes par période" };
  }
}

export async function getSalesByCategory(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<SalesByCategory[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/sales_by_category/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get sales by category error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des ventes par catégorie" };
  }
}

export async function getSalesByPaymentMethod(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<SalesByPaymentMethod[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/sales_by_payment_method/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get sales by payment method error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des ventes par méthode de paiement" };
  }
}

export async function getTopProducts(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<TopProduct[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.limit) params.append("limit", String(filters.limit));

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/top_products/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get top products error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des meilleurs produits" };
  }
}

export async function getTopCustomers(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<TopCustomer[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.limit) params.append("limit", String(filters.limit));

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/top_customers/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get top customers error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des meilleurs clients" };
  }
}

export async function getStockStats(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<StockStats>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/stock/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get stock stats error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des statistiques de stock" };
  }
}

export async function getCashbookStats(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<CashbookStats>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/cashbook/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get cashbook stats error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des statistiques de caisse" };
  }
}

export async function getCashFlow(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<CashFlowByPeriod[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.group_by) params.append("group_by", filters.group_by);

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/cash_flow/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get cash flow error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération du flux de trésorerie" };
  }
}

export async function getCustomerStats(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<CustomerStats>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/customers/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get customer stats error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des statistiques clients" };
  }
}

// =============================================================================
// RAPPORT JOURNALIER DE CAISSE
// =============================================================================

export interface DailyCashReport {
  date: string;
  opening_balance: string;
  closing_balance: string;
  total_sales: string;
  total_sales_count: number;
  cash_sales: string;
  mobile_money_sales: string;
  card_sales: string;
  credit_sales: string;
  debt_collections: string;
  expenses: string;
  expenses_count: number;
  net_cash_flow: string;
}

export interface DailyCashMovement {
  id: string;
  time: string;
  type: string;
  type_display: string;
  description: string;
  reference: string | null;
  amount: string;
  direction: string;
  balance_after: string;
}

export interface DailyCashReportResponse {
  report: DailyCashReport;
  movements: DailyCashMovement[];
}

export async function getDailyCashReport(
  accessToken: string,
  organizationId: string,
  date?: string
): Promise<ApiResponse<DailyCashReportResponse>> {
  try {
    const params = new URLSearchParams();
    if (date) params.append("date", date);

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/daily_cash_report/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get daily cash report error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération du rapport journalier" };
  }
}

// =============================================================================
// BÉNÉFICES ET MARGES
// =============================================================================

export interface ProfitMargins {
  total_revenue: string;
  total_cost: string;
  gross_profit: string;
  gross_margin_percentage: string;
  total_expenses: string;
  net_profit: string;
  net_margin_percentage: string;
}

export interface ProductProfit {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity_sold: number;
  total_revenue: string;
  total_cost: string;
  profit: string;
  margin_percentage: string;
}

export async function getProfitMargins(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<ProfitMargins>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/profit_margins/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get profit margins error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des marges" };
  }
}

export async function getProductProfits(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<ProductProfit[]>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.limit) params.append("limit", String(filters.limit));

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/product_profits/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get product profits error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des bénéfices par produit" };
  }
}

// =============================================================================
// STOCKS DÉTAILLÉS
// =============================================================================

export interface StockDetail {
  product_id: string;
  product_name: string;
  product_sku: string;
  category_name: string | null;
  current_stock: string;
  reserved_stock: string;
  available_stock: string;
  min_stock_level: string | null;
  cost_price: string | null;
  stock_value: string;
  status: "available" | "low_stock" | "out_of_stock";
}

export interface StockMovementSummary {
  total_in: string;
  total_out: string;
  sales_out: string;
  adjustments_in: string;
  adjustments_out: string;
  transfers_in: string;
  transfers_out: string;
  returns_in: string;
}

export async function getStockDetails(
  accessToken: string,
  organizationId: string,
  status?: "low" | "out" | "available"
): Promise<ApiResponse<StockDetail[]>> {
  try {
    const params = new URLSearchParams();
    if (status) params.append("status", status);

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/stock_details/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get stock details error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des détails du stock" };
  }
}

export async function getStockMovementsSummary(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<StockMovementSummary>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/stock_movements_summary/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Reports] Get stock movements summary error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération du résumé des mouvements" };
  }
}
