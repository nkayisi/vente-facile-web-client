"use server";

import {
  formatApiErrorBody,
  formatAxiosErrorMessage,
} from "@/lib/api/drf-error";
import axios from "@/lib/auth/api-helper";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Types
export interface AssignedWarehouse {
  id: string;
  name: string;
  code: string;
}

export interface OrganizationMember {
  id: string;
  user: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_first_name: string;
  user_last_name: string;
  user_phone: string;
  user_avatar: string | null;
  user_is_active: boolean;
  user_last_login: string | null;
  role: string;
  role_display: string;
  is_active: boolean;
  invited_by: string | null;
  invited_by_name: string | null;
  joined_at: string;
  /** ``all`` = administrateur (tous les entrepôts) ; ``restricted`` = périmètre assigné */
  warehouse_access?: "all" | "restricted";
  assigned_warehouses?: AssignedWarehouse[];
  /** Permissions additionnelles accordées à ce membre */
  extra_permissions?: string[];
  /** Permissions héritées du rôle */
  role_permissions?: string[];
  /** Permissions effectives (role + extra) */
  effective_permissions?: string[];
}

export interface MemberPermissions {
  role: string;
  role_display: string;
  role_permissions: string[];
  extra_permissions: string[];
  effective_permissions: string[];
  all_permissions: string[];
}

export interface CreateUserData {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  password: string;
  role: string;
  /** Obligatoire côté API pour les rôles non administrateur (≥ 1 UUID) */
  warehouse_ids: string[];
}

export interface UpdateMemberData {
  role?: string;
  is_active?: boolean;
  warehouse_ids?: string[];
  extra_permissions?: string[];
}

interface MembersListResponse {
  success: boolean;
  data?: {
    count: number;
    next: string | null;
    previous: string | null;
    results: OrganizationMember[];
  };
  error?: string;
}

export interface MemberFilters {
  role?: string;
  is_active?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

interface MemberResponse {
  success: boolean;
  data?: OrganizationMember;
  error?: string;
}

function getHeaders(accessToken: string, organizationId: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Organization-ID": organizationId,
  };
}

/**
 * Récupère la liste des membres de l'organisation
 */
export async function getMembers(
  accessToken: string,
  organizationId: string,
  filters?: MemberFilters
): Promise<MembersListResponse> {
  try {
    const params = new URLSearchParams();
    if (filters?.role) params.append("role", filters.role);
    if (filters?.is_active) params.append("is_active", filters.is_active);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.page_size) params.append("page_size", String(filters.page_size));

    const url = `${API_BASE_URL}/memberships/?${params.toString()}`;
    const response = await axios.get(url, {
      headers: getHeaders(accessToken, organizationId),
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: formatAxiosErrorMessage(error, "Erreur lors de la récupération des membres"),
    };
  }
}

/**
 * Récupère le détail d'un membre
 */
export async function getMember(
  accessToken: string,
  organizationId: string,
  memberId: string
): Promise<MemberResponse> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/memberships/${memberId}/`,
      {
        headers: getHeaders(accessToken, organizationId),
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: formatAxiosErrorMessage(error, "Erreur lors de la récupération du membre"),
    };
  }
}

/**
 * Crée un nouvel utilisateur et l'ajoute à l'organisation
 */
export async function createUser(
  accessToken: string,
  organizationId: string,
  data: CreateUserData
): Promise<MemberResponse> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/memberships/create-user/`,
      data,
      {
        headers: getHeaders(accessToken, organizationId),
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    const err = error as { response?: { data?: Record<string, unknown> } };
    const errorData = err?.response?.data;
    const fallback = "Erreur lors de la création de l'utilisateur";
    let errorMsg = errorData
      ? formatApiErrorBody(errorData, fallback)
      : formatAxiosErrorMessage(error, fallback);

    if (errorData?.email && errorData.detail == null) {
      const em = errorData.email;
      errorMsg = Array.isArray(em) ? String(em[0]) : String(em);
    }

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Met à jour le rôle ou le statut d'un membre
 */
export async function updateMember(
  accessToken: string,
  organizationId: string,
  memberId: string,
  data: UpdateMemberData
): Promise<MemberResponse> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/memberships/${memberId}/`,
      data,
      {
        headers: getHeaders(accessToken, organizationId),
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    const err = error as { response?: { data?: Record<string, unknown> } };
    const errorData = err?.response?.data;
    const fallback = "Erreur lors de la mise à jour du membre";
    const errorMsg = errorData
      ? formatApiErrorBody(errorData, fallback)
      : formatAxiosErrorMessage(error, fallback);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Retire un membre de l'organisation
 */
export async function removeMember(
  accessToken: string,
  organizationId: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.delete(
      `${API_BASE_URL}/memberships/${memberId}/`,
      {
        headers: getHeaders(accessToken, organizationId),
      }
    );

    return { success: true };
  } catch (error: unknown) {
    return {
      success: false,
      error: formatAxiosErrorMessage(error, "Erreur lors de la suppression du membre"),
    };
  }
}

/**
 * Récupère les permissions détaillées d'un membre
 */
export async function getMemberPermissions(
  accessToken: string,
  organizationId: string,
  memberId: string
): Promise<{ success: boolean; data?: MemberPermissions; error?: string }> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/memberships/${memberId}/permissions/`,
      {
        headers: getHeaders(accessToken, organizationId),
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: formatAxiosErrorMessage(error, "Erreur lors de la récupération des permissions"),
    };
  }
}

/**
 * Met à jour les permissions additionnelles d'un membre
 */
export async function updateMemberPermissions(
  accessToken: string,
  organizationId: string,
  memberId: string,
  extraPermissions: string[]
): Promise<{ success: boolean; data?: MemberPermissions; error?: string }> {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/memberships/${memberId}/permissions/`,
      { extra_permissions: extraPermissions },
      {
        headers: getHeaders(accessToken, organizationId),
      }
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    const err = error as { response?: { data?: Record<string, unknown> } };
    const errorData = err?.response?.data;
    const fallback = "Erreur lors de la mise à jour des permissions";
    const errorMsg = errorData
      ? formatApiErrorBody(errorData, fallback)
      : formatAxiosErrorMessage(error, fallback);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
