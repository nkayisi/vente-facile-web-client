import { Check } from "lucide-react";
import { Suspense } from "react";

import { EntetePage } from "@/components/marketing/entete-page";
import { PricingSkeleton } from "@/components/marketing/pricing-skeleton";
import { Reveal } from "@/components/marketing/reveal";
import { SectionTarifs } from "@/components/marketing/section-tarifs";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { DonneesStructurees } from "@/components/seo/donnees-structurees";
import { PAGE_TARIFS as P } from "@/lib/marketing/pages-contenu";
import { etatEntete } from "@/lib/marketing/session-entete";
import { metadonneesDePage } from "@/lib/seo/metadonnees";
import { schemaFilAriane } from "@/lib/seo/schema";

const CHEMIN = "/tarifs";

export const metadata = metadonneesDePage(CHEMIN);

/**
 * La page de prix.
 *
 * ⚠ AUCUN MONTANT N'EST ÉCRIT ICI. Les prix viennent du backend par
 * `getPublicPlans()` : les recopier dans le dépôt donnerait deux vérités, et
 * c'est la mauvaise qu'un commerçant lirait avant de payer.
 *
 * ⚠ Ce qui distingue cette page de la section `#tarifs` de l'accueil, c'est la
 * prose : ce qui est compté, et comment on paie. La grille, elle, est la MÊME,
 * et c'est normal : un composant partagé n'est pas du contenu dupliqué.
 */
export default async function PageTarifs() {
  const entete = await etatEntete();

  return (
    <>
      <SiteHeader {...entete} />

      <main>
        <EntetePage
          chemin={CHEMIN}
          eyebrow={P.eyebrow}
          titre={P.titre}
          accroche={P.accroche}
        />

        {/* Sans cette frontière, tout l'en-tête de la page attendrait la réponse
            du backend pour s'afficher. */}
        <Suspense fallback={<PricingSkeleton />}>
          <SectionTarifs isAuthenticated={entete.isAuthenticated} />
        </Suspense>

        <section className="bg-paper-creux px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <h2 className="t-h2 text-encre">{P.compteTitre}</h2>
              <p className="t-body mt-4 max-w-[46ch] text-encre-faible">
                {P.compteNote}
              </p>
              <ul className="mt-7 space-y-3">
                {P.compte.map((ligne) => (
                  <li
                    key={ligne}
                    className="flex gap-2.5 text-[0.9375rem] leading-snug text-encre-faible"
                  >
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-braise-texte"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    {ligne}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal>
              <h2 className="t-h2 text-encre">{P.paiementTitre}</h2>
              <div className="mt-4 max-w-[48ch] space-y-4">
                {P.paiement.map((paragraphe) => (
                  <p key={paragraphe} className="t-body text-encre-faible">
                    {paragraphe}
                  </p>
                ))}
              </div>

              <ul className="mt-7 flex flex-wrap gap-2">
                {P.operateurs.map((operateur) => (
                  <li
                    key={operateur}
                    className="t-data rounded-lg border border-trait bg-paper px-3 py-1.5 text-[0.8125rem] text-encre-faible"
                  >
                    {operateur}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        <DonneesStructurees donnees={schemaFilAriane(CHEMIN)} />
      </main>

      <SiteFooter />
    </>
  );
}
