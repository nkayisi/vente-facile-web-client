"use server";

import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

// =============================================================================
// TYPES
// =============================================================================

export interface AdminDashboardStats {
  total_organizations: number;
  active_organizations: number;
  total_users: number;
  new_users_this_month: number;
  total_revenue: string;
  revenue_this_month: string;
  subscriptions_by_status: Record<string, number>;
  subscriptions_by_plan: Array<{ plan__name: string; count: number }>;
  recent_organizations: Array<{
    id: string;
    name: string;
    business_type: string;
    created_at: string;
  }>;
  growth_trend: Array<{ month: string; count: number }>;
  users_trend: Array<{ month: string; count: number }>;
  revenue_trend: Array<{ month: string; total: string }>;
}

export interface AdminOrganization {
  id: string;
  name: string;
  business_type: string;
  country: string;
  city?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  owner_name: string;
  owner_email: string;
  members_count: number;
  subscription_status: string;
  subscription_plan: string;
  subscription_end?: string;
  created_at: string;
  address?: string;
  tax_id?: string;
  currency?: string;
  recent_activity?: Array<{
    user: string;
    action: string;
    resource_type: string;
    created_at: string;
  }>;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  is_staff: boolean;
  is_email_verified: boolean;
  organizations_count: number;
  organizations: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  date_joined: string;
  last_login?: string;
}

export interface AdminPlan {
  id: string;
  name: string;
  code: string;
  description: string;
  price_monthly: string;
  price_yearly: string;
  currency: string;
  max_users: number;
  max_branches: number;
  max_products?: number;
  max_monthly_transactions?: number;
  storage_limit_mb: number;
  features: Record<string, any>;
  is_active: boolean;
  is_featured: boolean;
  trial_days: number;
  sort_order: number;
  plan_features?: Array<{
    id: string;
    name: string;
    code: string;
    description: string;
    is_enabled: boolean;
    limit_value?: number;
  }>;
  subscribers_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminSubscription {
  id: string;
  organization: string;
  organization_name: string;
  plan: string;
  plan_name: string;
  status: string;
  status_display: string;
  billing_cycle: string;
  billing_cycle_display: string;
  price: string;
  currency: string;
  current_period_start: string;
  current_period_end: string;
  days_remaining: number;
  created_at: string;
}

export interface CreatePlanData {
  name: string;
  code: string;
  description: string;
  price_monthly: string;
  price_yearly: string;
  currency: string;
  max_users: number;
  max_branches: number;
  max_products?: number;
  max_monthly_transactions?: number;
  storage_limit_mb: number;
  features: Record<string, any>;
  is_active: boolean;
  is_featured: boolean;
  trial_days: number;
  sort_order: number;
}

export interface UpdatePlanData extends Partial<CreatePlanData> {}

// =============================================================================
// HELPERS
// =============================================================================

function getHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

// =============================================================================
// DASHBOARD
// =============================================================================

export async function getAdminDashboardStats(
  accessToken: string
): Promise<{ success: boolean; data?: AdminDashboardStats; message?: string }> {
  try {
    const response = await axios.get(`${API_BASE_URL}/platform-admin/dashboard/`, {
      headers: getHeaders(accessToken),
    });

    if (response.data) {
      return { success: true, data: response.data };
    }
    return { success: false, message: "Données non disponibles" };
  } catch (error: any) {
    console.error("Error fetching admin dashboard stats:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors du chargement des statistiques",
    };
  }
}

// =============================================================================
// ORGANIZATIONS
// =============================================================================

export async function getAdminOrganizations(
  accessToken: string,
  filters?: {
    page?: number;
    page_size?: number;
    search?: string;
    is_active?: boolean;
    business_type?: string;
    country?: string;
  }
): Promise<{ success: boolean; data?: { results: AdminOrganization[]; count: number; next: string | null; previous: string | null }; message?: string }> {
  try {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    const response = await axios.get(
      `${API_BASE_URL}/platform-admin/organizations/?${params}`,
      { headers: getHeaders(accessToken) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("Error fetching admin organizations:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors du chargement des organisations",
    };
  }
}

export async function getAdminOrganization(
  accessToken: string,
  organizationId: string
): Promise<{ success: boolean; data?: AdminOrganization; message?: string }> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/platform-admin/organizations/${organizationId}/`,
      { headers: getHeaders(accessToken) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("Error fetching admin organization:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors du chargement de l'organisation",
    };
  }
}

export async function toggleOrganizationActive(
  accessToken: string,
  organizationId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/platform-admin/organizations/${organizationId}/toggle_active/`,
      {},
      { headers: getHeaders(accessToken) }
    );

    return { success: true, message: response.data.message };
  } catch (error: any) {
    console.error("Error toggling organization:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la modification de l'organisation",
    };
  }
}

export async function activateOrganizationSubscription(
  accessToken: string,
  organizationId: string,
  data: {
    plan_id: string;
    billing_cycle: string;
    notes?: string;
  }
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/platform-admin/organizations/${organizationId}/activate_subscription/`,
      data,
      { headers: getHeaders(accessToken) }
    );

    return { success: true, message: response.data.message };
  } catch (error: any) {
    console.error("Error activating subscription:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de l'activation de l'abonnement",
    };
  }
}

// =============================================================================
// USERS
// =============================================================================

export async function getAdminUsers(
  accessToken: string,
  filters?: {
    page?: number;
    page_size?: number;
    search?: string;
    is_active?: boolean;
    is_staff?: boolean;
  }
): Promise<{ success: boolean; data?: { results: AdminUser[]; count: number; next: string | null; previous: string | null }; message?: string }> {
  try {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    const response = await axios.get(
      `${API_BASE_URL}/platform-admin/users/?${params}`,
      { headers: getHeaders(accessToken) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("Error fetching admin users:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors du chargement des utilisateurs",
    };
  }
}

export async function getAdminUser(
  accessToken: string,
  userId: string
): Promise<{ success: boolean; data?: AdminUser; message?: string }> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/platform-admin/users/${userId}/`,
      { headers: getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("Error fetching admin user:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors du chargement de l'utilisateur",
    };
  }
}

