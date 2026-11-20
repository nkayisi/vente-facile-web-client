"use client";

/**
 * Corriger le solde d'un client, sur décision humaine.
 *
 * Ce n'est PAS un encaissement : c'est une correction d'écriture, et elle a ses
 * propres conséquences, dites AVANT de valider.
 *
 * ⚠ RÉDUIRE UNE DETTE FAIT ENTRER L'ARGENT AU TIROIR (`adjust_customer_balance`
 *   inscrit un mouvement de caisse) : réduire une dette sans contrepartie ferait
 *   sortir la somme des comptes sans que personne ne l'ait reçue. Le marchand
 *   qui « efface » une dette perdue doit le savoir : son tiroir comptera ce
 *   montant au Z du soir.
 *
 * ⚠ LE SIGNE VIENT DU SENS CHOISI, jamais de la saisie (`montantAjustement`).
 * ⚠ LE MOTIF EST OBLIGATOIRE : un ajustement sans motif est une écriture dont
 *   plus personne ne saura l'origine. Le serveur le refuse aussi.
 */
import { chromeDeSecours } from "@/lib/receipt/chrome";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Scale } from "lucide-react";
import { toast } from "sonner";

import { adjustCustomerBalance, type Customer } from "@/actions/contacts.actions";
import { useOrganization } from "@/components/auth/organization-checker";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useReceiptPrinter } from "@/hooks/use-receipt-printer";
import { montantAjustement } from "@/lib/contacts/imputation";
import type { MoneyHelpers } from "@/lib/currency";
import { buildPaymentReceipt, type PaperWidth, type ReceiptChrome } from "@/lib/receipt";
import { lireNombre, phraseDeRefus } from "@/lib/stock/nombres";

type Sens = "augmenter" | "reduire";

export function CustomerAdjustDialog({
  open,
  onOpenChange,
  customer,
  money,
  chrome,
  paperWidth,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer;
  money: MoneyHelpers;
  chrome: ReceiptChrome | null;
  paperWidth: PaperWidth;
  onDone: () => void;
}) {
  const { data: session } = useSession();
  const { organization } = useOrganization();
  const printer = useReceiptPrinter();

  const currencies = [
    money.primaryCode,
    ...money.currencies.filter((c) => c.is_active && c.currency_code !== money.primaryCode).map((c) => c.currency_code),
  ];
  // La devise de départ est celle où le client DOIT : une ligne en avance
  // (solde négatif) n'est pas ce qu'on vient corriger le plus souvent.
  const premiereDette =
    customer.balances?.find((b) => parseFloat(b.amount) > 0)?.currency ??
    customer.balances?.find((b) => parseFloat(b.amount) !== 0)?.currency;

  const [sens, setSens] = useState<Sens>("reduire");
  const [saisie, setSaisie] = useState("");
  const [devise, setDevise] = useState(premiereDette || money.primaryCode);
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const lu = lireNombre(saisie);
  const saisi = lu.ok && lu.valeur !== null ? lu.valeur : 0;
  const signe = montantAjustement(sens, saisi);
  const avant = parseFloat(customer.balances?.find((b) => b.currency === devise)?.amount ?? "0") || 0;
  const apres = avant + signe;

  const motifMontant = !lu.ok ? phraseDeRefus(lu.motif) : null;
  const bloque = envoi || saisi <= 0 || !!motifMontant || !motif.trim();

  /** Un solde se lit « doit X », « avance X » ou « rien » : jamais un signe nu. */
  const lire = (v: number) =>
    v > 0.005 ? `doit ${money.money(v, devise)}` : v < -0.005 ? `avance de ${money.money(-v, devise)}` : "rien";

  const valider = async () => {
    const jeton = session?.accessToken;
    if (bloque || !jeton || !organization) return;
    const job = printer.begin();
    setEnvoi(true);
    try {
      const montant = Math.round(signe * 100) / 100;
      const r = await adjustCustomerBalance(jeton, organization.id, customer.id, {
        amount: montant,
        currency: devise,
        notes: motif.trim(),
      });
      if (!r.success || !r.data) {
        job.abort();
        toast.error(r.message || "L'ajustement n'a pas pu être enregistré");
        return;
      }
      const d = r.data;
      job.present(
        buildPaymentReceipt({
          kind: "adjustment",
          chrome: chrome ?? chromeDeSecours(organization.name),
          number: d.receipt_number,
          date: new Date().toLocaleString("fr-CD"),
          customerName: customer.name,
          customerPhone: customer.phone || undefined,
          amountPaid: Math.abs(montant),
          currency: devise,
          notes: motif.trim(),
          debt: {
            before: parseFloat(d.balance_before) || 0,
            after: parseFloat(d.balance_after) || 0,
            currency: d.currency || devise,
          },
        }),
        {
          filename: `ajustement-${d.receipt_number}.pdf`,
          paperWidth,
          successMessage: `Pièce ${d.receipt_number} : solde ajusté`,
        }
      );
      onOpenChange(false);
      onDone();
    } catch {
      job.abort();
      toast.error("L'ajustement n'a pas pu être enregistré");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !envoi && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-orange-500" />
            Ajuster le solde
          </DialogTitle>
          <DialogDescription>
            Une correction d&apos;écriture, pas un encaissement. Pour de l&apos;argent remis par le client, utilisez
            « Encaisser ».
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sens de l'ajustement">
            {(
              [
                ["reduire", "Réduire la dette"],
                ["augmenter", "Augmenter la dette"],
              ] as const
            ).map(([valeur, libelle]) => (
              <button
                key={valeur}
                type="button"
                role="radio"
                aria-checked={sens === valeur}
                onClick={() => setSens(valeur)}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  sens === valeur
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                {libelle}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="aju-montant">Montant</Label>
              <Input
                id="aju-montant"
                inputMode="decimal"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                aria-invalid={!!motifMontant}
              />
              {motifMontant && <p className="text-xs text-destructive">{motifMontant}</p>}
            </div>
            {currencies.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="aju-devise">Devise</Label>
                <Select value={devise} onValueChange={setDevise}>
                  <SelectTrigger id="aju-devise" className="w-full sm:w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="aju-motif">Motif *</Label>
            <Textarea
              id="aju-motif"
              rows={2}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ce qui justifie la correction"
            />
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p>
              En {devise}, le client {lire(avant)}
              {saisi > 0 ? <>, puis {lire(apres)}.</> : "."}
            </p>
            {sens === "reduire" && saisi > 0 && (
              <p className="mt-2 font-medium text-warning">
                {money.money(saisi, devise)} {saisi >= 2 ? "entreront" : "entrera"} au tiroir : la caisse{" "}
                {saisi >= 2 ? "les" : "le"} comptera au Z du soir.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={envoi}>
            Annuler
          </Button>
          <Button onClick={valider} disabled={bloque}>
            {envoi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enregistrer l&apos;ajustement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
