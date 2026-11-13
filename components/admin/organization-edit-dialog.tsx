"use client";

/**
 * Corriger la fiche d'un établissement pour le compte du marchand.
 *
 * ⚠ Ni l'état, ni la devise : le premier se change par « Désactiver », qui
 * demande un motif ; la devise principale ne se change pas sans réécrire tout ce
 * qui a été encaissé dans l'ancienne. Chaque champ modifié est gardé au journal,
 * avec son ancienne valeur.
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  updateAdminOrganization,
  type AdminOrganization,
  type UpdateAdminOrganizationData,
} from "@/actions/admin.actions";

export const TYPES_ETABLISSEMENT = [
  { value: "boutique", label: "Boutique" },
  { value: "supermarket", label: "Supermarché" },
  { value: "pharmacy", label: "Pharmacie" },
  { value: "depot", label: "Dépôt" },
  { value: "restaurant", label: "Restaurant" },
  { value: "other", label: "Autre" },
];

type Champ = keyof UpdateAdminOrganizationData;

const CHAMPS: Array<{ cle: Champ; label: string; type?: string }> = [
  { cle: "name", label: "Nom *" },
  { cle: "email", label: "E-mail", type: "email" },
  { cle: "phone", label: "Téléphone" },
  { cle: "city", label: "Ville" },
  { cle: "country", label: "Pays" },
  { cle: "tax_id", label: "NIF" },
  { cle: "rccm", label: "RCCM" },
  { cle: "id_nat", label: "ID Nat" },
];

export function OrganizationEditDialog({
  open,
  onOpenChange,
  organization,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: AdminOrganization;
  onSaved: (org: AdminOrganization) => void;
}) {
  const { data: session } = useSession();
  const initial: Record<Champ, string> = {
    name: organization.name ?? "",
    business_type: organization.business_type ?? "boutique",
    email: organization.email ?? "",
    phone: organization.phone ?? "",
    address: organization.address ?? "",
    city: organization.city ?? "",
    country: organization.country ?? "",
    tax_id: organization.tax_id ?? "",
    rccm: organization.rccm ?? "",
    id_nat: organization.id_nat ?? "",
  };
  const [valeurs, setValeurs] = useState(initial);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState(false);

  const poser = (cle: Champ, v: string) => {
    setValeurs((p) => ({ ...p, [cle]: v }));
    setErreurs({});
  };

  const enregistrer = async () => {
    if (!session?.accessToken) return;
    // Seuls les champs qui changent partent : le journal dira lesquels.
    const ecart: UpdateAdminOrganizationData = {};
    for (const cle of Object.keys(valeurs) as Champ[]) {
      if (valeurs[cle] !== initial[cle]) ecart[cle] = valeurs[cle];
    }
    if (Object.keys(ecart).length === 0) {
      onOpenChange(false);
      return;
    }
    setEnCours(true);
    const r = await updateAdminOrganization(session.accessToken, organization.id, ecart);
    setEnCours(false);
    if (!r.success || !r.data) {
      const champs: Record<string, string> = {};
      for (const [k, v] of Object.entries(r.errors ?? {})) {
        champs[k] = Array.isArray(v) ? String(v[0]) : String(v);
      }
      setErreurs(champs);
      toast.error(r.message);
      return;
    }
    toast.success("Fiche mise à jour.");
    onSaved(r.data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !enCours && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier l&apos;établissement</DialogTitle>
          <DialogDescription>Chaque modification est gardée au journal d&apos;audit.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CHAMPS.slice(0, 1).map((c) => (
            <div key={c.cle} className="space-y-1 sm:col-span-2">
              <Label htmlFor={`org-${c.cle}`}>{c.label}</Label>
              <Input id={`org-${c.cle}`} value={valeurs[c.cle]} onChange={(e) => poser(c.cle, e.target.value)} />
              {erreurs[c.cle] && <p className="text-xs text-destructive">{erreurs[c.cle]}</p>}
            </div>
          ))}
          <div className="space-y-1 sm:col-span-2">
            <Label>Type d&apos;établissement</Label>
            <Select value={valeurs.business_type} onValueChange={(v) => poser("business_type", v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES_ETABLISSEMENT.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {CHAMPS.slice(1).map((c) => (
            <div key={c.cle} className="space-y-1">
              <Label htmlFor={`org-${c.cle}`}>{c.label}</Label>
              <Input id={`org-${c.cle}`} type={c.type} value={valeurs[c.cle]} onChange={(e) => poser(c.cle, e.target.value)} />
              {erreurs[c.cle] && <p className="text-xs text-destructive">{erreurs[c.cle]}</p>}
            </div>
          ))}
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="org-address">Adresse</Label>
            <Textarea id="org-address" rows={2} value={valeurs.address} onChange={(e) => poser("address", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enCours}>Annuler</Button>
          <Button onClick={enregistrer} disabled={enCours || !valeurs.name.trim()}>
            {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
