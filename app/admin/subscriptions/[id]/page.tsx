"use client";

/**
 * La fiche d'un abonnement.
 *
 * Deux gestes, et chacun laisse une trace : prolonger (un geste commercial, une
 * panne de paiement) et annuler. L'annulation demande un motif, parce qu'elle
 * bloque l'établissement en écriture et qu'on viendra demander pourquoi.
 */
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Building2, Calendar, Clock, CreditCard, Loader2, ScrollText, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cancelSubscription,
  extendSubscription,
  getAdminAuditLog,
  getAdminSubscription,
  type AdminActionLogEntry,
  type AdminSubscription,
} from "@/actions/admin.actions";
import { useAdminPermissions } from "@/components/admin/admin-permissions-provider";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { dateCourte, dateHeure, montant, tonEcheance } from "@/lib/admin/format";

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export default function AdminSubscriptionDetailPage() {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const params = useParams();
  const router = useRouter();
  const subId = params.id as string;
  const { hasPlatformPermission } = useAdminPermissions();

  const [sub, setSub] = useState<AdminSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [journal, setJournal] = useState<AdminActionLogEntry[]>([]);
  const [tour, setTour] = useState(0);
  const [prolongation, setProlongation] = useState(false);
  const [jours, setJours] = useState(30);
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [annulation, setAnnulation] = useState(false);

  const voitJournal = hasPlatformPermission("audit_log.view");
  const actualiser = useCallback(() => setTour((t) => t + 1), []);

  useEffect(() => {
    if (!jeton || !subId) return;
    let annule = false;
    (async () => {
      const [r, j] = await Promise.all([
        getAdminSubscription(jeton, subId),
        voitJournal ? getAdminAuditLog(jeton, { target_id: subId, page_size: 10 }) : Promise.resolve(null),
      ]);
      if (annule) return;
      if (r.success && r.data) setSub(r.data);
      else toast.error(r.message || "Abonnement introuvable");
      if (j?.success && j.data) setJournal(j.data.results);
      setIsLoading(false);
    })();
    return () => {
      annule = true;
    };
  }, [jeton, subId, tour, voitJournal]);

  const prolonger = async () => {
    if (!jeton || !sub) return;
    setEnCours(true);
    const r = await extendSubscription(jeton, sub.id, jours, motif.trim());
    setEnCours(false);
    if (!r.success) {
      toast.error(r.message);
      return;
    }
    toast.success(r.message);
    setProlongation(false);
    actualiser();
  };

  const annuler = async (raison: string) => {
    if (!jeton || !sub) return false;
    const r = await cancelSubscription(jeton, sub.id, raison);
    if (!r.success) {
      toast.error(r.message);
      return false;
    }
    toast.success(r.message);
    actualiser();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour
        </Button>
        <p className="py-12 text-center text-muted-foreground">Abonnement introuvable.</p>
      </div>
    );
  }

  // Le serveur prolonge tout ce qui n'est pas annulé : un abonnement échu ou en
  // retard y redevient actif, et c'est précisément le geste du support.
  const peutProlonger = hasPlatformPermission("subscriptions.extend") && sub.status !== "cancelled";
  const peutAnnuler =
    hasPlatformPermission("subscriptions.cancel") && ["active", "trial", "past_due"].includes(sub.status);
  const joursValides = Number.isInteger(jours) && jours >= 1 && jours <= 365;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Retour">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{sub.plan_name}</h1>
              <Badge variant="outline">{sub.status_display}</Badge>
            </div>
            <Link href={`/admin/organizations/${sub.organization}`} className="text-muted-foreground hover:underline">
              {sub.organization_name}
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {peutProlonger && (
            <Button
              variant="outline"
              onClick={() => {
                setJours(30);
                setMotif("");
                setProlongation(true);
              }}
            >
              <Calendar className="mr-2 h-4 w-4" /> Prolonger
            </Button>
          )}
          {peutAnnuler && (
            <Button variant="outline" onClick={() => setAnnulation(true)} className="text-destructive hover:text-destructive">
              <X className="mr-2 h-4 w-4" /> Annuler l&apos;abonnement
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Établissement
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Ligne label="Nom">
              <Link href={`/admin/organizations/${sub.organization}`} className="font-medium hover:text-primary">
                {sub.organization_name}
              </Link>
            </Ligne>
            <Ligne label="Autres abonnements">
              <Link href={`/admin/subscriptions?organization=${sub.organization}`} className="text-primary hover:underline">
                Historique
              </Link>
            </Ligne>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <CreditCard className="h-4 w-4 text-muted-foreground" /> Plan et tarif
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Ligne label="Plan">{sub.plan_name}</Ligne>
            <Ligne label="Cycle">{sub.billing_cycle_display}</Ligne>
            <Ligne label="Prix"><span className="font-medium">{montant(sub.price, sub.currency)}</span></Ligne>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Calendar className="h-4 w-4 text-muted-foreground" /> Période
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <Ligne label="Début">{dateCourte(sub.current_period_start)}</Ligne>
            <Ligne label="Fin">{dateCourte(sub.current_period_end)}</Ligne>
            <Ligne label="Reste">
              <span
                className={`inline-flex items-center gap-1.5 font-medium ${tonEcheance(sub.days_remaining)}`}
              >
                <Clock className="h-3.5 w-3.5" />
                {sub.days_remaining > 0 ? `${sub.days_remaining} jour${sub.days_remaining > 1 ? "s" : ""}` : "Échu"}
              </span>
            </Ligne>
            <Ligne label="Créé le">{dateHeure(sub.created_at)}</Ligne>
          </CardContent>
        </Card>
      </div>

      {voitJournal && (
        <Card className="border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <ScrollText className="h-4 w-4 text-muted-foreground" /> Actes d&apos;administration
            </CardTitle>
            <Link href="/admin/audit-log" className="text-sm text-primary hover:underline">Journal complet</Link>
          </CardHeader>
          <CardContent className="divide-y">
            {journal.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Aucun acte sur cet abonnement.</p>
            ) : (
              journal.map((l) => (
                <div key={l.id} className="py-2 text-sm">
                  <p>
                    <span className="font-medium">{l.actor_name || l.actor_email || "Système"}</span> · {l.action_display}
                  </p>
                  {l.reason && <p className="text-muted-foreground">« {l.reason} »</p>}
                  <p className="text-xs text-muted-foreground">{dateHeure(l.created_at)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={prolongation} onOpenChange={(o) => !enCours && setProlongation(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Prolonger l&apos;abonnement</DialogTitle>
            <DialogDescription>
              {sub.organization_name} · {sub.plan_name} · fin actuelle le {dateCourte(sub.current_period_end)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sub-jours">Jours à ajouter</Label>
              <Input
                id="sub-jours"
                type="number"
                min={1}
                max={365}
                value={Number.isNaN(jours) ? "" : jours}
                onChange={(e) => setJours(parseInt(e.target.value, 10))}
              />
              {!joursValides && <p className="text-xs text-destructive">Entre 1 et 365 jours.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-motif">Motif</Label>
              <Textarea
                id="sub-motif"
                rows={2}
                placeholder="Geste commercial, panne de paiement, erreur de facturation…"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Gardé au journal d&apos;audit avec la prolongation.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProlongation(false)} disabled={enCours}>
              Fermer
            </Button>
            <Button onClick={prolonger} disabled={enCours || !joursValides}>
              {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Prolonger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={annulation}
        onOpenChange={setAnnulation}
        title="Annuler l'abonnement"
        entityName={sub.organization_name}
        description="L'établissement est bloqué en écriture : il ne peut plus enregistrer de vente tant qu'un nouvel abonnement n'est pas activé. Ses données restent."
        confirmLabel="Annuler l'abonnement"
        destructive
        reason="required"
        onConfirm={annuler}
      />
    </div>
  );
}
