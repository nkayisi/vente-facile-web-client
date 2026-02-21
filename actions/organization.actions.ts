"use server";

import axios from "@/lib/auth/api-helper";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
  } catch (error: any) {
    console.error("[Server Action] Get organizations error:", error.response?.data || error.message);

    return {
      success: false,
      message: error.message || "Impossible de récupérer les organisations",
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
  } catch (error: any) {
    console.error("[Server Action] Create organization error:", error.response?.data || error.message);

    // Gérer les erreurs de validation du backend
    if (error.response?.data) {
      const errorData = error.response.data;

      return {
        success: false,
        message: errorData.detail || "Erreur lors de la création de l'organisation",
        errors: errorData,
      };
    }

    return {
      success: false,
      message: error.message || "Une erreur est survenue lors de la création de l'organisation",
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
  } catch (error: any) {
    console.error("[Server Action] Switch organization error:", error.response?.data || error.message);

    return {
      success: false,
      message: error.message || "Impossible de changer d'organisation",
    };
  }
}

/**
 * Server Action pour récupérer les succursales d'une organisation
 */
export async function getBranches(
  accessToken: string,
  organizationId: string
): Promise<{ success: boolean; data?: Branch[]; message?: string }> {
  try {
    const response = await axios.get(`${API_BASE_URL}/branches/`, {
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
  } catch (error: any) {
    console.error("[Server Action] Get branches error:", error.response?.data || error.message);

    return {
      success: false,
      message: error.message || "Impossible de récupérer les succursales",
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
  } catch (error: any) {
    console.error("[Server Action] Get dashboard stats error:", error.response?.data || error.message);

    return {
      success: false,
      message: error.message || "Impossible de récupérer les statistiques du dashboard",
    };
  }
}
