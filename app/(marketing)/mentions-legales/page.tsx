import { EntetePage } from "@/components/marketing/entete-page";
import { Reveal } from "@/components/marketing/reveal";
import {
  DocumentLegal,
  SectionsTexte,
} from "@/components/marketing/sections-texte";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { DonneesStructurees } from "@/components/seo/donnees-structurees";
import { MENTIONS as M } from "@/lib/marketing/pages-contenu";
import { etatEntete } from "@/lib/marketing/session-entete";
import { adresseEnLigne, ENTREPRISE } from "@/lib/seo/entreprise";
import { metadonneesDePage } from "@/lib/seo/metadonnees";
import { schemaFilAriane } from "@/lib/seo/schema";

const CHEMIN = "/mentions-legales";

export const metadata = metadonneesDePage(CHEMIN);

/**
 * ⚠ LES IDENTIFIANTS ABSENTS NE S'AFFICHENT PAS. Forme juridique, RCCM, ID Nat
 * et NIF ne sont pas renseignés dans `lib/seo/entreprise.ts` : leurs lignes
 * disparaissent, elles ne sortent pas en « à compléter ». Les inventer sur la
 * page dont l'objet est d'identifier l'éditeur serait une fausse déclaration.
 * Les renseigner dans ce fichier les fait apparaître, sans toucher ici.
 */
export default async function PageMentionsLegales() {
  const entete = await etatEntete();

  const identite = [
    { label: "Éditeur", valeur: ENTREPRISE.editeur },
    { label: "Forme juridique", valeur: ENTREPRISE.forme },
    { label: "RCCM", valeur: ENTREPRISE.rccm },
    { label: "Identification nationale", valeur: ENTREPRISE.idNat },
    { label: "Numéro impôt", valeur: ENTREPRISE.nif },
    { label: "Siège", valeur: adresseEnLigne() },
    { label: "Téléphone", valeur: ENTREPRISE.telephone },
    { label: "Courriel", valeur: ENTREPRISE.email },
  ].filter((ligne): ligne is { label: string; valeur: string } =>
    Boolean(ligne.valeur),
  );

  return (
    <>
      <SiteHeader {...entete} />

      <main>
        <EntetePage
          chemin={CHEMIN}
          eyebrow={M.eyebrow}
          titre={M.titre}
          accroche={M.accroche}
        />

        <DocumentLegal majLe={M.majLe}>
          <Reveal as="section">
            <h2 className="t-h3 text-encre">{M.editeurTitre}</h2>
            <dl className="mt-5 overflow-hidden rounded-2xl border border-trait">
              {identite.map((ligne) => (
                <div
                  key={ligne.label}
                  className="flex flex-col gap-1 border-b border-trait px-5 py-3 last:border-b-0 sm:flex-row sm:gap-6"
                >
                  <dt className="t-eyebrow shrink-0 pt-0.5 text-[0.6875rem] text-encre-ombre sm:w-52">
                    {ligne.label}
                  </dt>
                  <dd className="t-body text-encre">{ligne.valeur}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          {ENTREPRISE.hebergeur ? (
            <Reveal as="section" className="mt-12">
              <h2 className="t-h3 text-encre">{M.hebergeurTitre}</h2>
              <p className="t-body mt-4 text-encre-faible">
                <span className="text-encre">{ENTREPRISE.hebergeur}</span>.{" "}
                {M.hebergeurNote}
              </p>
            </Reveal>
          ) : null}

          <div className="mt-12">
            <SectionsTexte sections={M.sections} />
          </div>
        </DocumentLegal>

        <DonneesStructurees donnees={schemaFilAriane(CHEMIN)} />
      </main>

      <SiteFooter />
    </>
  );
}