export async function getAdminSubscription(
  accessToken: string,
  subscriptionId: string
): Promise<{ success: boolean; data?: AdminSubscription; message?: string }> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/platform-admin/subscriptions/${subscriptionId}/`,
      { headers: getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("Error fetching admin subscription:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors du chargement de l'abonnement",
    };
  }
}

export async function toggleUserActive(
  accessToken: string,
  userId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/platform-admin/users/${userId}/toggle_active/`,
      {},
      { headers: getHeaders(accessToken) }
    );

    return { success: true, message: response.data.message };
  } catch (error: any) {
    console.error("Error toggling user:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la modification de l'utilisateur",
    };
  }
}

export async function toggleUserStaff(
  accessToken: string,
  userId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/platform-admin/users/${userId}/toggle_staff/`,
      {},
      { headers: getHeaders(accessToken) }
    );

    return { success: true, message: response.data.message };
  } catch (error: any) {
    console.error("Error toggling user staff:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la modification du statut admin",
    };
  }
}

// =============================================================================
// PLANS
// =============================================================================

export async function getAdminPlans(
  accessToken: string
): Promise<{ success: boolean; data?: AdminPlan[]; message?: string }> {
  try {
    const response = await axios.get(`${API_BASE_URL}/platform-admin/plans/`, {
      headers: getHeaders(accessToken),
    });

    return { success: true, data: response.data.results || response.data };
  } catch (error: any) {
    console.error("Error fetching admin plans:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors du chargement des plans",
    };
  }
}

export async function getAdminPlan(
  accessToken: string,
  planId: string
): Promise<{ success: boolean; data?: AdminPlan; message?: string }> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/platform-admin/plans/${planId}/`,
      { headers: getHeaders(accessToken) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("Error fetching admin plan:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors du chargement du plan",
    };
  }
}

export async function createAdminPlan(
  accessToken: string,
  data: CreatePlanData
): Promise<{ success: boolean; data?: AdminPlan; message?: string }> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/platform-admin/plans/`,
      data,
      { headers: getHeaders(accessToken) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("Error creating plan:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la création du plan",
    };
  }
}

export async function updateAdminPlan(
  accessToken: string,
  planId: string,
  data: UpdatePlanData
): Promise<{ success: boolean; data?: AdminPlan; message?: string }> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/platform-admin/plans/${planId}/`,
      data,
      { headers: getHeaders(accessToken) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("Error updating plan:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la mise à jour du plan",
    };
  }
}

export async function deleteAdminPlan(
  accessToken: string,
  planId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    await axios.delete(`${API_BASE_URL}/platform-admin/plans/${planId}/`, {
      headers: getHeaders(accessToken),
    });

    return { success: true, message: "Plan supprimé avec succès" };
  } catch (error: any) {
    console.error("Error deleting plan:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la suppression du plan",
    };
  }
}

// =============================================================================
// SUBSCRIPTIONS
// =============================================================================

export async function getAdminSubscriptions(
  accessToken: string,
  filters?: {
    page?: number;
    page_size?: number;
    search?: string;
    status?: string;
    billing_cycle?: string;
    plan?: string;
  }
): Promise<{ success: boolean; data?: { results: AdminSubscription[]; count: number; next: string | null; previous: string | null }; message?: string }> {
  try {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    const response = await axios.get(
      `${API_BASE_URL}/platform-admin/subscriptions/?${params}`,
      { headers: getHeaders(accessToken) }
    );

    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("Error fetching admin subscriptions:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors du chargement des abonnements",
    };
  }
}

export async function extendSubscription(
  accessToken: string,
  subscriptionId: string,
  days: number
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/platform-admin/subscriptions/${subscriptionId}/extend/`,
      { days },
      { headers: getHeaders(accessToken) }
    );

    return { success: true, message: response.data.message };
  } catch (error: any) {
    console.error("Error extending subscription:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de la prolongation de l'abonnement",
    };
  }
}

export async function cancelSubscription(
  accessToken: string,
  subscriptionId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/platform-admin/subscriptions/${subscriptionId}/cancel/`,
      {},
      { headers: getHeaders(accessToken) }
    );

    return { success: true, message: response.data.message };
  } catch (error: any) {
    console.error("Error canceling subscription:", error);
    return {
      success: false,
      message: error.response?.data?.detail || "Erreur lors de l'annulation de l'abonnement",
    };
  }
}

export interface CreateSubscriptionData {
  organization: string;
  plan: string;
  billing_cycle: "monthly" | "quarterly" | "yearly";
  start_date?: string;
  notes?: string;
}

export async function createAdminSubscription(
  accessToken: string,
  data: CreateSubscriptionData
): Promise<{ success: boolean; data?: AdminSubscription; message?: string }> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/platform-admin/subscriptions/`,
      data,
      { headers: getHeaders(accessToken) }
    );

    return { success: true, data: response.data, message: "Abonnement créé avec succès" };
  } catch (error: any) {
    console.error("Error creating subscription:", error);
    const detail = error.response?.data?.detail
      || Object.values(error.response?.data || {}).flat().join(", ")
      || "Erreur lors de la création de l'abonnement";
    return { success: false, message: detail };
  }
}
