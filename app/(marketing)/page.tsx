import { Suspense } from "react";

import { getPublicPlans } from "@/actions/subscription.actions";
import { CapabilityGrid } from "@/components/marketing/capability-grid";
import { CurrencyBand } from "@/components/marketing/currency-band";
import { Faq } from "@/components/marketing/faq";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PackagingBand } from "@/components/marketing/packaging-band";
import { ProductShot } from "@/components/marketing/product-shot";
import { Pricing } from "@/components/marketing/pricing";
import { PricingSkeleton } from "@/components/marketing/pricing-skeleton";
import { Recognitions } from "@/components/marketing/recognitions";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { TerminalBand } from "@/components/marketing/terminal-band";
import { auth } from "@/lib/auth";

/**
 * COMPOSANT SERVEUR.
 *
 * L'ancienne page était un seul `"use client"` de 872 lignes : tout partait au
 * navigateur, et les tarifs étaient chargés en `useEffect` APRÈS montage, donc
 * en cascade derrière l'hydratation. Ici, seules quatre îles sont clientes
 * (en-tête, démo, tarifs, questions) : le reste est du HTML.
 *
 * La session est résolue ICI, par `auth()`. L'en-tête ne clignote plus de
 * « Connexion » vers « Mon compte » au premier rendu.
 */
export default async function LandingPage() {
  const session = await auth();
  const isAuthenticated = Boolean(session?.user);
  const isStaff = Boolean(session?.isStaff);

  return (
    <>
      <SiteHeader isAuthenticated={isAuthenticated} isStaff={isStaff} />

      <main>
        <Hero />
        {/* La capture suit le hero : la démo dit ce que ça FAIT, la capture ce
            à quoi ça RESSEMBLE. Les deux preuves, dans cet ordre. */}
        <ProductShot />
        <Recognitions />
        <PackagingBand />
        <CurrencyBand />
        <CapabilityGrid />
        <TerminalBand />
        {/* Le chemin d'entrée AVANT le prix : on explique ce qu'il faut faire,
            puis ce que ça coûte. */}
        <HowItWorks />

        {/* Sans cette frontière, tout le hero attendrait la réponse du backend
            pour s'afficher. La section tarifs est la SEULE qui en dépend. */}
        <Suspense fallback={<PricingSkeleton />}>
          <SectionTarifs isAuthenticated={isAuthenticated} />
        </Suspense>

        <Faq />
      </main>

      <SiteFooter />
    </>
  );
}

async function SectionTarifs({ isAuthenticated }: { isAuthenticated: boolean }) {
  const reponse = await getPublicPlans();
  // `getPublicPlans` rattrape ses propres erreurs et rend `success: false` :
  // un backend arrêté donne une section vide qui parle, jamais une page cassée.
  const plans =
    reponse.success && reponse.data
      ? [...reponse.data].sort((a, b) => a.sort_order - b.sort_order)
      : [];

  return <Pricing plans={plans} isAuthenticated={isAuthenticated} />;
}
