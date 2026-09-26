import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";

import { DonneesStructurees } from "@/components/seo/donnees-structurees";
import { schemaOrganisation, schemaSiteWeb } from "@/lib/seo/schema";

/**
 * Les deux faces d'affichage ne sont chargées QUE sur cette route : le tableau
 * de bord garde Inter seule et ne paie rien pour elles.
 *
 * Trois rôles, et la division est une règle :
 *   Instrument Sans → titres
 *   Inter (racine)  → corps
 *   IBM Plex Mono   → tout ce qui est une DONNÉE (montant, référence, quantité,
 *                     ticket). Le métier de ce produit est d'être exact sur des
 *                     nombres ; le mono le dit sans l'écrire.
 */
const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

/**
 * ⚠ CE LAYOUT NE PORTE QUE CE QUI EST COMMUN À TOUTES LES PAGES PUBLIQUES.
 *
 * Il portait jusqu'ici le titre, la description, `alternates.canonical: "/"` et
 * `openGraph.url: "/"` de la page d'accueil. Les métadonnées Next se FUSIONNENT
 * du layout vers la page : chaque page ajoutée dans ce groupe aurait donc hérité
 * du canonical de l'ACCUEIL, c'est-à-dire aurait déclaré à Google « je suis un
 * doublon, ne m'indexe pas ». Les pages auraient été écrites, déployées, et
 * jamais indexées, sans qu'aucune erreur ne le signale.
 *
 * Ce qui est propre à une page vit désormais dans cette page, par
 * `metadonneesDePage()` (voir `lib/seo/metadonnees.ts`).
 *
 * `robots` RESTE ici : le layout racine met toute l'application en `noindex`,
 * ce qui est juste pour un back-office. Ce groupe est la surface publique, et
 * c'est lui qui lève l'interdiction, pour toutes ses pages d'un coup.
 */
export const metadata: Metadata = {
  /**
   * ⚠ PAS d'`openGraph` ici, et ce n'est pas un oubli. Une page qui déclare son
   * `openGraph` REMPLACE celui de son layout au lieu de le compléter (mesuré :
   * les métadonnées se fusionnent par champ de premier niveau). Un objet posé
   * ici serait donc effacé par chaque page, et donnerait l'illusion d'une
   * valeur par défaut qui n'en est pas une. Tout vit dans `metadonneesDePage()`.
   */
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`vf-marketing ${instrument.variable} ${plexMono.variable}`}>
      {/* L'identité de l'éditeur, une fois pour toutes les pages publiques. */}
      <DonneesStructurees donnees={schemaOrganisation()} />
      <DonneesStructurees donnees={schemaSiteWeb()} />
      {children}
    </div>
  );
}
