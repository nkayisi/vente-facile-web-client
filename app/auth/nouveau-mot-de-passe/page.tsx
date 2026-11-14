"use client";

/**
 * Le changement OBLIGATOIRE d'un mot de passe posé par l'administration.
 *
 * Le support l'a dicté au téléphone : il le connaît. Le middleware conduit ici
 * toute session qui en porte un, et le serveur refuse toute autre route tant
 * que ce n'est pas fait (`password_change_required`).
 *
 * ⚠ Le « mot de passe actuel » est EXIGÉ, alors que la session vient de naître
 * avec lui : c'est ce qui empêche un jeton resté ouvert ailleurs de choisir le
 * mot de passe à la place du titulaire.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, getUserProfile } from "@/actions/auth.actions";
import { getDefaultRedirectPath } from "@/lib/auth/redirect";

type Champ = "current_password" | "new_password" | "new_password_confirm";

export default function NouveauMotDePassePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [valeurs, setValeurs] = useState<Record<Champ, string>>({
    current_password: "",
    new_password: "",
    new_password_confirm: "",
  });
  const [visible, setVisible] = useState(false);
  const [erreurs, setErreurs] = useState<Partial<Record<Champ, string>>>({});
  const [enCours, setEnCours] = useState(false);

  // ┌────────────────────────────────────────────────────────────────────┐
  // │ LE DRAPEAU DU COOKIE PEUT ÊTRE PÉRIMÉ.                            │
  // │                                                                    │
  // │ Il est posé à la connexion et ne se remet à faux que par CETTE     │
  // │ page. Un titulaire qui a changé son mot de passe ailleurs (sur son │
  // │ terminal, par le lien reçu par e-mail) serait sinon contraint de   │
  // │ le changer une seconde fois, en tapant comme « mot de passe        │
  // │ communiqué » celui qu'il vient de choisir. Le serveur fait foi :   │
  // │ `/users/me/` reste lisible avant le changement.                    │
  // └────────────────────────────────────────────────────────────────────┘
  //
  // ⚠ UNE FOIS PAR JETON, et sans annulation : `update` change d'identité à
  // chaque nouvelle session, donc l'effet se rejoue après son propre `update`.
  // Annuler au nettoyage ferait jeter la réponse du premier passage par le
  // second, qui lui-même ne relirait rien.
  const jeton = session?.accessToken;
  const estAdministrateur = session?.isStaff;
  const verifiePour = useRef<string | null>(null);
  useEffect(() => {
    if (!jeton || verifiePour.current === jeton) return;
    verifiePour.current = jeton;
    void getUserProfile(jeton).then(async (r) => {
      if (!r.success || r.data?.must_change_password !== false) return;
      await update({ passwordChanged: true });
      router.replace(getDefaultRedirectPath(estAdministrateur));
      router.refresh();
    });
  }, [jeton, estAdministrateur, update, router]);

  const poser = (champ: Champ, v: string) => {
    setValeurs((p) => ({ ...p, [champ]: v }));
    setErreurs((p) => ({ ...p, [champ]: undefined }));
  };

  const valider = (): boolean => {
    const e: Partial<Record<Champ, string>> = {};
    if (!valeurs.current_password) e.current_password = "Saisissez le mot de passe qu'on vous a communiqué.";
    if (valeurs.new_password.length < 8) e.new_password = "Au moins 8 caractères.";
    else if (valeurs.new_password === valeurs.current_password) {
      e.new_password = "Choisissez un mot de passe différent de celui qu'on vous a communiqué.";
    }
    if (valeurs.new_password_confirm !== valeurs.new_password) {
      e.new_password_confirm = "Les deux mots de passe ne correspondent pas.";
    }
    setErreurs(e);
    return Object.keys(e).length === 0;
  };

  const enregistrer = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!session?.accessToken || !valider()) return;
    setEnCours(true);
    const r = await changePassword(session.accessToken, valeurs);
    if (!r.success) {
      setEnCours(false);
      // `changePassword` rend la phrase du serveur pour le premier champ fautif
      // (mot de passe communiqué erroné, nouveau trop faible) : elle se lit telle quelle.
      toast.error(r.message);
      return;
    }
    await update({ passwordChanged: true });
    toast.success("Mot de passe enregistré.");
    router.replace(getDefaultRedirectPath(session.isStaff));
    router.refresh();
  };

  const champ = (id: Champ, label: string, autoComplete: string, autoFocus = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        value={valeurs[id]}
        onChange={(e) => poser(id, e.target.value)}
        aria-invalid={Boolean(erreurs[id])}
        disabled={enCours}
      />
      {erreurs[id] && <p className="text-sm text-destructive">{erreurs[id]}</p>}
    </div>
  );

  return (
    <Card className="mx-auto w-full max-w-md border-0 shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl">Choisissez votre mot de passe</CardTitle>
        <CardDescription>
          Le mot de passe de ce compte a été réinitialisé par le support. Remplacez-le par le vôtre pour
          continuer : personne d&apos;autre ne doit le connaître.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={enregistrer} className="space-y-4" noValidate>
          {champ("current_password", "Mot de passe communiqué", "current-password", true)}
          {champ("new_password", "Nouveau mot de passe", "new-password")}
          {champ("new_password_confirm", "Confirmation", "new-password")}
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {visible ? "Masquer les mots de passe" : "Afficher les mots de passe"}
          </button>
          <Button type="submit" className="w-full" disabled={enCours}>
            {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer et continuer
          </Button>
        </form>
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            disabled={enCours}
          >
            Se déconnecter
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
