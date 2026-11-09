"use client";

/**
 * L'historique d'un client : ses mouvements, sa cagnotte, son rapport.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA FICHE PORTAIT DIX SECTIONS SUR UN SEUL ÉCRAN.                        │
 * │                                                                          │
 * │ Identité, quatre relevés, cagnotte, coordonnées, rapport par période,    │
 * │ grand livre, registre de cagnotte, factures ouvertes et dernières        │
 * │ ventes. Ce qu'on vient chercher devant un client - sa situation et ce    │
 * │ qu'il doit - était noyé sous trois lectures du PASSÉ, qu'on consulte     │
 * │ rarement et longuement. Elles vivent ici.                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ LES TROIS BLOCS CHARGENT LEURS PROPRES LIGNES. Cette page ne tire que ce
 * qui lui est propre : le nom du client pour son en-tête, et les devises de
 * l'établissement pour que chaque montant porte la sienne.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { CustomerLoyaltyHistoryCard } from "@/components/contacts/CustomerLoyaltyHistoryCard";
import { CustomerReportCard } from "@/components/contacts/CustomerReportCard";
import { CustomerTransactionsCard } from "@/components/contacts/CustomerTransactionsCard";
import { createMoneyHelpers } from "@/lib/currency";
import { getCustomer, type Customer } from "@/actions/contacts.actions";
import {
  getOrganizationCurrencies,
  type OrganizationCurrency,
} from "@/actions/settings.actions";

const ONGLETS = [
  { valeur: "mouvements", label: "Mouvements" },
  { valeur: "cagnotte", label: "Cagnotte" },
  { valeur: "rapport", label: "Rapport" },
] as const;

export default function CustomerHistoryPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const router = useRouter();
  const params = useParams();
  const { currency: defaultCurrency } = useCurrency();
  const customerId = params.id as string;
  const jeton = session?.accessToken;
  const orgId = organization?.id ?? "";

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [devises, setDevises] = useState<OrganizationCurrency[]>([]);
  const [charge, setCharge] = useState(true);

  /**
   * ⚠ UNE SEULE TABLE DE TAUX POUR TOUTE LA PAGE, construite ici et PASSÉE aux
   * enfants. En monter une seconde dans un bloc donnerait deux conversions du
   * même montant, et c'est la réserve déjà écrite dans `CustomerReportCard`.
   */
  const money = useMemo(
    () => createMoneyHelpers(devises, defaultCurrency),
    [devises, defaultCurrency]
  );

  useEffect(() => {
    if (!jeton || !organization) return;
    let vivant = true;
    (async () => {
      try {
        const [fiche, lesDevises] = await Promise.all([
          getCustomer(jeton, organization.id, customerId),
          getOrganizationCurrencies(jeton, organization.id),
        ]);
        if (!vivant) return;
        if (lesDevises.success && lesDevises.data) setDevises(lesDevises.data);
        if (fiche.success && fiche.data) {
          setCustomer(fiche.data);
        } else {
          router.push("/dashboard/contacts/customers");
        }
      } finally {
        if (vivant) setCharge(false);
      }
    })();
    return () => {
      vivant = false;
    };
  }, [jeton, organization, customerId, router]);

  if (charge) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!customer) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Ce client est introuvable.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/contacts/customers/${customerId}`}>
          <Button variant="ghost" size="icon" aria-label="Retour à la fiche">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-gray-900">
            Historique de {customer.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Ses mouvements de compte, sa cagnotte et ce qu&apos;il rapporte.
          </p>
        </div>
      </div>

      <Tabs defaultValue="mouvements" className="w-full">
        {/* ┌──────────────────────────────────────────────────────────────┐
            │ LA LISTE D'ONGLETS DÉFILE, ELLE NE SE REPLIE PAS.           │
            │                                                              │
            │ `w-max` est ce qui compte : sans lui, la liste se contraint  │
            │ à la largeur de son conteneur et le défilement n'a rien à    │
            │ faire défiler. C'est le motif de la page Rapports.           │
            └──────────────────────────────────────────────────────────────┘ */}
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="flex w-max gap-1">
            {ONGLETS.map((onglet) => (
              <TabsTrigger key={onglet.valeur} value={onglet.valeur}>
                {onglet.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="mouvements" className="mt-4">
          <CustomerTransactionsCard
            accessToken={jeton as string | undefined}
            organizationId={orgId}
            customerId={customerId}
            money={money}
            defaultCurrency={defaultCurrency.code}
          />
        </TabsContent>

        <TabsContent value="cagnotte" className="mt-4">
          <CustomerLoyaltyHistoryCard
            accessToken={jeton as string | undefined}
            organizationId={orgId}
            customerId={customerId}
          />
        </TabsContent>

        <TabsContent value="rapport" className="mt-4">
          <CustomerReportCard
            accessToken={jeton as string | undefined}
            organizationId={orgId}
            customerId={customerId}
            money={money}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
