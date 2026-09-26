import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { ToasterProvider } from "@/providers/toaster-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { URL_SITE } from "@/lib/seo/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Vente Facile",
    template: "%s | Vente Facile",
  },
  description: "Système SaaS multi-tenant de gestion commerciale (POS) pour la RDC",
  keywords: ["POS", "gestion commerciale", "RDC", "Congo", "vente", "stock", "facturation"],
  authors: [{ name: "Vente Facile" }],
  creator: "Vente Facile",
  publisher: "Vente Facile",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  /**
   * ⚠ Plus de repli écrit ici. `URL_SITE` lève en production si
   * `NEXT_PUBLIC_APP_URL` manque, au lieu de publier des canonicals vers
   * localhost sur toutes les pages à la fois, en silence.
   */
  metadataBase: new URL(URL_SITE),
  openGraph: {
    type: "website",
    // La cible est la RDC, pas la France. Le groupe marketing déclarait déjà
    // `fr_CD` : les deux divergeaient, et la racine avait tort.
    locale: "fr_CD",
    // Pas d'`url` ici : chaque page publique déclare la sienne par
    // `metadonneesDePage()`. Une `url: "/"` héritée ferait dire à une page du
    // tableau de bord qu'elle EST la page d'accueil.
    siteName: "Vente Facile",
    title: "Vente Facile",
    description: "Système SaaS multi-tenant de gestion commerciale (POS) pour la RDC",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vente Facile",
    description: "Système SaaS multi-tenant de gestion commerciale (POS) pour la RDC",
  },
  /**
   * Prêt, et INERTE tant que la variable est absente : aucune balise n'est
   * rendue. C'est la doctrine Sentry du dépôt, « sans DSN rien ne s'initialise,
   * et ce n'est pas une erreur ». Le jour où un compte Search Console existe,
   * il n'y a qu'une variable d'environnement à poser.
   */
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Les deux valeurs de `--background` de globals.css. Teinte la barre du
  // navigateur ; sans elle, Android la rend en blanc quel que soit le thème.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f11" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
        >
          <AuthProvider>
            <QueryProvider>
              {children}
              <ToasterProvider />
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
