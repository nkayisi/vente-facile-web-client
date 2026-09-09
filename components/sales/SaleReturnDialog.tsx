"use client";

/**
 * Enregistrer un retour, DEPUIS SA VENTE.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ UN RETOUR SE CRÉE DEPUIS SA VENTE, JAMAIS D'UNE LISTE VIDE.             │
 * │                                                                          │
 * │ Il faut savoir CE QUI est rendu et à quel prix cela avait été vendu :    │
 * │ chaque ligne DÉSIGNE une ligne de facture (`original_item`). Sans ce     │
 * │ lien, le serveur ne sait ni quoi remettre en stock ni combien            │
 * │ rembourser, et il refuse.                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * **Le retour naît en BROUILLON.** Ni le stock ni la caisse ne bougent avant
 * l'approbation, qui est un geste distinct et confirmé sur la fiche du retour.
 *
 * **« Remettre en stock » est coché par défaut, et se décoche.** Un retour rend
 * la marchandise ; l'article cassé ou périmé est le cas particulier.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LE PLAFOND EST CE QUI RESTE À RENDRE, PAS CE QUI A ÉTÉ VENDU.           │
 * │                                                                          │
 * │ Sans cette borne, la même marchandise se rend deux fois : elle revient   │
 * │ deux fois en stock et se rembourse deux fois. Le reste vient du SERVEUR  │
 * │ (`returnable_quantity`), qui applique la même règle au refus - l'écran   │
 * │ et le contrôle ne peuvent donc pas diverger.                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { createSaleReturn, type Sale, type SaleItem } from "@/actions/sales.actions";

interface LigneSaisie {
  quantite: string;
  remisEnStock: boolean;
}

/** Ce qu'il reste à rendre sur une ligne, ou la quantité vendue à défaut. */
function resteARendre(item: SaleItem): number {
  const reste = parseFloat(item.returnable_quantity ?? "");
  if (Number.isFinite(reste)) return reste;
  // Repli : un serveur plus ancien n'expose pas le champ. On ne desserre pas
  // la borne au-delà du vendu, et c'est lui qui tranchera de toute façon.
  return parseFloat(item.quantity || "0") || 0;
}

export function SaleReturnDialog({
  sale,
  open,
  onOpenChange,
  onCreated,
  accessToken,
  organizationId,
}: {
  sale: Sale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Le retour est créé : à l'appelant d'ouvrir sa fiche. */
  onCreated: (returnId: string) => void;
  accessToken: string;
  organizationId: string;
}) {
  const [lignes, setLignes] = useState<Record<string, LigneSaisie>>({});
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);

  // Mémoïsé : `sale.items ?? []` fabrique un tableau NEUF à chaque rendu, ce
  // qui réveille les `useMemo` qui en dépendent à chaque frappe.
  const items = useMemo(() => sale.items ?? [], [sale.items]);
  const rendables = useMemo(
    () => items.filter((i) => resteARendre(i) > 0),
    [items]
  );

  const saisies = useMemo(
    () =>
      Object.entries(lignes)
        .map(([id, l]) => ({ id, quantite: parseFloat(l.quantite || "0") || 0, restock: l.remisEnStock }))
        .filter((l) => l.quantite > 0),
    [lignes]
  );

  /** « Remettre en stock » est coché par défaut : rendre la marchandise est
   *  le cas ordinaire, l'article cassé le cas particulier. */
  const LIGNE_NEUVE: LigneSaisie = { quantite: "", remisEnStock: true };

  const majLigne = (id: string, patch: Partial<LigneSaisie>) =>
    setLignes((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? LIGNE_NEUVE), ...patch },
    }));

  const enregistrer = async () => {
    if (saisies.length === 0) return;
    setEnCours(true);
    const reponse = await createSaleReturn(accessToken, organizationId, {
      original_sale: sale.id,
      // `partial` dès qu'une ligne n'est pas rendue en entier : c'est le cas
      // ordinaire, et le serveur recalcule les montants de toute façon.
      return_type:
        saisies.length === rendables.length &&
        saisies.every((l) => {
          const item = items.find((i) => i.id === l.id);
          return item ? l.quantite >= resteARendre(item) : false;
        })
          ? "full"
          : "partial",
      reason: motif.trim(),
      items: saisies.map((l) => ({
        original_item: l.id,
        quantity: l.quantite,
        restock: l.restock,
      })),
    });
    setEnCours(false);

    if (reponse.success && reponse.data) {
      toast.success("Retour enregistré en brouillon");
      setLignes({});
      setMotif("");
      onOpenChange(false);
      onCreated(reponse.data.id);
    } else {
      toast.error(reponse.message || "Le retour n'a pas pu être enregistré");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Retour d&apos;articles - {sale.reference}</DialogTitle>
          <DialogDescription>
            Le retour est enregistré en <strong>brouillon</strong> : ni le stock
            ni la caisse ne bougent avant son approbation.
          </DialogDescription>
        </DialogHeader>

        {rendables.length === 0 ? (
          // Ouvrir un formulaire dont tous les champs seraient plafonnés à zéro
          // laisserait croire à une panne.
          <p className="py-6 text-center text-sm text-muted-foreground">
            Tous les articles de cette vente ont déjà été rendus.
          </p>
        ) : (
          <div className="space-y-4">
            {rendables.map((item) => {
              const reste = resteARendre(item);
              const deja = parseFloat(item.returned_quantity ?? "0") || 0;
              const ligne = lignes[item.id];
              const saisi = parseFloat(ligne?.quantite || "0") || 0;
              const trop = saisi > reste;

              return (
                <div key={item.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity_display || item.quantity} vendus
                        {deja > 0 && (
                          <> · {deja} déjà rendu{deja > 1 ? "s" : ""}</>
                        )}
                      </p>
                    </div>
                    <Badge variant="outline">Reste {reste} à rendre</Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end gap-4">
                    <div className="space-y-1">
                      <Label htmlFor={`qte-${item.id}`} className="text-xs">
                        Quantité rendue
                      </Label>
                      <Input
                        id={`qte-${item.id}`}
                        type="number"
                        min="0"
                        max={reste}
                        step="any"
                        className={`w-28 ${trop ? "border-destructive" : ""}`}
                        placeholder="0"
                        value={ligne?.quantite ?? ""}
                        onChange={(e) => majLigne(item.id, { quantite: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center gap-2 pb-2">
                      <Switch
                        id={`stock-${item.id}`}
                        checked={ligne?.remisEnStock ?? true}
                        onCheckedChange={(v) => majLigne(item.id, { remisEnStock: v })}
                      />
                      <Label htmlFor={`stock-${item.id}`} className="text-sm font-normal">
                        Remettre en stock
                      </Label>
                    </div>
                  </div>

                  {trop && (
                    <p className="mt-2 text-xs text-destructive">
                      Au plus {reste}, ce qui reste à rendre sur cette ligne.
                    </p>
                  )}
                </div>
              );
            })}

            <div className="space-y-1">
              <Label htmlFor="motif-retour">Motif du retour</Label>
              <Textarea
                id="motif-retour"
                placeholder="Article défectueux, erreur de commande…"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enCours}>
            Annuler
          </Button>
          <Button
            onClick={enregistrer}
            disabled={
              enCours ||
              saisies.length === 0 ||
              saisies.some((l) => {
                const item = items.find((i) => i.id === l.id);
                return item ? l.quantite > resteARendre(item) : true;
              })
            }
          >
            {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer le retour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
