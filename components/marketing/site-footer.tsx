import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { FINAL, PIED } from "@/lib/marketing/content";
import { Reveal } from "./reveal";

/**
 * Bande encre n° 3. La page finit en encre, comme un ticket finit par une
 * coupe : le rythme papier / encre / papier / encre se referme ici.
 *
 * TOUS les liens de ce pied mènent à une route qui existe. L'ancienne version
 * en portait treize dont NEUF renvoyaient un 404 : /contact, /docs, /help,
 * /blog, /api, /about, /integrations, /changelog, /privacy, /terms. Ne
 * réintroduire une entrée que le jour où sa page est écrite.
 */
export function SiteFooter() {
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal className="mx-auto max-w-[36rem] text-center">
          <h2 className="t-h2 text-paper">{FINAL.titre}</h2>
          <p className="t-lead mt-5 text-[#b8ada3]">{FINAL.accroche}</p>

          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/auth/register"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-braise px-7 text-[0.9375rem] font-medium text-white shadow-[0_8px_28px_-10px_rgba(234,88,12,0.75)] transition-[background-color,scale] duration-150 hover:bg-[#f2660f] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise-ink focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              {FINAL.cta}
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-12 items-center rounded-xl px-4 text-[0.9375rem] text-[#b8ada3] underline-offset-4 transition-colors duration-150 hover:text-paper hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise-ink"
            >
              {FINAL.dejaClient}
            </Link>
          </div>
        </Reveal>

        {/* ⚠ CINQ COLONNES, PAS QUATRE. Le bloc de marque en occupe DEUX
            (`lg:col-span-2`) : avec une grille de quatre, la troisième rubrique
            de liens passait à la ligne toute seule, sous un rang vide de trois
            colonnes. Cinq laisse 2 + 1 + 1 + 1, donc les quatre sections sur une
            seule ligne. Ajouter une rubrique demandera de repasser à six. */}
        <div className="mt-20 grid gap-10 border-t border-trait-ink pt-12 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            {/* ⚠ PAS DE LOGO ICI, ET C'EST UNE RÈGLE.
                Le fond derrière le logo doit TOUJOURS être celui de la page
                sur laquelle il se trouve : on ne lui pose jamais une plaque
                d'une autre couleur pour le rendre lisible.
                Or `logo.png` porte des formes bleu marine et un texte interne
                sombre : posé sur cette bande encre (#161311), il dessine une
                boîte d'un autre noir et son texte devient illisible. Le rendre
                lisible demanderait précisément la plaque claire que la règle
                interdit. Le pied porte donc la marque EN TYPOGRAPHIE, dans la
                face d'affichage de la page. Le logo reste sur le papier, dans
                l'en-tête, où il a été dessiné pour vivre. */}
            <span
              className="text-[1.0625rem] font-semibold tracking-tight text-paper"
              style={{ fontFamily: "var(--font-display-stack)" }}
            >
              Vente Facile
            </span>
            <p className="mt-4 max-w-[34ch] text-[0.875rem] leading-relaxed text-[#8a7f75]">
              {PIED.phrase}
            </p>
          </div>

          {PIED.colonnes.map((col) => (
            <nav key={col.titre} aria-label={col.titre}>
              <p className="t-eyebrow text-[0.6875rem] text-[#8a7f75]">{col.titre}</p>
              <ul className="mt-4 space-y-1">
                {col.liens.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="-mx-2 inline-flex min-h-9 items-center rounded-md px-2 text-[0.875rem] text-[#b8ada3] transition-colors duration-150 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-braise-ink"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-trait-ink pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="t-data text-[0.75rem] text-[#6d635a]">
            © {new Date().getFullYear()} Vente Facile
          </p>
          <p className="t-data text-[0.75rem] text-[#6d635a]">{PIED.mention}</p>
        </div>
      </div>
    </footer>
  );
}
