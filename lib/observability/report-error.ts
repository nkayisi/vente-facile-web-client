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

export function reportClientError(error: unknown, context: ErrorContext = {}): void {
  // Toujours logger - visible dans la console navigateur et remonté par la
  // plupart des outils d'observabilité (LogRocket, Datadog RUM, etc.).
  // eslint-disable-next-line no-console
  console.error("[VF] Erreur client capturée", { error, ...context });

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
