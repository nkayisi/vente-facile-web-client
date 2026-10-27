"use client";

/**
 * Achats et fournisseurs (lot 13) : le concentrateur.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LE BACKEND ÉTAIT COMPLET, ET AUCUN ÉCRAN N'EXISTAIT NULLE PART.         │
 * │                                                                          │
 * │ Huit modèles, quatre ViewSets, leurs permissions au catalogue depuis     │
 * │ l'origine - et ni page web ni écran mobile. Le lot 13 était marqué       │
 * │ « conditionnel, à traiter si le besoin est confirmé » ; il l'est.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * **Deux registres, deux formes.** Les relevés vivent dans UN panneau à filets
 * (`StatStrip`), les destinations sont des tuiles qui réagissent au clic
 * (`ActionTile`). C'est la frontière posée sur « Gestion de stock », où neuf
 * boîtes identiques dont quatre seulement étaient cliquables ne se
 * distinguaient que par un trait de couleur.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ClipboardList,
  CreditCard,
  FileText,
  PackageCheck,
  Undo2,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ActionTile } from "@/components/shared/ActionTile";
import { StatStrip, StatStripItem } from "@/components/shared/StatStrip";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { usePermissions } from "@/components/auth/permissions-provider";
import {
  getPurchaseOrders,
  getPendingPurchaseOrders,
  getPurchaseReturns,
} from "@/actions/purchases.actions";
import { getOrganizationCurrencies } from "@/actions/settings.actions";
import type { OrganizationCurrency } from "@/actions/settings.actions";

export default function PurchasesHubPage() {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency: defaultCurrency } = useCurrency();
  const { hasPermission } = usePermissions();

  const [devises, setDevises] = useState<OrganizationCurrency[]>([]);
  const money = useMemo(
    () => createMoneyHelpers(devises, defaultCurrency),
    [devises, defaultCurrency]
  );

  const [releves, setReleves] = useState<{
    commandes: number;
    aReceptionner: number;
    retours: number;
    /**
     * Ce qui reste à payer, ou `null` quand plusieurs monnaies coexistent.
     *
     * ⚠ UN SENTINELLE À `-1` DISAIT « PLUSIEURS DEVISES » SUR UN ÉTABLISSEMENT
     * QUI N'A AUCUNE COMMANDE. `parDevise` est vide quand rien n'attend d'être
     * réceptionné - l'état de tout nouveau marchand - et `size === 1` étant
     * faux, le relevé retombait sur la sentinelle. `null` NOMME le seul cas
     * qu'il décrit ; zéro reste un montant, et c'est la doctrine du dépôt.
     */
    du: number | null;
  }>({
    commandes: 0,
    aReceptionner: 0,
    retours: 0,
    du: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const jeton = session?.accessToken;

  const charger = useCallback(async () => {
    if (!jeton || !organization) return;
    // ⚠ LE `try/finally` N'EST PAS DÉCORATIF : sans lui, une exception laisse
    // la page sur son tourniquet, indéfiniment, sans rien dire. Les actions
    // avalent leurs erreurs réseau, mais la LECTURE de la réponse peut lever,
    // et un rejet non traité dans un effet ne se voit nulle part. C'est aussi
    // ce qui tait `set-state-in-effect`, et la forme de la page Réquisitions.
    try {

      // ⚠ Les trois appels partent EN PARALLÈLE : ils ne dépendent pas les uns
      // des autres, et les enchaîner ferait trois allers-retours là où la
      // latence est le coût dominant. Même arbitrage que les onglets de rapports.
      const [toutes, attente, retours] = await Promise.all([
        getPurchaseOrders(jeton, organization.id, { page_size: 1 }),
        getPendingPurchaseOrders(jeton, organization.id, { page_size: 100 }),
        getPurchaseReturns(jeton, organization.id, { page_size: 1 }),
      ]);

      // ⚠ Le reste dû se somme sur les commandes à réceptionner, qui portent
      // leur devise. On ne convertit PAS : la somme serait inter-devises, ce que
      // tout le reste de la plateforme interdit. Elle n'est donc rendue que sur
      // un établissement mono-devise, et le relevé le DIT autrement.
      const parDevise = new Map<string, number>();
      for (const po of attente.data?.results ?? []) {
        const avant = parDevise.get(po.currency) ?? 0;
        parDevise.set(po.currency, avant + parseFloat(po.amount_due || "0"));
      }

      setReleves({
        commandes: toutes.data?.count ?? 0,
        aReceptionner: attente.data?.count ?? 0,
        retours: retours.data?.count ?? 0,
        // Rien en attente : il ne reste rien à payer, et zéro est un montant.
        du:
          parDevise.size === 0
            ? 0
            : parDevise.size === 1
              ? [...parDevise.values()][0]
              : null,
      });
    } finally {
      setIsLoading(false);
    }
  }, [jeton, organization]);

  useEffect(() => {
    if (organization) charger();
  }, [organization, charger]);

  useEffect(() => {
    if (!jeton || !organization) return;
    getOrganizationCurrencies(jeton, organization.id).then((r) => {
      if (r.success && r.data) setDevises(r.data);
    });
  }, [jeton, organization]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Achats et fournisseurs</h1>
        <p className="text-sm text-muted-foreground">
          Ce qu&apos;on commande, ce qu&apos;on reçoit, ce qu&apos;on doit.
        </p>
      </div>

      <StatStrip>
        <StatStripItem
          label="Commandes"
          value={isLoading ? "…" : String(releves.commandes)}
          icon={FileText}
        />
        <StatStripItem
          label="À réceptionner"
          value={isLoading ? "…" : String(releves.aReceptionner)}
          icon={PackageCheck}
          // Un relevé à zéro reste NEUTRE : un « 0 à réceptionner » en orange
          // crie pour rien, et à force on ne voit plus le vrai signal.
          tone={releves.aReceptionner > 0 ? "warn" : "neutral"}
        />
        <StatStripItem
          label="Reste à payer"
          value={
            isLoading
              ? "…"
              : releves.du === null
                ? "Plusieurs devises"
                : money.money(releves.du, money.primaryCode)
          }
          icon={Wallet}
          hint={
            releves.du === null
              ? "Les commandes en attente sont libellées dans plusieurs monnaies : elles ne s'additionnent pas."
              : undefined
          }
        />
        <StatStripItem
          label="Retours"
          value={isLoading ? "…" : String(releves.retours)}
          icon={Undo2}
        />
      </StatStrip>

      {/* ⚠ `grid-cols-1` est EXPLICITE : une grille sans colonne déclarée
          dimensionne sa piste sur `max-content`, et neuf grilles du
          back-office ont déjà débordé pour cette raison. */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Opérations
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActionTile
            href="/dashboard/purchases/orders"
            title="Commandes"
            description="Ce qu'on a commandé, et chez qui"
            icon={FileText}
            accent="indigo"
          />
          <ActionTile
            href="/dashboard/purchases/receipts"
            title="Réceptions"
            description="Le camion arrive : on compte, on valide"
            icon={PackageCheck}
            accent="cyan"
          />
          <ActionTile
            href="/dashboard/purchases/payments"
            title="Règlements"
            description="Ce qu'on a payé, et sur quelles commandes"
            icon={CreditCard}
            accent="amber"
          />
          <ActionTile
            href="/dashboard/purchases/returns"
            title="Retours"
            description="La marchandise qui repart chez le fournisseur"
            icon={Undo2}
            accent="purple"
          />
        </div>
      </div>

      {/* Le lien vers les réquisitions : elles DISENT ce qu'il faut acheter, et
          c'est de là qu'une commande part le plus souvent. */}
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                Vous ne savez pas encore quoi commander ?
              </p>
              <p className="text-sm text-muted-foreground">
                Les réquisitions listent ce qui manque en rayon, avant toute
                commande.
              </p>
            </div>
          </div>
          <Button variant="outline" asChild className="shrink-0">
            <Link href="/dashboard/stock/requisitions">Voir les réquisitions</Link>
          </Button>
        </div>
      </div>

      {!hasPermission("purchases.create") && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium">Vous pouvez lire, pas commander.</p>
            <p className="text-muted-foreground">
              Passer une commande demande le droit « Achats : créer ». Un
              magasinier réceptionne, c&apos;est le gérant qui engage
              l&apos;argent.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
