import Link from "next/link";

import { pagePubliqueDe } from "@/lib/seo/pages-publiques";

/**
 * Le fil d'Ariane d'une sous-page.
 *
 * ⚠ Il double VOLONTAIREMENT le `BreadcrumbList` en JSON-LD. Google demande que
 * le balisage décrive quelque chose que la page AFFICHE : un fil déclaré mais
 * invisible est un balisage qu'il écarte, et parfois sanctionne.
 *
 * ⚠ Jamais sur l'accueil : un fil qui ne porterait que sa propre page ne dit
 * rien à personne.
 */
export function FilAriane({ chemin }: { chemin: string }) {
  const page = pagePubliqueDe(chemin);

  return (
    <nav aria-label="Fil d'Ariane" className="t-data text-[0.8125rem]">
      <ol className="flex flex-wrap items-center gap-x-2 text-encre-faible">
        <li>
          <Link href="/" className="transition-colors hover:text-braise-texte">
            Accueil
          </Link>
        </li>
        <li aria-hidden className="text-encre-ombre">
          /
        </li>
        {/* `aria-current` dit au lecteur d'écran que c'est la page courante :
            sans lui, le dernier maillon se lit comme un lien de plus. */}
        <li aria-current="page" className="text-encre">
          {page.libelle}
        </li>
      </ol>
    </nav>
  );
}
