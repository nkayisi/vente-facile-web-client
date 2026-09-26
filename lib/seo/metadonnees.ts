import type { Metadata } from "next";

import { pagePubliqueDe } from "./pages-publiques";

const MARQUE = "Vente Facile";

/**
 * Les métadonnées d'une page publique, depuis son seul chemin.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE HELPER EXISTE POUR RENDRE LE CANONICAL IMPOSSIBLE À OUBLIER.          │
 * │                                                                          │
 * │ Le layout marketing déclarait `alternates: { canonical: "/" }`. Les       │
 * │ métadonnées Next se FUSIONNENT du layout vers la page : toute page        │
 * │ ajoutée dans ce groupe sans redéclarer son canonical héritait donc de     │
 * │ celui de l'accueil, c'est-à-dire annonçait à Google « je suis un doublon  │
 * │ de la page d'accueil, ne m'indexe pas ». Six pages auraient été écrites,  │
 * │ déployées, et jamais indexées, sans qu'aucune erreur ne le signale.      │
 * │                                                                          │
 * │ Un garde-fou qui VÉRIFIE la présence du champ serait plus faible qu'un    │
 * │ générateur qui le POSE toujours. `scripts/check-seo.mjs` contrôle donc    │
 * │ que chaque page passe par ici, et non que chaque page pense au canonical. │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Usage, une ligne par page :
 *
 *     export const metadata = metadonneesDePage("/tarifs");
 */
export function metadonneesDePage(chemin: string): Metadata {
  const page = pagePubliqueDe(chemin);

  /**
   * ⚠ `openGraph.title` NE PASSE PAS par le gabarit « %s | Vente Facile ».
   * Le gabarit ne s'applique qu'à `title` ; le layout racine pose un
   * `openGraph.title` de chaîne nue, sans gabarit. Un partage sortirait donc
   * « Tarifs et essai de quatorze jours » sans la marque, là où l'onglet la
   * porte. On le compose ici.
   */
  const titreSocial = page.titreAbsolu ? page.titre : `${page.titre} | ${MARQUE}`;

  return {
    title: page.titreAbsolu ? { absolute: page.titre } : page.titre,
    description: page.description,

    // Relatif : `metadataBase` du layout racine le rend absolu.
    alternates: { canonical: page.chemin },

    /**
     * ⚠ L'OBJET `openGraph` DOIT ÊTRE COMPLET ICI, `type`, `locale` et
     * `siteName` COMPRIS.
     *
     * MESURÉ, et contraire à l'intuition : les métadonnées Next se fusionnent
     * par champ de PREMIER NIVEAU, jamais en profondeur. Un `openGraph` déclaré
     * dans une page REMPLACE intégralement celui de son layout. Une première
     * version laissait `type`/`locale`/`siteName` au layout marketing : sur
     * l'accueil, les trois balises DISPARAISSAIENT du HTML servi, pendant que
     * /auth/login (qui ne déclare rien) les gardait. Le partage social perdait
     * le nom du site et la langue, en silence.
     */
    openGraph: {
      type: "website",
      // La cible est la RDC, pas la France.
      locale: "fr_CD",
      siteName: MARQUE,
      url: page.chemin,
      title: titreSocial,
      description: page.description,
    },

    twitter: {
      card: "summary_large_image",
      title: titreSocial,
      description: page.description,
    },
  };
}
