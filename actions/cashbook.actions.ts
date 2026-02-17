"use server";

import axios from "@/lib/auth/api-helper";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// =============================================================================
// TYPES
// =============================================================================

export interface IncomeCategory {
  id: string;
  name: string;
  code: string;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
  movement_count?: number;
  total_amount?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateIncomeCategoryData {
  name: string;
  code?: string;
  description?: string;
  color?: string;
  icon?: string;
  is_active?: boolean;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
  budget_monthly: string;
  expense_count?: number;
  total_spent?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateExpenseCategoryData {
  name: string;
  code?: string;
  description?: string;
  color?: string;
  icon?: string;
  is_active?: boolean;
  budget_monthly?: string;
}

export interface Expense {
  id: string;
  reference: string;
  category: string;
  category_name: string;
  category_color: string;
  description: string;
  amount: string;
  status: "draft" | "pending" | "approved" | "paid" | "rejected" | "cancelled";
  beneficiary: string;
  payment_method: string | null;
  payment_method_name: string | null;
  payment_reference: string;
  expense_date: string;
  due_date: string | null;
  paid_date: string | null;
  is_recurring: boolean;
  recurrence_period: string;
  notes: string;
  attachment: string | null;
  created_by: string;
  created_by_name: string;
  approved_by: string | null;
  approved_by_name: string | null;
  cash_movements?: CashMovement[];
  created_at: string;
  updated_at?: string;
}

export interface CreateExpenseData {
  category: string;
  description: string;
  amount: string;
  beneficiary?: string;
  payment_method?: string;
  payment_reference?: string;
  expense_date: string;
  due_date?: string;
  is_recurring?: boolean;
  recurrence_period?: string;
  notes?: string;
}

export interface CashMovement {
  id: string;
  reference: string;
  direction: "in" | "out";
  direction_display: string;
  movement_type: string;
  movement_type_display: string;
  amount: string;
  signed_amount: string;
  description: string;
  payment_method: string | null;
  payment_method_name: string | null;
  income_category: string | null;
  income_category_name: string | null;
  income_category_color: string | null;
  expense_category: string | null;
  expense_category_name: string | null;
  expense_category_color: string | null;
  sale: string | null;
  sale_reference: string | null;
  expense: string | null;
  expense_reference: string | null;
  customer: string | null;
  customer_name: string | null;
  supplier: string | null;
  supplier_name: string | null;
  balance_after: string;
  movement_date: string;
  is_cancelled: boolean;
  notes?: string;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancelled_by_name?: string | null;
  cancel_reason?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface CreateCashMovementData {
  direction: "in" | "out";
  movement_type: string;
  amount: string;
  description: string;
  payment_method?: string;
  income_category?: string;
  expense_category?: string;
  customer?: string;
  supplier?: string;
  movement_date: string;
  notes?: string;
}

export interface CashBalance {
  balance: string;
  today_in: string;
  today_out: string;
  today_net: string;
}

export interface CashSummary {
  total_in: string;
  total_out: string;
  net: string;
  count: number;
  by_type: Array<{
    movement_type: string;
    direction: string;
    total: string;
    count: number;
  }>;
  by_day: Array<{
    day: string;
    total_in: string;
    total_out: string;
    count: number;
  }>;
}

export interface DailyReport {
  date: string;
  opening_balance: string;
  closing_balance: string;
  total_in: string;
  total_out: string;
  net: string;
  by_type: Array<{
    movement_type: string;
    direction: string;
    total: string;
    count: number;
  }>;
  movements: CashMovement[];
}

export interface MonthlyReport {
  year: number;
  month: number;
  opening_balance: string;
  closing_balance: string;
  total_in: string;
  total_out: string;
  net: string;
  count: number;
  by_day: Array<{
    day: string;
    total_in: string;
    total_out: string;
    count: number;
  }>;
  by_type: Array<{
    movement_type: string;
    direction: string;
    total: string;
    count: number;
  }>;
  expense_by_category: Array<{
    expense__category__name: string;
    expense__category__color: string;
    total: string;
    count: number;
  }>;
}

export interface AnnualReport {
  year: number;
  opening_balance: string;
  closing_balance: string;
  total_in: string;
  total_out: string;
  net: string;
  count: number;
  by_month: Array<{
    month: string;
    total_in: string;
    total_out: string;
    count: number;
  }>;
  by_type: Array<{
    movement_type: string;
    direction: string;
    total: string;
    count: number;
  }>;
  expense_by_category: Array<{
    expense__category__name: string;
    expense__category__color: string;
    total: string;
    count: number;
  }>;
}

export interface CustomReport {
  date_from: string;
  date_to: string;
  opening_balance: string;
  closing_balance: string;
  total_in: string;
  total_out: string;
  net: string;
  count: number;
  by_day: Array<{
    day: string;
    total_in: string;
    total_out: string;
    count: number;
  }>;
  by_type: Array<{
    movement_type: string;
    direction: string;
    total: string;
    count: number;
  }>;
  expense_by_category: Array<{
    expense__category__name: string;
    expense__category__color: string;
    total: string;
    count: number;
  }>;
}

export interface ExpenseStats {
  total: string;
  count: number;
  by_category: Array<{
    category__name: string;
    category__color: string;
    total: string;
    count: number;
  }>;
  by_month: Array<{
    month: string;
    total: string;
    count: number;
  }>;
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

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface PaginatedResponse<T> {
  count: number;
  results: T[];
}

// =============================================================================
// INCOME CATEGORIES
// =============================================================================

export async function getIncomeCategories(
  accessToken: string,
  organizationId: string,
  filters?: { is_active?: string; search?: string }
): Promise<ApiResponse<PaginatedResponse<IncomeCategory>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.is_active) params.append("is_active", filters.is_active);
    if (filters?.search) params.append("search", filters.search);

    const response = await axios.get(
      `${API_BASE_URL}/income-categories/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la récupération des catégories",
    };
  }
}

export async function createIncomeCategory(
  accessToken: string,
  organizationId: string,
  data: CreateIncomeCategoryData
): Promise<ApiResponse<IncomeCategory>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/income-categories/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || error?.response?.data?.name?.[0] || "Erreur lors de la création",
    };
  }
}

export async function updateIncomeCategory(
  accessToken: string,
  organizationId: string,
  categoryId: string,
  data: Partial<CreateIncomeCategoryData>
): Promise<ApiResponse<IncomeCategory>> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/income-categories/${categoryId}/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la mise à jour",
    };
  }
}

export async function deleteIncomeCategory(
  accessToken: string,
  organizationId: string,
  categoryId: string
): Promise<ApiResponse<null>> {
  try {
    await axios.delete(
      `${API_BASE_URL}/income-categories/${categoryId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la suppression",
    };
  }
}

// =============================================================================
// EXPENSE CATEGORIES
// =============================================================================

export async function getExpenseCategories(
  accessToken: string,
  organizationId: string,
  filters?: { is_active?: string; search?: string }
): Promise<ApiResponse<PaginatedResponse<ExpenseCategory>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.is_active) params.append("is_active", filters.is_active);
    if (filters?.search) params.append("search", filters.search);

