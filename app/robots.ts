import type { MetadataRoute } from "next";

import { URL_SITE } from "@/lib/seo/site";

/**
 * `/robots.txt` n'existait pas : Next rendait sa page 404, soit treize
 * kilooctets de HTML en `text/html` là où un robot attend du `text/plain`.
 *
 * ⚠ LES PAGES D'AUTHENTIFICATION NE SONT PAS INTERDITES, ET C'EST DÉLIBÉRÉ.
 * Elles portent déjà `noindex` par le layout racine. Interdire leur parcours
 * empêcherait Google de LIRE ce `noindex` : une URL interdite peut rester
 * indexée sans extrait, sur la foi d'un simple lien, ce qui est pire que
 * parcourue puis exclue.
 *
 * Ce qui est interdit ici l'est pour économiser le budget de parcours sur des
 * chemins qui ne rendront jamais rien d'utile à un robot : derrière ceux-là, il
 * n'obtient qu'une redirection vers la page de connexion.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/admin/",
          "/payment/",
          "/onboarding",
          // Le tunnel Sentry, monté en production seulement (next.config.ts).
          "/monitoring",
        ],
      },
    ],
    sitemap: `${URL_SITE}/sitemap.xml`,
    host: URL_SITE,
  };
}
