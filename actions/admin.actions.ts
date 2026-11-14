"use server";

import axios, { type AxiosError } from "axios";
import { formatAxiosErrorMessage, getErrorBody } from "@/lib/api/drf-error";
import { enTetesDeBordure } from "@/lib/api/bordure";
import { signalerSiSessionFermee } from "@/lib/auth/session-fermee";

const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8005/api/v1";

// =============================================================================
// TYPES
// =============================================================================

export interface AdminDashboardStats {
  total_organizations: number;
  active_organizations: number;
  total_users: number;
  new_users_this_month: number;
  /** L'encaissé, PAR DEVISE : il n'existe pas de total inter-devises. */
  revenue_by_currency: Array<{ currency: string; total: string; this_month: string }>;
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
  revenue_trend: Array<{ month: string; by_currency: Record<string, string> }>;
  /** MRR dans la devise principale de la plateforme (`mrr_currency`). */
  mrr: string;
  mrr_currency: string | null;
  mrr_by_currency: Array<{ currency: string; mrr: string; paying_organizations: number }>;
  arpu: string;
  paying_organizations: number;
  trialing_organizations: number;
  /** `null` quand il n'y avait personne à perdre : ce n'est pas « 0 % ». */
  churn_rate_30d: string | null;
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
  subscription_status_code: string | null;
  subscription_plan: string;
  subscription_end?: string;
  created_at: string;
  address?: string;
  tax_id?: string;
  rccm?: string;
  id_nat?: string;
  timezone?: string;
  subscription_floor_tier?: number;
  currency?: string;
  members?: AdminOrganizationMember[];
  subscription?: AdminOrganizationSubscription | null;
  recent_activity?: Array<{
    user: string;
    action: string;
    resource_type: string;
    created_at: string;
  }>;
  updated_at: string;
}

export interface AdminOrganizationMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
  role_display: string;
  /** L'adhésion ET le compte : ce qui ouvre ou ferme la prise en main. */
  is_active: boolean;
  /** Le compte seul : une adhésion close n'empêche pas de réinitialiser un mot de passe. */
  user_is_active: boolean;
  /** On ne prend jamais la main sur un administrateur : le bouton se ferme. */
  is_platform_admin: boolean;
  joined_at: string;
}

export interface AdminOrganizationSubscription {
  id: string;
  plan_id: string;
  plan_name: string;
  status: string;
  status_display: string;
  billing_cycle: string;
  price: string;
  currency: string;
  current_period_start: string;
  current_period_end: string;
  days_remaining: number;
}

export type PlatformRole = "support" | "super_admin";

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  is_email_verified: boolean;
  platform_role: PlatformRole | null;
  platform_role_display: string | null;
  platform_profile?: PlatformAdminProfile | null;
  organizations_count: number;
  organizations: Array<{
    id: string;
    name: string;
    role: string;
    role_code: string;
  }>;
  date_joined: string;
  last_login?: string;
  /** Mot de passe posé par l'administration, pas encore remplacé par son titulaire. */
  must_change_password: boolean;
}

export interface AdminPlanCurrency {
  id: string;
  code: string;
  symbol: string;
}

export interface AdminPlan {
  id: string;
  name: string;
  code: string;
  description: string;
  price_monthly: string;
  price_yearly: string;
  currency: AdminPlanCurrency;
  max_users: number;
  max_branches: number;
  max_warehouses: number;
  max_products?: number;
  max_monthly_transactions?: number;
  storage_limit_mb: number;
  features: Record<string, any>;
  is_active: boolean;
  is_featured: boolean;
  trial_days: number;
  sort_order: number;
  tier: number;
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
  cancelled_at: string | null;
  created_at: string;
}

export interface CreatePlanData {
  name: string;
  code: string;
  description: string;
  price_monthly: string;
  price_yearly: string;
  /** UUID de la devise (table Currency côté API). */
  currency: string;
  max_users: number;
  max_branches: number;
  max_warehouses: number;
  max_products?: number;
  max_monthly_transactions?: number;
  storage_limit_mb: number;
  features: Record<string, any>;
  is_active: boolean;
  is_featured: boolean;
  trial_days: number;
  sort_order: number;
  /** Palier : compare upgrade/downgrade (plus grand = offre supérieure). */
  tier: number;
}

export interface UpdatePlanData extends Partial<CreatePlanData> { }

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Le client HTTP de l'administration.
 *
 * ⚠ Un seul crochet, celui d'une session coupée : un administrateur dont un
 * super-administrateur vient de poser le mot de passe garderait sinon un onglet
 * dont chaque écran répond 401, jusqu'au rafraîchissement suivant. Le refus
 * repart tel quel : les messages des écrans ne changent pas.
 */
