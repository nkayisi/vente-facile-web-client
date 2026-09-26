import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

import { HOTE_WWW, URL_SITE } from "./lib/seo/site";

const nextConfig: NextConfig = {
  /**
   * `www` vers l'apex, en 308 permanent.
   *
   * ┌──────────────────────────────────────────────────────────────────────────┐
   * │ MESURÉ : `vente-facile.net` ET `www.vente-facile.net` rendaient tous     │
   * │ deux un 200, sans redirection. La même page à deux adresses divise les   │
   * │ signaux de classement entre elles, et Google doit deviner laquelle       │
   * │ compte.                                                                  │
   * └──────────────────────────────────────────────────────────────────────────┘
   *
   * ⚠ Une redirection posée au niveau de l'HÉBERGEUR serait préférable, elle
   * économiserait un passage par Next. Celle-ci fonctionne quel que soit
   * l'hébergeur, et elle est vérifiable depuis le dépôt.
   *
   * ⚠ Pas de condition sur `NODE_ENV` : elle doit être active en production, et
   * elle est de toute façon inerte en développement, l'hôte ne correspondant
   * jamais.
   */
  async redirects() {
    return [
      {
        source: "/:chemin*",
        has: [{ type: "host", value: HOTE_WWW }],
        destination: `${URL_SITE}/:chemin*`,
        permanent: true,
      },
    ];
  },

  async headers() {
    const entetes = [
      // Empêche un navigateur de deviner un type de contenu autre que celui
      // qu'on déclare. Sans lui, un fichier servi en texte peut être exécuté.
      { key: "X-Content-Type-Options", value: "nosniff" },
    ];

    /**
     * ⚠ SANS `includeSubDomains`, ET C'EST DÉLIBÉRÉ. L'inclure engagerait
     * `backend.vente-facile.net` et tout sous-domaine à naître : un seul servi
     * en clair deviendrait injoignable, sans recours pendant un an, et le
     * navigateur ne dirait pas pourquoi.
     */
    if (process.env.NODE_ENV === "production") {
      entetes.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000",
      });
    }

    return [{ source: "/(.*)", headers: entetes }];
  },
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
