import Link from "next/link";

import { PAGES_PUBLIQUES } from "@/lib/seo/pages-publiques";

/**
 * La 404 du site.
 *
 * Il n'y en avait aucune : Next servait sa page par défaut, sans mise en page,
 * sans navigation de retour, et sur un site dont l'accueil est la seule porte
 * d'entrée, cela veut dire que le visiteur s'arrête là.
 *
 * ⚠ ELLE HÉRITE DU `noindex` DU LAYOUT RACINE, et c'est ce qu'on veut : une
 * page d'erreur indexée occuperait un résultat de recherche pour rien.
 *
 * ⚠ Les jetons sont ceux de l'APPLICATION (`background`, `foreground`), pas
 * ceux du groupe marketing : cette page vit sous le layout racine, qui ne charge
 * ni Instrument Sans ni IBM Plex Mono. Employer `text-encre` ici donnerait une
 * couleur juste avec une police qui n'est pas celle du reste du site.
 */
export default function NotFound() {
  // L'accueil a son propre bouton ci-dessous : on ne le répète pas dans la liste.
  const destinations = PAGES_PUBLIQUES.filter((page) => page.chemin !== "/");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-20 text-foreground">
      <div className="w-full max-w-lg">
        <p className="font-mono text-sm tracking-widest text-muted-foreground">
          ERREUR 404
        </p>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Cette page n&apos;existe pas.
        </h1>

        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Le lien est peut-être périmé, ou l&apos;adresse comporte une faute de
          frappe. Voici ce qui existe.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex items-center rounded-xl bg-primary px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Retour à l&apos;accueil
        </Link>

        <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {destinations.map((page) => (
            <li key={page.chemin} className="bg-background">
              <Link
                href={page.chemin}
                className="block px-4 py-3 text-sm transition-colors hover:text-primary"
              >
                {page.libelle}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
