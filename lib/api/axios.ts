import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { getSession } from "next-auth/react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

// Log de l'URL de base en développement
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log("Axios baseURL:", API_BASE_URL);
}

// Créer une instance Axios
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// Intercepteur de requête pour ajouter le token d'authentification
axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Ne récupérer la session que côté client
    if (typeof window !== "undefined") {
      try {
        const session = await getSession();

        if (session?.accessToken) {
          config.headers.Authorization = `Bearer ${session.accessToken}`;
        }
      } catch (error) {
        console.warn("Failed to get session:", error);
      }
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Flag pour éviter les boucles infinies de retry
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
  config: InternalAxiosRequestConfig;
}> = [];

const processQueue = (error: any) => {
  failedQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      resolve(axiosInstance(config));
    }
  });
  failedQueue = [];
};

// Intercepteur de réponse pour gérer les erreurs
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Log détaillé en développement
    if (process.env.NODE_ENV === "development") {
      console.error("Axios Error Details:", {
        message: error.message,
        code: error.code,
        url: error.config?.url,
        status: error.response?.status,
      });
    }

    if (error.response) {
      const { status, data } = error.response;

      // Token expiré : rafraîchir silencieusement et réessayer
      if (status === 401 && !originalRequest._retry && typeof window !== "undefined") {
        originalRequest._retry = true;

        if (isRefreshing) {
          // Un refresh est déjà en cours, mettre en file d'attente
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject, config: originalRequest });
          });
        }

        isRefreshing = true;

        try {
          // Appeler le endpoint session de next-auth qui :
          // 1. Déclenche le jwt callback côté serveur (rafraîchit le token si expiré)
          // 2. Met à jour le cookie de session avec le nouveau JWT
          // 3. Retourne la session fraîche avec le nouveau accessToken
          const refreshResponse = await fetch("/api/auth/session", {
            method: "GET",
            credentials: "include",
          });

          if (refreshResponse.ok) {
            const freshSession = await refreshResponse.json();
            if (freshSession?.accessToken) {
              originalRequest.headers.Authorization = `Bearer ${freshSession.accessToken}`;
              // Notifier SessionMonitor pour mettre à jour useSession() côté client
              window.dispatchEvent(new Event("session-token-refreshed"));
              processQueue(null);
              return axiosInstance(originalRequest);
            }
          }

          // Pas de token valide après refresh
          processQueue(new Error("Session expirée"));
          window.dispatchEvent(new Event("session-token-refreshed"));
          return Promise.reject(new Error("Session expirée"));
        } catch (refreshError) {
          processQueue(refreshError);
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // Formater le message d'erreur
      const errorMessage = (data as any)?.detail ||
        (data as any)?.message ||
        "Une erreur est survenue";

      return Promise.reject(new Error(errorMessage));
    } else if (error.request) {
      // La requête a été faite mais pas de réponse
      return Promise.reject(new Error("Impossible de contacter le serveur. Vérifiez que le backend est démarré."));
    } else {
      // Erreur lors de la configuration de la requête
      return Promise.reject(error);
    }
  }
);

export default axiosInstance;

// Helper pour les appels API
export const api = {
  get: <T = any>(url: string, config = {}) =>
    axiosInstance.get<T>(url, config).then(res => res.data),

  post: <T = any>(url: string, data?: any, config = {}) =>
    axiosInstance.post<T>(url, data, config).then(res => res.data),

  put: <T = any>(url: string, data?: any, config = {}) =>
    axiosInstance.put<T>(url, data, config).then(res => res.data),

  patch: <T = any>(url: string, data?: any, config = {}) =>
    axiosInstance.patch<T>(url, data, config).then(res => res.data),

  delete: <T = any>(url: string, config = {}) =>
    axiosInstance.delete<T>(url, config).then(res => res.data),
};