const adminAxios = axios.create();
adminAxios.interceptors.response.use(
  (reponse) => reponse,
  async (error: AxiosError) => {
    await signalerSiSessionFermee(error);
    return Promise.reject(error);
  },
);

/** Le message à montrer, champ par champ quand le serveur en désigne un. */
function messageDe(error: unknown, repli: string): string {
  return formatAxiosErrorMessage(error, repli);
}

/**
 * ⚠ Chaque acte d'administration écrit une ligne d'audit avec l'adresse de son
 * auteur : sans les en-têtes de bordure, elle serait celle du serveur de Next.
 */
async function getHeaders(accessToken: string): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...(await enTetesDeBordure()),
  };
}

// =============================================================================
// DASHBOARD
// =============================================================================

export async function getAdminDashboardStats(
  accessToken: string
): Promise<{ success: boolean; data?: AdminDashboardStats; message?: string }> {
  try {
    const response = await adminAxios.get(`${API_BASE_URL}/platform-admin/dashboard/`, {
      headers: await getHeaders(accessToken),
    });

    if (response.data) {
      return { success: true, data: response.data };
    }
    return { success: false, message: "Données non disponibles" };
  } catch (error: unknown) {
    console.error("Error fetching admin dashboard stats:", error);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors du chargement des statistiques",
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

    const response = await adminAxios.get(
      `${API_BASE_URL}/platform-admin/organizations/?${params}`,
      { headers: await getHeaders(accessToken) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error fetching admin organizations:", error);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors du chargement des organisations",
    };
  }
}

export async function getAdminOrganization(
  accessToken: string,
  organizationId: string
): Promise<{ success: boolean; data?: AdminOrganization; message?: string }> {
  try {
    const response = await adminAxios.get(
      `${API_BASE_URL}/platform-admin/organizations/${organizationId}/`,
      { headers: await getHeaders(accessToken) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error fetching admin organization:", error);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors du chargement de l'organisation",
    };
  }
}

export async function toggleOrganizationActive(
  accessToken: string,
  organizationId: string,
  reason = ""
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await adminAxios.post(
      `${API_BASE_URL}/platform-admin/organizations/${organizationId}/toggle_active/`,
      { reason },
      { headers: await getHeaders(accessToken) }
    );

    return { success: true, message: response.data.message };
  } catch (error: unknown) {
    console.error("Error toggling organization:", error);
    return {
      success: false,
      message: messageDe(error, "Erreur lors de la modification de l'organisation"),
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
    const response = await adminAxios.post(
      `${API_BASE_URL}/platform-admin/organizations/${organizationId}/activate_subscription/`,
      data,
      { headers: await getHeaders(accessToken) }
    );

    return { success: true, message: response.data.message };
  } catch (error: unknown) {
    console.error("Error activating subscription:", error);
    return {
      success: false,
      message: messageDe(error, "Erreur lors de l'activation de l'abonnement"),
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
    ordering?: string;
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

    const response = await adminAxios.get(
      `${API_BASE_URL}/platform-admin/users/?${params}`,
      { headers: await getHeaders(accessToken) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error fetching admin users:", error);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors du chargement des utilisateurs",
    };
  }
}

export async function getAdminUser(
  accessToken: string,
  userId: string
): Promise<{ success: boolean; data?: AdminUser; message?: string }> {
  try {
    const response = await adminAxios.get(
      `${API_BASE_URL}/platform-admin/users/${userId}/`,
      { headers: await getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error fetching admin user:", error);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors du chargement de l'utilisateur",
    };
  }
}

export async function getAdminSubscription(
  accessToken: string,
  subscriptionId: string
): Promise<{ success: boolean; data?: AdminSubscription; message?: string }> {
  try {
    const response = await adminAxios.get(
      `${API_BASE_URL}/platform-admin/subscriptions/${subscriptionId}/`,
      { headers: await getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error fetching admin subscription:", error);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors du chargement de l'abonnement",
    };
  }
}

export async function toggleUserActive(
  accessToken: string,
  userId: string,
  reason = ""
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await adminAxios.post(
      `${API_BASE_URL}/platform-admin/users/${userId}/toggle_active/`,
      { reason },
      { headers: await getHeaders(accessToken) }
    );

    return { success: true, message: response.data.message };
  } catch (error: unknown) {
    console.error("Error toggling user:", error);
    return {
      success: false,
      message: messageDe(error, "Erreur lors de la modification de l'utilisateur"),
    };
  }
}

export interface CreateAdminUserData {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  password: string;
  password_confirm: string;
}

/**
 * Crée un compte. Le mot de passe passe par `create_user` côté serveur : le
 * compte naissait jusqu'ici sans mot de passe haché, donc inutilisable.
 */
export async function createAdminUser(
  accessToken: string,
  data: CreateAdminUserData
): Promise<{ success: boolean; data?: AdminUser; message?: string; errors?: Record<string, unknown> }> {
  try {
    const response = await adminAxios.post(`${API_BASE_URL}/platform-admin/users/`, data, {
      headers: await getHeaders(accessToken),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      message: messageDe(error, "Erreur lors de la création du compte"),
      errors: getErrorBody(error),
    };
  }
}

export interface ResetPasswordResult {
  message: string;
  sessions_closed: number;
  devices_revoked: number;
}

/**
 * Pose un mot de passe temporaire, à changer à la prochaine connexion.
 *
 * ⚠ LE MOT DE PASSE NE REVIENT PAS dans la réponse : l'écran le tient déjà, et
 * c'est lui qui l'affiche une seule fois pour qu'on le dicte au titulaire.
 */
export async function resetUserPassword(
  accessToken: string,
  userId: string,
  data: { password: string; reason: string }
): Promise<{ success: boolean; data?: ResetPasswordResult; message?: string; errors?: Record<string, unknown> }> {
  try {
    const response = await adminAxios.post(
      `${API_BASE_URL}/platform-admin/users/${userId}/reset_password/`,
      data,
      { headers: await getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      message: messageDe(error, "Erreur lors de la réinitialisation du mot de passe"),
      errors: getErrorBody(error),
    };
  }
}

export async function updateAdminUser(
  accessToken: string,
  userId: string,
  data: { first_name?: string; last_name?: string; phone?: string }
): Promise<{ success: boolean; data?: AdminUser; message?: string; errors?: Record<string, unknown> }> {
  try {
    const response = await adminAxios.patch(`${API_BASE_URL}/platform-admin/users/${userId}/`, data, {
      headers: await getHeaders(accessToken),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      message: messageDe(error, "Erreur lors de la mise à jour du compte"),
      errors: getErrorBody(error),
    };
  }
}

/** Accorde ou change le rôle plateforme. Réservé à `platform_admins.manage`. */
export async function grantPlatformRole(
  accessToken: string,
  userId: string,
  data: { role: PlatformRole; extra_permissions?: string[]; notes?: string }
): Promise<{ success: boolean; data?: AdminUser; message?: string }> {
  try {
    const response = await adminAxios.post(
      `${API_BASE_URL}/platform-admin/users/${userId}/grant_role/`,
      data,
      { headers: await getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "Erreur lors de l'attribution du rôle") };
  }
}

export async function revokePlatformRole(
  accessToken: string,
  userId: string,
  reason = ""
): Promise<{ success: boolean; data?: AdminUser; message?: string }> {
  try {
    const response = await adminAxios.post(
      `${API_BASE_URL}/platform-admin/users/${userId}/revoke_role/`,
      { reason },
      { headers: await getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "Erreur lors du retrait du rôle") };
  }
}

// =============================================================================
// PLANS
// =============================================================================

export interface SettingsCurrency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_active: boolean;
}

export async function getSettingsCurrencies(
  accessToken: string
): Promise<{ success: boolean; data?: SettingsCurrency[]; message?: string }> {
  try {
    const response = await adminAxios.get(`${API_BASE_URL}/settings/currencies/`, {
      headers: await getHeaders(accessToken),
    });
    const list = Array.isArray(response.data) ? response.data : response.data?.results ?? [];
    return { success: true, data: list };
  } catch (error: unknown) {
    console.error("Error fetching currencies:", error);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors du chargement des devises",
    };
  }
}

export async function getAdminPlans(
  accessToken: string
): Promise<{ success: boolean; data?: AdminPlan[]; message?: string }> {
  try {
    const response = await adminAxios.get(`${API_BASE_URL}/platform-admin/plans/`, {
      headers: await getHeaders(accessToken),
    });

    return { success: true, data: response.data.results || response.data };
  } catch (error: unknown) {
    console.error("Error fetching admin plans:", error);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors du chargement des plans",
    };
  }
}

export async function createAdminPlan(
  accessToken: string,
  data: CreatePlanData
): Promise<{ success: boolean; data?: AdminPlan; message?: string }> {
  try {
    const payload: Record<string, unknown> = { ...data };
    if (!payload.currency) {
      delete payload.currency;
    }
    const response = await adminAxios.post(
      `${API_BASE_URL}/platform-admin/plans/`,
      payload,
      { headers: await getHeaders(accessToken) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error creating plan:", error);
    return {
      success: false,
      message: messageDe(error, "Erreur lors de la création du plan"),
    };
  }
}

export async function updateAdminPlan(
  accessToken: string,
  planId: string,
  data: UpdatePlanData
): Promise<{ success: boolean; data?: AdminPlan; message?: string }> {
  try {
    const payload: Record<string, unknown> = { ...data };
    if (payload.currency === "" || payload.currency === undefined) {
      delete payload.currency;
    }
    const response = await adminAxios.patch(
      `${API_BASE_URL}/platform-admin/plans/${planId}/`,
      payload,
      { headers: await getHeaders(accessToken) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error updating plan:", error);
    return {
      success: false,
      message: messageDe(error, "Erreur lors de la mise à jour du plan"),
    };
  }
}

/**
 * Retire un plan de la vente, ou l'y remet. Un plan ne se supprime pas : une
 * facture passée le désigne peut-être encore, et ses abonnés le gardent.
 */
export async function togglePlanActive(
  accessToken: string,
  planId: string,
  reason = ""
): Promise<{ success: boolean; data?: AdminPlan; message?: string }> {
  try {
    const response = await adminAxios.post(
      `${API_BASE_URL}/platform-admin/plans/${planId}/toggle_active/`,
      { reason },
      { headers: await getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "Erreur lors de la modification du plan") };
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
    organization?: string;
    ordering?: string;
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

    const response = await adminAxios.get(
      `${API_BASE_URL}/platform-admin/subscriptions/?${params}`,
      { headers: await getHeaders(accessToken) }
    );

    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("Error fetching admin subscriptions:", error);
    return {
      success: false,
      message: getErrorBody(error)?.detail || "Erreur lors du chargement des abonnements",
    };
  }
}

export async function extendSubscription(
  accessToken: string,
  subscriptionId: string,
  days: number,
  reason = ""
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await adminAxios.post(
      `${API_BASE_URL}/platform-admin/subscriptions/${subscriptionId}/extend/`,
      { days, reason },
      { headers: await getHeaders(accessToken) }
    );

    return { success: true, message: response.data.message };
  } catch (error: unknown) {
    console.error("Error extending subscription:", error);
    return {
      success: false,
      message: messageDe(error, "Erreur lors de la prolongation de l'abonnement"),
    };
  }
}

export async function cancelSubscription(
  accessToken: string,
  subscriptionId: string,
  reason = ""
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await adminAxios.post(
      `${API_BASE_URL}/platform-admin/subscriptions/${subscriptionId}/cancel/`,
      { reason },
      { headers: await getHeaders(accessToken) }
    );

    return { success: true, message: response.data.message };
  } catch (error: unknown) {
    console.error("Error canceling subscription:", error);
    return {
      success: false,
      message: messageDe(error, "Erreur lors de l'annulation de l'abonnement"),
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
    const response = await adminAxios.post(
      `${API_BASE_URL}/platform-admin/subscriptions/`,
      data,
      { headers: await getHeaders(accessToken) }
    );

    return { success: true, data: response.data, message: "Abonnement créé avec succès" };
  } catch (error: unknown) {
    console.error("Error creating subscription:", error);
    return { success: false, message: messageDe(error, "Erreur lors de la création de l'abonnement") };
  }
}

// =============================================================================
// PORTE DE MISE A JOUR MOBILE
// =============================================================================

export interface AppRelease {
  android_minimum_version: string;
  android_current_version: string;
  android_store_url: string;
  android_update_message: string;
  ios_minimum_version: string;
  ios_current_version: string;
  ios_store_url: string;
  ios_update_message: string;
}

/**
 * Lit la porte de mise à jour du terminal mobile.
 *
 * ⚠ Un seuil posé ici rend INUTILISABLE tout terminal dont la version est
 * inférieure. C'est le seul réglage de la plateforme dont une erreur ne se
 * répare pas depuis un terminal : la seule sortie est de revenir ici et de
 * vider le champ.
 */
export async function getAppRelease(
  accessToken: string
): Promise<{ success: boolean; data?: AppRelease; message?: string }> {
  try {
    const response = await adminAxios.get(`${API_BASE_URL}/platform-admin/app-release/`, {
      headers: await getHeaders(accessToken),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      message: formatAxiosErrorMessage(
        error,
        "Erreur lors du chargement de la porte de mise à jour"
      ),
    };
  }
}

/**
 * Corrige la porte de mise à jour.
 *
 * ⚠ `errors` porte la carte des erreurs PAR CHAMP, et l'appelant doit s'en
 * servir : les trois règles du serveur (forme du numéro, seuil qui ne dépasse
 * pas la version du magasin, seuil qui mène quelque part) désignent chacune un
 * champ précis. Les aplatir en un seul message ferait chercher lequel des huit
 * est en cause.
 */
export async function updateAppRelease(
  accessToken: string,
  data: Partial<AppRelease>
): Promise<{
  success: boolean;
  data?: AppRelease;
  message?: string;
  errors?: Record<string, unknown>;
}> {
  try {
    const response = await adminAxios.patch(
      `${API_BASE_URL}/platform-admin/app-release/`,
      data,
      { headers: await getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Erreur lors de l'enregistrement"),
      errors: getErrorBody(error),
    };
  }
}

// =============================================================================
// QUI SUIS-JE
// =============================================================================

export interface AdminMe {
  id: string;
  email: string;
  full_name: string;
  role: PlatformRole | null;
  role_display: string | null;
  is_super_admin: boolean;
  is_support: boolean;
  /** Codes du catalogue `apps/platform_admin/permissions_catalog.py`. */
  permissions: string[];
}

/**
 * Le rôle et les permissions de l'instant.
 *
 * ⚠ Lus ici et non dans le jeton : un rôle posé dans le JWT resterait figé
 * jusqu'à la reconnexion, et un support rétrogradé garderait des boutons que le
 * serveur lui refuse. `status` distingue « pas d'accès » (403) d'une panne.
 */
export async function getAdminMe(
  accessToken: string
): Promise<{ success: boolean; data?: AdminMe; status?: number; message?: string }> {
  try {
    const response = await adminAxios.get(`${API_BASE_URL}/platform-admin/me/`, {
      headers: await getHeaders(accessToken),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    const statut = (error as { response?: { status?: number } })?.response?.status;
    return { success: false, status: statut, message: messageDe(error, "Erreur lors du chargement du profil") };
  }
}

// =============================================================================
// ORGANISATION : ÉDITION
// =============================================================================

export interface UpdateAdminOrganizationData {
  name?: string;
  business_type?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  tax_id?: string;
  rccm?: string;
  id_nat?: string;
}

export async function updateAdminOrganization(
  accessToken: string,
  organizationId: string,
  data: UpdateAdminOrganizationData
): Promise<{ success: boolean; data?: AdminOrganization; message?: string; errors?: Record<string, unknown> }> {
  try {
    const response = await adminAxios.patch(
      `${API_BASE_URL}/platform-admin/organizations/${organizationId}/`,
      data,
      { headers: await getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      message: messageDe(error, "Erreur lors de la mise à jour de l'organisation"),
      errors: getErrorBody(error),
    };
  }
}

// =============================================================================
// ADMINISTRATEURS DE LA PLATEFORME
// =============================================================================

export interface PlatformAdminProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  user_is_active: boolean;
  role: PlatformRole;
  role_display: string;
  is_active: boolean;
  extra_permissions: string[];
  granted_by_email: string | null;
  granted_at: string;
  revoked_by_email: string | null;
  revoked_at: string | null;
  notes: string;
}

export async function getPlatformAdmins(
  accessToken: string,
  filters?: { is_active?: boolean; role?: PlatformRole; search?: string; page?: number }
): Promise<{ success: boolean; data?: { results: PlatformAdminProfile[]; count: number }; message?: string }> {
  try {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
    });
    const response = await adminAxios.get(`${API_BASE_URL}/platform-admin/platform-admins/?${params}`, {
      headers: await getHeaders(accessToken),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "Erreur lors du chargement des administrateurs") };
  }
}

// =============================================================================
// JOURNAL D'AUDIT
// =============================================================================

export interface AdminActionLogEntry {
  id: string;
  created_at: string;
  actor: string | null;
  actor_email: string;
  actor_name: string | null;
  action: string;
  action_display: string;
  target_type: string;
  target_type_display: string;
  target_id: string;
  target_repr: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  reason: string;
  ip_address: string | null;
}

export interface AdminActionLogFilters {
  page?: number;
  page_size?: number;
  search?: string;
  action?: string;
  target_type?: string;
  target_id?: string;
  actor?: string;
  date_from?: string;
  date_to?: string;
}

export async function getAdminAuditLog(
  accessToken: string,
  filters?: AdminActionLogFilters
): Promise<{ success: boolean; data?: { results: AdminActionLogEntry[]; count: number }; message?: string }> {
  try {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
    });
    const response = await adminAxios.get(`${API_BASE_URL}/platform-admin/audit-log/?${params}`, {
      headers: await getHeaders(accessToken),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "Erreur lors du chargement du journal") };
  }
}

// =============================================================================
// MÉTRIQUES RÉCURRENTES
// =============================================================================

export interface AdminMetrics {
  currency: string | null;
  multi_currency: boolean;
  mrr: string;
  mrr_by_currency: Array<{ currency: string; mrr: string; paying_organizations: number }>;
  arpu: string;
  paying_organizations: number;
  trialing_organizations: number;
  new_paying_30d: number;
  churned_30d: number;
  churn_rate_30d: string | null;
  trend: Array<{
    month: string;
    mrr_by_currency: Record<string, string>;
    paying_organizations: number;
    /** `null` pour le premier mois : il n'y a rien à quoi le comparer. */
    new: number | null;
    churned: number | null;
  }>;
}

export async function getAdminMetrics(
  accessToken: string,
  months = 12
): Promise<{ success: boolean; data?: AdminMetrics; message?: string }> {
  try {
    const response = await adminAxios.get(`${API_BASE_URL}/platform-admin/metrics/?months=${months}`, {
      headers: await getHeaders(accessToken),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "Erreur lors du chargement des métriques") };
  }
}

// =============================================================================
// INCIDENTS
// =============================================================================

export type IncidentSeverity = "critical" | "high" | "medium";

interface IncidentContact {
  owner_name?: string | null;
  owner_email?: string | null;
  phone?: string | null;
}

export interface SubscriptionIncident extends IncidentContact {
  subscription_id: string;
  organization_id: string;
  organization_name: string;
  plan_name: string;
  status: string;
  status_display: string;
  current_period_end: string;
  days_remaining: number;
  days_overdue: number;
  severity: IncidentSeverity;
  reason: string;
}

export interface PaymentIncident extends IncidentContact {
  payment_id: string;
  reference: string;
  organization_id: string;
  organization_name: string;
  amount: string;
  currency: string;
  status: string;
  status_display: string;
  created_at: string;
  age_minutes: number;
  reconcile_attempts: number;
  last_reconciled_at: string | null;
  plan_id: string | null;
  billing_cycle: string | null;
  severity: IncidentSeverity;
}

export interface OrphanOrganizationIncident {
  organization_id: string;
  organization_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  severity: IncidentSeverity;
}

export interface AdminIncidents {
  generated_at: string;
  counts: {
    subscriptions_at_risk: number;
    payments_to_review: number;
    organizations_without_owner: number;
    critical: number;
  };
  subscriptions_at_risk: SubscriptionIncident[];
  payments_to_review: PaymentIncident[];
  organizations_without_owner: OrphanOrganizationIncident[];
  /** Les listes s'arrêtent à `limit` ; les décomptes, eux, sont exacts. */
  limit: number;
}

export async function getAdminIncidents(
  accessToken: string
): Promise<{ success: boolean; data?: AdminIncidents; message?: string }> {
  try {
    const response = await adminAxios.get(`${API_BASE_URL}/platform-admin/incidents/`, {
      headers: await getHeaders(accessToken),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "Erreur lors du chargement des incidents") };
  }
}

export interface ReconcileReport {
  checked: number;
  reconciled: number;
  still_pending: number;
  really_failed: number;
  unresolved: number;
  dry_run: boolean;
  skipped: number;
  details: Record<"reconciled" | "still_pending" | "really_failed" | "unresolved", Array<{ reference: string; detail: string }>>;
}

/** Interroge l'opérateur pour un paiement (ou le lot), et active ce qui a été encaissé. */
export async function reconcilePayments(
  accessToken: string,
  options: { reference?: string; dry_run?: boolean } = {}
): Promise<{ success: boolean; data?: ReconcileReport; message?: string }> {
  try {
    const response = await adminAxios.post(`${API_BASE_URL}/platform-admin/incidents/reconcile/`, options, {
      headers: await getHeaders(accessToken),
      // L'opérateur peut répondre lentement : un lot entier se compte en dizaines de secondes.
      timeout: 120_000,
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "Erreur lors de la réconciliation") };
  }
}

// =============================================================================
// PRISE EN MAIN
// =============================================================================

export interface ImpersonationStart {
  /** Jeton d'accès de vingt minutes, lecture seule. Il n'y a PAS de jeton de rafraîchissement. */
  access: string;
  session_id: string;
  expires_at: string;
  target_user: { id: string; email: string; full_name: string };
  organization: { id: string; name: string };
}

export async function startImpersonation(
  accessToken: string,
  userId: string,
  organizationId: string,
  reason: string
): Promise<{ success: boolean; data?: ImpersonationStart; message?: string }> {
  try {
    const response = await adminAxios.post(
      `${API_BASE_URL}/platform-admin/users/${userId}/impersonate/`,
      { organization: organizationId, reason },
      { headers: await getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "Impossible de prendre la main") };
  }
}

/** ⚠ Appelée avec le jeton de PRISE EN MAIN, c'est le seul que le navigateur tient alors. */
export async function endImpersonation(
  impersonationToken: string
): Promise<{ success: boolean; message?: string }> {
  try {
    await adminAxios.post(`${API_BASE_URL}/platform-admin/impersonation/end/`, {}, {
      headers: await getHeaders(impersonationToken),
    });
    return { success: true };
  } catch (error: unknown) {
    // Une session déjà close ou échue n'est pas un échec de la sortie.
    const statut = (error as { response?: { status?: number } })?.response?.status;
    if (statut === 401) return { success: true };
    return { success: false, message: messageDe(error, "Impossible de terminer la prise en main") };
  }
}

export interface ImpersonationSessionEntry {
  id: string;
  impersonator: string;
  impersonator_email: string;
  target_user: string;
  target_email: string;
  target_name: string;
  organization: string;
  organization_name: string;
  reason: string;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
  ended_reason: string;
  ended_reason_display: string;
  is_live: boolean;
  ip_address: string | null;
}

export async function getImpersonationSessions(
  accessToken: string,
  filters?: {
    organization?: string;
    target_user?: string;
    impersonator?: string;
    /** Seulement celles qui ouvrent encore quelque chose (ni closes, ni échues). */
    en_cours?: boolean;
    page?: number;
    page_size?: number;
  }
): Promise<{ success: boolean; data?: { results: ImpersonationSessionEntry[]; count: number }; message?: string }> {
  try {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
    });
    const response = await adminAxios.get(`${API_BASE_URL}/platform-admin/impersonation-sessions/?${params}`, {
      headers: await getHeaders(accessToken),
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "Erreur lors du chargement des prises en main") };
  }
}

/**
 * Arrête la prise en main d'un autre administrateur (super-administrateur seul).
 * Le motif est exigé par le serveur : c'est lui que le journal garde.
 */
export async function endImpersonationSession(
  accessToken: string,
  sessionId: string,
  reason: string
): Promise<{ success: boolean; data?: ImpersonationSessionEntry; message?: string }> {
  try {
    const response = await adminAxios.post(
      `${API_BASE_URL}/platform-admin/impersonation-sessions/${sessionId}/end/`,
      { reason },
      { headers: await getHeaders(accessToken) }
    );
    return { success: true, data: response.data, message: "Prise en main arrêtée." };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "Impossible d'arrêter la prise en main") };
  }
}

/**
 * Vrai si le jeton de prise en main ouvre encore quelque chose ; faux s'il a
 * été coupé (arrêt forcé, rôle retiré, compte désactivé) ; `null` si on n'a
 * pas pu le savoir.
 *
 * ⚠ `null` n'est pas « coupé » : une coupure de réseau ne doit pas rendre la
 * main d'office à l'administrateur au milieu de ce qu'il regarde.
 */
export async function isImpersonationLive(impersonationToken: string): Promise<boolean | null> {
  try {
    await adminAxios.get(`${API_BASE_URL}/users/me/`, { headers: await getHeaders(impersonationToken) });
    return true;
  } catch (error: unknown) {
    const statut = (error as { response?: { status?: number } })?.response?.status;
    return statut === 401 ? false : null;
  }
}

// =============================================================================
// NOTES DU SUPPORT (phase 7)
// =============================================================================

/** Une note du support sur un établissement. Jamais visible du marchand. */
export interface SupportNote {
  id: string;
  organization: string;
  organization_name: string;
  author_email: string;
  body: string;
  is_pinned: boolean;
  /** Seul son auteur corrige le texte : l'écran ne propose rien d'autre. */
  peut_corriger: boolean;
  created_at: string;
  updated_at: string;
}

export async function getSupportNotes(
  accessToken: string,
  organizationId: string
): Promise<{ success: boolean; data?: SupportNote[]; message?: string }> {
  try {
    const response = await adminAxios.get(
      // ⚠ La pagination par défaut couperait à vingt : sur la fiche, une note
      //   tronquée en silence est une note que personne ne lira.
      `${API_BASE_URL}/platform-admin/support-notes/?organization=${encodeURIComponent(organizationId)}&page_size=200`,
      { headers: await getHeaders(accessToken) }
    );
    const data = response.data;
    return { success: true, data: Array.isArray(data) ? data : data.results };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "Les notes n'ont pas pu être chargées") };
  }
}

export async function createSupportNote(
  accessToken: string,
  organizationId: string,
  body: string
): Promise<{ success: boolean; data?: SupportNote; message?: string }> {
  try {
    const response = await adminAxios.post(
      `${API_BASE_URL}/platform-admin/support-notes/`,
      { organization: organizationId, body },
      { headers: await getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "La note n'a pas pu être enregistrée") };
  }
}

export async function updateSupportNote(
  accessToken: string,
  noteId: string,
  patch: { body?: string; is_pinned?: boolean }
): Promise<{ success: boolean; data?: SupportNote; message?: string }> {
  try {
    const response = await adminAxios.patch(
      `${API_BASE_URL}/platform-admin/support-notes/${noteId}/`,
      patch,
      { headers: await getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "La note n'a pas pu être modifiée") };
  }
}

// =============================================================================
// RECHERCHE GLOBALE (phase 7)
// =============================================================================

export interface AdminSearchHit {
  id: string;
  name: string;
  detail: string;
  is_active?: boolean;
  organization?: string;
}

/**
 * Un groupe à `null` n'est pas « aucun résultat » : c'est un domaine que le rôle
 * ne lit pas. L'écran ne l'affiche pas du tout.
 */
export interface AdminSearchResults {
  q: string;
  organizations: AdminSearchHit[] | null;
  users: AdminSearchHit[] | null;
  payments: AdminSearchHit[] | null;
}

export async function searchAdmin(
  accessToken: string,
  q: string
): Promise<{ success: boolean; data?: AdminSearchResults; message?: string }> {
  try {
    const response = await adminAxios.get(
      `${API_BASE_URL}/platform-admin/search/?q=${encodeURIComponent(q)}`,
      { headers: await getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "La recherche n'a pas abouti") };
  }
}

// =============================================================================
// PAIEMENTS D'ABONNEMENT (phase 7)
// =============================================================================

export interface AdminSubscriptionPayment {
  id: string;
  organization: string;
  organization_name: string;
  subscription: string | null;
  plan_name: string | null;
  /** Décimal en chaîne : `COERCE_DECIMAL_TO_STRING` reste au défaut. */
  amount: string;
  currency: string;
  payment_method: string;
  payment_method_display: string;
  status: string;
  status_display: string;
  reference: string;
  external_transaction_id: string;
  paid_at: string | null;
  created_at: string;
}

export interface AdminSubscriptionPaymentFilters {
  search?: string;
  status?: string;
  payment_method?: string;
  organization?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export async function getAdminSubscriptionPayments(
  accessToken: string,
  filters?: AdminSubscriptionPaymentFilters
): Promise<{ success: boolean; data?: { results: AdminSubscriptionPayment[]; count: number }; message?: string }> {
  try {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
    });
    const response = await adminAxios.get(
      `${API_BASE_URL}/platform-admin/subscription-payments/?${params}`,
      { headers: await getHeaders(accessToken) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return { success: false, message: messageDe(error, "Les paiements n'ont pas pu être chargés") };
  }
}

// =============================================================================
// EXPORTS DE L'ADMINISTRATION (phase 7)
// =============================================================================

/**
 * Les cinq listes exportables. Une liste fermée plutôt qu'un chemin libre : une
 * server action est un point d'entrée RPC, et un chemin fourni par le client
 * ferait d'elle un relais vers n'importe quelle route de l'API.
 */
export type AdminExportList =
  | "organizations"
  | "users"
  | "subscriptions"
  | "subscription-payments"
  | "audit-log";

const LISTES_EXPORTABLES: readonly AdminExportList[] = [
  "organizations",
  "users",
  "subscriptions",
  "subscription-payments",
  "audit-log",
];

const TYPES_DE_FICHIER = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv;charset=utf-8",
} as const;

/**
 * Exporte une liste de l'administration, dans le périmètre de ses filtres.
 *
 * ⚠ PAS `fetchExportFile` : celui-là passe par le client HTTP du MARCHAND, qui
 *   exige un établissement et lit le signal de suspension. L'administration n'a
 *   pas d'établissement. Le corps rendu a la même forme (`ExportFile`), donc le
 *   téléchargement côté client est le même.
 */
export async function exportAdminList(
  accessToken: string,
  liste: AdminExportList,
  format: "pdf" | "xlsx" | "csv",
  filters: Record<string, string | number | undefined | null> = {}
): Promise<{ success: boolean; data?: { data: number[]; contentType: string; filename: string }; message?: string }> {
  if (!LISTES_EXPORTABLES.includes(liste)) {
    return { success: false, message: "Liste inconnue." };
  }
  try {
    const params = new URLSearchParams({ export_format: format });
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    });
    const response = await adminAxios.get(
      `${API_BASE_URL}/platform-admin/${liste}/export/?${params}`,
      { headers: await getHeaders(accessToken), responseType: "arraybuffer" }
    );
    const disposition = String(response.headers["content-disposition"] || "");
    const nom = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `${liste}.${format}`;
    return {
      success: true,
      data: {
        data: Array.from(new Uint8Array(response.data)),
        contentType: TYPES_DE_FICHIER[format],
        filename: nom,
      },
    };
  } catch (error: unknown) {
    // Un corps d'erreur arrive lui aussi en `arraybuffer` : on le relit en JSON
    // pour que « réservé au super-administrateur » se lise, pas « erreur 403 ».
    const reponse = (error as { response?: { status?: number; data?: ArrayBuffer } }).response;
    if (reponse?.data instanceof ArrayBuffer) {
      try {
        const corps = JSON.parse(new TextDecoder().decode(reponse.data));
        if (corps?.detail) return { success: false, message: String(corps.detail) };
      } catch {
        // Corps illisible : on retombe sur le message générique.
      }
    }
    return { success: false, message: messageDe(error, "L'export n'a pas pu être préparé") };
  }
}
