import type { MetadataRoute } from "next";

import { PAGES_PUBLIQUES } from "@/lib/seo/pages-publiques";
import { urlAbsolue } from "@/lib/seo/site";

/**
 * Le plan de site, ENGENDRÉ depuis le registre des pages publiques.
 *
 * ⚠ Une boucle, jamais sept entrées recopiées : une URL écrite ici mais absente
 * du registre serait une URL déclarée à Google que le middleware rejetterait,
 * et une page ajoutée au registre sans l'être ici resterait introuvable.
 *
 * ⚠ `lastModified` reçoit la CHAÎNE du registre, jamais `new Date(chaîne)`.
 * La forme courte « AAAA-MM-JJ » est interprétée en UTC par JavaScript : sur un
 * fuseau en retard sur Greenwich, la date reculerait d'un jour. Le dépôt a déjà
 * payé ce piège (`dateDepuisJourISO`, côté terminal).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES_PUBLIQUES.map((page) => ({
    url: urlAbsolue(page.chemin),
    lastModified: page.misAJourLe,
    changeFrequency: page.frequence,
    priority: page.priorite,
  }));
}
