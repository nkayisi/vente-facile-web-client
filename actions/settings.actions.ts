"use server";

import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
  is_primary: boolean;
  exchange_rate: string;
  is_active: boolean;
  last_rate_update: string;
}

export interface LoyaltyProgram {
  id: string;
  name: string;
  is_active: boolean;
  points_calculation_type: "fixed_per_amount" | "percentage";
  points_calculation_type_display: string;
  points_per_unit: number;
  amount_per_unit: string;
  points_percentage: string;
  point_value: string;
  min_points_to_redeem: number;
  points_expiry_days: number;
  only_registered_customers: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyReward {
  id: string;
  loyalty_program: string;
  name: string;
  description: string;
  reward_type: "discount_amount" | "discount_percentage" | "free_product" | "custom";
  reward_type_display: string;
  points_required: number;
  discount_amount: string;
  discount_percentage: string;
  product: string | null;
  product_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerLoyalty {
  id: string;
  customer: string;
  customer_name: string;
  customer_phone: string;
  total_points_earned: number;
  total_points_redeemed: number;
  current_points: number;
  tier: string;
  last_points_earned_at: string | null;
  last_points_redeemed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  customer_loyalty: string;
  customer_name: string;
  transaction_type: "earn" | "redeem" | "expire" | "adjust" | "bonus";
  transaction_type_display: string;
  points: number;
  balance_after: number;
  sale: string | null;
  sale_reference: string | null;
  reward: string | null;
  reward_name: string | null;
  description: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface OrganizationSettings {
  id: string;
  receipt_header: string;
  receipt_footer: string;
  allow_negative_stock_sales: boolean;
  default_tax_rate: string;
  show_secondary_currency_on_receipt: boolean;
  auto_update_exchange_rates: boolean;
  show_loyalty_points_on_receipt: boolean;
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
  } catch (error: any) {
    console.error("[Settings] Get currencies error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des devises" };
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
  } catch (error: any) {
    console.error("[Settings] Get org currencies error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des devises" };
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
  } catch (error: any) {
    console.error("[Settings] Add org currency error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.currency?.[0] || "Erreur lors de l'ajout de la devise",
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
  } catch (error: any) {
    console.error("[Settings] Update org currency error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la mise à jour de la devise" };
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
  } catch (error: any) {
    console.error("[Settings] Delete org currency error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de la suppression de la devise",
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
  } catch (error: any) {
    console.error("[Settings] Set primary currency error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors du changement de devise principale" };
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
  } catch (error: any) {
    console.error("[Settings] Update exchange rate error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la mise à jour du taux de change" };
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
  } catch (error: any) {
    console.error("[Settings] Convert currency error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la conversion" };
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
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Settings] Get loyalty program error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération du programme de fidélité" };
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
  } catch (error: any) {
    console.error("[Settings] Create loyalty program error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la création du programme de fidélité" };
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
  } catch (error: any) {
    console.error("[Settings] Update loyalty program error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la mise à jour du programme de fidélité" };
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
  } catch (error: any) {
    console.error("[Settings] Toggle loyalty program error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de l'activation/désactivation" };
  }
}

// ============================================================================
// LOYALTY REWARDS
// ============================================================================

export async function getLoyaltyRewards(
  accessToken: string,
  organizationId: string
): Promise<ApiResponse<LoyaltyReward[]>> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/settings/loyalty-rewards/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Settings] Get loyalty rewards error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des récompenses" };
  }
}

export async function createLoyaltyReward(
  accessToken: string,
  organizationId: string,
  data: Partial<LoyaltyReward>
): Promise<ApiResponse<LoyaltyReward>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/settings/loyalty-rewards/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Settings] Create loyalty reward error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la création de la récompense" };
  }
}

export async function updateLoyaltyReward(
  accessToken: string,
  organizationId: string,
  rewardId: string,
  data: Partial<LoyaltyReward>
): Promise<ApiResponse<LoyaltyReward>> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/settings/loyalty-rewards/${rewardId}/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Settings] Update loyalty reward error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la mise à jour de la récompense" };
  }
}

export async function deleteLoyaltyReward(
  accessToken: string,
  organizationId: string,
  rewardId: string
): Promise<ApiResponse<void>> {
  try {
    await axios.delete(
      `${API_BASE_URL}/settings/loyalty-rewards/${rewardId}/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true };
  } catch (error: any) {
    console.error("[Settings] Delete loyalty reward error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la suppression de la récompense" };
  }
}

// ============================================================================
// CUSTOMER LOYALTY
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
    const data = response.data;
    return { success: true, data: Array.isArray(data) && data.length > 0 ? data[0] : null };
  } catch (error: any) {
    console.error("[Settings] Get customer loyalty error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des points de fidélité" };
  }
}

export async function adjustCustomerPoints(
  accessToken: string,
  organizationId: string,
  customerId: string,
  points: number,
  description?: string
): Promise<ApiResponse<CustomerLoyalty>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/settings/customer-loyalty/adjust_points/`,
      { customer_id: customerId, points, description },
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Settings] Adjust customer points error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de l'ajustement des points",
    };
  }
}

export async function redeemCustomerPoints(
  accessToken: string,
  organizationId: string,
  loyaltyId: string,
  data: { reward_id?: string; points?: number }
): Promise<ApiResponse<{ success: boolean; points_redeemed: number; current_points: number }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/settings/customer-loyalty/${loyaltyId}/redeem/`,
      data,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: any) {
    console.error("[Settings] Redeem customer points error:", error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.error || "Erreur lors de l'utilisation des points",
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
  } catch (error: any) {
    console.error("[Settings] Get loyalty transactions error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération de l'historique" };
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
  } catch (error: any) {
    console.error("[Settings] Get org settings error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la récupération des paramètres" };
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
  } catch (error: any) {
    console.error("[Settings] Update org settings error:", error.response?.data || error.message);
    return { success: false, message: "Erreur lors de la mise à jour des paramètres" };
  }
}
