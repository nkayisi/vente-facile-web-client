"use client";

/**
 * La confirmation d'un acte d'administration, avec son motif.
 *
 * Remplace les `confirm()` natifs : ils n'affichaient ni QUOI on s'apprêtait à
 * toucher, ni ne laissaient écrire POURQUOI. Or le motif est ce que le journal
 * d'audit garde, et ce qu'un collègue cherchera six mois plus tard.
 *
 * ⚠ Le rouge (`destructive`) est réservé à l'acte qui ne se défait pas : annuler
 * un abonnement, désactiver un compte. Prolonger ou réactiver ne le portent pas.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Ce que l'acte change, en une phrase. */
  description: React.ReactNode;
  /** Le nom de ce qu'on touche : il se lit avant le bouton. */
  entityName?: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Demande un motif. `required` l'exige avant de confirmer. */
  reason?: "none" | "optional" | "required";
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => Promise<boolean | void> | boolean | void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  entityName,
  confirmLabel,
  destructive = false,
  reason = "optional",
  reasonPlaceholder = "Pourquoi ? (gardé au journal d'audit)",
  onConfirm,
}: ConfirmDialogProps) {
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const motifManquant = reason === "required" && motif.trim().length < 5;

  const confirmer = async () => {
    setEnCours(true);
    try {
      const resultat = await onConfirm(motif.trim());
      if (resultat !== false) {
        setMotif("");
        onOpenChange(false);
      }
    } finally {
      setEnCours(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (enCours) return;
        if (!o) setMotif("");
        onOpenChange(o);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {entityName && <p className="font-medium text-foreground">{entityName}</p>}
              <div>{description}</div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {reason !== "none" && (
          <div className="space-y-2">
            <Label htmlFor="motif-confirmation">
              Motif{reason === "required" ? " *" : " (facultatif)"}
            </Label>
            <Textarea
              id="motif-confirmation"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
              maxLength={1000}
            />
            {reason === "required" && motifManquant && motif.length > 0 && (
              <p className="text-xs text-destructive">Quelques mots de plus : le motif doit être compréhensible.</p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={enCours}>Annuler</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={enCours || motifManquant}
            onClick={confirmer}
          >
            {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
