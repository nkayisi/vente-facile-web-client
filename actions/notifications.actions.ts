"use server";

/**
 * Notifications reçues, et alertes du périmètre.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA CLOCHE DE L'EN-TÊTE ÉTAIT COMMENTÉE.                                 │
 * │                                                                          │
 * │ Écrite, puis mise entre commentaires, parce qu'il n'y avait rien à       │
 * │ montrer : `apps/notifications` portait cinq modèles et aucune vue. Six   │
 * │ familles d'alertes se créaient sur le serveur sans prévenir personne.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import { formatAxiosErrorMessage, getErrorBody } from "@/lib/api/drf-error";
import axios from "@/lib/auth/api-helper";

const API_BASE_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8005/api/v1";

function getHeaders(accessToken: string, organizationId: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "X-Organization-ID": organizationId,
  };
}

export type NotificationType = "info" | "success" | "warning" | "error" | "alert";

export interface AppNotification {
  id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  action_url: string;
  action_label: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  data: Record<string, unknown> | null;
}

export interface Alert {
  id: string;
  alert_type: string;
  alert_type_display: string;
  severity: "low" | "medium" | "high" | "critical";
  severity_display: string;
  status: "active" | "acknowledged" | "resolved" | "dismissed";
  title: string;
  message: string;
  resource_type: string;
  resource_id: string | null;
  data: Record<string, unknown> | null;
  acknowledged_by_name?: string;
  acknowledged_at: string | null;
  created_at: string;
}

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface Resultat<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export async function getNotifications(
  accessToken: string,
  organizationId: string,
  filtres?: { is_read?: boolean; page?: number; page_size?: number }
): Promise<Resultat<Paginated<AppNotification>>> {
  try {
    const params = new URLSearchParams();
    if (filtres?.is_read !== undefined) {
      params.set("is_read", String(filtres.is_read));
    }
    params.set("page", String(filtres?.page ?? 1));
    params.set("page_size", String(filtres?.page_size ?? 20));

    const response = await axios.get(
      `${API_BASE_URL}/notifications/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[notifications] Get error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des notifications" };
  }
}

/**
 * Le décompte de la pastille. Une requête, un nombre.
 *
 * ⚠ IL NE REND JAMAIS ZÉRO SUR UNE PANNE. Le compteur est rendu `null` quand
 * l'appel échoue : l'appelant garde alors le dernier chiffre connu plutôt que
 * d'afficher « rien à lire », ce qui est le contraire de « je n'ai pas pu
 * regarder ».
 */
export async function getUnreadCount(
  accessToken: string,
  organizationId: string
): Promise<number | null> {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/notifications/unread-count/`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return Number(response.data?.count ?? 0);
  } catch {
    return null;
  }
}

export async function markNotificationRead(
  accessToken: string,
  organizationId: string,
  id: string
): Promise<Resultat<AppNotification>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/notifications/${id}/mark-read/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "La notification n'a pas pu être marquée comme lue"),
    };
  }
}

export async function markAllNotificationsRead(
  accessToken: string,
  organizationId: string
): Promise<Resultat<{ updated: number }>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/notifications/mark-all-read/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "Les notifications n'ont pas pu être marquées comme lues"),
    };
  }
}

export async function getAlerts(
  accessToken: string,
  organizationId: string,
  filtres?: { status?: string; severity?: string; alert_type?: string; page?: number }
): Promise<Resultat<Paginated<Alert>>> {
  try {
    const params = new URLSearchParams();
    if (filtres?.status) params.set("status", filtres.status);
    if (filtres?.severity) params.set("severity", filtres.severity);
    if (filtres?.alert_type) params.set("alert_type", filtres.alert_type);
    params.set("page", String(filtres?.page ?? 1));
    params.set("page_size", "20");

    const response = await axios.get(
      `${API_BASE_URL}/alerts/?${params.toString()}`,
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    console.error("[notifications] Get alerts error:", getErrorBody(error) || (error as Error)?.message);
    return { success: false, message: "Erreur lors de la récupération des alertes" };
  }
}

/**
 * « J'ai vu. »
 *
 * ⚠ CE N'EST PAS « C'EST RÉGLÉ » : le fait est toujours là. Résoudre une alerte
 * à la main n'existe pas, et le serveur le refuse (`DENY`) - elle se résout
 * quand le rayon se remplit ou que la facture se règle, et c'est la tâche
 * périodique qui le constate. Un bouton « Résolu » laisserait croire au
 * marchand qu'il a traité ce qu'il a seulement masqué.
 */
export async function acknowledgeAlert(
  accessToken: string,
  organizationId: string,
  id: string
): Promise<Resultat<Alert>> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/alerts/${id}/acknowledge/`,
      {},
      { headers: getHeaders(accessToken, organizationId) }
    );
    return { success: true, data: response.data };
  } catch (error: unknown) {
    return {
      success: false,
      message: formatAxiosErrorMessage(error, "L'alerte n'a pas pu être marquée comme vue"),
    };
  }
}
