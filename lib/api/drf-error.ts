/**
 * Normalise les erreurs DRF (detail string | liste | objet avec message/code).
 */

export function parseDrfDetail(detail: unknown, fallback = "Erreur de validation"): string {
  if (detail == null) return fallback;
  if (typeof detail === "string" && detail.trim()) return detail.trim();

  if (Array.isArray(detail)) {
    const parts: string[] = [];
    for (const item of detail) {
      if (typeof item === "string" && item.trim()) {
        parts.push(item.trim());
      } else if (item && typeof item === "object" && "message" in item) {
        const m = (item as { message?: unknown }).message;
        if (typeof m === "string" && m.trim()) parts.push(m.trim());
      }
    }
    return parts.length > 0 ? parts.join(" ") : fallback;
  }

  if (typeof detail === "object" && detail !== null) {
    const o = detail as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
    if (typeof o.detail === "string" && o.detail.trim()) return o.detail.trim();
  }

  return fallback;
}

function parseBodyField(data: Record<string, unknown>, key: string, fallback: string): string {
  const v = data[key];
  return parseDrfDetail(v, fallback);
}

/**
 * Extrait un message lisible depuis error.response.data (Axios) ou un corps JSON d’erreur.
 */
export function formatApiErrorBody(
  data: Record<string, unknown> | undefined | null,
  fallback: string
): string {
  if (!data || typeof data !== "object") return fallback;

  const d = parseDrfDetail(data.detail, "");
  if (d) return d;

  const err = parseDrfDetail(data.error, "");
  if (err) return err;

  if (typeof data.message === "string" && data.message.trim()) return data.message.trim();

  return fallback;
}

/**
 * Message utilisateur depuis une erreur Axios (réponse JSON DRF).
 */
export function formatAxiosErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: unknown }; message?: string };
  const data = err?.response?.data;
  if (data && typeof data === "object") {
    return formatApiErrorBody(data as Record<string, unknown>, fallback);
  }
  if (typeof err?.message === "string" && err.message.trim()) return err.message.trim();
  return fallback;
}

export function getSubscriptionErrorCode(data: Record<string, unknown> | undefined | null): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const detail = data.detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail) && "code" in detail) {
    const c = (detail as { code?: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}
