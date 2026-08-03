import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Slugs org/projet Sentry, requis uniquement pour l'upload des source maps
  // en CI (avec SENTRY_AUTH_TOKEN). Pilotés par env pour ne rien coder en dur.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // N'affiche les logs d'upload de source maps qu'en CI.
  silent: !process.env.CI,

  // Masque les requêtes Sentry derrière une route de l'app pour contourner
  // les bloqueurs de pub (améliore le taux de capture côté navigateur).
  tunnelRoute: "/monitoring",
});
