// Point d'entrée d'instrumentation Next.js (App Router).
// Charge la config Sentry adaptée au runtime et expose onRequestError pour
// capturer les erreurs des Server Components, du middleware et des route handlers.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
