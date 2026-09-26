import { QUESTIONS } from "@/lib/marketing/content";

import { ENTREPRISE } from "./entreprise";
import { pagePubliqueDe } from "./pages-publiques";
import { URL_SITE, urlAbsolue } from "./site";

/**
 * Les données structurées du site.
 *
 * ⚠ RIEN N'EST RECOPIÉ. La FAQ LIT `QUESTIONS.items` de `lib/marketing/content.ts`
 * et le fil d'Ariane lit le registre : un balisage qui recopierait ses textes
 * finirait par annoncer à Google une réponse que la page n'affiche plus, et
 * c'est précisément ce que Google sanctionne.
 *
 * ⚠ AUCUN `LocalBusiness`. Vente Facile édite un logiciel, ce n'est pas un
 * commerce où l'on entre. `Organization` avec son adresse dit la vérité ;
 * `LocalBusiness` revendiquerait une devanture et des horaires qui n'existent
 * pas. Pour apparaître dans le bloc local de Google, c'est une fiche
 * d'établissement qu'il faut, pas du balisage.
 */

const ID_ORGANISATION = `${URL_SITE}/#organisation`;
const ID_SITE = `${URL_SITE}/#site`;

/** Retire les clés indéfinies : un champ vide vaut mieux qu'un champ faux. */
function sansVide<T extends Record<string, unknown>>(objet: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(objet).filter(([, valeur]) => valeur !== undefined),
  ) as Partial<T>;
}

export function schemaOrganisation() {
  const { adresse, reseaux, telephone, email } = ENTREPRISE;

  return sansVide({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ID_ORGANISATION,
    name: ENTREPRISE.nom,
    url: URL_SITE,
    logo: `${URL_SITE}/logo.png`,
    description:
      "Éditeur de Vente Facile, un logiciel de caisse, de gestion de stock et " +
      "de crédit client pour les commerces de la République Démocratique du Congo.",

    /**
     * ⚠ SEULS LES PROFILS DONT ON CONNAÎT L'URL. `sameAs` est une liste d'URL,
     * pas de noms : y glisser un objet ou un libellé donne un balisage que
     * Google écarte en entier, sans que rien ne le signale. Un profil dont on
     * n'a que le nom s'affiche sur /contact et n'entre pas ici.
     *
     * Absent tant qu'aucune URL n'est connue : un tableau vide annoncerait une
     * entreprise sans présence, ce qui n'est pas la même chose qu'une entreprise
     * dont on n'a pas encore listé les profils.
     */
    sameAs: (() => {
      const urls = reseaux.map((r) => r.url).filter((url): url is string => Boolean(url));
      return urls.length > 0 ? urls : undefined;
    })(),

    address: sansVide({
      "@type": "PostalAddress",
      streetAddress: [adresse.rue, adresse.quartier].filter(Boolean).join(", "),
      addressLocality: adresse.commune ?? adresse.ville,
      addressRegion: adresse.ville,
      addressCountry: adresse.pays,
    }),

    contactPoint: [
      sansVide({
        "@type": "ContactPoint",
        contactType: "customer support",
        telephone,
        email,
        availableLanguage: ["fr"],
      }),
    ],
  });
}

export function schemaSiteWeb() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": ID_SITE,
    url: URL_SITE,
    name: ENTREPRISE.nom,
    inLanguage: "fr-CD",
    publisher: { "@id": ID_ORGANISATION },
  };
}

export function schemaFaq() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: QUESTIONS.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.r },
    })),
  };
}

/**
 * Le fil d'Ariane d'une sous-page.
 *
 * ⚠ Jamais sur l'accueil : un fil qui ne porterait que sa propre page ne dit
 * rien, et Google le signale comme incomplet.
 */
export function schemaFilAriane(chemin: string) {
  const page = pagePubliqueDe(chemin);

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: URL_SITE },
      {
        "@type": "ListItem",
        position: 2,
        name: page.libelle,
        item: urlAbsolue(page.chemin),
      },
    ],
  };
}
