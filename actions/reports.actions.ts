"use server";

import axios from "@/lib/auth/api-helper";
import type { AgingBucket } from "@/lib/reports/aging";
import { getErrorBody } from "@/lib/api/drf-error";
import {
  fetchExportFile,
  type ExportFile,
  type ExportFormat,
} from "@/lib/export/fetch-export";

const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

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
  /** Devise principale : celle de tous les montants scalaires ci-dessous. */
  currency?: string;
  /** Solde toutes devises confondues, converti en devise principale. */
  current_balance: string;
  /** Détail réel du tiroir : le solde de chaque devise, sans conversion. */
  balance_by_currency?: Array<{ currency: string; balance: string }>;
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
  /**
   * Quantité vendue dans les termes de la vente : « 10 casiers + 5 bouteilles ».
   * Somme des contenants réellement facturés, jamais une division du total.
   */
  quantity_display?: string;
  packages_sold?: string | null;
  loose_sold?: string | null;
  /** Unités de détail par contenant, `null` pour un produit vendu à l'unité */
  packaging_factor?: number | null;
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
  /**
   * Les CALENDAIRES suivent le calendrier (« Ce mois » part du 1er) ; les
   * GLISSANTES comptent en arrière depuis aujourd'hui, inclus. Seules les
   * secondes s'emboîtent quel que soit le quantième, et c'est pourquoi le
   * défaut du serveur est `last_30_days` : `month` ouvrait la page sur une
   * fenêtre de deux jours les 2 du mois, donc sur « Aucune donnée ».
   */
  period?:
    | "today"
    | "week"
    | "month"
    | "quarter"
    | "year"
    | "last_7_days"
    | "last_30_days"
    | "last_12_months";
  date_from?: string;
  date_to?: string;
  group_by?: "day" | "week" | "month";
  limit?: number;
  page?: number;
  page_size?: number;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
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
  } catch (error: unknown) {
    console.error("[Reports] Get dashboard summary error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération du résumé" };
  }
}

export interface UserActivityReport {
  user: { id: string; name: string; email: string; role: string };
  period: { start: string; end: string; group_by: string };
  sales: {
    count: number;
    total: number | string;
    by_payment_method: { method: string; total: number | string }[];
  };
  expenses: { count: number; total: number | string };
  cash: { cash_in: number | string; cash_out: number | string; net: number | string };
  breakdown: { bucket: string; count: number; total: number | string }[];
}

/**
 * Rapport d'activité d'un utilisateur sur une période (admin / gérant).
 * group_by : "hour" | "day".
 */
export type UserActivityFilters = Omit<ReportFilters, "group_by"> & {
  group_by?: "hour" | "day";
};

export async function getUserActivityReport(
  accessToken: string,
  organizationId: string,
  userId: string,
  filters?: UserActivityFilters
): Promise<ApiResponse<UserActivityReport>> {
  try {
    const params = new URLSearchParams();
    params.append("user", userId);
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.group_by) params.append("group_by", filters.group_by);

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/user_activity/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Reports] Get user activity error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération du rapport utilisateur" };
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
  } catch (error: unknown) {
    console.error("[Reports] Get sales stats error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des statistiques de ventes" };
  }
}

export async function getSalesByPeriod(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<PaginatedResponse<SalesByPeriod>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.group_by) params.append("group_by", filters.group_by);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/sales_by_period/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Reports] Get sales by period error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des ventes par période" };
  }
}

export async function getSalesByCategory(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<PaginatedResponse<SalesByCategory>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/sales_by_category/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Reports] Get sales by category error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des ventes par catégorie" };
  }
}

export async function getSalesByPaymentMethod(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<PaginatedResponse<SalesByPaymentMethod>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/sales_by_payment_method/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Reports] Get sales by payment method error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des ventes par méthode de paiement" };
  }
}

export async function getTopProducts(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<PaginatedResponse<TopProduct>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/top_products/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Reports] Get top products error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des meilleurs produits" };
  }
}

