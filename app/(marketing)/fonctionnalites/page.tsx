import { Check } from "lucide-react";

import { GLYPHES } from "@/components/marketing/capability-grid";
import { EntetePage } from "@/components/marketing/entete-page";
import { Reveal } from "@/components/marketing/reveal";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { DonneesStructurees } from "@/components/seo/donnees-structurees";
import { CAPACITES } from "@/lib/marketing/content";
import { detailDuModule, FONCTIONNALITES as F } from "@/lib/marketing/pages-contenu";
import { etatEntete } from "@/lib/marketing/session-entete";
import { metadonneesDePage } from "@/lib/seo/metadonnees";
import { schemaFilAriane } from "@/lib/seo/schema";

const CHEMIN = "/fonctionnalites";

export const metadata = metadonneesDePage(CHEMIN);

/**
 * Les huit modules, développés.
 *
 * ⚠ ELLE NE RECOPIE PAS L'ACCUEIL, et c'est ce qui l'empêche de lui faire
 * concurrence. La grille de l'accueil donne un libellé, une phrase et trois
 * puces ; cette page reprend ces éléments, qui sont les mêmes données, et y
 * ajoute la PROSE que l'accueil n'a pas. Deux URL qui porteraient le même texte
 * se dilueraient l'une l'autre sur les mêmes requêtes.
 */
export default async function PageFonctionnalites() {
  const entete = await etatEntete();

  return (
    <>
      <SiteHeader {...entete} />

      <main>
        <EntetePage
          chemin={CHEMIN}
          eyebrow={F.eyebrow}
          titre={F.titre}
          accroche={F.accroche}
        />

        {CAPACITES.items.map((item, index) => {
          const Glyphe = GLYPHES[item.icone];
          const prose = detailDuModule(item.label);

          return (
            <section
              key={item.label}
              className={`px-5 py-14 sm:px-8 sm:py-16 ${
                index % 2 === 1 ? "bg-paper-creux" : ""
              }`}
            >
              <div className="mx-auto max-w-6xl">
                <Reveal>
                  <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
                    <div>
                      <span
                        className="flex size-10 items-center justify-center rounded-xl bg-braise-voile text-braise-texte"
                        aria-hidden
                      >
                        <Glyphe className="size-5" strokeWidth={1.75} />
                      </span>

                      <h2 className="t-h2 mt-5 text-encre">{item.label}</h2>
                      <p className="t-lead mt-3 max-w-[46ch] text-encre">
                        {item.ligne}
                      </p>

                      <div className="mt-6 max-w-[62ch] space-y-4">
                        {prose.map((paragraphe) => (
                          <p key={paragraphe} className="t-body text-encre-faible">
                            {paragraphe}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Les trois puces de l'accueil, en résumé lisible d'un coup
                        d'oeil à côté du texte. Ce sont les MÊMES données. */}
                    <ul className="space-y-3 self-start rounded-2xl border border-trait bg-paper p-6">
                      {item.details.map((detail) => (
                        <li
                          key={detail}
                          className="flex gap-2.5 text-[0.875rem] leading-snug text-encre-faible"
                        >
                          <Check
                            className="mt-0.5 size-3.5 shrink-0 text-braise-texte"
                            strokeWidth={2.5}
                            aria-hidden
                          />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              </div>
            </section>
          );
        })}

        <DonneesStructurees donnees={schemaFilAriane(CHEMIN)} />
      </main>

      <SiteFooter />
    </>
  );
}
