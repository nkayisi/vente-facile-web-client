"use client";

/**
 * Réceptionner une commande : le camion arrive, on compte.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA RÉCEPTION EST PARTIELLE PAR DÉFAUT, ET C'EST LE CAS ORDINAIRE.       │
 * │                                                                          │
 * │ Chaque ligne s'ouvre PRÉREMPLIE au reste à recevoir - c'est ce qu'on     │
 * │ attend du fournisseur - et le magasinier n'a à toucher que ce qui        │
 * │ diffère. La réception partielle n'existait sur AUCUNE des deux surfaces  │
 * │ pour les transferts avant qu'on la livre, alors que le serveur           │
 * │ l'acceptait : le magasinier qui ne décharge qu'un casier sur deux ne     │
 * │ pouvait pas le dire.                                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ ZÉRO EST UNE VALEUR, « VIDE » N'EN EST PAS UNE. Un camion qui arrive sans
 * l'un des articles est un constat qui doit pouvoir s'écrire ; les confondre
 * ferait réceptionner la totalité de ce qui n'est jamais arrivé.
 *
 * ⚠ La réception naît en BROUILLON : ni le stock ni la dette ne bougent avant
 * sa validation, qui est un geste distinct et confirmé. Créer et valider d'un
 * même bouton ferait entrer du stock sur une faute de frappe.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/components/auth/organization-checker";
import { useSession } from "next-auth/react";
import { roundQuantity } from "@/lib/packaging";
import { jourISO, lireNombreRequis } from "@/lib/stock/nombres";
import {
  createGoodsReceipt,
  type CreateGoodsReceiptItemData,
  type PurchaseOrder,
} from "@/actions/purchases.actions";

type Saisie = {
  /** Quantité reçue, telle que tapée. Vide = la ligne n'est pas réceptionnée. */
  recue: string;
  /** Part refusée (casse, péremption). */
  refusee: string;
  /** Coût réellement facturé. Prérempli au prix commandé. */
  cout: string;
};

