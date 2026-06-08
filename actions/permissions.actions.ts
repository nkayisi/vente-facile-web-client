"use server";

import axios from "@/lib/auth/api-helper";
import type { UserPermissions } from "@/lib/permissions";
import { getErrorBody } from "@/lib/api/drf-error";

const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005/api/v1";

interface PermissionsResponse {
  success: boolean;
  data?: UserPermissions;
  error?: string;
}

export async function getUserPermissions(
  accessToken: string,
  organizationId: string
): Promise<PermissionsResponse> {
  try {
    const response = await axios.get(`${API_BASE_URL}/users/me/permissions/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Organization-ID": organizationId,
      },
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error:
        getErrorBody(error)?.detail ||
        (error as Error)?.message ||
        "Erreur lors de la récupération des permissions",
    };
  }
}
