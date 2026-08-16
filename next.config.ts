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
  //
  // Uniquement en production : le tunnel fait relayer les envelopes par le
  // serveur Next, donc en dev c'est le conteneur Docker qui doit joindre
  // ingest.sentry.io. Sa résolution DNS échoue par intermittence (EAI_AGAIN)
  // et pollue les logs. Sans tunnel, c'est le navigateur qui parle à Sentry
  // directement : le conteneur sort du chemin.
  tunnelRoute: process.env.NODE_ENV === "production" ? "/monitoring" : undefined,
});