    const response = await axios.get(
      `${API_BASE_URL}/expense-categories/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la récupération des catégories",
    };
  }
}

export async function createExpenseCategory(
  accessToken: string,
  organizationId: string,
  data: CreateExpenseCategoryData
): Promise<ApiResponse<ExpenseCategory>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/expense-categories/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || error?.response?.data?.name?.[0] || "Erreur lors de la création",
    };
  }
}

export async function updateExpenseCategory(
  accessToken: string,
  organizationId: string,
  categoryId: string,
  data: Partial<CreateExpenseCategoryData>
): Promise<ApiResponse<ExpenseCategory>> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/expense-categories/${categoryId}/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la mise à jour",
    };
  }
}

export async function deleteExpenseCategory(
  accessToken: string,
  organizationId: string,
  categoryId: string
): Promise<ApiResponse<null>> {
  try {
    await axios.delete(
      `${API_BASE_URL}/expense-categories/${categoryId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la suppression",
    };
  }
}

// =============================================================================
// EXPENSES
// =============================================================================

export async function getExpenses(
  accessToken: string,
  organizationId: string,
  filters?: {
    status?: string;
    category?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    is_recurring?: string;
  }
): Promise<ApiResponse<PaginatedResponse<Expense>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.is_recurring) params.append("is_recurring", filters.is_recurring);

    const response = await axios.get(
      `${API_BASE_URL}/expenses/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la récupération des dépenses",
    };
  }
}

export async function getExpense(
  accessToken: string,
  organizationId: string,
  expenseId: string
): Promise<ApiResponse<Expense>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/expenses/${expenseId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la récupération de la dépense",
    };
  }
}

export async function createExpense(
  accessToken: string,
  organizationId: string,
  data: CreateExpenseData
): Promise<ApiResponse<Expense>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/expenses/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    const errorData = error?.response?.data;
    let errorMsg = "Erreur lors de la création de la dépense";
    if (errorData?.detail) errorMsg = errorData.detail;
    else if (errorData?.description) errorMsg = errorData.description[0];
    else if (errorData?.amount) errorMsg = errorData.amount[0];
    return { success: false, error: errorMsg };
  }
}

export async function updateExpense(
  accessToken: string,
  organizationId: string,
  expenseId: string,
  data: Partial<CreateExpenseData>
): Promise<ApiResponse<Expense>> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/expenses/${expenseId}/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la mise à jour",
    };
  }
}

export async function deleteExpense(
  accessToken: string,
  organizationId: string,
  expenseId: string
): Promise<ApiResponse<null>> {
  try {
    await axios.delete(
      `${API_BASE_URL}/expenses/${expenseId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la suppression",
    };
  }
}

export async function submitExpense(
  accessToken: string,
  organizationId: string,
  expenseId: string
): Promise<ApiResponse<Expense>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/expenses/${expenseId}/submit/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la soumission",
    };
  }
}

