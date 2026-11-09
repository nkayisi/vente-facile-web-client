"use server";

import axios from "@/lib/auth/api-helper";
import { formatAxiosErrorMessage, getErrorBody } from "@/lib/api/drf-error";

const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

function getHeaders(accessToken: string, organizationId: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-Organization-ID": organizationId,
    "Content-Type": "application/json",
  };
}

// ============================================================================
// TYPES
// ============================================================================

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_active: boolean;
}

export interface OrganizationCurrency {
  id: string;
  currency: string;
  currency_code: string;
  currency_name: string;
  currency_symbol: string;
  currency_decimal_places: number;
  is_primary: boolean;
  exchange_rate: string;
  is_active: boolean;
  last_rate_update: string;
}

export interface LoyaltyProgram {
  id: string;
  name: string;
  is_active: boolean;
  /** Part de la facture reversée dans la cagnotte du client, en %. */
  earn_percent: string;
  /** Part maximale d'une facture réglable avec la cagnotte. */
  max_redemption_percent: string;
  /**
   * Borne dure imposée par le serveur, que `max_redemption_percent` ne peut
   * pas dépasser. Lecture seule : elle vit dans le modèle Django. Sort en
   * nombre JSON (champ calculé), contrairement aux champs Decimal du modèle.
   */
  max_redemption_percent_ceiling: number;
  only_registered_customers: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerLoyalty {
  id: string;
  customer: string;
  customer_name: string;
  customer_phone: string;
  // ⚠ DES CHAÎNES, pas des nombres : la cagnotte est de l'argent, et un solde
  // en CDF atteint sept chiffres - un nombre JavaScript y perd ses unités.
  // Voir `money_field` dans `apps/settings/serializers.py`.
  total_earned: string;
  total_used: string;
  balance: string;
  tier: string;
  last_earned_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  customer_loyalty: string;
  customer_name: string;
  transaction_type:
    | "earn"
    | "redeem"
    // ⚠ `expire` N'A PLUS AUCUN PRODUCTEUR : l'expiration a disparu avec les
    // points. Des lignes historiques le portent, et une écriture passée est
    // une trace.
    | "expire"
    | "adjust"
    | "bonus"
    // Inversions écrites lors d'une annulation ou d'un retour de vente.
    | "earn_reversal"
    | "redeem_reversal";
  transaction_type_display: string;
  amount: string;
  balance_after: string;
  sale: string | null;
  sale_reference: string | null;
  description: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface OrganizationSettings {
  id: string;
  receipt_header: string;
  receipt_footer: string;
  receipt_paper_width: number;
  show_loyalty_on_receipt: boolean;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CURRENCIES
// ============================================================================

export async function getCurrencies(
  accessToken: string
): Promise<ApiResponse<Currency[]>> {
  try {
    const response = await axios.get(`${API_BASE_URL}/settings/currencies/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Settings] Get currencies error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: formatAxiosErrorMessage(error, "Erreur lors de la récupération des devises") };
  }
}

export async function getOrganizationCurrencies(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<OrganizationCurrency[]>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/settings/organization-currencies/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Settings] Get org currencies error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: formatAxiosErrorMessage(error, "Erreur lors de la récupération des devises") };
  }
}

export async function addOrganizationCurrency(
  accessToken: string,
  organizationId: string,
  data: {
    currency: string;
    is_primary?: boolean;
    exchange_rate?: string;
  }
): Promise<ApiResponse<OrganizationCurrency>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/settings/organization-currencies/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Settings] Add org currency error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.currency?.[0] || "Erreur lors de l'ajout de la devise",
    };
  }
}

export async function updateOrganizationCurrency(
  accessToken: string,
  organizationId: string,
  currencyId: string,
  data: {
    exchange_rate?: string;
    is_active?: boolean;
    is_primary?: boolean;
  }
): Promise<ApiResponse<OrganizationCurrency>> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/settings/organization-currencies/${currencyId}/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Settings] Update org currency error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: formatAxiosErrorMessage(error, "Erreur lors de la mise à jour de la devise") };
  }
}

export async function deleteOrganizationCurrency(
  accessToken: string,
  organizationId: string,
  currencyId: string
): Promise<ApiResponse<void>> {
  try {
    await axios.delete(
      `${API_BASE_URL}/settings/organization-currencies/${currencyId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true };
  } catch (error: unknown) {
    console.error("[Settings] Delete org currency error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.error || "Erreur lors de la suppression de la devise",
    };
  }
}

export async function setPrimaryCurrency(
  accessToken: string,
  organizationId: string,
  currencyId: string
): Promise<ApiResponse<OrganizationCurrency>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/settings/organization-currencies/${currencyId}/set_primary/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Settings] Set primary currency error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: formatAxiosErrorMessage(error, "Erreur lors du changement de devise principale") };
  }
}

