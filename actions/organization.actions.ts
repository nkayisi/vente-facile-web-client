"use server";

import axios from "@/lib/auth/api-helper";
import { getErrorBody } from "@/lib/api/drf-error";

const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

// Types pour les organisations
export type BusinessType = "boutique" | "supermarket" | "pharmacy" | "depot" | "restaurant" | "other";

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  is_main: boolean;
  is_active: boolean;
  created_at: string;
}

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  business_type: BusinessType;
  business_type_display: string;
  logo?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  tax_id?: string;
  rccm?: string;
  id_nat?: string;
  currency: string;
  timezone: string;
  is_active: boolean;
  default_currency_info?: CurrencyInfo;
  created_at: string;
}

export interface CreateOrganizationData {
  name: string;
  business_type: BusinessType;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  tax_id?: string;
  rccm?: string;
  id_nat?: string;
  currency?: string;
  timezone?: string;
}

interface OrganizationResponse {
  success: boolean;
  message?: string;
  data?: Organization;
  errors?: Record<string, string[]>;
}

interface OrganizationsListResponse {
  success: boolean;
  message?: string;
  data?: Organization[];
  errors?: Record<string, string>;
  errorCode?: string;
}

/**
 * Server Action pour récupérer les organisations de l'utilisateur
 */
export async function getUserOrganizations(accessToken: string): Promise<OrganizationsListResponse> {
  try {
    console.log("[Server Action] Fetching user organizations");

    const response = await axios.get(`${API_BASE_URL}/organizations/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    console.log("[Server Action] Organizations fetched successfully:", response.data.results?.length || 0);

    return {
      success: true,
      data: response.data.results || [],
    };
  } catch (error: unknown) {
    console.error("[Server Action] Get organizations error:", getErrorBody(error) || (error as Error)?.message);

    const errorCode = getErrorBody(error)?.code;
    const errorMessage = getErrorBody(error)?.detail || (error as Error)?.message || "Impossible de récupérer les organisations";

    return {
      success: false,
      message: errorMessage,
      errorCode: errorCode,
    };
  }
}

/**
 * Server Action pour créer une organisation
 */
export async function createOrganization(
  accessToken: string,
  data: CreateOrganizationData
): Promise<OrganizationResponse> {
  try {
    console.log("[Server Action] Creating organization:", {
      name: data.name,
      business_type: data.business_type,
      city: data.city,
    });

    const response = await axios.post(
      `${API_BASE_URL}/organizations/`,
      {
        name: data.name,
        business_type: data.business_type,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        country: data.country,
        tax_id: data.tax_id || "",
        rccm: data.rccm || "",
        id_nat: data.id_nat || "",
        currency: data.currency || "CDF",
        timezone: data.timezone || "Africa/Kinshasa",
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("[Server Action] Organization created successfully:", response.data.id);

    return {
      success: true,
      message: "Organisation créée avec succès",
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Server Action] Create organization error:", getErrorBody(error) || (error as Error)?.message);

    // Gérer les erreurs de validation du backend
    const errorData = getErrorBody(error);
    if (errorData) {
      return {
        success: false,
        message: errorData.detail || "Erreur lors de la création de l'organisation",
        errors: errorData,
      };
    }

    return {
      success: false,
      message: (error as Error)?.message || "Une erreur est survenue lors de la création de l'organisation",
    };
  }
}

/**
 * Server Action pour récupérer le détail complet d'une organisation.
 * Contrairement à la liste (OrganizationListSerializer, allégée), ce endpoint
 * renvoie tous les champs (email, phone, address, etc.) via OrganizationDetailSerializer.
 */
export async function getOrganization(
  accessToken: string,
  organizationId: string
): Promise<OrganizationResponse> {
  try {
    const response = await axios.get(`${API_BASE_URL}/organizations/${organizationId}/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Organization-ID": organizationId,
      },
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Server Action] Get organization error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message:
        getErrorBody(error)?.detail ||
        (error as Error)?.message ||
        "Impossible de récupérer les informations de l'établissement",
    };
  }
}

// Champs modifiables de l'établissement. business_type (type d'activité), slug et
// currency (devise principale) sont volontairement exclus : non modifiables après création.
export interface UpdateOrganizationData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  tax_id?: string;
  rccm?: string;
  id_nat?: string;
  timezone?: string;
}

/**
 * Server Action pour modifier les informations d'une organisation (établissement).
 * Utilise PATCH /organizations/{id}/ (OrganizationUpdateSerializer côté backend).
 * Nécessite le rôle manager+ (IsTenantAdmin).
 */
