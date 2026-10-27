"use client";

/**
 * Enregistrer un règlement fournisseur, depuis la commande qu'il solde.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ L'IMPUTATION EST ANNONCÉE AVANT D'ÊTRE FAITE.                            │
 * │                                                                          │
 * │ Un règlement sans imputation fait baisser le solde du fournisseur        │
 * │ pendant que chaque `amount_due` reste intact : la somme des commandes    │
 * │ dues ne correspond plus au solde qu'elle résume, et le marchand ne peut  │
 * │ plus savoir laquelle il a payée. Le côté client a payé exactement cela - │
 * │ `record-advance` a été rendu alias de `record-payment` pour cette raison.│
 * │                                                                          │
 * │ Ici l'imputation est EXPLICITE, sur la commande ouverte : c'est de sa    │
 * │ fiche qu'on vient. Le serveur sait aussi imputer tout seul, de la plus   │
 * │ ancienne à la plus récente, mais l'écran n'a pas à le laisser devenir    │
 * │ une surprise.                                                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠ UN SURPAIEMENT EST LÉGITIME et rend le solde négatif : c'est un acompte,
 * qu'une réception future consommera. On ne le borne donc pas - payer d'avance
 * un fournisseur est un geste ordinaire - mais l'écran DIT ce qui dépasse.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/components/auth/organization-checker";
import { useCurrency } from "@/components/providers/currency-provider";
import { createMoneyHelpers } from "@/lib/currency";
import { jourISO, lireNombreRequis } from "@/lib/stock/nombres";
import {
  createSupplierPayment,
  type PurchaseOrder,
} from "@/actions/purchases.actions";
import { getPaymentMethods, type PaymentMethod } from "@/actions/sales.actions";
import {
  getOrganizationCurrencies,
  type OrganizationCurrency,
} from "@/actions/settings.actions";

export function SupplierPaymentDialog({
  open,
  onOpenChange,
  order,
  onDone,
}: {
  open: boolean;
  onOpenChange: (ouvert: boolean) => void;
  order: PurchaseOrder;
  onDone: () => void;
}) {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const { currency: defaultCurrency } = useCurrency();

  const [devises, setDevises] = useState<OrganizationCurrency[]>([]);
  const money = useMemo(
    () => createMoneyHelpers(devises, defaultCurrency),
    [devises, defaultCurrency]
  );

  const [moyens, setMoyens] = useState<PaymentMethod[]>([]);
  // L'état naît avec le composant - l'appelant le rend conditionnellement -
  // donc le montant s'ouvre PRÉREMPLI au reste dû sans aucun effet de remise à
  // zéro. C'est le règlement le plus fréquent : un seul bouton à presser.
  const [montant, setMontant] = useState(() => order.amount_due || "");
  const [moyen, setMoyen] = useState<string>("");
  const [piece, setPiece] = useState("");
  const [date, setDate] = useState(() => jourISO(new Date()));
  const [notes, setNotes] = useState("");
  const [enCours, setEnCours] = useState(false);

  const du = parseFloat(order.amount_due || "0");

  const jeton = session?.accessToken;

  useEffect(() => {
    if (!jeton || !organization) return;
    getPaymentMethods(jeton, organization.id).then((r) => {
      if (r.success && r.data) setMoyens(r.data.filter((m) => m.is_active));
    });
    getOrganizationCurrencies(jeton, organization.id).then((r) => {
      if (r.success && r.data) setDevises(r.data);
    });
  }, [jeton, organization]);

  const lu = useMemo(() => lireNombreRequis(montant), [montant]);
  const valeur = lu.ok ? lu.valeur : 0;
  const excedent = valeur - du;

  const enregistrer = async () => {
    if (!jeton || !organization || !lu.ok || valeur <= 0) return;
    setEnCours(true);
    const r = await createSupplierPayment(jeton, organization.id, {
      supplier: order.supplier,
      amount: String(valeur),
      // ⚠ La devise est celle de la COMMANDE, pas celle du contexte : un
      // règlement imputé sur une facture en dollars se tient en dollars, et
      // c'est son taux figé qui ramène le montant en principale.
      currency: order.currency,
      exchange_rate: order.exchange_rate,
      payment_method: moyen || null,
      payment_reference: piece.trim(),
      payment_date: date,
      notes: notes.trim(),
      // L'imputation explicite sur la commande dont on vient, bornée au reste
      // dû : le dépassement devient un acompte, que le serveur impute seul.
      allocations:
        du > 0
          ? [{ purchase_order: order.id, amount: String(Math.min(valeur, du)) }]
          : [],
    });
    setEnCours(false);
    if (r.success) {
      toast.success(`Règlement ${r.data?.reference ?? ""} enregistré`.trim());
      onDone();
    } else {
      toast.error(r.message ?? "Le règlement n'a pas pu être enregistré");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Régler {order.reference}</DialogTitle>
          <DialogDescription>
            {order.supplier_name} · reste dû{" "}
            {money.money(du, order.currency)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">
              Montant ({order.currency}) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pay-amount"
              inputMode="decimal"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
            />
            {!lu.ok && montant.trim() !== "" && (
              <p className="text-sm text-destructive">{lu.phrase}</p>
            )}
            {/* L'écart est DIT, jamais corrigé en silence. */}
            {lu.ok && excedent > 0 && (
              <p className="text-sm text-muted-foreground">
                {money.money(excedent, order.currency)} dépassent le reste dû :
                ils deviendront un acompte chez ce fournisseur.
              </p>
            )}
            {lu.ok && valeur > 0 && excedent < 0 && (
              <p className="text-sm text-muted-foreground">
                Il restera {money.money(-excedent, order.currency)} à payer sur
                cette commande.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Date</Label>
              <Input
                id="pay-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-method">Moyen de paiement</Label>
              <Select value={moyen} onValueChange={setMoyen}>
                <SelectTrigger id="pay-method">
                  <SelectValue placeholder="Non précisé" />
                </SelectTrigger>
                <SelectContent>
                  {moyens.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">Référence de la pièce</Label>
            <Input
              id="pay-ref"
              value={piece}
              onChange={(e) => setPiece(e.target.value)}
              placeholder="N° de chèque, de transaction mobile money…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-notes">Notes</Label>
            <Textarea
              id="pay-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            L&apos;argent sort du tiroir : un mouvement de caisse est enregistré
            dans la devise réellement décaissée.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={enregistrer}
            disabled={enCours || !lu.ok || valeur <= 0}
          >
            {enCours && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer le règlement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
