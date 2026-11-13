"use client";

/**
 * Accorder ou changer le rôle d'un compte sur la plateforme.
 *
 * ⚠ Les deux rôles se décrivent par ce qu'ils PERMETTENT, pas par leur nom :
 * « support » laisse prolonger un abonnement et prendre la main sur un compte,
 * ce qu'un nom ne dit pas. Un super-administrateur nommé par erreur peut changer
 * les tarifs de toute la plateforme.
 */
import { useState } from "react";
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
import { grantPlatformRole, type PlatformRole } from "@/actions/admin.actions";
import { cn } from "@/lib/utils";

const ROLES: Array<{ value: PlatformRole; titre: string; texte: string }> = [
  {
    value: "support",
    titre: "Support",
    texte:
      "Consulte tout. Réactive un établissement, prolonge un abonnement, réconcilie un paiement, prend la main en lecture seule. Ne touche ni aux tarifs, ni aux rôles, ni à la porte de mise à jour.",
  },
  {
    value: "super_admin",
    titre: "Super-administrateur",
    texte:
      "Tout, y compris nommer d'autres administrateurs, changer les tarifs, annuler un abonnement et poser un seuil de mise à jour qui peut bloquer tout le parc.",
  },
];

export function RoleDialog({
  open,
  onOpenChange,
  userId,
  userLabel,
  roleActuel,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userLabel: string;
  roleActuel: PlatformRole | null;
  onDone: () => void;
}) {
  const { data: session } = useSession();
  const [role, setRole] = useState<PlatformRole>(roleActuel ?? "support");
  const [notes, setNotes] = useState("");
  const [enCours, setEnCours] = useState(false);

  const valider = async () => {
    if (!session?.accessToken) return;
    setEnCours(true);
    const r = await grantPlatformRole(session.accessToken, userId, { role, notes });
    setEnCours(false);
    if (!r.success) {
      toast.error(r.message);
      return;
    }
    toast.success(roleActuel ? "Rôle modifié." : "Rôle attribué.");
    setNotes("");
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !enCours && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{roleActuel ? "Changer le rôle" : "Attribuer un rôle"}</DialogTitle>
          <DialogDescription>{userLabel}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2" role="radiogroup" aria-label="Rôle">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={role === r.value}
              onClick={() => setRole(r.value)}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition-colors",
                role === r.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}
            >
              <p className="font-medium">{r.titre}</p>
              <p className="text-sm text-muted-foreground">{r.texte}</p>
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes-role">Note (facultative, gardée au journal)</Label>
          <Textarea id="notes-role" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enCours}>
            Annuler
          </Button>
          <Button onClick={valider} disabled={enCours || role === roleActuel}>
            {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {roleActuel ? "Changer le rôle" : "Attribuer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