export async function getTopCustomers(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<PaginatedResponse<TopCustomer>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));
    if (filters?.limit) params.append("limit", String(filters.limit));

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/top_customers/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Reports] Get top customers error:", getErrorBody(error) || (error as Error)?.message);
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
  } catch (error: unknown) {
    console.error("[Reports] Get stock stats error:", getErrorBody(error) || (error as Error)?.message);
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
  } catch (error: unknown) {
    console.error("[Reports] Get cashbook stats error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des statistiques de caisse" };
  }
}

export async function getCashFlow(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<PaginatedResponse<CashFlowByPeriod>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.group_by) params.append("group_by", filters.group_by);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/cash_flow/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Reports] Get cash flow error:", getErrorBody(error) || (error as Error)?.message);
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
  } catch (error: unknown) {
    console.error("[Reports] Get customer stats error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des statistiques clients" };
  }
}

// =============================================================================
// CRÉANCES CLIENTS (BALANCE ÂGÉE)
// =============================================================================

// Les tranches et leurs libellés vivent dans `lib/reports/aging.ts` : un
// fichier `"use server"` n'exporte que des fonctions asynchrones, et l'objet
// des libellés faisait échouer le rendu de TOUT le tableau de bord.
// Le TYPE, lui, peut rester ici : il est effacé à la compilation.

/**
 * Une ligne par devise. Les montants ne s'additionnent JAMAIS entre devises :
 * seul `total_primary` du rapport porte une conversion, et il est nommé
 * explicitement comme tel.
 */
export interface ReceivablesByCurrency extends Record<AgingBucket, string> {
  currency: string;
  total: string;
}

export interface ReceivablesDebtor {
  customer_id: string;
  customer_name: string;
  /**
   * Le téléphone du client, rendu par le serveur.
   *
   * On relance au téléphone, pas par la pensée : cet écran n'en portait aucun,
   * et il fallait ouvrir la fiche du client pour en trouver un.
   */
  customer_phone: string;
  currency: string;
  amount_due: string;
  invoice_count: number;
  /** Ancienneté de la plus vieille facture, en jours (négatif = pas échue). */
  oldest_days: number;
  overdue_amount: string;
}

export interface ReceivablesReport {
  as_of: string;
  buckets: AgingBucket[];
  by_currency: ReceivablesByCurrency[];
  by_customer: ReceivablesDebtor[];
  invoice_count: number;
  debtor_count: number;
  total_primary: string;
  overdue_primary: string;
  primary_currency: string;
}

export async function getReceivablesReport(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<ReceivablesReport>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/receivables/`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Reports] Get receivables error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des créances" };
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
  movements: PaginatedResponse<DailyCashMovement>;
}

export async function getDailyCashReport(
  accessToken: string,
  organizationId: string,
  date?: string,
  page?: number
): Promise<ApiResponse<DailyCashReportResponse>> {
  try {
    const params = new URLSearchParams();
    if (date) params.append("date", date);
    if (page) params.append("page", String(page));
    params.append("page_size", "20");

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/daily_cash_report/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Reports] Get daily cash report error:", getErrorBody(error) || (error as Error)?.message);
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
  /** Quantité vendue (décimale possible, API en string) */
  quantity_sold: number | string;
  /** La même, ventilée gros/détail : « 10 casiers + 5 bouteilles » */
  quantity_display?: string;
  /** Unités de détail par contenant, `null` pour un produit vendu à l'unité */
  packaging_factor?: number | null;
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
  } catch (error: unknown) {
    console.error("[Reports] Get profit margins error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des marges" };
  }
}

export async function getProductProfits(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<PaginatedResponse<ProductProfit>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/product_profits/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Reports] Get product profits error:", getErrorBody(error) || (error as Error)?.message);
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
  /** Stock dans les termes du marchand : « 12 cartons + 3 bouteilles » */
  stock_display?: string;
  /** Contenants scellés et unités isolées, lus sur les compteurs du stock */
  stock_packages?: string | null;
  stock_loose?: string | null;
  reserved_stock: string;
  /** Réservé en unité de détail nommée, jamais traduit en contenants */
  reserved_display?: string;
  available_stock: string;
  /** Disponible dans les mêmes termes que `stock_display` */
  available_display?: string;
  /** Unités de détail par contenant, `null` pour un produit vendu à l'unité */
  packaging_factor?: number | null;
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
  filters?: ReportFilters & { status?: "low" | "out" | "available" }
): Promise<ApiResponse<PaginatedResponse<StockDetail>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/stock_details/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Reports] Get stock details error:", getErrorBody(error) || (error as Error)?.message);
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
  } catch (error: unknown) {
    console.error("[Reports] Get stock movements summary error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération du résumé des mouvements" };
  }
}

// Approvisionnements par produit (dictionnaire product_id -> quantity)
/**
 * Approvisionnement d'un produit sur la période.
 *
 * `quantity` reste le total en unité de détail ; `display` le rend dans les
 * termes de la réception (« 10 cartons + 5 bouteilles »), reconstitué depuis la
 * saisie figée sur chaque mouvement et non depuis une division du total.
 */
export interface ProductSupply {
  quantity: number;
  display: string;
  packages: number | null;
  loose: number | null;
}

export type ProductSupplies = Record<string, ProductSupply>;

export async function getProductSupplies(
  accessToken: string,
  organizationId: string,
  filters?: ReportFilters
): Promise<ApiResponse<ProductSupplies>> {
  try {
    const params = new URLSearchParams();
    if (filters?.period) params.append("period", filters.period);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);

    const response = await axios.get(
      `${API_BASE_URL}/reports/statistics/product_supplies/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Reports] Get product supplies error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des approvisionnements" };
  }
}