export function ReceiveGoodsDialog({
  open,
  onOpenChange,
  order,
  onDone,
}: {
  open: boolean;
  onOpenChange: (ouvert: boolean) => void;
  order: PurchaseOrder;
  onDone: (receiptId: string) => void;
}) {
  const { data: session } = useSession();
  const { organization } = useOrganization();

  const lignes = useMemo(
    () => (order.items ?? []).filter((l) => parseFloat(l.quantity_pending || "0") > 0),
    [order.items]
  );

  // ┌──────────────────────────────────────────────────────────────────────┐
  // │ L'ÉTAT NAÎT AVEC LE COMPOSANT, IL NE SE REMET PAS À ZÉRO.            │
  // │                                                                      │
  // │ L'appelant rend ce dialogue CONDITIONNELLEMENT : chaque ouverture est │
  // │ donc un montage, et le formulaire est vierge par construction. Un    │
  // │ effet de remise à zéro serait une seconde liste de champs à tenir en  │
  // │ phase avec la première - c'est l'arbitrage rendu sur les feuilles du  │
  // │ terminal, et il retire aussi le `setState` dans un effet que le lint  │
  // │ refuse à raison.                                                      │
  // └──────────────────────────────────────────────────────────────────────┘
  const [saisies, setSaisies] = useState<Record<string, Saisie>>(() => {
    const initial: Record<string, Saisie> = {};
    for (const l of order.items ?? []) {
      if (parseFloat(l.quantity_pending || "0") <= 0) continue;
      initial[l.id] = {
        recue: l.quantity_pending,
        refusee: "",
        cout: l.unit_price,
      };
    }
    return initial;
  });
  const [facture, setFacture] = useState("");
  const [bon, setBon] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => jourISO(new Date()));
  const [enCours, setEnCours] = useState(false);

  const poser = (id: string, champ: keyof Saisie, valeur: string) =>
    setSaisies((avant) => ({
      ...avant,
      [id]: { ...avant[id], [champ]: valeur },
    }));

  /** Les refus par ligne, et le corps à envoyer. */
  const { refus, corps } = useMemo(() => {
    const refus: Record<string, string> = {};
    const corps: CreateGoodsReceiptItemData[] = [];

    for (const l of lignes) {
      const s = saisies[l.id];
      if (!s) continue;
      // Vide : la ligne n'entre pas dans cette réception. Ce n'est pas un
      // refus, c'est un choix - on ne reçoit pas tout d'un coup.
      if (s.recue.trim() === "") continue;

      // ⚠ `lireNombreRequis` et non `lireNombre` : le vide a déjà été écarté
      // juste au-dessus, et il veut dire « pas dans cette livraison ». Ici une
      // chaîne non vide DOIT valoir un nombre.
      const recue = lireNombreRequis(s.recue);
      if (!recue.ok) {
        refus[l.id] = recue.phrase;
        continue;
      }
      const attendue = parseFloat(l.quantity_pending || "0");
      if (recue.valeur > attendue) {
        refus[l.id] =
          `Au plus ${l.quantity_pending}, ce qui reste à recevoir sur cette ligne.`;
        continue;
      }

      // Refusé et prix facturé sont FACULTATIFS : vide vaut zéro pour le
      // premier, et le prix commandé pour le second.
      let refusee = 0;
      if (s.refusee.trim() !== "") {
        const lu = lireNombreRequis(s.refusee);
        if (!lu.ok) {
          refus[l.id] = lu.phrase;
          continue;
        }
        refusee = lu.valeur;
      }
      if (refusee > recue.valeur) {
        refus[l.id] = "On ne peut pas refuser plus qu'on n'a reçu.";
        continue;
      }

      let cout = parseFloat(l.unit_price || "0");
      if (s.cout.trim() !== "") {
        const lu = lireNombreRequis(s.cout);
        if (!lu.ok) {
          refus[l.id] = lu.phrase;
          continue;
        }
        cout = lu.valeur;
      }

      corps.push({
        purchase_order_item: l.id,
        product: l.product,
        // ⚠ TOUTE QUANTITÉ ENVOYÉE SE QUANTISE, Y COMPRIS UNE DIFFÉRENCE.
        // `1,1 - 0,9` vaut `0.20000000000000007` en flottant : le serveur
        // borne ces champs à TROIS décimales (`DecimalField(15, 3)`) et
        // répondait 400 `max_decimal_places`, sur une saisie parfaitement
        // légitime et avec un message que le magasinier ne peut pas relier à
        // ce qu'il a tapé. C'est la règle que `roundQuantity` porte depuis que
        // les quantités se vendent au poids.
        quantity_received: String(roundQuantity(recue.valeur)),
        // ⚠ L'ACCEPTÉ pilote le stock, le coût moyen pondéré et la dette : le
        // refusé reste constaté mais n'entre nulle part.
        quantity_accepted: String(roundQuantity(recue.valeur - refusee)),
        quantity_rejected: String(roundQuantity(refusee)),
        unit_cost: String(cout),
        packaging_factor: l.packaging_factor ?? undefined,
      });
    }
    return { refus, corps };
  }, [lignes, saisies]);

  const bloque =
    Object.keys(refus).length > 0 || corps.length === 0 || !order.warehouse;

  const enregistrer = async () => {
    if (!session?.accessToken || !organization || bloque) return;
    setEnCours(true);
    const r = await createGoodsReceipt(session.accessToken, organization.id, {
      purchase_order: order.id,
      warehouse: order.warehouse!,
      receipt_date: date,
      supplier_invoice: facture.trim(),
      supplier_delivery_note: bon.trim(),
      notes: notes.trim(),
      items: corps,
    });
    setEnCours(false);
    if (r.success && r.data) {
      toast.success(`Réception ${r.data.reference} enregistrée en brouillon`);
      onDone(r.data.id);
    } else {
      toast.error(r.message ?? "La réception n'a pas pu être enregistrée");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Réceptionner {order.reference}</DialogTitle>
          <DialogDescription>
            La réception naît en brouillon : rien n&apos;entre en rayon avant que
            vous ne la validiez.
          </DialogDescription>
        </DialogHeader>

        {!order.warehouse ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
            <p className="font-medium">Cette commande n&apos;a pas d&apos;entrepôt.</p>
            <p className="text-muted-foreground">
              Une réception entre du stock quelque part : indiquez l&apos;entrepôt
              sur la commande avant de réceptionner.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="receipt-date">Date de réception</Label>
                <Input
                  id="receipt-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receipt-invoice">N° de facture fournisseur</Label>
                <Input
                  id="receipt-invoice"
                  value={facture}
                  onChange={(e) => setFacture(e.target.value)}
                  placeholder="Optionnel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receipt-note">N° de bon de livraison</Label>
                <Input
                  id="receipt-note"
                  value={bon}
                  onChange={(e) => setBon(e.target.value)}
                  placeholder="Optionnel"
                />
              </div>
            </div>

            <div className="space-y-3">
              {lignes.map((l) => (
                <div key={l.id} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{l.product_name}</span>
                    <span className="text-sm text-muted-foreground">
                      Reste à recevoir : {l.quantity_pending}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`recue-${l.id}`}>Reçu</Label>
                      <Input
                        id={`recue-${l.id}`}
                        inputMode="decimal"
                        value={saisies[l.id]?.recue ?? ""}
                        onChange={(e) => poser(l.id, "recue", e.target.value)}
                        placeholder="Vide = pas dans cette livraison"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`refusee-${l.id}`}>Refusé</Label>
                      <Input
                        id={`refusee-${l.id}`}
                        inputMode="decimal"
                        value={saisies[l.id]?.refusee ?? ""}
                        onChange={(e) => poser(l.id, "refusee", e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`cout-${l.id}`}>Prix facturé</Label>
                      <Input
                        id={`cout-${l.id}`}
                        inputMode="decimal"
                        value={saisies[l.id]?.cout ?? ""}
                        onChange={(e) => poser(l.id, "cout", e.target.value)}
                      />
                    </div>
                  </div>
                  {refus[l.id] && (
                    <p className="mt-2 text-sm text-destructive">{refus[l.id]}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="receipt-notes">Notes</Label>
              <Textarea
                id="receipt-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Ce qui mérite d'être noté sur cette livraison"
              />
            </div>

            {corps.length === 0 && Object.keys(refus).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Indiquez ce que vous avez reçu sur au moins une ligne.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={enregistrer} disabled={bloque || enCours}>
            {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer la réception
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
