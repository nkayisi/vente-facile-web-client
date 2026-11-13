"use client";

/**
 * Ce que le support doit traiter aujourd'hui.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN ÉCRAN DE TRAVAIL, PAS UN RAPPORT : CHAQUE LIGNE APPELLE UN GESTE.     │
 * │                                                                          │
 * │ Relancer un marchand dont l'abonnement tombe dans trois jours - son      │
 * │ téléphone est sur la ligne. Réconcilier un paiement Mobile Money prélevé │
 * │ mais jamais activé. Retrouver un propriétaire pour une boutique qui n'en │
 * │ a plus. La plus grave en tête.                                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Phone, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAdminIncidents,
  reconcilePayments,
  type AdminIncidents,
  type IncidentSeverity,
} from "@/actions/admin.actions";
import { useAdminPermissions } from "@/components/admin/admin-permissions-provider";
import { compte, dateCourte, dateHeure, depuis, montant, nombre } from "@/lib/admin/format";
import { resumerReconciliation } from "@/lib/admin/reconciliation";

const GRAVITE: Record<IncidentSeverity, { label: string; className: string }> = {
  critical: { label: "Critique", className: "bg-destructive/10 text-destructive border-destructive/30" },
  high: { label: "Urgent", className: "bg-warning/10 text-warning border-warning/30" },
  medium: { label: "À surveiller", className: "bg-muted text-muted-foreground" },
};

function Gravite({ niveau }: { niveau: IncidentSeverity }) {
  const g = GRAVITE[niveau];
  return (
    <Badge variant="outline" className={g.className}>
      {g.label}
    </Badge>
  );
}

function Contact({ nom, email, telephone }: { nom?: string | null; email?: string | null; telephone?: string | null }) {
  if (!nom && !email && !telephone) {
    return <p className="text-xs text-muted-foreground">Aucun contact connu</p>;
  }
  return (
    <div className="text-xs text-muted-foreground space-y-0.5">
      {nom && <p className="text-foreground">{nom}</p>}
      {telephone && (
        <a href={`tel:${telephone}`} className="flex items-center gap-1 hover:text-foreground">
          <Phone className="h-3 w-3" /> {telephone}
        </a>
      )}
      {email && <a href={`mailto:${email}`} className="hover:text-foreground">{email}</a>}
    </div>
  );
}

function Vide({ texte }: { texte: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <CheckCircle2 className="h-8 w-8 text-success" />
      <p className="text-sm text-muted-foreground">{texte}</p>
    </div>
  );
}

export default function IncidentsPage() {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const { hasPlatformPermission } = useAdminPermissions();
  const peutReconcilier = hasPlatformPermission("incidents.reconcile_payments");
  const [donnees, setDonnees] = useState<AdminIncidents | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tour, setTour] = useState(0);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [rapports, setRapports] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!jeton) return;
    let annule = false;
    (async () => {
      const r = await getAdminIncidents(jeton);
      if (annule) return;
      if (r.success && r.data) setDonnees(r.data);
      else toast.error(r.message || "Incidents indisponibles");
      setIsLoading(false);
    })();
    return () => {
      annule = true;
    };
  }, [jeton, tour]);

  const actualiser = useCallback(() => setTour((t) => t + 1), []);

  /**
   * Interroge l'opérateur pour UNE référence. La réponse dit ce que la base ne
   * dit pas : si l'argent est parti, et pourquoi l'abonnement ne s'est pas
   * activé (« activation différée : plan introuvable… »).
   */
  const reconcilier = async (reference: string) => {
    if (!jeton) return;
    setEnCours(reference);
    const r = await reconcilePayments(jeton, { reference });
    setEnCours(null);
    if (!r.success || !r.data) {
      toast.error(r.message || "Réconciliation impossible");
      return;
    }
    setRapports((prev) => ({ ...prev, [reference]: resumerReconciliation(r.data!) }));
    if (r.data.reconciled > 0) {
      toast.success("Paiement encaissé : l'abonnement est activé.");
      actualiser();
    }
  };

  if (isLoading && !donnees) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!donnees) {
    return <p className="py-12 text-center text-muted-foreground">Incidents indisponibles.</p>;
  }

  const c = donnees.counts;
  const tronque = (n: number) =>
    n > donnees.limit ? <p className="pt-3 text-xs text-muted-foreground">Les {donnees.limit} plus graves sur {nombre(n)}.</p> : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Incidents</h1>
          <p className="text-muted-foreground">
            Ce qui demande un geste du support, toutes organisations confondues. Mis à jour {dateHeure(donnees.generated_at)}.
          </p>
        </div>
        <Button variant="outline" onClick={actualiser}>
          <RefreshCw className="mr-2 h-4 w-4" /> Actualiser
        </Button>
      </div>

      <Tabs defaultValue="abonnements">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            <TabsTrigger value="abonnements">Abonnements à risque ({nombre(c.subscriptions_at_risk)})</TabsTrigger>
            <TabsTrigger value="paiements">Paiements à vérifier ({nombre(c.payments_to_review)})</TabsTrigger>
            <TabsTrigger value="orphelines">Sans propriétaire ({nombre(c.organizations_without_owner)})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="abonnements">
          <Card className="border">
            <CardContent className="divide-y">
              {donnees.subscriptions_at_risk.length === 0 ? (
                <Vide texte="Aucun abonnement à relancer." />
              ) : (
                donnees.subscriptions_at_risk.map((a) => (
                  <div key={a.subscription_id} className="grid grid-cols-1 gap-3 py-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Gravite niveau={a.severity} />
                        <Link href={`/admin/organizations/${a.organization_id}`} className="font-medium hover:underline">
                          {a.organization_name}
                        </Link>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {a.reason} · {a.plan_name} ·{" "}
                        {a.days_overdue > 0
                          ? `échu depuis ${a.days_overdue} j`
                          : `fin le ${dateCourte(a.current_period_end)} (${a.days_remaining} j)`}
                      </p>
                    </div>
                    <Contact nom={a.owner_name} email={a.owner_email} telephone={a.phone} />
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/subscriptions/${a.subscription_id}`}>Ouvrir</Link>
                    </Button>
                  </div>
                ))
              )}
              {tronque(c.subscriptions_at_risk)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paiements">
          <Card className="border">
            <CardContent className="divide-y">
              {donnees.payments_to_review.length === 0 ? (
                <Vide texte="Aucun paiement Mobile Money en suspens." />
              ) : (
                donnees.payments_to_review.map((p) => (
                  <div key={p.payment_id} className="grid grid-cols-1 gap-3 py-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Gravite niveau={p.severity} />
                        <span className="font-medium">{montant(p.amount, p.currency)}</span>
                        <Link href={`/admin/organizations/${p.organization_id}`} className="text-sm hover:underline">
                          {p.organization_name}
                        </Link>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {p.status_display} depuis {depuis(p.age_minutes)} · réf. <span className="font-mono">{p.reference}</span>
                        {p.reconcile_attempts > 0 && ` · ${compte(p.reconcile_attempts, "réconciliation", "réconciliations")} sans issue`}
                      </p>
                      {rapports[p.reference] && (
                        <p className="text-sm text-foreground">{rapports[p.reference]}</p>
                      )}
                    </div>
                    <Contact nom={p.owner_name} email={p.owner_email} telephone={p.phone} />
                    {peutReconcilier && (
                      <Button size="sm" variant="outline" disabled={enCours !== null} onClick={() => reconcilier(p.reference)}>
                        {enCours === p.reference ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                        Interroger l&apos;opérateur
                      </Button>
                    )}
                  </div>
                ))
              )}
              {tronque(c.payments_to_review)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orphelines">
          <Card className="border">
            <CardContent className="divide-y">
              {donnees.organizations_without_owner.length === 0 ? (
                <Vide texte="Chaque boutique active a un propriétaire actif." />
              ) : (
                <>
                  <p className="py-3 text-sm text-muted-foreground">
                    Seul le propriétaire peut régler l&apos;abonnement : sans lui, ces boutiques s&apos;arrêteront à leur prochaine échéance.
                  </p>
                  {donnees.organizations_without_owner.map((o) => (
                    <div key={o.organization_id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <Link href={`/admin/organizations/${o.organization_id}`} className="font-medium hover:underline">
                          {o.organization_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">Créée le {dateCourte(o.created_at)}</p>
                      </div>
                      <Contact telephone={o.phone} email={o.email} />
                    </div>
                  ))}
                </>
              )}
              {tronque(c.organizations_without_owner)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
