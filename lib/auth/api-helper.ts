import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { formatApiErrorBody } from "@/lib/api/drf-error";
import { getServerAccessToken } from "./server-token";

/**
 * Instance Axios pour les server actions avec retry automatique sur 401.
 * 
 * Quand une requête échoue avec 401 (token expiré), cette instance :
 * 1. Récupère un token frais via auth() (qui déclenche le JWT callback)
 * 2. Réessaie la requête avec le nouveau token
 * 
 * Cela résout le problème où useSession() côté client retourne un token expiré
 * avant que le refetch périodique ne mette à jour la session.
 * 
 * Les server actions construisent déjà les URLs complètes, donc pas de baseURL ici.
 */
const serverAxios: AxiosInstance = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// Intercepteur de réponse : retry sur 401 avec token frais + gestion 402
serverAxios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Retry sur 401 (token expiré)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const freshToken = await getServerAccessToken();
      if (freshToken) {
        originalRequest.headers.Authorization = `Bearer ${freshToken}`;
        return serverAxios(originalRequest);
      }
    }

    // Enrichir l'erreur 402 (Payment Required) avec des infos supplémentaires
    if (error.response?.status === 402) {
      const data = error.response.data as Record<string, unknown>;
      (error as any).isSubscriptionError = true;
      (error as any).subscriptionStatus = data?.subscription_status;
      (error as any).subscriptionMessage = formatApiErrorBody(data, "Abonnement requis");
    }

    return Promise.reject(error);
  }
);

/**
 * Helper pour extraire les erreurs d'une réponse Axios.
 * Détecte spécifiquement les erreurs 402 (abonnement expiré).
 */
export function extractApiError(error: any): {
  message: string;
  isSubscriptionError: boolean;
  status?: number;
} {
  if (error?.response?.status === 402) {
    const data = error.response.data as Record<string, unknown> | undefined;
    return {
      message: data ? formatApiErrorBody(data, "Abonnement requis") : "Abonnement requis",
      isSubscriptionError: true,
      status: 402,
    };
  }

  if (error?.isSubscriptionError) {
    const msg =
      typeof error.subscriptionMessage === "string" && error.subscriptionMessage.trim()
        ? error.subscriptionMessage
        : "Abonnement requis";
    return {
      message: msg,
      isSubscriptionError: true,
      status: 402,
    };
  }

  const data = error?.response?.data;
  const message =
    data && typeof data === "object"
      ? formatApiErrorBody(data as Record<string, unknown>, error?.message || "Une erreur est survenue")
      : error?.message || "Une erreur est survenue";

  return {
    message,
    isSubscriptionError: false,
    status: error?.response?.status,
  };
}

export default serverAxios;
