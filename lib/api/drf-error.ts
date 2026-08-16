/**
 * Normalise les erreurs DRF (detail string | liste | objet avec message/code).
 */

/**
 * Body JSON d'une erreur DRF.
 *
 * - ``detail`` : string standard DRF (ex. "Not found") ou objet pour
 *   ``ValidationError`` non-field (ex. ``{code: "...", message: "..."}``).
 * - ``error``, ``message`` : conventions custom du backend.
 * - Reste des champs : erreurs par champ (``{email: ["msg"]}``) ou structures
 *   imbriquées. Typé en ``any`` pour rester pratique côté caller (les
 *   conventions DRF varient selon l'endpoint, et un typage strict imposerait
 *   un cast à chaque accès). C'est le SEUL ``any`` accepté dans le projet :
 *   il est centralisé ici plutôt que dispersé dans 200+ ``catch (error: any)``.
 */
export interface DrfErrorBody {
  // ``detail`` peut être string DRF standard, objet (``ValidationError``
  // non-field avec code/message), ou tableau de strings (validation par
  // field). Typage volontairement permissif pour éviter un cast à chaque
  // caller - le format précis dépend de l'endpoint backend.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detail?: any;
  error?: string;
  message?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Extrait le body JSON d'une erreur Axios sans ``any`` côté caller.
 *
 * Pattern à privilégier dans les ``catch (error: unknown)`` de server
 * actions :
 *
 *   catch (error: unknown) {
 *     const body = getErrorBody(error);
 *     return { success: false, message: formatAxiosErrorMessage(error, "..."), errors: body };
 *   }
 *
 * Retourne ``undefined`` si l'erreur n'a pas la forme d'une réponse Axios
 * (par ex. erreur réseau, timeout) - le caller doit alors retomber sur
 * ``formatAxiosErrorMessage`` pour un message générique.
 */
export function getErrorBody(error: unknown): DrfErrorBody | undefined {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object"
  ) {
    return error.response.data as DrfErrorBody;
  }
  return undefined;
}

/**
 * True si l'erreur ressemble à une erreur Axios (a une réponse HTTP).
 * Permet de discriminer une erreur réseau d'une erreur de logique applicative.
 */
export function isAxiosLikeError(
  error: unknown,
): error is { response: { status: number; data?: unknown }; message?: string } {
  return (
    !!error &&
    typeof error === "object" &&
    "response" in error &&
    !!(error as { response?: unknown }).response &&
    typeof (error as { response?: unknown }).response === "object" &&
    "status" in (error as { response: object }).response
  );
}

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
  const err = error as { response?: { data?: unknown; status?: number }; message?: string };
  const data = err?.response?.data;

  // Django DEBUG=True renvoie souvent une page HTML sur 500 - pas du JSON DRF.
  if (typeof data === "string") {
    const s = data.trim();
    if (s.startsWith("<!DOCTYPE") || s.startsWith("<html")) {
      const m = s.match(/<title>([^<]*)<\/title>/i);
      const title = m?.[1]?.trim();
      const status = err?.response?.status;
      const prefix =
        typeof status === "number" ? `Erreur HTTP ${status}` : "Erreur serveur";
      return title
        ? `${prefix} (${title}). Consultez les logs du service backend.`
        : `${prefix} (réponse HTML). Consultez les logs du service backend.`;
    }
    return s.length > 400 ? `${s.slice(0, 400)}…` : s;
  }

  if (data && typeof data === "object") {
    return formatApiErrorBody(data as Record<string, unknown>, fallback);
  }
  if (typeof err?.message === "string" && err.message.trim()) return err.message.trim();
  return fallback;
}

/**
 * Aplatit récursivement les erreurs DRF imbriquées en une liste de messages plats.
 *
 * Couvre les structures typiques :
 * - `{ detail: "..." }`                                                  → ["..."]
 * - `{ field: ["msg1", "msg2"] }`                                        → ["field: msg1", "field: msg2"]
 * - `{ items: [{ quantity: ["msg"] }, {}] }`                             → ["items[0].quantity: msg"]
 * - `{ payments: [{ amount: ["msg"] }] }`                                → ["payments[0].amount: msg"]
 * - `{ field: { sub: "msg" } }`                                          → ["field.sub: msg"]
 *
 * Renvoie un tableau vide si rien d'utile n'est trouvé.
 */
export function flattenDrfErrors(
  data: unknown,
  prefix = '',
): string[] {
  if (data == null) return [];

  if (typeof data === 'string') {
    const s = data.trim();
    return s ? [prefix ? `${prefix}: ${s}` : s] : [];
  }

  if (Array.isArray(data)) {
    const out: string[] = [];
    data.forEach((item, idx) => {
      const childPrefix = prefix ? `${prefix}[${idx}]` : `[${idx}]`;
      out.push(...flattenDrfErrors(item, childPrefix));
    });
    return out;
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const out: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      // `detail`, `message`, `error` sans préfixe en haut du payload.
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      out.push(...flattenDrfErrors(value, childPrefix));
    }
    return out;
  }

  // number, boolean → cast en string
  return [prefix ? `${prefix}: ${String(data)}` : String(data)];
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
