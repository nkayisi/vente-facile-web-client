"use client";

/**
 * Créer un compte, corriger un compte.
 *
 * ⚠ La création porte un mot de passe et sa confirmation : le serveur passe par
 * `create_user`, qui le hache. Un compte créé sans eux naissait jusqu'ici
 * inutilisable, et rien ne le disait.
 *
 * ⚠ La correction ne touche ni l'adresse e-mail, ni le mot de passe. La
 * première sert d'identifiant de connexion. Le second a son PROPRE geste
 * (`reset-password-dialog.tsx`), motivé, journalisé, qui coupe les sessions et
 * fait changer le mot de passe à la prochaine connexion : le glisser dans une
 * correction de nom le poserait à la place du titulaire, sans rien de tout cela.
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAdminUser,
  updateAdminUser,
  type AdminUser,
  type CreateAdminUserData,
} from "@/actions/admin.actions";

function erreursDeChamp(errors: Record<string, unknown> | undefined): Record<string, string> {
  const champs: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors ?? {})) {
    champs[k] = Array.isArray(v) ? String(v[0]) : String(v);
  }
  return champs;
}

function Champ({
  id,
  label,
  valeur,
  onChange,
  erreur,
  type,
  autoComplete,
}: {
  id: string;
  label: string;
  valeur: string;
  onChange: (v: string) => void;
  erreur?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} autoComplete={autoComplete} value={valeur} onChange={(e) => onChange(e.target.value)} />
      {erreur && <p className="text-xs text-destructive">{erreur}</p>}
    </div>
  );
}

const VIDE: CreateAdminUserData = {
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
  password: "",
  password_confirm: "",
};

export function UserCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (user: AdminUser) => void;
}) {
  const { data: session } = useSession();
  const [valeurs, setValeurs] = useState<CreateAdminUserData>(VIDE);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState(false);

  const poser = (cle: keyof CreateAdminUserData, v: string) => {
    setValeurs((p) => ({ ...p, [cle]: v }));
    setErreurs({});
  };

  const creer = async () => {
    if (!session?.accessToken) return;
    if (valeurs.password !== valeurs.password_confirm) {
      setErreurs({ password_confirm: "Les deux mots de passe ne correspondent pas." });
      return;
    }
    setEnCours(true);
    const r = await createAdminUser(session.accessToken, valeurs);
    setEnCours(false);
    if (!r.success || !r.data) {
      setErreurs(erreursDeChamp(r.errors));
      toast.error(r.message);
      return;
    }
    toast.success("Compte créé. Communiquez le mot de passe au titulaire par un canal sûr.");
    onCreated(r.data);
    onOpenChange(false);
  };

  const pret = valeurs.email.trim() !== "" && valeurs.password !== "" && valeurs.password_confirm !== "";

  return (
    <Dialog open={open} onOpenChange={(o) => !enCours && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau compte</DialogTitle>
          <DialogDescription>
            Le compte n&apos;appartient à aucun établissement : on l&apos;y invite ensuite, ou le titulaire crée le sien.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Champ id="nu-email" label="E-mail *" type="email" autoComplete="off" valeur={valeurs.email} onChange={(v) => poser("email", v)} erreur={erreurs.email} />
          </div>
          <Champ id="nu-first" label="Prénom" valeur={valeurs.first_name ?? ""} onChange={(v) => poser("first_name", v)} erreur={erreurs.first_name} />
          <Champ id="nu-last" label="Nom" valeur={valeurs.last_name ?? ""} onChange={(v) => poser("last_name", v)} erreur={erreurs.last_name} />
          <div className="sm:col-span-2">
            <Champ id="nu-phone" label="Téléphone" valeur={valeurs.phone ?? ""} onChange={(v) => poser("phone", v)} erreur={erreurs.phone} />
          </div>
          <Champ id="nu-pass" label="Mot de passe *" type="password" autoComplete="new-password" valeur={valeurs.password} onChange={(v) => poser("password", v)} erreur={erreurs.password} />
          <Champ id="nu-pass2" label="Confirmation *" type="password" autoComplete="new-password" valeur={valeurs.password_confirm} onChange={(v) => poser("password_confirm", v)} erreur={erreurs.password_confirm} />
        </div>
        {erreurs.non_field_errors && <p className="text-sm text-destructive">{erreurs.non_field_errors}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enCours}>
            Annuler
          </Button>
          <Button onClick={creer} disabled={!pret || enCours}>
            {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer le compte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserEditDialog({
  open,
  onOpenChange,
  user,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
  onSaved: (user: AdminUser) => void;
}) {
  const { data: session } = useSession();
  const initial = {
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    phone: user.phone ?? "",
  };
  const [valeurs, setValeurs] = useState(initial);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState(false);

  const poser = (cle: keyof typeof initial, v: string) => {
    setValeurs((p) => ({ ...p, [cle]: v }));
    setErreurs({});
  };

  const enregistrer = async () => {
    if (!session?.accessToken) return;
    // Seuls les champs qui changent partent : le journal dira lesquels.
    const ecart: Partial<typeof initial> = {};
    for (const cle of Object.keys(valeurs) as Array<keyof typeof initial>) {
      if (valeurs[cle] !== initial[cle]) ecart[cle] = valeurs[cle];
    }
    if (Object.keys(ecart).length === 0) {
      onOpenChange(false);
      return;
    }
    setEnCours(true);
    const r = await updateAdminUser(session.accessToken, user.id, ecart);
    setEnCours(false);
    if (!r.success || !r.data) {
      setErreurs(erreursDeChamp(r.errors));
      toast.error(r.message);
      return;
    }
    toast.success("Compte mis à jour.");
    onSaved(r.data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !enCours && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le compte</DialogTitle>
          <DialogDescription>
            {user.email} · l&apos;adresse ne se modifie pas ; le mot de passe a son propre geste, « Réinitialiser ».
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ id="eu-first" label="Prénom" valeur={valeurs.first_name} onChange={(v) => poser("first_name", v)} erreur={erreurs.first_name} />
          <Champ id="eu-last" label="Nom" valeur={valeurs.last_name} onChange={(v) => poser("last_name", v)} erreur={erreurs.last_name} />
          <div className="sm:col-span-2">
            <Champ id="eu-phone" label="Téléphone" valeur={valeurs.phone} onChange={(v) => poser("phone", v)} erreur={erreurs.phone} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enCours}>
            Annuler
          </Button>
          <Button onClick={enregistrer} disabled={enCours}>
            {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
