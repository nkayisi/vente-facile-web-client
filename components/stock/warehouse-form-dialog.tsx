"use client";

/**
 * Créer ou modifier un entrepôt : un seul formulaire, pour la page Stock ET la
 * fiche de l'entrepôt.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA FICHE MENAIT À UNE PAGE QUI N'EXISTE PAS.                            │
 * │                                                                          │
 * │ « Modifier », sur la fiche d'un entrepôt, poussait vers `…/edit` : un    │
 * │ 404. La page Stock avait SON formulaire, la fiche aucun. Il n'y en a     │
 * │ plus qu'un, et il connaît les droits.                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * QUI MODIFIE QUOI (règle du serveur) :
 * - créer : le propriétaire seul ;
 * - nom et adresse : le gérant, sur SES entrepôts ;
 * - code, principal, actif : le propriétaire seul.
 *
 * ⚠ ON N'ENVOIE QUE CE QUI A CHANGÉ (`champsModifies`), borné aux champs du
 * demandeur : un gérant qui renverrait `is_default` inchangé se ferait refuser
 * une modification réservée au propriétaire qu'il n'a pas faite.
 *
 * ⚠ LE REFUS DU SERVEUR S'ÉCRIT DANS LA BOÎTE, PAS DANS UN TOAST. Il nomme ce
 * qui bloque (« session de caisse ouverte sur Caisse 2 », « seul entrepôt actif
 * de Jean ») : quatre secondes de toast ne suffisent pas à le lire, et le
 * marchand doit pouvoir corriger sans retaper.
 */
import { useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, Loader2 } from "lucide-react";

import {
  createWarehouse,
  updateWarehouse,
  type CreateWarehouseData,
  type Warehouse,
} from "@/actions/stock.actions";
import { useOrganization } from "@/components/auth/organization-checker";
import { usePermissions } from "@/components/auth/permissions-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CHAMPS_ENTREPOT_DU_GERANT,
  CHAMPS_ENTREPOT_DU_PROPRIETAIRE,
  champsModifies,
} from "@/lib/stock/entrepots";

type Formulaire = Required<Pick<CreateWarehouseData, "name" | "code" | "address" | "is_default" | "is_active">>;

function depuis(entrepot: Warehouse | null): Formulaire {
  return {
    name: entrepot?.name ?? "",
    code: entrepot?.code ?? "",
    address: entrepot?.address ?? "",
    is_default: entrepot?.is_default ?? false,
    is_active: entrepot?.is_active ?? true,
  };
}

export function WarehouseFormDialog({
  entrepot,
  onClose,
  onSaved,
}: {
  /** `null` : création. */
  entrepot: Warehouse | null;
  onClose: () => void;
  /**
   * L'entrepôt tel que le serveur l'a écrit, ou `null` quand sa réponse n'a pas
   * d'identifiant (serveur antérieur) : l'appelant relit alors sa liste.
   */
  onSaved: (resultat: Warehouse | null, cree: boolean) => void;
}) {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { isRole, relireSiRefus } = usePermissions();

  // ⚠ Monté à l'ouverture (rendu conditionnel par l'appelant) : chaque
  // ouverture repart de l'entrepôt courant, sans effet de remise à zéro.
  const [avant] = useState<Formulaire>(() => depuis(entrepot));
  const [formulaire, setFormulaire] = useState<Formulaire>(() => depuis(entrepot));
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  const proprietaire = isRole("owner");
  const creation = entrepot === null;
  const champs = proprietaire ? CHAMPS_ENTREPOT_DU_PROPRIETAIRE : CHAMPS_ENTREPOT_DU_GERANT;
  const reserve = !proprietaire;

  const poser = (patch: Partial<Formulaire>) => {
    setRefus(null);
    setFormulaire((f) => ({ ...f, ...patch }));
  };

  const desactivation = !creation && avant.is_active && !formulaire.is_active;

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.accessToken || !organization?.id) return;
    setEnvoi(true);
    setRefus(null);
    try {
      if (entrepot === null) {
        const r = await createWarehouse(session.accessToken, organization.id, formulaire);
        if (!r.success) {
          relireSiRefus(r);
          setRefus(r.message || "La création a été refusée.");
          return;
        }
        onSaved(r.data?.id ? r.data : null, true);
        return;
      }

      const diff = champsModifies(avant, formulaire, champs);
      if (Object.keys(diff).length === 0) {
        onClose();
        return;
      }
      const r = await updateWarehouse(session.accessToken, organization.id, entrepot.id, diff);
      if (!r.success) {
        relireSiRefus(r);
        setRefus(r.message || "La modification a été refusée.");
        return;
      }
      onSaved(r.data?.id ? { ...entrepot, ...r.data } : { ...entrepot, ...diff }, false);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{creation ? "Nouvel entrepôt" : "Modifier l'entrepôt"}</DialogTitle>
          <DialogDescription>
            {creation
              ? "Créez un nouvel entrepôt pour stocker vos produits."
              : reserve
                ? "Vous pouvez modifier le nom et l'adresse. Le reste est réservé au propriétaire."
                : "Modifiez les informations de l'entrepôt."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={enregistrer} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entrepot-nom">Nom *</Label>
            <Input
              id="entrepot-nom"
              value={formulaire.name}
              onChange={(e) => poser({ name: e.target.value })}
              placeholder="Ex : Entrepôt principal"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entrepot-code">Code *</Label>
            <Input
              id="entrepot-code"
              value={formulaire.code}
              onChange={(e) => poser({ code: e.target.value.toUpperCase() })}
              placeholder="Ex : WH001"
              required
              disabled={reserve}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entrepot-adresse">Adresse</Label>
            <Textarea
              id="entrepot-adresse"
              value={formulaire.address}
              onChange={(e) => poser({ address: e.target.value })}
              placeholder="Adresse de l'entrepôt"
              rows={2}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="entrepot-principal">Entrepôt principal</Label>
                <p className="text-xs text-muted-foreground">
                  {formulaire.is_active
                    ? "Un seul par établissement : le désigner retire ce titre à l'actuel."
                    : "Un entrepôt désactivé ne peut pas être principal."}
                </p>
              </div>
              <Switch
                id="entrepot-principal"
                checked={formulaire.is_default}
                onCheckedChange={(v) => poser({ is_default: v })}
                // ⚠ Retirer le titre ne se fait pas d'ici : il passe à un autre
                // en désignant cet autre. Un établissement sans principal ne
                // saurait plus où ranger une vente sans entrepôt explicite.
                disabled={reserve || !formulaire.is_active || (!creation && avant.is_default)}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="entrepot-actif">Actif</Label>
                <p className="text-xs text-muted-foreground">
                  {formulaire.is_default
                    ? "L'entrepôt principal ne se désactive pas : désignez-en un autre d'abord."
                    : "Un entrepôt désactivé est fermé à toute opération, son historique reste lisible."}
                </p>
              </div>
              <Switch
                id="entrepot-actif"
                checked={formulaire.is_active}
                onCheckedChange={(v) => poser({ is_active: v })}
                disabled={reserve || formulaire.is_default}
              />
            </div>
          </div>

          {desactivation && (
            <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
              Les caisses rattachées à cet entrepôt seront désactivées avec lui. Une dette
              d&apos;une vente faite ici s&apos;encaisse toujours.
            </p>
          )}

          {refus && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{refus}</span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={envoi}>
              {envoi && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {creation ? "Créer" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
