"use client";

/**
 * Activer un abonnement pour un établissement, en choisissant VRAIMENT le plan.
 *
 * ⚠ L'action envoyait `plan_id: "default-plan-id"`, une chaîne en dur avec un
 * « TODO » : le serveur répondait « Plan introuvable », à chaque fois, et rien à
 * l'écran ne permettait de choisir autre chose.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  activateOrganizationSubscription,
  getAdminPlans,
  type AdminPlan,
} from "@/actions/admin.actions";
import { montant } from "@/lib/admin/format";

const CYCLES = [
  { value: "monthly", label: "Mensuel" },
  { value: "quarterly", label: "Trimestriel" },
  { value: "yearly", label: "Annuel" },
];

export function ActivateSubscriptionDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  onDone: () => void;
}) {
  const { data: session } = useSession();
  const jeton = session?.accessToken;
  const [plans, setPlans] = useState<AdminPlan[] | null>(null);
  const [planId, setPlanId] = useState("");
  const [cycle, setCycle] = useState("monthly");
  const [notes, setNotes] = useState("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!jeton || !open || plans !== null) return;
    let annule = false;
    (async () => {
      const r = await getAdminPlans(jeton);
      if (annule) return;
      setPlans(r.success && r.data ? r.data.filter((p) => p.is_active) : []);
    })();
    return () => {
      annule = true;
    };
  }, [jeton, open, plans]);

  const plan = plans?.find((p) => p.id === planId);

  const valider = async () => {
    if (!jeton || !planId) return;
    setEnCours(true);
    const r = await activateOrganizationSubscription(jeton, organizationId, {
      plan_id: planId,
      billing_cycle: cycle,
      notes,
    });
    setEnCours(false);
    if (!r.success) {
      toast.error(r.message);
      return;
    }
    toast.success(r.message || "Abonnement activé.");
    setNotes("");
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !enCours && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Activer un abonnement</DialogTitle>
          <DialogDescription>
            {organizationName}. Un abonnement en cours est remplacé : il passe à « expiré ».
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Plan *</Label>
            {plans === null ? (
              <div className="flex h-9 items-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun plan en vente.</p>
            ) : (
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choisir un plan" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {montant(p.price_monthly, p.currency?.code)}/mois
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Cycle de facturation</Label>
            <Select value={cycle} onValueChange={setCycle}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CYCLES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {plan && cycle === "yearly" && (
              <p className="text-xs text-muted-foreground">Prix annuel : {montant(plan.price_yearly, plan.currency?.code)}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes-activation">Note (gardée au journal)</Label>
            <Textarea
              id="notes-activation"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex. : paiement reçu en espèces au bureau de Gombe"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enCours}>Annuler</Button>
          <Button onClick={valider} disabled={enCours || !planId}>
            {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Activer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
