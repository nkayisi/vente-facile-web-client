import { EntetePage } from "@/components/marketing/entete-page";
import { Reveal } from "@/components/marketing/reveal";
import {
  DocumentLegal,
  SectionsTexte,
} from "@/components/marketing/sections-texte";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { DonneesStructurees } from "@/components/seo/donnees-structurees";
import { CONFIDENTIALITE as P } from "@/lib/marketing/pages-contenu";
import { etatEntete } from "@/lib/marketing/session-entete";
import { ENTREPRISE, lienTelephone } from "@/lib/seo/entreprise";
import { metadonneesDePage } from "@/lib/seo/metadonnees";
import { schemaFilAriane } from "@/lib/seo/schema";

const CHEMIN = "/politique-de-confidentialite";

export const metadata = metadonneesDePage(CHEMIN);

/**
 * ⚠ CETTE PAGE DÉCRIT CE QUE LE LOGICIEL FAIT, PAS CE QU'IL SERAIT CONFORTABLE
 * D'ÉCRIRE. Trois affirmations ont été vérifiées dans le dépôt avant d'être
 * posées : le rapport d'incident passe par Sentry et il est ACTIF en production,
 * son enregistrement de session est à zéro, et le site ne pose que les cookies
 * d'authentification de next-auth. Une politique plus flatteuse serait fausse.
 */
export default async function PagePolitiqueConfidentialite() {
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

        <DocumentLegal majLe={P.majLe}>
          <SectionsTexte sections={P.sections} />

          {/* L'adresse de contact est RENDUE ICI plutôt qu'écrite dans le texte :
              une adresse recopiée dans une constante de prose finit par diverger
              de celle du reste du site. */}
          <Reveal as="section" className="mt-12 rounded-2xl border border-trait bg-paper-creux p-6 sm:p-7">
            <h2 className="t-h3 text-encre">Nous écrire</h2>
            <p className="t-body mt-3 text-encre-faible">
              Pour toute question ou demande relative à vos données :
            </p>
            <ul className="mt-4 space-y-1.5">
              <li>
                <a
                  href={`mailto:${ENTREPRISE.email}`}
                  className="t-data text-[0.9375rem] text-braise-texte underline underline-offset-4"
                >
                  {ENTREPRISE.email}
                </a>
              </li>
              <li>
                <a
                  href={lienTelephone()}
                  className="t-data text-[0.9375rem] text-braise-texte underline underline-offset-4"
                >
                  {ENTREPRISE.telephone}
                </a>
              </li>
            </ul>
          </Reveal>
        </DocumentLegal>

        <DonneesStructurees donnees={schemaFilAriane(CHEMIN)} />
      </main>

      <SiteFooter />
    </>
  );
}
