// Configuration Sentry côté navigateur (App Router).
// No-op si NEXT_PUBLIC_SENTRY_DSN absent : Sentry reste désactivé tant qu'aucun
// DSN n'est fourni, aucun risque en dev/prod non configuré.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Replay désactivé par défaut (coût/volume) ; activable plus tard si besoin.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

// Branche le hub d'observabilité maison sur Sentry.
// Tout appel à reportClientError(...) (gardes, ErrorBoundary, global-error)
// est ainsi remonté à Sentry avec son contexte, sans que ces modules dépendent
// directement de Sentry. Voir lib/observability/report-error.ts.
if (dsn && typeof window !== "undefined") {
  (window as unknown as {
    __vfReportError?: (error: unknown, context?: Record<string, unknown>) => void;
  }).__vfReportError = (error, context) => {
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: context });
    } else {
      Sentry.captureMessage(
        typeof error === "string" ? error : "Erreur client non-Error",
        { level: "error", extra: { ...context, rawError: error } }
      );
    }
  };
}

// Instrumentation des transitions de navigation App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