export async function updateOrganization(
  accessToken: string,
  organizationId: string,
  data: UpdateOrganizationData
): Promise<OrganizationResponse> {
  try {
    console.log("[Server Action] Updating organization:", organizationId);

    const response = await axios.patch(
      `${API_BASE_URL}/organizations/${organizationId}/`,
      data,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Organization-ID": organizationId,
        },
      }
    );

    console.log("[Server Action] Organization updated successfully:", response.data.id);

    return {
      success: true,
      message: "Établissement mis à jour avec succès",
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Server Action] Update organization error:", getErrorBody(error) || (error as Error)?.message);

    const errorData = getErrorBody(error);
    if (errorData) {
      return {
        success: false,
        message: errorData.detail || "Erreur lors de la mise à jour de l'établissement",
        errors: errorData,
      };
    }

    return {
      success: false,
      message: (error as Error)?.message || "Une erreur est survenue lors de la mise à jour de l'établissement",
    };
  }
}

/**
 * Server Action pour changer l'organisation active
 */
export async function switchOrganization(
  accessToken: string,
  organizationId: string
): Promise<OrganizationResponse> {
  try {
    console.log("[Server Action] Switching to organization:", organizationId);

    const response = await axios.post(
      `${API_BASE_URL}/organizations/${organizationId}/switch/`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("[Server Action] Organization switched successfully");

    return {
      success: true,
      message: "Organisation changée avec succès",
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Server Action] Switch organization error:", getErrorBody(error) || (error as Error)?.message);

    return {
      success: false,
      message: (error as Error)?.message || "Impossible de changer d'organisation",
    };
  }
}

export interface BranchFilters {
  search?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

/**
 * Server Action pour récupérer une succursale par ID.
 * Utilisé par ``useInitialOption`` pour la pré-sélection en édition.
 */
export async function getBranch(
  accessToken: string,
  organizationId: string,
  branchId: string
): Promise<{ success: boolean; data?: Branch; message?: string }> {
  try {
    const response = await axios.get(`${API_BASE_URL}/branches/${branchId}/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Organization-ID": organizationId,
      },
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      message: (error as Error)?.message || "Succursale introuvable",
    };
  }
}

/**
 * Server Action pour récupérer les succursales d'une organisation
 */
export async function getBranches(
  accessToken: string,
  organizationId: string,
  filters?: BranchFilters
): Promise<{ success: boolean; data?: Branch[]; message?: string }> {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active));
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const queryString = params.toString();
    const response = await axios.get(
      `${API_BASE_URL}/branches/${queryString ? `?${queryString}` : ""}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Organization-ID": organizationId,
        },
      });

    const data = Array.isArray(response.data)
      ? response.data
      : response.data.results || [];

    return {
      success: true,
      data,
    };
  } catch (error: unknown) {
    console.error("[Server Action] Get branches error:", getErrorBody(error) || (error as Error)?.message);

    return {
      success: false,
      message: (error as Error)?.message || "Impossible de récupérer les succursales",
    };
  }
}

// Types pour le dashboard
export interface DashboardCardData {
  value: string | number;
  variation: number;
  previous?: string | number;
  new_count?: number;
  margin?: number;
}

export interface SalesEvolutionData {
  date: string;
  total: string;
  count: number;
}

export interface PaymentMethodData {
  name: string;
  value: string;
  count: number;
}

export interface TopProductData {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  /** Quantité vendue ventilée : « 10 casiers + 5 bouteilles » */
  quantity_display?: string;
  /** Unités de détail par contenant, `null` pour un produit vendu à l'unité */
  packaging_factor?: number | null;
  revenue: string;
}

export interface DashboardStats {
  cards: {
    total_sales: DashboardCardData;
    total_customers: DashboardCardData;
    units_sold: DashboardCardData;
    gross_profit: DashboardCardData;
  };
  charts: {
    sales_evolution: SalesEvolutionData[];
    by_payment_method: PaymentMethodData[];
    top_products: TopProductData[];
  };
  inventory: {
    low_stock_count: number;
    stock_value: string;
  };
  period: string;
  date_range: {
    start: string;
    end: string;
  };
}

export type DashboardPeriod = "day" | "week" | "month" | "year";

/**
 * Server Action pour récupérer les statistiques du dashboard
 */
export async function getDashboardStats(
  accessToken: string,
  organizationId: string,
  period: DashboardPeriod = "month"
): Promise<{ success: boolean; data?: DashboardStats; message?: string }> {
  try {
    console.log("[Server Action] Fetching dashboard stats for period:", period);

    const response = await axios.get(
      `${API_BASE_URL}/organizations/${organizationId}/dashboard/`,
      {
        params: { period },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("[Server Action] Dashboard stats fetched successfully");

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    console.error("[Server Action] Get dashboard stats error:", getErrorBody(error) || (error as Error)?.message);

    return {
      success: false,
      message: (error as Error)?.message || "Impossible de récupérer les statistiques du dashboard",
    };
  }
}
