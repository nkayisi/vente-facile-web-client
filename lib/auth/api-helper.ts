import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
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

// Intercepteur de réponse : retry sur 401 avec token frais
serverAxios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const freshToken = await getServerAccessToken();
      if (freshToken) {
        originalRequest.headers.Authorization = `Bearer ${freshToken}`;
        return serverAxios(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

export default serverAxios;
