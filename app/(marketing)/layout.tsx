import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";

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

const TITRE = "Vente Facile · La caisse qui n'attend pas le réseau";
const DESCRIPTION =
  "Caisse, stock et crédit client pour les commerces de la RDC. Vendez en francs et en dollars, comptez en casiers et en bouteilles, imprimez le ticket même hors ligne.";

export const metadata: Metadata = {
  /**
   * ⚠ `absolute`, ET SURTOUT PAS UNE CHAÎNE NUE. Le layout racine déclare
   * `template: "%s | Vente Facile"`, et un `title` de chaîne dans un segment
   * ENFANT augmente le gabarit du parent : l'onglet et chaque résultat de
   * recherche sortaient « … qui n'attend pas le réseau | Vente Facile », la
   * marque deux fois en soixante-six caractères. C'est la seule page que
   * `robots.index` autorise à être indexée.
   */
  title: { absolute: TITRE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_CD",
    url: "/",
    siteName: "Vente Facile",
    title: TITRE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITRE, description: DESCRIPTION },
  /**
   * Le layout racine pose `index: false` sur toute l'application, ce qui est
   * juste pour un back-office. Cette page-ci est la seule page publique : elle
   * dit « Ouvrir un compte » et encaisse par Mobile Money derrière. On lève
   * l'interdiction ICI et nulle part ailleurs.
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
      {children}
    </div>
  );
}
