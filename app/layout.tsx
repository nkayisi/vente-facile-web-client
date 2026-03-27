import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { ToasterProvider } from "@/providers/toaster-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "Vente Facile",
    title: "Vente Facile",
    description: "Système SaaS multi-tenant de gestion commerciale (POS) pour la RDC",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vente Facile",
    description: "Système SaaS multi-tenant de gestion commerciale (POS) pour la RDC",
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
