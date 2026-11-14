"use client";

/**
 * Réinitialiser le mot de passe d'un compte, depuis l'administration.
 *
 * Deux étapes, et la seconde n'existe qu'une fois :
 * 1. le mot de passe temporaire (généré, modifiable) et le motif du geste ;
 * 2. le mot de passe en grand, pour qu'on le DICTE au titulaire, et ce que le
 *    geste a coupé. Il ne sera plus jamais affiché : le serveur ne le renvoie
 *    pas, et la boîte l'oublie en se fermant.
 *
 * ⚠ La boîte se monte À L'OUVERTURE (rendue conditionnellement par l'appelant) :
 * chaque ouverture tire donc un mot de passe neuf, sans effet de remise à zéro.
 *
 * ⚠ Un clic hors de la boîte ne la ferme PAS à la seconde étape : il ferait
 * perdre un mot de passe qu'on n'a peut-être pas encore dicté.
 */
import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, RefreshCw } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { resetUserPassword, type ResetPasswordResult } from "@/actions/admin.actions";
import { compte } from "@/lib/admin/format";
import { genererMotDePasse } from "@/lib/admin/mot-de-passe";

function premiereErreur(errors: Record<string, unknown> | undefined, champ: string): string | undefined {
  const v = errors?.[champ];
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v.map(String).join(" ") : String(v);
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userLabel,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** Le nom ou l'adresse du titulaire : il se lit avant le bouton. */
  userLabel: string;
  onDone?: () => void;
}) {
  const { data: session } = useSession();
  const [motDePasse, setMotDePasse] = useState(() => genererMotDePasse());
  const [motif, setMotif] = useState("");
  const [erreurs, setErreurs] = useState<{ password?: string; reason?: string }>({});
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<ResetPasswordResult | null>(null);
  const [copie, setCopie] = useState(false);

  const motifManquant = motif.trim().length < 5;
  const pret = motDePasse.trim().length > 0 && !motifManquant;

  const reinitialiser = async () => {
    if (!session?.accessToken || !pret) return;
    // ⚠ Sans les blancs de tête ou de fin : le serveur les GARDE
    // (`trim_whitespace=False`), et une espace invisible dans un mot de passe
    // dicté au téléphone le rendrait introuvable pour son titulaire.
    const envoye = motDePasse.trim();
    setMotDePasse(envoye);
    setEnCours(true);
    const r = await resetUserPassword(session.accessToken, userId, {
      password: envoye,
      reason: motif.trim(),
    });
    setEnCours(false);
    if (!r.success || !r.data) {
      const champs = {
        password: premiereErreur(r.errors, "password"),
        reason: premiereErreur(r.errors, "reason"),
      };
      setErreurs(champs);
      if (!champs.password && !champs.reason) toast.error(r.message);
      return;
    }
    setResultat(r.data);
    onDone?.();
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(motDePasse);
      setCopie(true);
    } catch {
      // Contexte non sécurisé, ou permission refusée : le mot de passe reste
      // affiché et sélectionnable d'un clic.
      toast.error("Copie impossible : sélectionnez le mot de passe et copiez-le à la main.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !enCours && onOpenChange(o)}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => {
          if (resultat) e.preventDefault();
        }}
        // Échap non plus : une touche frappée par mégarde ferait perdre le mot de
        // passe aussi sûrement qu'un clic dehors. On sort par le bouton.
        onEscapeKeyDown={(e) => {
          if (resultat) e.preventDefault();
        }}
      >
        {resultat ? (
          <>
            <DialogHeader>
              <DialogTitle>Mot de passe réinitialisé</DialogTitle>
              <DialogDescription>
                Dictez-le à {userLabel}. Il ne sera plus affiché.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3">
                <code className="min-w-0 flex-1 select-all break-all font-mono text-xl tracking-wider">
                  {motDePasse}
                </code>
                <Button variant="outline" size="sm" onClick={copier} aria-label="Copier le mot de passe">
                  {copie ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
                  {copie ? "Copié" : "Copier"}
                </Button>
              </div>
              <span className="sr-only" aria-live="polite">{copie ? "Mot de passe copié" : ""}</span>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>À la prochaine connexion, le titulaire devra choisir son propre mot de passe.</li>
                <li>
                  {compte(resultat.sessions_closed, "session fermée", "sessions fermées")} au
                  back-office ·{" "}
                  {compte(resultat.devices_revoked, "terminal à reconnecter", "terminaux à reconnecter")}.
                  Les ventes en attente d&apos;un terminal sont conservées et partiront à la reconnexion.
                </li>
                <li>
                  Après cinq essais erronés, la connexion du titulaire reste bloquée jusqu&apos;à quinze
                  minutes depuis son appareil.
                </li>
              </ul>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>J&apos;ai communiqué le mot de passe</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2">
                  <p className="font-medium text-foreground">{userLabel}</p>
                  <p>
                    Ses sessions ouvertes sont fermées et ses terminaux devront être reconnectés. À la
                    prochaine connexion, le titulaire choisira son propre mot de passe.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="rp-password">Mot de passe temporaire</Label>
                <div className="flex gap-2">
                  <Input
                    id="rp-password"
                    value={motDePasse}
                    onChange={(e) => {
                      setMotDePasse(e.target.value);
                      setErreurs((p) => ({ ...p, password: undefined }));
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono tracking-wider"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setMotDePasse(genererMotDePasse());
                      setErreurs((p) => ({ ...p, password: undefined }));
                    }}
                    aria-label="Générer un autre mot de passe"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                {erreurs.password ? (
                  <p className="text-xs text-destructive">{erreurs.password}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sans lettre ni chiffre ambigus : il se dicte au téléphone.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="rp-motif">Motif *</Label>
                <Textarea
                  id="rp-motif"
                  value={motif}
                  onChange={(e) => {
                    setMotif(e.target.value);
                    setErreurs((p) => ({ ...p, reason: undefined }));
                  }}
                  placeholder="Pourquoi ? (gardé au journal d'audit)"
                  rows={3}
                  maxLength={1000}
                />
                {erreurs.reason && <p className="text-xs text-destructive">{erreurs.reason}</p>}
                {!erreurs.reason && motifManquant && motif.length > 0 && (
                  <p className="text-xs text-destructive">Quelques mots de plus : le motif doit être compréhensible.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enCours}>
                Annuler
              </Button>
              <Button onClick={reinitialiser} disabled={!pret || enCours}>
                {enCours ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Réinitialiser
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
