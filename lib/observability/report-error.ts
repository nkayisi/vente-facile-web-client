/**
 * Point d'entrée unique pour remonter les erreurs client (page blanche, crash de
 * rendu, échec de garde). Aujourd'hui : log console structuré + hook global
 * optionnel. Demain : brancher Sentry (`@sentry/nextjs`) en implémentant
 * `window.__vfReportError` ou en appelant directement `Sentry.captureException`
 * ici - le reste de l'app n'a rien à changer.
 *
 * Objectif : ne JAMAIS avaler une erreur silencieusement. Une page blanche non
 * remontée est un bug qu'on ne peut pas corriger.
 */

type ErrorContext = Record<string, unknown>;

interface GlobalWithReporter {
  __vfReportError?: (error: unknown, context?: ErrorContext) => void;
}

/**
 * Résume n'importe quelle valeur levée en une ligne lisible.
 *
 * Indispensable : un `Error` n'a aucune propriété énumérable, donc il devient
 * `{}` dès qu'il passe par une sérialisation (overlay Next, JSON.stringify,
 * transport d'un outil d'observabilité). Sans ce résumé, le log ne dit rien.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  if (typeof error === "string") return error;
  if (error === null || error === undefined) return String(error);
  if (typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
    try {
      return JSON.stringify(error);
    } catch {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error);
}

export function reportClientError(error: unknown, context: ErrorContext = {}): void {
  // Toujours logger - visible dans la console navigateur et remonté par la
  // plupart des outils d'observabilité (LogRocket, Datadog RUM, etc.).
  // Le résumé est dans la CHAÎNE (jamais avalé par une sérialisation) et
  // l'erreur brute est passée en argument distinct pour conserver la stack
  // cliquable dans les devtools.
  const boundary = typeof context.boundary === "string" ? context.boundary : "inconnu";
  // eslint-disable-next-line no-console
  console.error(
    `[VF] Erreur client capturée [${boundary}] ${describeError(error)}`,
    { context, error }
  );

  if (typeof window === "undefined") return;

  const hook = (window as unknown as GlobalWithReporter).__vfReportError;
  if (typeof hook === "function") {
    try {
      hook(error, context);
    } catch {
      // Ne jamais laisser le reporting casser l'app.
    }
  }
}