export async function updateExchangeRate(
  accessToken: string,
  organizationId: string,
  currencyId: string,
  exchangeRate: string
): Promise<ApiResponse<OrganizationCurrency>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/settings/organization-currencies/${currencyId}/update_rate/`,
      { exchange_rate: exchangeRate },
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Settings] Update exchange rate error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: formatAxiosErrorMessage(error, "Erreur lors de la mise à jour du taux de change") };
  }
}

export async function convertCurrency(
  accessToken: string,
  organizationId: string,
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<ApiResponse<{ converted_amount: number; exchange_rate: number }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/settings/organization-currencies/convert/`,
      { amount, from_currency: fromCurrency, to_currency: toCurrency },
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Settings] Convert currency error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: formatAxiosErrorMessage(error, "Erreur lors de la conversion") };
  }
}

// ============================================================================
// LOYALTY PROGRAM
// ============================================================================

export async function getLoyaltyProgram(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<LoyaltyProgram | null>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/settings/loyalty-program/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    console.log("[Settings] Loyalty program response:", response.data);
    return { success: true, data: response.data };
  } catch (error: unknown) {
    const axiosLike = error as { response?: { status?: number; statusText?: string } };
    console.error("[Settings] Get loyalty program error:", {
      status: axiosLike.response?.status,
      statusText: axiosLike.response?.statusText,
      data: getErrorBody(error),
      message: (error as Error)?.message,
      url: `${API_BASE_URL}/settings/loyalty-program/`,
      organizationId
    });
    return { success: false, message: formatAxiosErrorMessage(error, "Erreur lors de la récupération du programme de fidélité") };
  }
}

export async function createLoyaltyProgram(
  accessToken: string,
  organizationId: string,
  data: Partial<LoyaltyProgram>
): Promise<ApiResponse<LoyaltyProgram>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/settings/loyalty-program/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Settings] Create loyalty program error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: formatAxiosErrorMessage(error, "Erreur lors de la création du programme de fidélité") };
  }
}

export async function updateLoyaltyProgram(
  accessToken: string,
  organizationId: string,
  programId: string,
  data: Partial<LoyaltyProgram>
): Promise<ApiResponse<LoyaltyProgram>> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/settings/loyalty-program/${programId}/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Settings] Update loyalty program error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: formatAxiosErrorMessage(error, "Erreur lors de la mise à jour du programme de fidélité") };
  }
}

export async function toggleLoyaltyProgram(
  accessToken: string,
  organizationId: string,
  programId: string
): Promise<ApiResponse<{ is_active: boolean; message: string }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/settings/loyalty-program/${programId}/toggle/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Settings] Toggle loyalty program error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: formatAxiosErrorMessage(error, "Erreur lors de l'activation/désactivation") };
  }
}

// ============================================================================
// LOYALTY REWARDS
// ============================================================================

export async function getCustomerLoyalty(
  accessToken: string,
  organizationId: string,
  customerId: string
): Promise<ApiResponse<CustomerLoyalty | null>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/settings/customer-loyalty/?customer=${customerId}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    // La réponse peut être une liste
    // brute ou une enveloppe { count, results }. Ne lire que le tableau nu
    // renvoyait `null` en permanence, ce qui masquait tout le panneau fidélité
    // du POS et affichait « 0 pts » sur la fiche client.
    const data = response.data;
    const list: CustomerLoyalty[] = Array.isArray(data) ? data : data?.results || [];
    return { success: true, data: list.length > 0 ? list[0] : null };
  } catch (error: unknown) {
    console.error("[Settings] Get customer loyalty error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: formatAxiosErrorMessage(error, "Erreur lors de la récupération de la cagnotte de fidélité") };
  }
}

export async function adjustCustomerLoyalty(
  accessToken: string,
  organizationId: string,
  customerId: string,
  amount: number,
  description?: string
): Promise<ApiResponse<CustomerLoyalty>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/settings/customer-loyalty/adjust-balance/`,
      { customer_id: customerId, amount, description },
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Settings] Adjust customer loyalty error:", getErrorBody(error) || (error as Error)?.message);
    return {
      success: false,
      message: getErrorBody(error)?.error || "Erreur lors de l'ajustement de la cagnotte",
    };
  }
}

export async function getCustomerLoyaltyTransactions(
  accessToken: string,
  organizationId: string,
  loyaltyId: string
): Promise<ApiResponse<LoyaltyTransaction[]>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/settings/customer-loyalty/${loyaltyId}/transactions/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Settings] Get loyalty transactions error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: formatAxiosErrorMessage(error, "Erreur lors de la récupération de l'historique") };
  }
}

// ============================================================================
// ORGANIZATION SETTINGS
// ============================================================================

export async function getOrganizationSettings(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<OrganizationSettings>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/settings/organization-settings/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Settings] Get org settings error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: formatAxiosErrorMessage(error, "Erreur lors de la récupération des paramètres") };
  }
}

export async function updateOrganizationSettings(
  accessToken: string,
  organizationId: string,
  data: Partial<OrganizationSettings>
): Promise<ApiResponse<OrganizationSettings>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/settings/organization-settings/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[Settings] Update org settings error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: formatAxiosErrorMessage(error, "Erreur lors de la mise à jour des paramètres") };
  }
}