export async function approveExpense(
  accessToken: string,
  organizationId: string,
  expenseId: string
): Promise<ApiResponse<Expense>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/expenses/${expenseId}/approve/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de l'approbation",
    };
  }
}

export async function rejectExpense(
  accessToken: string,
  organizationId: string,
  expenseId: string,
  reason?: string
): Promise<ApiResponse<Expense>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/expenses/${expenseId}/reject/`,
      { reason },
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors du rejet",
    };
  }
}

export async function payExpense(
  accessToken: string,
  organizationId: string,
  expenseId: string,
  data?: { payment_method?: string; payment_reference?: string }
): Promise<ApiResponse<Expense>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/expenses/${expenseId}/pay/`,
      data || {},
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors du paiement",
    };
  }
}

export async function cancelExpense(
  accessToken: string,
  organizationId: string,
  expenseId: string,
  reason?: string
): Promise<ApiResponse<Expense>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/expenses/${expenseId}/cancel/`,
      { reason },
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de l'annulation",
    };
  }
}

export async function getExpenseStats(
  accessToken: string,
  organizationId: string,
  filters?: { date_from?: string; date_to?: string }
): Promise<ApiResponse<ExpenseStats>> {
  try {
    const params = new URLSearchParams();
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);

    const response = await axios.get(
      `${API_BASE_URL}/expenses/stats/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la récupération des statistiques",
    };
  }
}

// =============================================================================
// CASH MOVEMENTS
// =============================================================================

export async function getCashMovements(
  accessToken: string,
  organizationId: string,
  filters?: {
    direction?: string;
    movement_type?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    is_cancelled?: string;
  }
): Promise<ApiResponse<PaginatedResponse<CashMovement>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.direction) params.append("direction", filters.direction);
    if (filters?.movement_type) params.append("movement_type", filters.movement_type);
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.is_cancelled) params.append("is_cancelled", filters.is_cancelled);

    const response = await axios.get(
      `${API_BASE_URL}/cash-movements/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la récupération des mouvements",
    };
  }
}

export async function createCashMovement(
  accessToken: string,
  organizationId: string,
  data: CreateCashMovementData
): Promise<ApiResponse<CashMovement>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/cash-movements/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    const errorData = error?.response?.data;
    let errorMsg = "Erreur lors de la création du mouvement";
    if (errorData?.detail) errorMsg = errorData.detail;
    else if (errorData?.movement_type) errorMsg = errorData.movement_type[0];
    return { success: false, error: errorMsg };
  }
}

export async function cancelCashMovement(
  accessToken: string,
  organizationId: string,
  movementId: string,
  reason?: string
): Promise<ApiResponse<CashMovement>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/cash-movements/${movementId}/cancel/`,
      { reason },
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de l'annulation",
    };
  }
}

export async function getCashBalance(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<CashBalance>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/cash-movements/balance/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la récupération du solde",
    };
  }
}

export async function getCashSummary(
  accessToken: string,
  organizationId: string,
  filters?: { date_from?: string; date_to?: string }
): Promise<ApiResponse<CashSummary>> {
  try {
    const params = new URLSearchParams();
    if (filters?.date_from) params.append("date_from", filters.date_from);
    if (filters?.date_to) params.append("date_to", filters.date_to);

    const response = await axios.get(
      `${API_BASE_URL}/cash-movements/summary/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la récupération du résumé",
    };
  }
}

export async function getDailyReport(
  accessToken: string,
  organizationId: string,
  date?: string
): Promise<ApiResponse<DailyReport>> {
  try {
    const params = new URLSearchParams();
    if (date) params.append("date", date);

    const response = await axios.get(
      `${API_BASE_URL}/cash-movements/daily-report/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la récupération du rapport",
    };
  }
}

export async function getMonthlyReport(
  accessToken: string,
  organizationId: string,
  year?: number,
  month?: number
): Promise<ApiResponse<MonthlyReport>> {
  try {
    const params = new URLSearchParams();
    if (year) params.append("year", year.toString());
    if (month) params.append("month", month.toString());

    const response = await axios.get(
      `${API_BASE_URL}/cash-movements/monthly-report/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la récupération du rapport",
    };
  }
}

export async function getAnnualReport(
  accessToken: string,
  organizationId: string,
  year?: number
): Promise<ApiResponse<AnnualReport>> {
  try {
    const params = new URLSearchParams();
    if (year) params.append("year", year.toString());

    const response = await axios.get(
      `${API_BASE_URL}/cash-movements/annual-report/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la récupération du rapport annuel",
    };
  }
}

export async function getCustomReport(
  accessToken: string,
  organizationId: string,
  dateFrom: string,
  dateTo: string
): Promise<ApiResponse<CustomReport>> {
  try {
    const params = new URLSearchParams();
    params.append("date_from", dateFrom);
    params.append("date_to", dateTo);

    const response = await axios.get(
      `${API_BASE_URL}/cash-movements/custom-report/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.detail || "Erreur lors de la récupération du rapport personnalisé",
    };
  }
}