// =============================================================================
// EXPORT
// =============================================================================

/**
 * Les huit onglets, tels que le serveur les nomme.
 *
 * Ce sont les clés de `TAB_BUILDERS` (`backend/apps/reports/exports.py`) : une
 * faute de frappe ici répondrait 400 en nommant les huit onglets, ce qui est
 * exactement ce qu'on veut d'un refus.
 */
export type ReportTab =
  | "overview"
  | "daily-cash"
  | "sales"
  | "products"
  | "customers"
  | "stock"
  | "profits"
  | "user-activity"
  /**
   * Les créances ne sont pas un onglet de la page : elles ont leur propre
   * rubrique. Elles passent par le même registre pour porter la même marque
   * que les huit autres documents, et le terminal reçoit le même fichier.
   */
  | "receivables";

export interface ReportExportFilters extends Omit<ReportFilters, "limit" | "page" | "page_size"> {
  /** L'employé, pour le seul onglet « Par utilisateur ». */
  user?: string;
  /** La date propre au rapport journalier. */
  date?: string;
  /** Le filtre d'état de l'onglet Stock. */
  status?: string;
}

/**
 * Télécharge un onglet de « Rapports & Statistiques ».
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LE DOCUMENT EST FABRIQUÉ PAR LE SERVEUR, ET C'EST TOUT L'INTÉRÊT.        │
 * │                                                                          │
 * │ Le back-office traçait sa propre mise en page, puis a ouvert un onglet   │
 * │ pour appeler `window.print()` : le marchand tombait sur la boîte         │
 * │ d'impression du navigateur, et rien ne se téléchargeait. Le terminal,    │
 * │ lui, produisait un vrai fichier. Un même rapport donnait donc deux       │
 * │ documents.                                                               │
 * │                                                                          │
 * │ Ici les deux surfaces ne font plus que télécharger des octets, et        │
 * │ l'export porte le PÉRIMÈTRE ENTIER là où les deux clients n'exportaient  │
 * │ que les vingt lignes affichées.                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Aucune pagination transmise : `page` et `page_size` produiraient un fichier
 * qui ne dit pas ce que son titre annonce.
 */
export async function exportStatistics(
  accessToken: string,
  organizationId: string,
  format: ExportFormat,
  tab: ReportTab,
  filters: ReportExportFilters = {}
): Promise<ExportFile> {
  return fetchExportFile(
    "/reports/statistics/export/",
    accessToken,
    organizationId,
    format,
    {
      tab,
      period: filters.period,
      date_from: filters.date_from,
      date_to: filters.date_to,
      group_by: filters.group_by,
      user: filters.user,
      date: filters.date,
      status: filters.status,
    }
  );
}
