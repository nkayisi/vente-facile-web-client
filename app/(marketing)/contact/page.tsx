import {
  ArrowUpRight,
  Facebook,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Youtube,
  type LucideIcon,
} from "lucide-react";

import { EntetePage } from "@/components/marketing/entete-page";
import { Reveal } from "@/components/marketing/reveal";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { DonneesStructurees } from "@/components/seo/donnees-structurees";
import { CONTACT as C } from "@/lib/marketing/pages-contenu";
import { etatEntete } from "@/lib/marketing/session-entete";
import {
  ENTREPRISE,
  lienTelephone,
  lienWhatsApp,
} from "@/lib/seo/entreprise";
import { metadonneesDePage } from "@/lib/seo/metadonnees";
import { schemaFilAriane } from "@/lib/seo/schema";

/**
 * ⚠ `Globe` EST UN REPLI, PAS UNE DÉCORATION. Un réseau ajouté dans
 * `lib/seo/entreprise.ts` sans entrée ici rendrait sinon une case vide à la
 * place de son icône, et une rangée bancale se lit comme un défaut de
 * chargement. Le repli garde la rangée droite en attendant son glyphe.
 */
const GLYPHES_RESEAU: Record<string, LucideIcon> = {
  YouTube: Youtube,
  Facebook: Facebook,
};

const CHEMIN = "/contact";

export const metadata = metadonneesDePage(CHEMIN);

/**
 * ⚠ LE TÉLÉPHONE EN PREMIER, ET C'EST UN CHOIX DE TERRAIN. En RDC, un commerçant
 * appelle ou écrit sur WhatsApp ; un formulaire de contact avec un délai de
 * réponse implicite ne correspond pas à la manière dont ce marché travaille.
 * C'est aussi pourquoi cette page n'a PAS de formulaire : il faudrait une boîte
 * de réception qu'on relève, et une promesse de réponse qu'on tient.
 */
export default async function PageContact() {
  const entete = await etatEntete();
  const { adresse } = ENTREPRISE;

  const moyens = [
    {
      Glyphe: Phone,
      label: "Téléphone",
      valeur: ENTREPRISE.telephone,
      href: lienTelephone(),
    },
    {
      Glyphe: MessageCircle,
      label: "WhatsApp",
      valeur: ENTREPRISE.telephone,
      href: lienWhatsApp(),
    },
    {
      Glyphe: Mail,
      label: "Courriel",
      valeur: ENTREPRISE.email,
      href: `mailto:${ENTREPRISE.email}`,
    },
  ];

  return (
    <>
      <SiteHeader {...entete} />

      <main>
        <EntetePage
          chemin={CHEMIN}
          eyebrow={C.eyebrow}
          titre={C.titre}
          accroche={C.accroche}
        />

        <section className="px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-trait bg-trait md:grid-cols-3">
              {moyens.map(({ Glyphe, label, valeur, href }) => (
                <Reveal as="li" key={label} className="bg-paper">
                  <a
                    href={href}
                    className="flex h-full flex-col p-6 transition-colors hover:bg-paper-creux sm:p-7"
                  >
                    <span
                      className="flex size-10 items-center justify-center rounded-xl bg-braise-voile text-braise-texte"
                      aria-hidden
                    >
                      <Glyphe className="size-5" strokeWidth={1.75} />
                    </span>
                    <span className="t-eyebrow mt-4 text-[0.6875rem] text-encre">
                      {label}
                    </span>
                    {/* `t-data` : un numéro et une adresse électronique sont des
                        DONNÉES, et le mono les rend recopiables sans erreur. */}
                    <span className="t-data mt-2 break-all text-[0.9375rem] text-braise-texte">
                      {valeur}
                    </span>
                  </a>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-paper-creux px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <h2 className="t-h2 text-encre">{C.adresseTitre}</h2>
              <address className="t-body mt-5 not-italic text-encre-faible">
                <span className="flex gap-3">
                  <MapPin
                    className="mt-1 size-4 shrink-0 text-braise-texte"
                    aria-hidden
                  />
                  <span>
                    {adresse.rue}
                    <br />
                    {adresse.quartier}
                    <br />
                    {adresse.commune}
                    <br />
                    {adresse.ville}, République Démocratique du Congo
                    {adresse.repere ? (
                      <>
                        <br />
                        <span className="text-encre-ombre">{adresse.repere}</span>
                      </>
                    ) : null}
                  </span>
                </span>
              </address>
              <p className="t-body mt-5 max-w-[44ch] text-encre-ombre">
                {C.adresseNote}
              </p>
            </Reveal>

            <Reveal>
              <h2 className="t-h2 text-encre">{C.reseauxTitre}</h2>
              <p className="t-body mt-4 max-w-[40ch] text-encre-ombre">
                {C.reseauxNote}
              </p>

              <ul className="mt-6 overflow-hidden rounded-2xl border border-trait bg-paper">
                {ENTREPRISE.reseaux.map((reseau) => {
                  const Glyphe = GLYPHES_RESEAU[reseau.reseau] ?? Globe;

                  const contenu = (
                    <>
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-braise-voile text-braise-texte"
                        aria-hidden
                      >
                        <Glyphe className="size-5" strokeWidth={1.75} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="t-eyebrow block text-[0.6875rem] text-encre-ombre">
                          {reseau.reseau}
                        </span>
                        <span className="mt-1 block truncate text-[0.9375rem] text-encre">
                          {reseau.compte}
                        </span>
                      </span>
                    </>
                  );

                  return (
                    <li
                      key={reseau.reseau}
                      className="border-b border-trait last:border-b-0"
                    >
                      {/* ⚠ Un compte dont on ne connaît pas l'URL reste une
                          RANGÉE, mais sans lien ni flèche : promettre une
                          destination qu'on n'a pas est pire que de ne rien
                          promettre. La mise en page, elle, ne bouge pas. */}
                      {reseau.url ? (
                        <a
                          href={reseau.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-4 p-4 transition-colors hover:bg-paper-creux sm:p-5"
                        >
                          {contenu}
                          <ArrowUpRight
                            className="size-4 shrink-0 text-encre-ombre transition-colors group-hover:text-braise-texte"
                            aria-hidden
                          />
                          <span className="sr-only">
                            (s&apos;ouvre dans un nouvel onglet)
                          </span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-4 p-4 sm:p-5">
                          {contenu}
                        </span>
                      )}
                    </li>
                  );
                })}
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
