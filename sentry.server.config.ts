// Configuration Sentry côté serveur (runtime Node.js).
// Chargée par instrumentation.ts. No-op si NEXT_PUBLIC_SENTRY_DSN absent :
// tant qu'aucun DSN n'est configuré, Sentry reste totalement désactivé.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV,
  // Échantillonnage des traces : 100 % en dev, 10 % en prod (ajuster selon le trafic).
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
