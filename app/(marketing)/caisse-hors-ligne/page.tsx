import { EntetePage } from "@/components/marketing/entete-page";
import { Reveal } from "@/components/marketing/reveal";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { DonneesStructurees } from "@/components/seo/donnees-structurees";
import { HORS_LIGNE as H } from "@/lib/marketing/pages-contenu";
import { etatEntete } from "@/lib/marketing/session-entete";
import { metadonneesDePage } from "@/lib/seo/metadonnees";
import { schemaFilAriane } from "@/lib/seo/schema";

const CHEMIN = "/caisse-hors-ligne";

export const metadata = metadonneesDePage(CHEMIN);

/**
 * La page qui porte le différenciateur du produit.
 *
 * C'est la seule revendication que personne d'autre ne peut copier sans l'avoir
 * construite, et c'est donc celle sur laquelle il vaut la peine de se classer.
 *
 * ⚠ ELLE NOMME SA LIMITE, et ce n'est pas une faiblesse de vente. La FAQ de
 * l'accueil le fait déjà : une page qui promettrait l'infaillible perdrait la
 * confiance d'un commerçant en une seconde, parce qu'il connaît le problème
 * mieux que nous.
 */
export default async function PageCaisseHorsLigne() {
  const entete = await etatEntete();

  return (
    <>
      <SiteHeader {...entete} />

      <main>
        <EntetePage
          chemin={CHEMIN}
          eyebrow={H.eyebrow}
          titre={H.titre}
          accroche={H.accroche}
        />

        {H.sections.map((section, index) => (
          <section
            key={section.titre}
            className={`px-5 py-16 sm:px-8 sm:py-20 ${
              index % 2 === 1 ? "bg-paper-creux" : ""
            }`}
          >
            <div className="mx-auto max-w-6xl">
              {/* Titre à gauche, prose à droite : une colonne de texte seule
                  laissait toute la moitié droite vide sur grand écran. C'est la
                  disposition de `TerminalBand`. */}
              <Reveal className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-16">
                <h2 className="t-h2 max-w-[20ch] text-encre">{section.titre}</h2>
                <div className="max-w-[58ch] space-y-4">
                  {section.corps.map((paragraphe) => (
                    <p key={paragraphe} className="t-body text-encre-faible">
                      {paragraphe}
                    </p>
                  ))}
                </div>
              </Reveal>
            </div>
          </section>
        ))}

        {/* La limite, sur la bande sombre : elle est MISE EN AVANT, pas reléguée
            en bas de page en petits caractères.

            ⚠ `bg-ink` et non `bg-encre`. Les deux existent, et la confusion est
            facile : `--encre` est la couleur du TEXTE sur papier (employée pour
            une pastille ou un interrupteur inversé), `--ink` est la SURFACE
            sombre, avec sa famille `ink-relief` et `trait-ink`. C'est celle
            qu'emploie `TerminalBand`, la seule autre bande sombre du site.

            ⚠ Le gris du corps est un littéral, comme chez elle. En introduire un
            autre donnerait deux gris différents sur deux bandes identiques. */}
        <section className="bg-ink px-5 py-20 text-paper sm:px-8 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="t-h2 max-w-[24ch] text-paper">{H.limiteTitre}</h2>
              <div className="mt-6 max-w-[62ch] space-y-4">
                {H.limite.map((paragraphe) => (
                  <p key={paragraphe} className="t-body text-[#b8ada3]">
                    {paragraphe}
                  </p>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="t-h2 text-encre">{H.materielTitre}</h2>
            </Reveal>
            <ul className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-trait bg-trait md:grid-cols-3">
              {H.materiel.map((item) => (
                <Reveal as="li" key={item.label} className="bg-paper">
                  <div className="flex h-full flex-col p-6 sm:p-7">
                    <h3 className="t-h3 text-encre">{item.label}</h3>
                    <p className="t-body mt-3 text-encre-faible">{item.corps}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        <DonneesStructurees donnees={schemaFilAriane(CHEMIN)} />
      </main>

      <SiteFooter />
    </>
  );
}
