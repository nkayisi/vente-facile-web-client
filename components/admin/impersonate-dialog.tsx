"use client";

/**
 * Prendre la main sur un compte, en lecture seule.
 *
 * ⚠ LE MOTIF EST OBLIGATOIRE, ET LE MARCHAND LE LIRA : il est inscrit dans le
 * journal de SON organisation, pas seulement dans celui de la plateforme.
 * L'écrire comme on l'écrirait au marchand lui-même.
 */
import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
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
import { usePriseEnMain } from "@/lib/auth/use-prise-en-main";

export function ImpersonateDialog({
  open,
  onOpenChange,
  userId,
  userLabel,
  organizationId,
  organizationName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userLabel: string;
  organizationId: string;
  organizationName: string;
}) {
  const { entrer, enCours } = usePriseEnMain();
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const valide = motif.trim().length >= 5;

  const confirmer = async () => {
    setErreur(null);
    const probleme = await entrer(userId, organizationId, motif.trim());
    if (probleme) setErreur(probleme);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !enCours && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prendre la main</DialogTitle>
          <DialogDescription>
            Vous verrez l&apos;application comme <strong>{userLabel}</strong> dans {organizationName}, pendant
            20 minutes.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Lecture seule : rien ne s&apos;enregistre au nom du marchand.</li>
          <li>L&apos;administration se ferme le temps de la prise en main, dans ce navigateur.</li>
          <li>Le marchand pourra voir qu&apos;un accès du support a eu lieu, et pourquoi.</li>
        </ul>
        <div className="space-y-2">
          <Label htmlFor="motif-prise-en-main">Motif *</Label>
          <Textarea
            id="motif-prise-en-main"
            rows={3}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. : vérifier l'écart de caisse signalé le 12 novembre"
          />
          {erreur && <p className="text-sm text-destructive">{erreur}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enCours}>Annuler</Button>
          <Button onClick={confirmer} disabled={!valide || enCours}>
            {enCours ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
            Prendre la main
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
