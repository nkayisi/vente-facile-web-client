"use server";

import { formatAxiosErrorMessage } from "@/lib/api/drf-error";
import axios from "@/lib/auth/api-helper";
import axiosPlain from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ============================================================================
// Types
// ============================================================================

export interface PlanFeature {
  id: string;
  name: string;
  code: string;
  description: string;
  is_enabled: boolean;
  limit_value: number | null;
}

/** Devise liée au plan (API : id, code ISO, symbole d'affichage). */
export interface PlanCurrency {
  id: string;
  code: string;
  symbol: string;
}

export interface Plan {
  id: string;
  name: string;
  code: string;
  description: string;
  price_monthly: string;
  price_yearly: string;
  currency: PlanCurrency;
  max_users: number;
  max_branches: number;
  max_warehouses: number;
  max_products: number | null;
  max_monthly_transactions: number | null;
  storage_limit_mb: number;
  features: Record<string, any>;
  is_active: boolean;
  is_featured: boolean;
  trial_days: number;
  sort_order: number;
  tier: number;
  plan_features: PlanFeature[];
}

export interface Subscription {
  id: string;
  plan: string;
  plan_name: string;
  plan_code: string;
  status: "trial" | "active" | "past_due" | "cancelled" | "expired" | "suspended";
  status_display: string;
  billing_cycle: "monthly" | "quarterly" | "yearly";
  billing_cycle_display: string;
  price: string;
  currency: string;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string;
  current_period_end: string;
  cancelled_at: string | null;
  cancel_at_period_end: boolean;
  days_remaining: number;
  is_active: boolean;
  is_trial: boolean;
  created_at: string;
}

/** Usage et plafonds renvoyés par GET /subscriptions/status/ */
export interface SubscriptionQuotas {
  has_plan: boolean;
  users: {
    current: number;
    limit: number | null;
    pending_invitations?: number;
  };
  branches: { current: number; limit: number | null };
  warehouses: { current: number; limit: number | null };
  products: { current: number; limit: number | null };
  plan_tier: number | null;
  current_plan_id: string | null;
  subscription_floor_tier: number;
  period_end: string | null;
  period_not_ended: boolean;
  can_renew_same_plan: boolean;
  can_upgrade: boolean;
}

export interface SubscriptionStatus {
  has_subscription: boolean;
  is_active: boolean;
  is_blocked: boolean;
  status: string;
  message: string | null;
  days_remaining?: number;
  days_remaining_grace?: number;
  subscription: Subscription | null;
  plan: Plan | null;
  quotas?: SubscriptionQuotas;
}

export interface SubscriptionPayment {
  id: string;
  amount: string;
  currency: string;
  payment_method: string;
  payment_method_display: string;
  status: string;
  status_display: string;
  reference: string;
  paid_at: string | null;
  notes: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface SubscriptionInvoice {
  id: string;
  invoice_number: string;
  status: string;
  status_display: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total: string;
  currency: string;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  period_start: string;
  period_end: string;
  notes: string;
  items: Array<{
    id: string;
    description: string;
    quantity: string;
    unit_price: string;
    total: string;
  }>;
  created_at: string;
}

export interface ActivateSubscriptionData {
  plan_id: string;
  billing_cycle: "monthly" | "quarterly" | "yearly";
  payment_method: "card" | "mobile_money" | "bank_transfer" | "manual";
  amount: number;
  reference?: string;
  notes?: string;
}

export interface PublicPlan {
  id: string;
  name: string;
  code: string;
  description: string;
  price_monthly: string;
  price_yearly: string;
  currency: PlanCurrency;
  max_users: number;
  max_branches: number;
  max_warehouses: number;
  max_products: number | null;
  max_monthly_transactions: number | null;
  storage_limit_mb: number;
  is_featured: boolean;
  trial_days: number;
  sort_order: number;
  tier: number;
  plan_features: PlanFeature[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Public API (no auth)
// ============================================================================

export async function getPublicPlans(): Promise<ApiResponse<PublicPlan[]>> {
  try {
    const response = await axiosPlain.get(`${API_BASE_URL}/plans/public/`);
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      error: formatAxiosErrorMessage(error, "Erreur lors du chargement des plans"),
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getHeaders(accessToken: string, organizationId: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-Organization-ID": organizationId,
  };
}

// ============================================================================
// API Calls
// ============================================================================

export async function getSubscriptionStatus(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<SubscriptionStatus>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/subscriptions/status/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      error: formatAxiosErrorMessage(error, "Erreur lors de la vérification de l'abonnement"),
    };
  }
}

export async function getPlans(
  accessToken: string
): Promise<ApiResponse<Plan[]>> {
  try {
    const response = await axios.get(`${API_BASE_URL}/plans/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      error: formatAxiosErrorMessage(error, "Erreur lors du chargement des plans"),
    };
  }
}

export async function getCurrentSubscription(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<Subscription>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/subscriptions/current/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      error: formatAxiosErrorMessage(error, "Aucun abonnement actif"),
    };
  }
}

export type MokoOperator = "airtel" | "orange" | "mpesa" | "africell";

export interface MokoInitiatePayload {
  plan_id: string;
  billing_cycle: "monthly" | "quarterly" | "yearly";
  mode?: "new" | "extend";
  method: MokoOperator;
  customer_number: string;
}

export interface MokoInitiateResponse {
  reference: string;
  transaction_id: string | null;
  subscription_activated: boolean;
  moko_ack_success: boolean;
  message: string;
}

export async function initiateMokoSubscriptionPayment(
  accessToken: string,
  organizationId: string,
  payload: MokoInitiatePayload
): Promise<ApiResponse<MokoInitiateResponse>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/subscriptions/moko/initiate/`,
      payload,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      error: formatAxiosErrorMessage(error, "Erreur lors du paiement"),
    };
  }
}

export async function activateSubscription(
  accessToken: string,
  organizationId: string,
  data: ActivateSubscriptionData
): Promise<ApiResponse<{ message: string; subscription: Subscription; invoice: SubscriptionInvoice }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/subscriptions/activate/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      error: formatAxiosErrorMessage(error, "Erreur lors de l'activation de l'abonnement"),
    };
  }
}

export async function getSubscriptionPayments(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<SubscriptionPayment[]>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/subscriptions/payments/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    const data = response.data;
    return { success: true, data: Array.isArray(data) ? data : data.results || [] };
  } catch (error: unknown) {
    return {
      success: false,
      error: formatAxiosErrorMessage(error, "Erreur lors du chargement des paiements"),
    };
  }
}

export async function getSubscriptionInvoices(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<SubscriptionInvoice[]>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/subscriptions/invoices/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    const data = response.data;
    return { success: true, data: Array.isArray(data) ? data : data.results || [] };
  } catch (error: unknown) {
    return {
      success: false,
      error: formatAxiosErrorMessage(error, "Erreur lors du chargement des factures"),
    };
  }
}

// ============================================================================
// MOKO Payment Status Polling
// ============================================================================

export interface MokoPaymentStatusResponse {
  status: "pending" | "completed" | "failed" | "unknown";
  message: string;
  subscription_activated: boolean;
}

export async function checkMokoPaymentStatus(
  accessToken: string,
  organizationId: string,
  reference: string
): Promise<ApiResponse<MokoPaymentStatusResponse>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/subscriptions/moko/status/`,
      {
        headers: getHeaders(accessToken, organizationId),
        params: { reference },
      }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      error: formatAxiosErrorMessage(error, "Erreur lors de la vérification du statut"),
    };
  }
}
